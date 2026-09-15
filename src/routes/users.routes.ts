import { Router } from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import { readSheet } from "read-excel-file/node";
import { Prisma, StatusAkses, UserRole } from "@prisma/client";

import { getDefaultLearningWindow, getLearningAccess } from "../lib/access";
import { recordActivity } from "../lib/activity-log";
import { fail, getRequiredParam, ok } from "../lib/http";
import { prisma } from "../lib/prisma";
import { getSecuritySettings } from "../lib/security-settings";
import {
  enforceDataScope,
  requireRoles,
  ScopedRequest,
} from "../middlewares/rbac.middleware";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (/\.(csv|xlsx)$/i.test(file.originalname)) {
      callback(null, true);
      return;
    }

    callback(new Error("Only CSV or XLSX files are allowed."));
  },
});

const importHeaderAliases: Record<string, string> = {
  nama: "nama",
  name: "nama",
  "nama siswa": "nama",
  email: "email",
  password: "password",
  sekolah_id: "sekolah_id",
  "id sekolah": "sekolah_id",
  kode_sekolah: "kode_sekolah",
  sekolah_kode: "kode_sekolah",
  "kode sekolah": "kode_sekolah",
  fasilitator_id: "fasilitator_id",
  "id fasilitator": "fasilitator_id",
  skillhub_id: "skillhub_id",
  "id skillhub": "skillhub_id",
  skillhub_nama: "skillhub_nama",
  "nama skillhub": "skillhub_nama",
};

type ImportStudentRow = {
  nama?: string;
  email?: string;
  password?: string;
  sekolah_id?: string;
  kode_sekolah?: string;
  fasilitator_id?: string;
  skillhub_id?: string;
  skillhub_nama?: string;
};

function cleanCell(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeImportRow(row: Record<string, unknown>) {
  const normalized: ImportStudentRow = {};

  Object.entries(row).forEach(([key, value]) => {
    const normalizedKey = importHeaderAliases[key.toLowerCase().trim()];
    if (!normalizedKey) {
      return;
    }

    normalized[normalizedKey as keyof ImportStudentRow] = cleanCell(value);
  });

  return normalized;
}

function parseCsvRows(buffer: Buffer) {
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(current);
      if (row.some((cell) => cell.trim())) {
        rows.push(row);
      }
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  row.push(current);
  if (row.some((cell) => cell.trim())) {
    rows.push(row);
  }

  const [headers = [], ...records] = rows;
  return records.map((record) =>
    normalizeImportRow(
      Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""])),
    ),
  );
}

async function parseImportRows(buffer: Buffer, filename: string) {
  if (/\.csv$/i.test(filename)) {
    return parseCsvRows(buffer);
  }

  const rows = (await readSheet(buffer)) as unknown[][];
  const [headers = [], ...records] = rows;

  return records
    .map((record) =>
      normalizeImportRow(
        Object.fromEntries(headers.map((header, index) => [cleanCell(header), record[index] ?? ""])),
      ),
    )
    .filter((row) => Object.values(row).some((value) => cleanCell(value)));
}

function isEmail(value: string | undefined): value is string {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}


const userSelect = {
  id: true,
  nama: true,
  email: true,
  role: true,
  status_akses: true,
  masa_aktif_mulai: true,
  masa_aktif_selesai: true,
  sekolah_id: true,
  fasilitator_id: true,
  pengawas_id: true,
  created_at: true,
  updated_at: true,
  sekolah: {
    select: {
      id: true,
      nama: true,
      kode_sekolah: true,
    },
  },
} satisfies Prisma.UserSelect;

function parseRole(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  return Object.values(UserRole).includes(value as UserRole)
    ? (value as UserRole)
    : undefined;
}

