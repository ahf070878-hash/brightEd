import { Router } from "express";
import { Prisma, StatusAkses, UserRole } from "@prisma/client";

import { recordActivity } from "../lib/activity-log";
import { fail, getRequiredParam, ok } from "../lib/http";
import { prisma } from "../lib/prisma";
import { requireRoles } from "../middlewares/rbac.middleware";

const router = Router();

router.get(
  "/",
  requireRoles([UserRole.admin, UserRole.pengawas, UserRole.fasilitator]),
  async (req, res) => {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;

    const where: Prisma.SekolahWhereInput = search
      ? {
          OR: [
            { nama: { contains: search, mode: "insensitive" } },
            { kode_sekolah: { contains: search, mode: "insensitive" } },
            { alamat: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};

    const sekolah = await prisma.sekolah.findMany({
      where,
      orderBy: { nama: "asc" },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    return ok(res, sekolah);
  },
);

router.post("/", requireRoles([UserRole.admin]), async (req, res) => {
  const { nama, kode_sekolah, alamat } = req.body as {
    nama?: string;
    kode_sekolah?: string;
    alamat?: string;
  };

  if (!nama || !kode_sekolah) {
    return fail(res, 400, "Nama and kode_sekolah are required.");
  }

  try {
    const sekolah = await prisma.sekolah.create({
      data: {
        nama: nama.trim(),
        kode_sekolah: kode_sekolah.trim(),
        alamat: alamat?.trim() || null,
      },
    });

    await recordActivity(req, {
      action: "school.created",
      entityType: "sekolah",
      entityId: sekolah.id,
      description: `Sekolah ${sekolah.nama} dibuat.`,
      metadata: { sekolah_id: sekolah.id, kode_sekolah: sekolah.kode_sekolah },
    });

    return ok(res, sekolah, 201);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return fail(res, 409, "Kode sekolah already exists.");
    }

    return fail(res, 500, "Internal Server Error.");
  }
});

router.put("/:id", requireRoles([UserRole.admin]), async (req, res) => {
  const id = getRequiredParam(req.params, "id");
  const { nama, kode_sekolah, alamat } = req.body as {
    nama?: string;
    kode_sekolah?: string;
    alamat?: string | null;
  };

  if (!id) {
    return fail(res, 400, "Sekolah id is required.");
  }

  try {
    const sekolah = await prisma.sekolah.update({
      where: { id },
      data: {
        ...(nama !== undefined ? { nama: nama.trim() } : {}),
        ...(kode_sekolah !== undefined ? { kode_sekolah: kode_sekolah.trim() } : {}),
        ...(alamat !== undefined ? { alamat: alamat?.trim() || null } : {}),
      },
    });

    await recordActivity(req, {
      action: "school.updated",
      entityType: "sekolah",
      entityId: sekolah.id,
      description: `Sekolah ${sekolah.nama} diperbarui.`,
      metadata: { sekolah_id: sekolah.id, kode_sekolah: sekolah.kode_sekolah },
    });

    return ok(res, sekolah);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return fail(res, 404, "Sekolah not found.");
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return fail(res, 409, "Kode sekolah already exists.");
    }

    return fail(res, 500, "Internal Server Error.");
  }
});

router.delete("/:id", requireRoles([UserRole.admin]), async (req, res) => {
  const id = getRequiredParam(req.params, "id");

  if (!id) {
    return fail(res, 400, "Sekolah id is required.");
  }

  try {
    const sekolah = await prisma.sekolah.update({
      where: { id },
      data: { status_akses: StatusAkses.arsip },
    });

    await recordActivity(req, {
      action: "school.archived",
      entityType: "sekolah",
      entityId: sekolah.id,
      description: `Sekolah ${sekolah.nama} diarsipkan.`,
      metadata: { sekolah_id: sekolah.id, kode_sekolah: sekolah.kode_sekolah },
    });

    return ok(res, sekolah);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return fail(res, 404, "Sekolah not found.");
    }

    return fail(res, 500, "Internal Server Error.");
  }
});

export default router;
