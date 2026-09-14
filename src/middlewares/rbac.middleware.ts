import { Request, Response, NextFunction } from "express";
import { Prisma, UserRole } from "@prisma/client";

import { prisma } from "../lib/prisma";

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  sekolah_id?: string | null;
  status_akses: string;
}

export interface ScopedRequest extends Request {
  user?: AuthenticatedUser;
  dataScope?: {
    userWhereClause: Prisma.UserWhereInput;
    enrollmentWhereClause: Prisma.EnrollmentWhereInput;
    assessmentAttemptWhereClause: Prisma.AssessmentAttemptWhereInput;
    scormProgressWhereClause: Prisma.ScormProgressWhereInput;
  };
}

export const requireRoles = (allowedRoles: UserRole[]) => {
  return (req: ScopedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    return next();
  };
};

export const enforceDataScope = async (
  req: ScopedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (user.role === UserRole.admin) {
      req.dataScope = {
        userWhereClause: {},
        enrollmentWhereClause: {},
        assessmentAttemptWhereClause: {},
        scormProgressWhereClause: {},
      };

      return next();
    }

    if (user.role === UserRole.pengawas) {
      const mutationMethods = ["POST", "PUT", "PATCH", "DELETE"];

      if (mutationMethods.includes(req.method.toUpperCase())) {
        return res.status(403).json({
          success: false,
          message: "Read-Only Access for Pengawas.",
        });
      }

      const fasilitatorList = await prisma.user.findMany({
        where: { pengawas_id: user.id, role: UserRole.fasilitator },
        select: { id: true },
      });
      const fasilitatorIds = fasilitatorList.map((fasilitator) => fasilitator.id);

      const scopedUserWhere: Prisma.UserWhereInput = {
        OR: [
          { id: { in: fasilitatorIds } },
          { fasilitator_id: { in: fasilitatorIds }, role: UserRole.peserta },
          { pengawas_id: user.id },
        ],
      };

      req.dataScope = {
        userWhereClause: scopedUserWhere,
        enrollmentWhereClause: { user: scopedUserWhere },
        assessmentAttemptWhereClause: { user: scopedUserWhere },
        scormProgressWhereClause: { user: scopedUserWhere },
      };

      return next();
    }

    if (user.role === UserRole.fasilitator) {
      const scopedUserWhere: Prisma.UserWhereInput = {
        fasilitator_id: user.id,
        role: UserRole.peserta,
      };

      req.dataScope = {
        userWhereClause: scopedUserWhere,
        enrollmentWhereClause: { user: scopedUserWhere },
        assessmentAttemptWhereClause: { user: scopedUserWhere },
        scormProgressWhereClause: { user: scopedUserWhere },
      };

      return next();
    }

    if (user.role === UserRole.peserta) {
      req.dataScope = {
        userWhereClause: { id: user.id },
        enrollmentWhereClause: { user_id: user.id },
        assessmentAttemptWhereClause: { user_id: user.id },
        scormProgressWhereClause: { user_id: user.id },
      };

      return next();
    }

    return res.status(403).json({
      success: false,
      message: "Role not recognized.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error.",
    });
  }
};