function parseStatusAkses(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  return Object.values(StatusAkses).includes(value as StatusAkses)
    ? (value as StatusAkses)
    : undefined;
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseNullableDate(value: unknown) {
  if (value === null || value === "") {
    return null;
  }

  return parseDate(value);
}

function parseNullableString(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const cleaned = cleanCell(value);
  return cleaned || null;
}

async function findScopedStudent(req: ScopedRequest, id: string) {
  return prisma.user.findFirst({
    where: {
      AND: [
        { id, role: UserRole.peserta },
        req.dataScope?.userWhereClause ?? {},
      ],
    },
    select: { id: true },
  });
}

router.post(
  "/import-students",
  requireRoles([UserRole.admin, UserRole.fasilitator]),
  upload.single("file"),
  async (req: ScopedRequest, res) => {
    if (!req.file) {
      return fail(res, 400, "Import file is required.");
    }

    const rows = await parseImportRows(req.file.buffer, req.file.originalname);

    if (rows.length === 0) {
      return fail(res, 400, "Import file does not contain student rows.");
    }

    const defaultSekolahId = cleanCell(req.body.default_sekolah_id) || undefined;
    const defaultFasilitatorId = cleanCell(req.body.default_fasilitator_id) || undefined;
    const defaultSkillhubId = cleanCell(req.body.default_skillhub_id) || undefined;
    const created = [];
    const skipped = [];
    const errors = [];

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2;
      const nama = row.nama?.trim();
      const email = row.email?.toLowerCase().trim();
      const password = row.password?.trim() || "Siswa12345!";

      try {
        if (!nama || !isEmail(email)) {
          errors.push({
            row: rowNumber,
            email: email ?? "-",
            message: "Nama dan email valid wajib diisi.",
          });
          continue;
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
          skipped.push({ row: rowNumber, email, message: "Email already exists." });
          continue;
        }

        const sekolahIdFromCode = row.kode_sekolah
          ? (
              await prisma.sekolah.findUnique({
                where: { kode_sekolah: row.kode_sekolah },
                select: { id: true },
              })
            )?.id
          : undefined;
        const sekolahId =
          row.sekolah_id || sekolahIdFromCode || defaultSekolahId || req.user?.sekolah_id || null;
        const requestedFasilitatorId = row.fasilitator_id || defaultFasilitatorId;
        const fasilitatorId =
          req.user?.role === UserRole.fasilitator
            ? req.user.id
            : requestedFasilitatorId || null;
        const skillhubIdFromName = row.skillhub_nama
          ? (
              await prisma.skillHub.findFirst({
                where: { nama: { equals: row.skillhub_nama, mode: "insensitive" } },
                select: { id: true },
              })
            )?.id
          : undefined;
        const skillhubId = row.skillhub_id || skillhubIdFromName || defaultSkillhubId || null;

        if (sekolahId) {
          const sekolah = await prisma.sekolah.findUnique({ where: { id: sekolahId } });
          if (!sekolah) {
            errors.push({ row: rowNumber, email, message: "Sekolah tidak ditemukan." });
            continue;
          }
        }

        if (fasilitatorId) {
          const fasilitator = await prisma.user.findFirst({
            where: { id: fasilitatorId, role: UserRole.fasilitator },
          });
          if (!fasilitator) {
            errors.push({ row: rowNumber, email, message: "Fasilitator tidak ditemukan." });
            continue;
          }
        }

        if (skillhubId) {
          const skillhub = await prisma.skillHub.findUnique({ where: { id: skillhubId } });
          if (!skillhub) {
            errors.push({ row: rowNumber, email, message: "SkillHub tidak ditemukan." });
            continue;
          }
        }

        const activeWindow = getDefaultLearningWindow(new Date());
        const hashedPassword = await bcrypt.hash(password, 12);
        const user = await prisma.$transaction(async (tx) => {
          const importedUser = await tx.user.create({
            data: {
              nama,
              email,
              password: hashedPassword,
              role: UserRole.peserta,
              status_akses: StatusAkses.aktif,
              sekolah_id: sekolahId,
              fasilitator_id: fasilitatorId,
              masa_aktif_mulai: activeWindow.masa_aktif_mulai,
              masa_aktif_selesai: activeWindow.masa_aktif_selesai,
            },
            select: userSelect,
          });

          if (skillhubId) {
            await tx.enrollment.create({
              data: {
                user_id: importedUser.id,
                skillhub_id: skillhubId,
              },
            });
          }

          return importedUser;
        });

        created.push(user);
      } catch (error) {
        errors.push({
          row: rowNumber,
          email: email ?? "-",
          message:
            error instanceof Error ? error.message : "Gagal import baris siswa.",
        });
      }
    }

    await recordActivity(req, {
      action: "students.imported",
      entityType: "user",
      description: `Import siswa massal: ${created.length} dibuat, ${skipped.length} dilewati, ${errors.length} error.`,
      metadata: {
        total_rows: rows.length,
        created_count: created.length,
        skipped_count: skipped.length,
        error_count: errors.length,
        created_ids: created.map((user) => user.id),
        default_sekolah_id: defaultSekolahId ?? null,
        default_fasilitator_id: defaultFasilitatorId ?? null,
        default_skillhub_id: defaultSkillhubId ?? null,
      },
    });

    return ok(
      res,
      {
        total_rows: rows.length,
        created_count: created.length,
        skipped_count: skipped.length,
        error_count: errors.length,
        created,
        skipped,
        errors,
      },
      201,
    );
  },
);

