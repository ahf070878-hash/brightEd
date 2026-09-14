import { Router } from "express";
import { EnrollmentStatus, Prisma, UserRole } from "@prisma/client";

import { getDefaultLearningWindow, getLearningAccess } from "../lib/access";
import { recordActivity } from "../lib/activity-log";
import { fail, getRequiredParam, ok } from "../lib/http";
import { prisma } from "../lib/prisma";
import {
  enforceDataScope,
  requireRoles,
  ScopedRequest,
} from "../middlewares/rbac.middleware";

const router = Router();

const enrollmentInclude = {
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
  skillhub: {
    select: {
      id: true,
      nama: true,
      deskripsi: true,
      status: true,
    },
  },
} satisfies Prisma.EnrollmentInclude;

function parseEnrollmentStatus(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  return Object.values(EnrollmentStatus).includes(value as EnrollmentStatus)
    ? (value as EnrollmentStatus)
    : undefined;
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

router.get("/", enforceDataScope, async (req: ScopedRequest, res) => {
  const status = parseEnrollmentStatus(req.query.status);
  const skillhubId =
    typeof req.query.skillhub_id === "string" ? req.query.skillhub_id : undefined;

  const enrollments = await prisma.enrollment.findMany({
    where: {
      AND: [
        req.dataScope?.enrollmentWhereClause ?? {},
        status ? { status } : {},
        skillhubId ? { skillhub_id: skillhubId } : {},
      ],
    },
    include: enrollmentInclude,
    orderBy: { created_at: "desc" },
  });

  return ok(res, enrollments);
});

router.get(
  "/my-learning",
  requireRoles([UserRole.peserta]),
  async (req: ScopedRequest, res) => {
    if (!req.user) {
      return fail(res, 401, "Unauthorized");
    }

    const enrollments = await prisma.enrollment.findMany({
      where: { user_id: req.user.id },
      include: enrollmentInclude,
      orderBy: { created_at: "desc" },
    });

    return ok(
      res,
      enrollments.map((enrollment) => ({
        ...enrollment,
        access: getLearningAccess(enrollment.user),
      })),
    );
  },
);

router.post("/assign-bulk", requireRoles([UserRole.admin]), async (req, res) => {
  const { user_ids, skillhub_id } = req.body ?? {};
  if (!Array.isArray(user_ids) || user_ids.length < 1 || user_ids.length > 500 || user_ids.some(id => typeof id !== "string" || !id.trim()) || typeof skillhub_id !== "string" || !skillhub_id.trim()) {
    return fail(res, 400, "Select a SkillHub and between 1 and 500 learners.");
  }
  const ids = [...new Set<string>(user_ids)];
  try {
    const result = await prisma.$transaction(async tx => {
      const hub = await tx.skillHub.findUnique({ where: { id: skillhub_id }, select: { id: true, nama: true } });
      if (!hub) return { error: "SkillHub not found." };
      const users = await tx.user.findMany({ where: { id: { in: ids }, role: UserRole.peserta }, select: { id: true } });
      if (users.length !== ids.length) return { error: "Some selected learners no longer exist or are not participants. Refresh the list and try again." };
      const created = await tx.enrollment.createMany({ data: ids.map(user_id => ({ user_id, skillhub_id, status: EnrollmentStatus.enrolled })), skipDuplicates: true });
      return { requested: ids.length, assigned: created.count, skipped: ids.length - created.count, skillhub: hub };
    });
    if ("error" in result) return fail(res, 400, result.error!);
    await recordActivity(req, { action: "skillhub.bulk_assigned", entityType: "skillhub", entityId: skillhub_id,
      description: `Bulk assignment to ${result.skillhub.nama}: ${result.assigned} enrolled, ${result.skipped} already enrolled.`,
      metadata: { user_ids: ids, assigned: result.assigned, skipped: result.skipped } });
    return ok(res, result, result.assigned ? 201 : 200);
  } catch {
    return fail(res, 500, "Unable to assign learners. Please refresh the list and try again.");
  }
});

router.post("/assign", requireRoles([UserRole.admin]), async (req, res) => {
  const { user_id, skillhub_id, tanggal_assign, masa_aktif_mulai, masa_aktif_selesai } =
    req.body as {
      user_id?: string;
      skillhub_id?: string;
      tanggal_assign?: string;
      masa_aktif_mulai?: string;
      masa_aktif_selesai?: string;
    };

  if (!user_id || !skillhub_id) {
    return fail(res, 400, "user_id and skillhub_id are required.");
  }

  const assignDate = parseDate(tanggal_assign) ?? new Date();
  const activeStart = parseDate(masa_aktif_mulai) ?? assignDate;
  const defaultWindow = getDefaultLearningWindow(activeStart);
  const activeEnd = parseDate(masa_aktif_selesai) ?? defaultWindow.masa_aktif_selesai;

  try {
    const [user, skillhub] = await Promise.all([
      prisma.user.findUnique({ where: { id: user_id } }),
      prisma.skillHub.findUnique({ where: { id: skillhub_id } }),
    ]);

    if (!user) {
      return fail(res, 404, "User not found.");
    }

    if (user.role !== UserRole.peserta) {
      return fail(res, 400, "Only peserta can be enrolled to SkillHub.");
    }

    if (!skillhub) {
      return fail(res, 404, "SkillHub not found.");
    }

    const enrollment = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user_id },
        data: {
          masa_aktif_mulai: user.masa_aktif_mulai ?? activeStart,
          masa_aktif_selesai: user.masa_aktif_selesai ?? activeEnd,
        },
      });

      return tx.enrollment.upsert({
        where: {
          user_id_skillhub_id: {
            user_id,
            skillhub_id,
          },
        },
        update: {
          tanggal_assign: assignDate,
          status: EnrollmentStatus.enrolled,
        },
        create: {
          user_id,
          skillhub_id,
          tanggal_assign: assignDate,
          status: EnrollmentStatus.enrolled,
        },
        include: enrollmentInclude,
      });
    });

    await recordActivity(req, {
      action: "skillhub.assigned",
      entityType: "enrollment",
      entityId: enrollment.id,
      description: `Siswa ${enrollment.user.nama} di-assign ke SkillHub ${enrollment.skillhub.nama}.`,
      metadata: {
        enrollment_id: enrollment.id,
        user_id,
        skillhub_id,
        tanggal_assign: enrollment.tanggal_assign,
        masa_aktif_mulai: activeStart,
        masa_aktif_selesai: activeEnd,
      },
    });

    return ok(res, enrollment, 201);
  } catch (error) {
    return fail(res, 500, "Internal Server Error.");
  }
});

