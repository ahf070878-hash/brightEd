import AdmZip from "adm-zip";
import {
  ContentType,
  Prisma,
  ScormStatus,
  User,
  UserRole,
} from "@prisma/client";
import { Router } from "express";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import multer from "multer";
import jwt from "jsonwebtoken";

import { getLearningAccess } from "../lib/access";
import { recordActivity } from "../lib/activity-log";
import { fail, getRequiredParam, ok } from "../lib/http";
import { prisma } from "../lib/prisma";
import {
  enforceDataScope,
  requireRoles,
  ScopedRequest,
} from "../middlewares/rbac.middleware";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 250 * 1024 * 1024,
    files: 1,
  },
});

const storageRoot = path.resolve(process.cwd(), "storage", "scorm");

type ManifestMetadata = {
  manifestPath: string;
  version: string;
  launchFile?: string;
};

const scormPackageInclude = {
  lesson: {
    select: {
      id: true,
      judul: true,
      tipe_konten: true,
      course: {
        select: {
          id: true,
          judul: true,
          skillhub_id: true,
          skillhub: {
            select: {
              id: true,
              nama: true,
              status: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.ScormPackageInclude;

function normalizeZipPath(value: string) {
  return value.replace(/\\/g, "/").replace(/^\/+/, "");
}

function parseManifest(zip: AdmZip): ManifestMetadata | undefined {
  const manifestEntry = zip
    .getEntries()
    .find((entry) => normalizeZipPath(entry.entryName).endsWith("imsmanifest.xml"));

  if (!manifestEntry) {
    return undefined;
  }

  const manifestXml = manifestEntry.getData().toString("utf8");
  const versionMatch = manifestXml.match(
    /<schemaversion>\s*([^<]+?)\s*<\/schemaversion>/i,
  );
  const hrefMatch =
    manifestXml.match(
      /<resource\b[^>]*\badlcp:scormType=["']sco["'][^>]*\bhref=["']([^"']+)["']/i,
    ) ??
    manifestXml.match(
      /<resource\b[^>]*\bhref=["']([^"']+)["'][^>]*\badlcp:scormType=["']sco["']/i,
    ) ??
    manifestXml.match(/<resource\b[^>]*\bhref=["']([^"']+)["']/i);

  return {
    manifestPath: normalizeZipPath(manifestEntry.entryName),
    version: (versionMatch?.[1]?.trim() || "1.2").slice(0, 50),
    launchFile: hrefMatch?.[1] ? normalizeZipPath(hrefMatch[1]) : undefined,
  };
}

async function parseManifestFromDirectory(
  packageDirectory: string,
): Promise<ManifestMetadata> {
  const manifestPath = path.join(packageDirectory, "imsmanifest.xml");
  const manifestXml = await readFile(manifestPath, "utf8");
  const versionMatch = manifestXml.match(
    /<schemaversion>\s*([^<]+?)\s*<\/schemaversion>/i,
  );
  const hrefMatch =
    manifestXml.match(
      /<resource\b[^>]*\badlcp:scormType=["']sco["'][^>]*\bhref=["']([^"']+)["']/i,
    ) ??
    manifestXml.match(
      /<resource\b[^>]*\bhref=["']([^"']+)["'][^>]*\badlcp:scormType=["']sco["']/i,
    ) ??
    manifestXml.match(/<resource\b[^>]*\bhref=["']([^"']+)["']/i);

  return {
    manifestPath: "imsmanifest.xml",
    version: (versionMatch?.[1]?.trim() || "1.2").slice(0, 50),
    launchFile: hrefMatch?.[1] ? normalizeZipPath(hrefMatch[1]) : "index.html",
  };
}

async function extractZipSafely(zip: AdmZip, targetDirectory: string) {
  await mkdir(targetDirectory, { recursive: true });

  for (const entry of zip.getEntries()) {
    const normalizedName = normalizeZipPath(entry.entryName);

    if (
      !normalizedName ||
      normalizedName.includes("../") ||
      path.isAbsolute(normalizedName)
    ) {
      throw new Error("Unsafe ZIP entry path.");
    }

    const destination = path.resolve(targetDirectory, normalizedName);

    if (!destination.startsWith(targetDirectory + path.sep)) {
      throw new Error("Unsafe ZIP entry path.");
    }

    if (entry.isDirectory) {
      await mkdir(destination, { recursive: true });
      continue;
    }

    await mkdir(path.dirname(destination), { recursive: true });
    zip.extractEntryTo(entry, path.dirname(destination), false, true);
  }
}

function parseScormStatus(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  return Object.values(ScormStatus).includes(value as ScormStatus)
    ? (value as ScormStatus)
    : undefined;
}

type ParticipantPackageResult =
  | { error: string }
  | {
      scormPackage: Prisma.ScormPackageGetPayload<{
        include: {
          lesson: {
            include: {
              course: {
                include: {
                  skillhub: true;
                };
              };
            };
          };
        };
      }>;
      user: User;
    };

async function getPackageForParticipant(
  scormPackageId: string,
  userId: string,
): Promise<ParticipantPackageResult> {
  const scormPackage = await prisma.scormPackage.findUnique({
    where: { id: scormPackageId },
    include: {
      lesson: {
        include: {
          course: {
            include: {
              skillhub: true,
            },
          },
        },
      },
    },
  });

  if (!scormPackage) {
    return { error: "SCORM package not found." as const };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return { error: "User not found." as const };
  }

  const access = getLearningAccess(user);

  if (!access.canAccessLearningMaterial) {
    return { error: "Learning material access has expired." as const };
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: {
      user_id_skillhub_id: {
        user_id: userId,
        skillhub_id: scormPackage.lesson.course.skillhub_id,
      },
    },
  });

  if (!enrollment) {
    return { error: "User is not enrolled to this SkillHub." as const };
  }

  return { scormPackage, user };
}

// Simple material creation keeps the existing lesson/package access and progress model.
router.post("/skillhubs/:skillhub_id/materials", requireRoles([UserRole.admin]),
  (req, res, next) => upload.single("file")(req, res, (error) => error ? fail(res, 400, "Upload failed. Maximum file size is 250 MB.") : next()),
  async (req: ScopedRequest, res) => {
    const hubId = getRequiredParam(req.params, "skillhub_id");
    const title = typeof req.body.judul === "string" ? req.body.judul.trim() : "";
    const type = req.body.tipe_konten as ContentType;
    const file = req.file;
    const extensions: Record<string, string[]> = { scorm: [".zip"], pdf: [".pdf"], video: [".mp4", ".webm"], article: [".txt"] };
    const ext = path.extname(file?.originalname ?? "").toLowerCase();
    if (!title || title.length > 255 || !file?.size || !extensions[type]?.includes(ext)) return fail(res, 400, "Enter a title and select a valid material file.");
    if (!hubId || !await prisma.skillHub.findUnique({ where: { id: hubId } })) return fail(res, 404, "SkillHub not found.");
    const directory = path.join(storageRoot, randomUUID());
    let version = "1.2";
    try {
      await mkdir(directory, { recursive: true });
      if (type === ContentType.scorm) {
        const zip = new AdmZip(file.buffer);
        if (zip.getEntries().reduce((sum, entry) => sum + entry.header.size, 0) > 1024 * 1024 * 1024) throw new Error("Uncompressed package exceeds 1 GB.");
        const manifest = parseManifest(zip);
        if (!manifest?.launchFile) throw new Error("A SCORM ZIP must contain imsmanifest.xml and a launch file.");
        await extractZipSafely(zip, directory);
        const launch = path.posix.join(path.posix.dirname(manifest.manifestPath), manifest.launchFile);
        const resolved = path.resolve(directory, launch);
        if (!resolved.startsWith(directory + path.sep) || !existsSync(resolved)) throw new Error("SCORM launch file not found.");
        version = manifest.version;
        const xmlEscape = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
        // Normalize the entry point for packages with a nested manifest.
        if (manifest.manifestPath !== "imsmanifest.xml") await writeFile(path.join(directory, "imsmanifest.xml"), `<manifest><metadata><schemaversion>${xmlEscape(version)}</schemaversion></metadata><resources><resource href="${xmlEscape(launch)}" /></resources></manifest>`);
      } else {
        if (type === ContentType.pdf && file.buffer.subarray(0, 5).toString() !== "%PDF-") throw new Error("Please select a valid PDF file.");
        if (type === ContentType.video && !(ext === ".mp4" ? file.buffer.subarray(4, 8).toString() === "ftyp" : file.buffer.subarray(0, 4).toString("hex") === "1a45dfa3")) throw new Error("Please select a valid MP4 or WebM video.");
        const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        let body: string;
        if (type === ContentType.article) {
          if (file.size > 5 * 1024 * 1024 || file.buffer.includes(0)) throw new Error("Please select a UTF-8 text file up to 5 MB.");
          body = `<article><h1>${escape(title)}</h1><pre>${escape(new TextDecoder("utf-8", { fatal: true }).decode(file.buffer))}</pre></article>`;
        } else {
          await writeFile(path.join(directory, `material${ext}`), file.buffer);
          body = type === ContentType.video ? '<video controls playsinline></video>' : '<iframe title="PDF"></iframe>';
          body += `<p><a target="_blank" rel="noopener">Open / download</a></p><script>const u=new URL("material${ext}",location.href);u.search=location.search;document.querySelector("video,iframe").src=u.href;document.querySelector("a").href=u.href;</script>`;
        }
        await writeFile(path.join(directory, "index.html"), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}</title><style>body{margin:0;background:#faf9f6;color:#232723;font:17px/1.7 system-ui}article{max-width:760px;margin:auto;padding:32px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}video,iframe{display:block;width:100%;height:85vh;border:0}p{padding:0 20px}</style></head><body>${body}</body></html>`);
        await writeFile(path.join(directory, "imsmanifest.xml"), '<manifest><resources><resource href="index.html" /></resources></manifest>');
      }
    } catch (error) {
      await rm(directory, { recursive: true, force: true });
      return fail(res, 400, error instanceof Error ? error.message : "Invalid material file.");
    }
    try {
      const lesson = await prisma.$transaction(async (tx) => {
        let course = await tx.course.findFirst({ where: { skillhub_id: hubId }, orderBy: { urutan: "asc" } });
        if (!course) course = await tx.course.create({ data: { skillhub_id: hubId, judul: "Learning materials", urutan: 1 } });
        const last = await tx.lesson.aggregate({ where: { course_id: course.id }, _max: { urutan: true } });
        return tx.lesson.create({ data: { course_id: course.id, judul: title, tipe_konten: type, urutan: (last._max.urutan ?? 0) + 1, scorm_package: { create: { file_path: directory, versi_manifest: version } } }, include: { scorm_package: true } });
      });
      await recordActivity(req, { action: "material.create", entityType: "lesson", entityId: lesson.id, description: `Added material: ${title}` });
      return ok(res, lesson, 201);
    } catch {
      await rm(directory, { recursive: true, force: true });
      return fail(res, 500, "Unable to save material. Please try again.");
    }
  });

router.post(
  "/lessons/:lesson_id/scorm/upload",
  requireRoles([UserRole.admin]),
  upload.single("package"),
  async (req, res) => {
    const lessonId = getRequiredParam(req.params, "lesson_id");

    if (!lessonId) {
      return fail(res, 400, "Lesson id is required.");
    }

    if (!req.file) {
      return fail(res, 400, "SCORM ZIP file is required in field `package`.");
    }

    if (
      req.file.mimetype !== "application/zip" &&
      req.file.mimetype !== "application/x-zip-compressed" &&
      !req.file.originalname.toLowerCase().endsWith(".zip")
    ) {
      return fail(res, 400, "SCORM package must be a ZIP file.");
    }

    const packageDirectory = path.resolve(storageRoot, lessonId, randomUUID());

    try {
      const zip = new AdmZip(req.file.buffer);
      const manifest = parseManifest(zip);

      if (!manifest) {
        return fail(res, 400, "SCORM package must include imsmanifest.xml.");
      }

      await extractZipSafely(zip, packageDirectory);

      const scormPackage = await prisma.$transaction(async (tx) => {
        await tx.lesson.update({
          where: { id: lessonId },
          data: { tipe_konten: ContentType.scorm },
        });

        return tx.scormPackage.upsert({
          where: { lesson_id: lessonId },
          update: {
            file_path: packageDirectory,
            versi_manifest: manifest.version,
          },
          create: {
            lesson_id: lessonId,
            file_path: packageDirectory,
            versi_manifest: manifest.version,
          },
          include: scormPackageInclude,
        });
      });

      await recordActivity(req, {
        action: "scorm.uploaded",
        entityType: "scorm_package",
        entityId: scormPackage.id,
        description: `Paket SCORM diupload untuk lesson ${scormPackage.lesson.judul}.`,
        metadata: {
          scorm_package_id: scormPackage.id,
          lesson_id: lessonId,
          lesson_title: scormPackage.lesson.judul,
          course_id: scormPackage.lesson.course.id,
          skillhub_id: scormPackage.lesson.course.skillhub.id,
          filename: req.file.originalname,
          manifest_version: manifest.version,
        },
      });

      return ok(
        res,
        {
          ...scormPackage,
          manifest,
        },
        201,
      );
    } catch (error) {
      await rm(packageDirectory, { recursive: true, force: true });

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return fail(res, 404, "Lesson not found.");
      }

      if (error instanceof Error && error.message.includes("Unsafe ZIP")) {
        return fail(res, 400, "SCORM package contains unsafe file paths.");
      }

      return fail(res, 500, "Internal Server Error.");
    }
  },
);

router.get(
  "/lessons/:lesson_id/scorm/manifest",
  enforceDataScope,
  async (req: ScopedRequest, res) => {
    const lessonId = getRequiredParam(req.params, "lesson_id");

    if (!lessonId) {
      return fail(res, 400, "Lesson id is required.");
    }

    const scormPackage = await prisma.scormPackage.findUnique({
      where: { lesson_id: lessonId },
      include: scormPackageInclude,
    });

    if (!scormPackage) {
      return fail(res, 404, "SCORM package not found.");
    }

    if (req.user?.role === UserRole.peserta) {
      const accessCheck = await getPackageForParticipant(scormPackage.id, req.user.id);

      if ("error" in accessCheck) {
        return fail(res, 403, accessCheck.error);
      }
    }

    return ok(res, scormPackage);
  },
);

router.get(
  "/scorm/:scorm_package_id/initialize",
  requireRoles([UserRole.peserta]),
  async (req: ScopedRequest, res) => {
    const scormPackageId = getRequiredParam(req.params, "scorm_package_id");

    if (!req.user) {
      return fail(res, 401, "Unauthorized");
    }

    if (!scormPackageId) {
      return fail(res, 400, "SCORM package id is required.");
    }

    const accessCheck = await getPackageForParticipant(scormPackageId, req.user.id);

    if ("error" in accessCheck) {
      const status = accessCheck.error.includes("not found") ? 404 : 403;
      return fail(res, status, accessCheck.error);
    }

    const progress = await prisma.scormProgress.upsert({
      where: {
        user_id_scorm_package_id: {
          user_id: req.user.id,
          scorm_package_id: scormPackageId,
        },
      },
      update: {},
      create: {
        user_id: req.user.id,
        scorm_package_id: scormPackageId,
        status: ScormStatus.incomplete,
      },
      include: {
        scorm_package: {
          include: scormPackageInclude,
        },
      },
    });

    return ok(res, progress);
  },
);

router.get(
  "/scorm/:scorm_package_id/launch",
  requireRoles([UserRole.peserta]),
  async (req: ScopedRequest, res) => {
    const scormPackageId = getRequiredParam(req.params, "scorm_package_id");

    if (!req.user) {
      return fail(res, 401, "Unauthorized");
    }

    if (!scormPackageId) {
      return fail(res, 400, "SCORM package id is required.");
    }

    const accessCheck = await getPackageForParticipant(scormPackageId, req.user.id);

    if ("error" in accessCheck) {
      const status = accessCheck.error.includes("not found") ? 404 : 403;
      return fail(res, status, accessCheck.error);
    }

    const manifest = await parseManifestFromDirectory(
      accessCheck.scormPackage.file_path,
    );

    if (!manifest.launchFile) {
      return fail(res, 404, "SCORM launch file not found in manifest.");
    }

    // Scope the browser credential to this package's asset directory only.
    // Relative CSS, scripts, images and nested pages then inherit authentication.
    const incoming = req.headers.authorization?.replace(/^Bearer /, "") || (typeof req.query.token === "string" ? req.query.token : "");
    const expiry = (jwt.decode(incoming) as jwt.JwtPayload | null)?.exp ?? 0;
    const lifetime = Math.max(1, Math.min(8 * 60 * 60, expiry - Math.floor(Date.now() / 1000)));
    const contentToken = jwt.sign({ ...req.user, scorm_package_id: scormPackageId }, process.env.JWT_SECRET!, { audience: "brighted-scorm-content", expiresIn: lifetime });
    res.cookie("brighted_scorm", contentToken, {
      httpOnly: true, sameSite: "strict",
      secure: req.secure || req.get("x-forwarded-proto") === "https",
      path: `/api/scorm/${scormPackageId}/content/`, maxAge: lifetime * 1000,
    });
    res.setHeader("Cache-Control", "no-store");
    const launchUrl = `/api/scorm/${scormPackageId}/content/${manifest.launchFile}`;

    await prisma.scormProgress.upsert({
      where: {
        user_id_scorm_package_id: {
          user_id: req.user.id,
          scorm_package_id: scormPackageId,
        },
      },
      update: {},
      create: {
        user_id: req.user.id,
        scorm_package_id: scormPackageId,
        status: ScormStatus.incomplete,
      },
    });

    return ok(res, {
      scorm_package: accessCheck.scormPackage,
      manifest,
      launch_url: launchUrl,
    });
  },
);

router.get(
  /^\/scorm\/([^/]+)\/content\/(.+)$/,
  requireRoles([UserRole.peserta]),
  async (req: ScopedRequest, res) => {
    const scormPackageId = req.params[0];
    const requestedPath = normalizeZipPath(req.params[1] ?? "");

    if (!req.user) {
      return fail(res, 401, "Unauthorized");
    }

    if (!scormPackageId || !requestedPath) {
      return fail(res, 400, "SCORM package id and content path are required.");
    }

    if (
      requestedPath.includes("../") ||
      requestedPath.includes("..\\") ||
      path.isAbsolute(requestedPath)
    ) {
      return fail(res, 400, "Invalid SCORM content path.");
    }

    const accessCheck = await getPackageForParticipant(scormPackageId, req.user.id);

    if ("error" in accessCheck) {
      const status = accessCheck.error.includes("not found") ? 404 : 403;
      return fail(res, status, accessCheck.error);
    }

    const packageDirectory = path.resolve(accessCheck.scormPackage.file_path);
    const filePath = path.resolve(packageDirectory, requestedPath);

    if (!filePath.startsWith(packageDirectory + path.sep) || !existsSync(filePath)) {
      return fail(res, 404, "SCORM content file not found.");
    }

    res.setHeader("Cache-Control", "private, no-store");
    return res.sendFile(filePath);
  },
);

router.post(
  "/scorm/:scorm_package_id/commit",
  requireRoles([UserRole.peserta]),
  async (req: ScopedRequest, res) => {
    const scormPackageId = getRequiredParam(req.params, "scorm_package_id");
    const { status, skor, waktu_belajar, suspend_data } = req.body as {
      status?: ScormStatus;
      skor?: number | string | null;
      waktu_belajar?: number;
      suspend_data?: string | null;
    };

    if (!req.user) {
      return fail(res, 401, "Unauthorized");
    }

    if (!scormPackageId) {
      return fail(res, 400, "SCORM package id is required.");
    }

    const parsedStatus = parseScormStatus(status);

    if (status !== undefined && !parsedStatus) {
      return fail(res, 400, "Invalid SCORM status.");
    }

    const numericScore = skor === undefined || skor === null ? undefined : Number(skor);

    if (
      numericScore !== undefined &&
      (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > 100)
    ) {
      return fail(res, 400, "Skor must be a number between 0 and 100.");
    }

    if (
      waktu_belajar !== undefined &&
      (!Number.isInteger(waktu_belajar) || waktu_belajar < 0)
    ) {
      return fail(res, 400, "Waktu belajar must be a non-negative integer.");
    }

    const accessCheck = await getPackageForParticipant(scormPackageId, req.user.id);

    if ("error" in accessCheck) {
      const statusCode = accessCheck.error.includes("not found") ? 404 : 403;
      return fail(res, statusCode, accessCheck.error);
    }

    const progress = await prisma.scormProgress.upsert({
      where: {
        user_id_scorm_package_id: {
          user_id: req.user.id,
          scorm_package_id: scormPackageId,
        },
      },
      update: {
        ...(parsedStatus ? { status: parsedStatus } : {}),
        ...(numericScore !== undefined ? { skor: numericScore } : {}),
        ...(waktu_belajar !== undefined ? { waktu_belajar } : {}),
        ...(suspend_data !== undefined ? { suspend_data } : {}),
      },
      create: {
        user_id: req.user.id,
        scorm_package_id: scormPackageId,
        status: parsedStatus ?? ScormStatus.incomplete,
        ...(numericScore !== undefined ? { skor: numericScore } : {}),
        ...(waktu_belajar !== undefined ? { waktu_belajar } : {}),
        ...(suspend_data !== undefined ? { suspend_data } : {}),
      },
      include: {
        scorm_package: {
          include: scormPackageInclude,
        },
      },
    });

    return ok(res, progress);
  },
);

router.post(
  "/scorm/:scorm_package_id/finish",
  requireRoles([UserRole.peserta]),
  async (req: ScopedRequest, res) => {
    const scormPackageId = getRequiredParam(req.params, "scorm_package_id");
    const { status, skor, waktu_belajar, suspend_data } = req.body as {
      status?: ScormStatus;
      skor?: number | string | null;
      waktu_belajar?: number;
      suspend_data?: string | null;
    };

    if (!req.user) {
      return fail(res, 401, "Unauthorized");
    }

    if (!scormPackageId) {
      return fail(res, 400, "SCORM package id is required.");
    }

    const parsedStatus = parseScormStatus(status);

    if (status !== undefined && !parsedStatus) {
      return fail(res, 400, "Invalid SCORM status.");
    }

    const numericScore = skor === undefined || skor === null ? undefined : Number(skor);

    if (
      numericScore !== undefined &&
      (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > 100)
    ) {
      return fail(res, 400, "Skor must be a number between 0 and 100.");
    }

    if (
      waktu_belajar !== undefined &&
      (!Number.isInteger(waktu_belajar) || waktu_belajar < 0)
    ) {
      return fail(res, 400, "Waktu belajar must be a non-negative integer.");
    }

    const accessCheck = await getPackageForParticipant(scormPackageId, req.user.id);

    if ("error" in accessCheck) {
      const statusCode = accessCheck.error.includes("not found") ? 404 : 403;
      return fail(res, statusCode, accessCheck.error);
    }

    const progress = await prisma.scormProgress.upsert({
      where: {
        user_id_scorm_package_id: {
          user_id: req.user.id,
          scorm_package_id: scormPackageId,
        },
      },
      update: {
        status: parsedStatus ?? ScormStatus.completed,
        ...(numericScore !== undefined ? { skor: numericScore } : {}),
        ...(waktu_belajar !== undefined ? { waktu_belajar } : {}),
        ...(suspend_data !== undefined ? { suspend_data } : {}),
      },
      create: {
        user_id: req.user.id,
        scorm_package_id: scormPackageId,
        status: parsedStatus ?? ScormStatus.completed,
        ...(numericScore !== undefined ? { skor: numericScore } : {}),
        ...(waktu_belajar !== undefined ? { waktu_belajar } : {}),
        ...(suspend_data !== undefined ? { suspend_data } : {}),
      },
      include: {
        scorm_package: {
          include: scormPackageInclude,
        },
      },
    });

    return ok(res, progress);
  },
);

router.get("/scorm-progress", enforceDataScope, async (req: ScopedRequest, res) => {
  const skillhubId = typeof req.query.skillhub_id === "string" ? req.query.skillhub_id : undefined;
  const status =
    typeof req.query.status === "string" &&
    Object.values(ScormStatus).includes(req.query.status as ScormStatus)
      ? (req.query.status as ScormStatus)
      : undefined;

  const progresses = await prisma.scormProgress.findMany({
    where: {
      AND: [
        req.dataScope?.scormProgressWhereClause ?? {},
        status ? { status } : {},
        skillhubId
          ? {
              scorm_package: {
                lesson: {
                  course: {
                    skillhub_id: skillhubId,
                  },
                },
              },
            }
          : {},
      ],
    },
    include: {
      user: {
        select: {
          id: true,
          nama: true,
          email: true,
          role: true,
          status_akses: true,
          masa_aktif_mulai: true,
          masa_aktif_selesai: true,
          sekolah: {
            select: {
              id: true,
              nama: true,
              kode_sekolah: true,
            },
          },
        },
      },
      scorm_package: {
        include: scormPackageInclude,
      },
    },
    orderBy: { updated_at: "desc" },
  });

  return ok(res, progresses);
});

router.get(
  "/scorm/:scorm_package_id/analytics",
  enforceDataScope,
  async (req: ScopedRequest, res) => {
    const scormPackageId = getRequiredParam(req.params, "scorm_package_id");

    if (!scormPackageId) {
      return fail(res, 400, "SCORM package id is required.");
    }

    const progresses = await prisma.scormProgress.findMany({
      where: {
        AND: [
          { scorm_package_id: scormPackageId },
          req.dataScope?.scormProgressWhereClause ?? {},
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            nama: true,
            email: true,
            role: true,
            status_akses: true,
            masa_aktif_mulai: true,
            masa_aktif_selesai: true,
            sekolah: {
              select: {
                id: true,
                nama: true,
                kode_sekolah: true,
              },
            },
          },
        },
        scorm_package: {
          include: scormPackageInclude,
        },
      },
      orderBy: { updated_at: "desc" },
    });

    const summary = progresses.reduce(
      (accumulator, progress) => {
        accumulator.total += 1;
        accumulator.by_status[progress.status] =
          (accumulator.by_status[progress.status] ?? 0) + 1;

        if (progress.skor !== null) {
          accumulator.average_score_total += Number(progress.skor);
          accumulator.average_score_count += 1;
        }

        accumulator.total_waktu_belajar += progress.waktu_belajar;
        return accumulator;
      },
      {
        total: 0,
        by_status: {} as Record<ScormStatus, number>,
        average_score_total: 0,
        average_score_count: 0,
        total_waktu_belajar: 0,
      },
    );

    return ok(res, {
      summary: {
        total: summary.total,
        by_status: summary.by_status,
        average_score:
          summary.average_score_count > 0
            ? summary.average_score_total / summary.average_score_count
            : null,
        total_waktu_belajar: summary.total_waktu_belajar,
      },
      progresses,
    });
  },
);

export default router;
