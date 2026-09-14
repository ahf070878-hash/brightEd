import { Router } from "express";
import { ContentType, Prisma, UserRole } from "@prisma/client";

import { fail, getRequiredParam, ok } from "../lib/http";
import { prisma } from "../lib/prisma";
import { requireRoles } from "../middlewares/rbac.middleware";

const router = Router();

function parseContentType(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  return Object.values(ContentType).includes(value as ContentType)
    ? (value as ContentType)
    : undefined;
}

router.post(
  "/courses/:course_id/lessons",
  requireRoles([UserRole.admin]),
  async (req, res) => {
    const courseId = getRequiredParam(req.params, "course_id");
    const { judul, tipe_konten, urutan } = req.body as {
      judul?: string;
      tipe_konten?: ContentType;
      urutan?: number;
    };

    if (!courseId) {
      return fail(res, 400, "Course id is required.");
    }

    if (!judul) {
      return fail(res, 400, "Judul is required.");
    }

    try {
      const lesson = await prisma.lesson.create({
        data: {
          course_id: courseId,
          judul: judul.trim(),
          tipe_konten: parseContentType(tipe_konten) ?? ContentType.article,
          urutan: Number.isInteger(urutan) ? urutan : 1,
        },
        include: { scorm_package: true },
      });

      return ok(res, lesson, 201);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2003"
      ) {
        return fail(res, 404, "Course not found.");
      }

      return fail(res, 500, "Internal Server Error.");
    }
  },
);

router.put("/lessons/:id", requireRoles([UserRole.admin]), async (req, res) => {
  const id = getRequiredParam(req.params, "id");
  const { judul, tipe_konten, urutan } = req.body as {
    judul?: string;
    tipe_konten?: ContentType;
    urutan?: number;
  };

  if (!id) {
    return fail(res, 400, "Lesson id is required.");
  }

  try {
    const lesson = await prisma.lesson.update({
      where: { id },
      data: {
        ...(judul !== undefined ? { judul: judul.trim() } : {}),
        ...(tipe_konten !== undefined
          ? { tipe_konten: parseContentType(tipe_konten) ?? ContentType.article }
          : {}),
        ...(urutan !== undefined && Number.isInteger(urutan) ? { urutan } : {}),
      },
      include: { scorm_package: true },
    });

    return ok(res, lesson);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return fail(res, 404, "Lesson not found.");
    }

    return fail(res, 500, "Internal Server Error.");
  }
});

router.delete("/lessons/:id", requireRoles([UserRole.admin]), async (req, res) => {
  const id = getRequiredParam(req.params, "id");

  if (!id) {
    return fail(res, 400, "Lesson id is required.");
  }

  try {
    await prisma.lesson.delete({
      where: { id },
    });

    return ok(res, { id });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return fail(res, 404, "Lesson not found.");
    }

    return fail(res, 500, "Internal Server Error.");
  }
});

export default router;
