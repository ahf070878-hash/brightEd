import { Router } from "express";
import { Prisma, UserRole } from "@prisma/client";

import { fail, getRequiredParam, ok } from "../lib/http";
import { prisma } from "../lib/prisma";
import { requireRoles } from "../middlewares/rbac.middleware";

const router = Router();

router.post(
  "/skillhubs/:skillhub_id/courses",
  requireRoles([UserRole.admin]),
  async (req, res) => {
    const skillhubId = getRequiredParam(req.params, "skillhub_id");
    const { judul, urutan } = req.body as {
      judul?: string;
      urutan?: number;
    };

    if (!skillhubId) {
      return fail(res, 400, "SkillHub id is required.");
    }

    if (!judul) {
      return fail(res, 400, "Judul is required.");
    }

    try {
      const course = await prisma.course.create({
        data: {
          skillhub_id: skillhubId,
          judul: judul.trim(),
          urutan: Number.isInteger(urutan) ? urutan : 1,
        },
        include: { lessons: true },
      });

      return ok(res, course, 201);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2003"
      ) {
        return fail(res, 404, "SkillHub not found.");
      }

      return fail(res, 500, "Internal Server Error.");
    }
  },
);

router.put("/courses/:id", requireRoles([UserRole.admin]), async (req, res) => {
  const id = getRequiredParam(req.params, "id");
  const { judul, urutan } = req.body as {
    judul?: string;
    urutan?: number;
  };

  if (!id) {
    return fail(res, 400, "Course id is required.");
  }

  try {
    const course = await prisma.course.update({
      where: { id },
      data: {
        ...(judul !== undefined ? { judul: judul.trim() } : {}),
        ...(urutan !== undefined && Number.isInteger(urutan) ? { urutan } : {}),
      },
      include: { lessons: true },
    });

    return ok(res, course);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return fail(res, 404, "Course not found.");
    }

    return fail(res, 500, "Internal Server Error.");
  }
});

router.delete("/courses/:id", requireRoles([UserRole.admin]), async (req, res) => {
  const id = getRequiredParam(req.params, "id");

  if (!id) {
    return fail(res, 400, "Course id is required.");
  }

  try {
    await prisma.course.delete({
      where: { id },
    });

    return ok(res, { id });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return fail(res, 404, "Course not found.");
    }

    return fail(res, 500, "Internal Server Error.");
  }
});

export default router;
