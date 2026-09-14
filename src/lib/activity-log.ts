import type { Request } from "express";
import type { Prisma, UserRole } from "@prisma/client";

import { prisma } from "./prisma";
import type { ScopedRequest } from "../middlewares/rbac.middleware";

type ActivityRequest = Request | ScopedRequest;

type RecordActivityInput = {
  action: string;
  entityType: string;
  entityId?: string | null;
  description: string;
  metadata?: Prisma.InputJsonValue;
};

function truncate(value: string | undefined, maxLength: number) {
  if (!value) {
    return null;
  }

  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

export async function recordActivity(
  req: ActivityRequest,
  input: RecordActivityInput,
) {
  const scopedReq = req as ScopedRequest;

  try {
    await prisma.activityLog.create({
      data: {
        actor_id: scopedReq.user?.id ?? null,
        actor_role: (scopedReq.user?.role as UserRole | undefined) ?? null,
        action: input.action,
        entity_type: input.entityType,
        entity_id: input.entityId ?? null,
        description: input.description,
        metadata: input.metadata ?? undefined,
        ip_address: truncate(req.ip, 80),
        user_agent: truncate(req.get("user-agent"), 255),
      },
    });
  } catch (error) {
    console.error("Failed to record activity log", error);
  }
}
