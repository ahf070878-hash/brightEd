import { Router } from "express";
import { Prisma, UserRole } from "@prisma/client";

import { fail, ok } from "../lib/http";
import { prisma } from "../lib/prisma";
import { requireRoles } from "../middlewares/rbac.middleware";

const router = Router();

const activityLogInclude = {
  actor: {
    select: {
      id: true,
      nama: true,
      email: true,
      role: true,
    },
  },
} satisfies Prisma.ActivityLogInclude;

router.get("/activity-logs", requireRoles([UserRole.admin]), async (req, res) => {
  const limitParam = typeof req.query.limit === "string" ? Number(req.query.limit) : 50;
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 1000) : 50;
  const action = typeof req.query.action === "string" ? req.query.action : undefined;
  const entityType =
    typeof req.query.entity_type === "string" ? req.query.entity_type : undefined;
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

  try {
    const logs = await prisma.activityLog.findMany({
      where: {
        AND: [
          action ? { action } : {},
          entityType ? { entity_type: entityType } : {},
          search
            ? {
                OR: [
                  { description: { contains: search, mode: "insensitive" } },
                  { action: { contains: search, mode: "insensitive" } },
                  { entity_type: { contains: search, mode: "insensitive" } },
                  { actor: { nama: { contains: search, mode: "insensitive" } } },
                  { actor: { email: { contains: search, mode: "insensitive" } } },
                ],
              }
            : {},
        ],
      },
      include: activityLogInclude,
      orderBy: { created_at: "desc" },
      take: limit,
    });

    return ok(res, logs);
  } catch (error) {
    return fail(res, 500, "Internal Server Error.");
  }
});

export default router;
