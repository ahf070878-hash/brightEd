import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { StatusAkses, UserRole } from "@prisma/client";

import type { AuthenticatedUser, ScopedRequest } from "./rbac.middleware";

interface JwtPayload {
  id: string;
  role: UserRole;
  sekolah_id?: string | null;
  status_akses?: StatusAkses | string;
  scorm_package_id?: string;
}

function getBearerToken(req: Request) {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }

  return typeof req.query.token === "string" ? req.query.token : null;
}

export const authenticate = (
  req: ScopedRequest,
  res: Response,
  next: NextFunction,
) => {
  let token = getBearerToken(req);
  let contentSession = false;
  const contentMatch = req.originalUrl.split("?")[0].match(/^\/api\/scorm\/([^/]+)\/content\//);
  if (!token && contentMatch) {
    token = req.headers.cookie?.split(";").map(value => value.trim()).find(value => value.startsWith("brighted_scorm="))?.slice("brighted_scorm=".length) ?? null;
    contentSession = Boolean(token);
  }

  if (!token) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      return res.status(500).json({
        success: false,
        message: "JWT secret is not configured.",
      });
    }

    const decoded = jwt.verify(token, secret, contentSession ? { audience: "brighted-scorm-content" } : {}) as JwtPayload;
    if (contentSession ? decoded.scorm_package_id !== contentMatch?.[1] : Boolean(decoded.scorm_package_id)) {
      return res.status(401).json({ success: false, message: "Invalid content session" });
    }

    if (!decoded.id || !decoded.role) {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }

    req.user = {
      id: decoded.id,
      role: decoded.role,
      sekolah_id: decoded.sekolah_id ?? null,
      status_akses: decoded.status_akses ?? StatusAkses.aktif,
    } satisfies AuthenticatedUser;

    return next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};