router.patch(
  "/:id/status",
  requireRoles([UserRole.admin, UserRole.fasilitator]),
  async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const status = parseEnrollmentStatus(req.body?.status);

    if (!id) {
      return fail(res, 400, "Enrollment id is required.");
    }

    if (!status) {
      return fail(res, 400, "Valid status is required.");
    }

    try {
      const enrollment = await prisma.enrollment.update({
        where: { id },
        data: { status },
        include: enrollmentInclude,
      });

      await recordActivity(req, {
        action: "enrollment.status_changed",
        entityType: "enrollment",
        entityId: enrollment.id,
        description: `Status enrollment ${enrollment.user.nama} pada ${enrollment.skillhub.nama} diubah menjadi ${status}.`,
        metadata: {
          enrollment_id: enrollment.id,
          user_id: enrollment.user_id,
          skillhub_id: enrollment.skillhub_id,
          status,
        },
      });

      return ok(res, enrollment);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return fail(res, 404, "Enrollment not found.");
      }

      return fail(res, 500, "Internal Server Error.");
    }
  },
);

router.delete("/:id", requireRoles([UserRole.admin]), async (req, res) => {
  const id = getRequiredParam(req.params, "id");

  if (!id) {
    return fail(res, 400, "Enrollment id is required.");
  }

  try {
    await prisma.enrollment.delete({
      where: { id },
    });

    return ok(res, { id });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return fail(res, 404, "Enrollment not found.");
    }

    return fail(res, 500, "Internal Server Error.");
  }
});

export default router;
