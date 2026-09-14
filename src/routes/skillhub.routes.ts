import { Router } from "express";
import { ContentStatus, Prisma, UserRole } from "@prisma/client";

import { fail, getRequiredParam, ok } from "../lib/http";
import { prisma } from "../lib/prisma";
import { enforceDataScope, requireRoles } from "../middlewares/rbac.middleware";

const router = Router();

const skillhubInclude = {
  courses: {
    orderBy: { urutan: "asc" },
    include: {
      lessons: {
        orderBy: { urutan: "asc" },
        include: {
          scorm_package: true,
        },
      },
    },
  },
  assessments: {
    orderBy: { created_at: "desc" },
  },
  _count: {
    select: {
      enrollments: true,
      certificates: true,
    },
  },
} satisfies Prisma.SkillHubInclude;

function parseContentStatus(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  return Object.values(ContentStatus).includes(value as ContentStatus)
    ? (value as ContentStatus)
    : undefined;
}

function contentWorkflowKey(skillhubId: string) {
  return `content_workflow:${skillhubId}`;
}

type ContentWorkflow = {
  version: number;
  status: "draft" | "in_review" | "approved";
  notes: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  history: Array<{
    action: string;
    notes: string | null;
    created_at: string;
  }>;
};

function normalizeContentWorkflow(value: unknown): ContentWorkflow {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Partial<ContentWorkflow>
    : {};
  const status = source.status === "in_review" || source.status === "approved" ? source.status : "draft";
  const version = Number.isFinite(Number(source.version)) && Number(source.version) > 0
    ? Number(source.version)
    : 1;
  const history = Array.isArray(source.history)
    ? source.history
        .filter((item) => item && typeof item === "object")
        .map((item) => {
          const entry = item as Record<string, unknown>;
          return {
            action: String(entry.action ?? "snapshot"),
            notes: typeof entry.notes === "string" ? entry.notes : null,
            created_at: typeof entry.created_at === "string" ? entry.created_at : new Date().toISOString(),
          };
        })
        .slice(0, 12)
    : [];

  return {
    version,
    status,
    notes: typeof source.notes === "string" ? source.notes : null,
    submitted_at: typeof source.submitted_at === "string" ? source.submitted_at : null,
    approved_at: typeof source.approved_at === "string" ? source.approved_at : null,
    history,
  };
}

async function getContentWorkflow(skillhubId: string) {
  const setting = await prisma.appSetting.findUnique({ where: { key: contentWorkflowKey(skillhubId) } });
  return normalizeContentWorkflow(setting?.value);
}

router.get("/", enforceDataScope, async (req, res) => {
  const status = parseContentStatus(req.query.status);
  const search = typeof req.query.search === "string" ? req.query.search : undefined;

  const skillhubs = await prisma.skillHub.findMany({
    where: {
      AND: [
        status ? { status } : {},
        search
          ? {
              OR: [
                { nama: { contains: search, mode: "insensitive" } },
                { deskripsi: { contains: search, mode: "insensitive" } },
              ],
            }
          : {},
      ],
    },
    orderBy: { created_at: "desc" },
    include: {
      _count: {
        select: {
          courses: true,
          assessments: true,
          enrollments: true,
          certificates: true,
        },
      },
    },
  });

  return ok(res, skillhubs);
});

router.get("/:id", enforceDataScope, async (req, res) => {
  const id = getRequiredParam(req.params, "id");

  if (!id) {
    return fail(res, 400, "SkillHub id is required.");
  }

  const skillhub = await prisma.skillHub.findUnique({
    where: { id },
    include: skillhubInclude,
  });

  if (!skillhub) {
    return fail(res, 404, "SkillHub not found.");
  }

  const contentWorkflow = await getContentWorkflow(id);

  return ok(res, { ...skillhub, content_workflow: contentWorkflow });
});