router.get("/", enforceDataScope, async (req: ScopedRequest, res) => {
  const role = parseRole(req.query.role);
  const statusAkses = parseStatusAkses(req.query.status_akses);
  const sekolahId =
    typeof req.query.sekolah_id === "string" ? req.query.sekolah_id : undefined;
  const search = typeof req.query.search === "string" ? req.query.search : undefined;

  const where: Prisma.UserWhereInput = {
    AND: [
      req.dataScope?.userWhereClause ?? {},
      role ? { role } : {},
      statusAkses ? { status_akses: statusAkses } : {},
      sekolahId ? { sekolah_id: sekolahId } : {},
      search
        ? {
            OR: [
              { nama: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {},
    ],
  };

  const users = await prisma.user.findMany({
    where,
    select: userSelect,
    orderBy: { created_at: "desc" },
  });

  return ok(res, users);
});

router.patch(
  "/:id/student-profile",
  requireRoles([UserRole.admin, UserRole.fasilitator]),
  enforceDataScope,
  async (req: ScopedRequest, res) => {
    const id = getRequiredParam(req.params, "id");

    if (!id) {
      return fail(res, 400, "User id is required.");
    }

    const scopedStudent = await findScopedStudent(req, id);
    if (!scopedStudent) {
      return fail(res, 404, "Student not found in your scope.");
    }

    const {
      nama,
      email,
      sekolah_id,
      fasilitator_id,
      masa_aktif_mulai,
      masa_aktif_selesai,
    } = req.body as {
      nama?: string;
      email?: string;
      sekolah_id?: string | null;
      fasilitator_id?: string | null;
      masa_aktif_mulai?: string | null;
      masa_aktif_selesai?: string | null;
    };

    const data: Prisma.UserUpdateInput = {
      ...(nama !== undefined ? { nama: nama.trim() } : {}),
      ...(email !== undefined ? { email: email.toLowerCase().trim() } : {}),
    };

    if (req.user?.role === UserRole.admin) {
      const parsedSekolahId = parseNullableString(sekolah_id);
      const parsedFasilitatorId = parseNullableString(fasilitator_id);

      if (parsedSekolahId !== undefined) {
        data.sekolah = parsedSekolahId
          ? { connect: { id: parsedSekolahId } }
          : { disconnect: true };
      }

      if (parsedFasilitatorId !== undefined) {
        data.fasilitator = parsedFasilitatorId
          ? { connect: { id: parsedFasilitatorId } }
          : { disconnect: true };
      }
    }

    if (masa_aktif_mulai !== undefined) {
      data.masa_aktif_mulai = parseNullableDate(masa_aktif_mulai);
    }

    if (masa_aktif_selesai !== undefined) {
      data.masa_aktif_selesai = parseNullableDate(masa_aktif_selesai);
    }

    try {
      const user = await prisma.user.update({
        where: { id },
        data,
        select: userSelect,
      });

      return ok(res, { ...user, access: getLearningAccess(user) });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return fail(res, 409, "Email already exists.");
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return fail(res, 404, "Student not found.");
      }

      return fail(res, 500, "Internal Server Error.");
    }
  },
);

router.patch(
  "/:id/status",
  requireRoles([UserRole.admin, UserRole.fasilitator]),
  enforceDataScope,
  async (req: ScopedRequest, res) => {
    const id = getRequiredParam(req.params, "id");
    const statusAkses = parseStatusAkses(req.body?.status_akses);

    if (!id) {
      return fail(res, 400, "User id is required.");
    }

    if (!statusAkses) {
      return fail(res, 400, "Status akses must be aktif or arsip.");
    }

    const scopedUser =
      req.user?.role === UserRole.admin
        ? await prisma.user.findUnique({ where: { id }, select: { id: true } })
        : await findScopedStudent(req, id);
    if (!scopedUser) {
      return fail(res, 404, "User not found in your scope.");
    }

    const user = await prisma.user.update({
      where: { id },
      data: { status_akses: statusAkses },
      select: userSelect,
    });

    await recordActivity(req, {
      action: user.role === UserRole.peserta ? "student.status_changed" : "app_user.status_changed",
      entityType: "user",
      entityId: user.id,
      description: `Status akses ${user.role === UserRole.peserta ? "siswa" : "user aplikasi"} ${user.nama} diubah menjadi ${statusAkses}.`,
      metadata: {
        user_id: user.id,
        email: user.email,
        role: user.role,
        status_akses: statusAkses,
      },
    });

    return ok(res, { ...user, access: getLearningAccess(user) });
  },
);

router.patch(
  "/:id/reset-password",
  requireRoles([UserRole.admin, UserRole.fasilitator]),
  enforceDataScope,
  async (req: ScopedRequest, res) => {
    const id = getRequiredParam(req.params, "id");
    const newPassword = cleanCell(req.body?.password) || "Siswa12345!";

    if (!id) {
      return fail(res, 400, "User id is required.");
    }

    const securitySettings = await getSecuritySettings();
    if (newPassword.length < securitySettings.password_min_length) {
      return fail(res, 400, `Password minimal ${securitySettings.password_min_length} karakter.`);
    }

    const scopedUser =
      req.user?.role === UserRole.admin
        ? await prisma.user.findUnique({ where: { id }, select: { id: true } })
        : await findScopedStudent(req, id);
    if (!scopedUser) {
      return fail(res, 404, "User not found in your scope.");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    const user = await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
      select: userSelect,
    });

    await recordActivity(req, {
      action: user.role === UserRole.peserta ? "student.password_reset" : "app_user.password_reset",
      entityType: "user",
      entityId: user.id,
      description: `Password ${user.role === UserRole.peserta ? "siswa" : "user aplikasi"} ${user.nama} direset.`,
      metadata: { user_id: user.id, email: user.email, role: user.role },
    });

    return ok(res, {
      user,
      temporary_password: newPassword,
      message: user.role === UserRole.peserta ? "Password siswa berhasil direset." : "Password user aplikasi berhasil direset.",
    });
  },
);

router.get("/:id/detail", enforceDataScope, async (req: ScopedRequest, res) => {
  const id = getRequiredParam(req.params, "id");

  if (!id) {
    return fail(res, 400, "User id is required.");
  }

  const scopedWhere = req.dataScope?.userWhereClause ?? {};
  const user = await prisma.user.findFirst({
    where: {
      AND: [{ id }, scopedWhere],
    },
    select: {
      ...userSelect,
      enrollments: {
        orderBy: { tanggal_assign: "desc" },
        select: {
          id: true,
          status: true,
          tanggal_assign: true,
          skillhub: {
            select: {
              id: true,
              nama: true,
              status: true,
            },
          },
        },
      },
      assessment_attempts: {
        orderBy: { created_at: "desc" },
        select: {
          id: true,
          skor: true,
          status_lulus: true,
          waktu_mulai: true,
          waktu_selesai: true,
          assessment: {
            select: {
              id: true,
              judul: true,
              skillhub: {
                select: { id: true, nama: true },
              },
            },
          },
        },
      },
      scorm_progresses: {
        orderBy: { updated_at: "desc" },
        select: {
          id: true,
          status: true,
          skor: true,
          waktu_belajar: true,
          updated_at: true,
          scorm_package: {
            select: {
              id: true,
              lesson: {
                select: {
                  id: true,
                  judul: true,
                  course: {
                    select: {
                      id: true,
                      judul: true,
                      skillhub: { select: { id: true, nama: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      certificates: {
        orderBy: { tanggal_terbit: "desc" },
        select: {
          id: true,
          nomor_sertifikat: true,
          kode_verifikasi: true,
          tanggal_terbit: true,
          status: true,
          skillhub: { select: { id: true, nama: true } },
        },
      },
    },
  });

  if (!user) {
    return fail(res, 404, "User not found.");
  }

  return ok(res, {
    ...user,
    access: getLearningAccess(user),
  });
});

router.get("/:id", enforceDataScope, async (req: ScopedRequest, res) => {
  const id = getRequiredParam(req.params, "id");

  if (!id) {
    return fail(res, 400, "User id is required.");
  }

  const user = await prisma.user.findFirst({
    where: {
      AND: [{ id }, req.dataScope?.userWhereClause ?? {}],
    },
    select: userSelect,
  });

  if (!user) {
    return fail(res, 404, "User not found.");
  }

  return ok(res, {
    ...user,
    access: getLearningAccess(user),
  });
});

router.post("/", requireRoles([UserRole.admin]), async (req, res) => {
  const {
    nama,
    email,
    password,
    role,
    sekolah_id,
    fasilitator_id,
    pengawas_id,
    status_akses,
    masa_aktif_mulai,
    masa_aktif_selesai,
  } = req.body as {
    nama?: string;
    email?: string;
    password?: string;
    role?: UserRole;
    sekolah_id?: string | null;
    fasilitator_id?: string | null;
    pengawas_id?: string | null;
    status_akses?: StatusAkses;
    masa_aktif_mulai?: string;
    masa_aktif_selesai?: string;
  };

  if (!nama || !email || !password) {
    return fail(res, 400, "Nama, email, and password are required.");
  }

  const securitySettings = await getSecuritySettings();
  if (password.length < securitySettings.password_min_length) {
    return fail(res, 400, `Password minimal ${securitySettings.password_min_length} karakter.`);
  }

  const parsedRole = role && Object.values(UserRole).includes(role) ? role : UserRole.peserta;
  const parsedStatus =
    status_akses && Object.values(StatusAkses).includes(status_akses)
      ? status_akses
      : StatusAkses.aktif;
  const activeStart = parseDate(masa_aktif_mulai);
  const activeEnd = parseDate(masa_aktif_selesai);
  const defaultWindow =
    parsedRole === UserRole.peserta ? getDefaultLearningWindow(activeStart) : undefined;

  try {
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        nama: nama.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role: parsedRole,
        status_akses: parsedStatus,
        sekolah_id: parsedRole === UserRole.peserta ? sekolah_id ?? null : null,
        fasilitator_id: parsedRole === UserRole.peserta ? fasilitator_id ?? null : null,
        pengawas_id: parsedRole === UserRole.fasilitator ? pengawas_id ?? null : null,
        masa_aktif_mulai:
          parsedRole === UserRole.peserta ? activeStart ?? defaultWindow?.masa_aktif_mulai ?? null : null,
        masa_aktif_selesai:
          parsedRole === UserRole.peserta ? activeEnd ?? defaultWindow?.masa_aktif_selesai ?? null : null,
      },
      select: userSelect,
    });

    await recordActivity(req, {
      action: parsedRole === UserRole.peserta ? "student.created" : "app_user.created",
      entityType: "user",
      entityId: user.id,
      description: `${parsedRole === UserRole.peserta ? "Siswa" : "User aplikasi"} ${user.nama} dibuat sebagai ${user.role}.`,
      metadata: { user_id: user.id, email: user.email, role: user.role, status_akses: user.status_akses },
    });

    return ok(res, user, 201);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return fail(res, 409, "Email already exists.");
    }

    return fail(res, 500, "Internal Server Error.");
  }
});

router.put("/:id", requireRoles([UserRole.admin]), async (req, res) => {
  const id = getRequiredParam(req.params, "id");
  const {
    nama,
    email,
    password,
    role,
    sekolah_id,
    fasilitator_id,
    pengawas_id,
    status_akses,
    masa_aktif_mulai,
    masa_aktif_selesai,
  } = req.body as {
    nama?: string;
    email?: string;
    password?: string;
    role?: UserRole;
    sekolah_id?: string | null;
    fasilitator_id?: string | null;
    pengawas_id?: string | null;
    status_akses?: StatusAkses;
    masa_aktif_mulai?: string | null;
    masa_aktif_selesai?: string | null;
  };

  if (!id) {
    return fail(res, 400, "User id is required.");
  }

  const data: Prisma.UserUpdateInput = {
    ...(nama !== undefined ? { nama: nama.trim() } : {}),
    ...(email !== undefined ? { email: email.toLowerCase().trim() } : {}),
    ...(role !== undefined && Object.values(UserRole).includes(role) ? { role } : {}),
    ...(status_akses !== undefined && Object.values(StatusAkses).includes(status_akses)
      ? { status_akses }
      : {}),
    ...(sekolah_id !== undefined ? { sekolah: sekolah_id ? { connect: { id: sekolah_id } } : { disconnect: true } } : {}),
    ...(fasilitator_id !== undefined
      ? { fasilitator: fasilitator_id ? { connect: { id: fasilitator_id } } : { disconnect: true } }
      : {}),
    ...(pengawas_id !== undefined
      ? { pengawas: pengawas_id ? { connect: { id: pengawas_id } } : { disconnect: true } }
      : {}),
    ...(masa_aktif_mulai !== undefined
      ? { masa_aktif_mulai: masa_aktif_mulai ? parseDate(masa_aktif_mulai) : null }
      : {}),
    ...(masa_aktif_selesai !== undefined
      ? { masa_aktif_selesai: masa_aktif_selesai ? parseDate(masa_aktif_selesai) : null }
      : {}),
  };

  if (password) {
    const securitySettings = await getSecuritySettings();
    if (password.length < securitySettings.password_min_length) {
      return fail(res, 400, `Password minimal ${securitySettings.password_min_length} karakter.`);
    }
    data.password = await bcrypt.hash(password, 12);
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data,
      select: userSelect,
    });

    await recordActivity(req, {
      action: user.role === UserRole.peserta ? "student.updated" : "app_user.updated",
      entityType: "user",
      entityId: user.id,
      description: `${user.role === UserRole.peserta ? "Data siswa" : "User aplikasi"} ${user.nama} diperbarui.`,
      metadata: { user_id: user.id, email: user.email, role: user.role, status_akses: user.status_akses },
    });

    return ok(res, user);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return fail(res, 404, "User not found.");
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return fail(res, 409, "Email already exists.");
    }

    return fail(res, 500, "Internal Server Error.");
  }
});

router.delete("/:id", requireRoles([UserRole.admin]), async (req, res) => {
  const id = getRequiredParam(req.params, "id");

  if (!id) {
    return fail(res, 400, "User id is required.");
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: { status_akses: StatusAkses.arsip },
      select: userSelect,
    });

    return ok(res, user);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return fail(res, 404, "User not found.");
    }

    return fail(res, 500, "Internal Server Error.");
  }
});

export default router;