router.post("/", requireRoles([UserRole.admin]), async (req, res) => {
  const { nama, deskripsi, status } = req.body as {
    nama?: string;
    deskripsi?: string | null;
    status?: ContentStatus;
  };

  if (!nama) {
    return fail(res, 400, "Nama is required.");
  }

  const parsedStatus =
    status && Object.values(ContentStatus).includes(status)
      ? status
      : ContentStatus.draft;

  const skillhub = await prisma.skillHub.create({
    data: {
      nama: nama.trim(),
      deskripsi: deskripsi?.trim() || null,
      status: parsedStatus,
    },
  });

  return ok(res, skillhub, 201);
});

router.put("/:id", requireRoles([UserRole.admin]), async (req, res) => {
  const id = getRequiredParam(req.params, "id");
  const { nama, deskripsi } = req.body as {
    nama?: string;
    deskripsi?: string | null;
  };

  if (!id) {
    return fail(res, 400, "SkillHub id is required.");
  }

  try {
    const skillhub = await prisma.skillHub.update({
      where: { id },
      data: {
        ...(nama !== undefined ? { nama: nama.trim() } : {}),
        ...(deskripsi !== undefined ? { deskripsi: deskripsi?.trim() || null } : {}),
      },
    });

    return ok(res, skillhub);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return fail(res, 404, "SkillHub not found.");
    }

    return fail(res, 500, "Internal Server Error.");
  }
});

router.patch("/:id/status", requireRoles([UserRole.admin]), async (req, res) => {
  const id = getRequiredParam(req.params, "id");
  const status = parseContentStatus(req.body?.status);

  if (!id) {
    return fail(res, 400, "SkillHub id is required.");
  }

  if (!status) {
    return fail(res, 400, "Valid status is required.");
  }

  try {
    const skillhub = await prisma.skillHub.update({
      where: { id },
      data: { status },
    });

    return ok(res, skillhub);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return fail(res, 404, "SkillHub not found.");
    }

    return fail(res, 500, "Internal Server Error.");
  }
});

router.post("/:id/workflow", requireRoles([UserRole.admin]), async (req, res) => {
  const id = getRequiredParam(req.params, "id");
  const action = typeof req.body?.action === "string" ? req.body.action : "";
  const notes = typeof req.body?.notes === "string" && req.body.notes.trim()
    ? req.body.notes.trim().slice(0, 500)
    : null;

  if (!id) {
    return fail(res, 400, "SkillHub id is required.");
  }

  if (!["snapshot", "submit", "approve", "revise"].includes(action)) {
    return fail(res, 400, "Valid workflow action is required.");
  }

  const skillhub = await prisma.skillHub.findUnique({ where: { id }, select: { id: true } });
  if (!skillhub) {
    return fail(res, 404, "SkillHub not found.");
  }

  const current = await getContentWorkflow(id);
  const now = new Date().toISOString();
  const next: ContentWorkflow = {
    ...current,
    notes,
    history: [
      { action, notes, created_at: now },
      ...current.history,
    ].slice(0, 12),
  };

  if (action === "snapshot") {
    next.version = current.version + 1;
    next.status = "draft";
    next.submitted_at = null;
    next.approved_at = null;
  }

  if (action === "submit") {
    next.status = "in_review";
    next.submitted_at = now;
    next.approved_at = null;
  }

  if (action === "approve") {
    next.status = "approved";
    next.approved_at = now;
  }

  if (action === "revise") {
    next.status = "draft";
    next.approved_at = null;
  }

  await prisma.appSetting.upsert({
    where: { key: contentWorkflowKey(id) },
    update: { value: next as unknown as Prisma.InputJsonValue },
    create: { key: contentWorkflowKey(id), value: next as unknown as Prisma.InputJsonValue },
  });

  return ok(res, { workflow: next });
});

router.delete("/:id", requireRoles([UserRole.admin]), async (req, res) => {
  const id = getRequiredParam(req.params, "id");

  if (!id) {
    return fail(res, 400, "SkillHub id is required.");
  }

  try {
    await prisma.skillHub.delete({
      where: { id },
    });

    return ok(res, { id });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return fail(res, 404, "SkillHub not found.");
    }

    return fail(res, 500, "Internal Server Error.");
  }
});

export default router;
