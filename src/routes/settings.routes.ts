import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { Prisma, UserRole } from "@prisma/client";

import { recordActivity } from "../lib/activity-log";
import { getCertificateSettings, normalizeCertificateSettings, saveCertificateSettings } from "../lib/certificate-settings";
import { fail, ok } from "../lib/http";
import { isEmailDeliveryConfigured } from "../lib/mailer";
import { prisma } from "../lib/prisma";
import { getSecuritySettings, normalizeSecuritySettings, saveSecuritySettings } from "../lib/security-settings";
import { requireRoles, ScopedRequest } from "../middlewares/rbac.middleware";

const router = Router();
const PERMISSION_KEY = "role_permissions";

const certificateUploadDir = path.join(process.cwd(), "public", "uploads", "certificates");
fs.mkdirSync(certificateUploadDir, { recursive: true });

const certificateUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, certificateUploadDir),
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      const safeName = `certificate-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
      callback(null, safeName);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (["image/png", "image/jpeg"].includes(file.mimetype)) {
      callback(null, true);
      return;
    }

    callback(new Error("Only PNG or JPG certificate assets are allowed."));
  },
});

const featureKeys = [
  "students",
  "schools",
  "app-users",
  "content",
  "assessment",
  "certificates",
  "reports",
  "audit",
  "settings",
] as const;

const roleKeys = [
  UserRole.admin,
  UserRole.fasilitator,
  UserRole.pengawas,
  UserRole.peserta,
] as const;

type FeatureKey = (typeof featureKeys)[number];
type RoleKey = (typeof roleKeys)[number];
type PermissionMatrix = Record<FeatureKey, Record<RoleKey, boolean>>;

const defaultPermissions: PermissionMatrix = {
  students: { admin: true, fasilitator: true, pengawas: true, peserta: false },
  schools: { admin: true, fasilitator: false, pengawas: true, peserta: false },
  "app-users": { admin: true, fasilitator: false, pengawas: false, peserta: false },
  content: { admin: true, fasilitator: false, pengawas: true, peserta: true },
  assessment: { admin: true, fasilitator: false, pengawas: true, peserta: true },
  certificates: { admin: true, fasilitator: false, pengawas: true, peserta: true },
  reports: { admin: true, fasilitator: true, pengawas: true, peserta: false },
  audit: { admin: true, fasilitator: false, pengawas: false, peserta: false },
  settings: { admin: true, fasilitator: false, pengawas: false, peserta: false },
};

function normalizePermissions(input: unknown): PermissionMatrix {
  const source = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const matrix = structuredClone(defaultPermissions) as PermissionMatrix;

  for (const feature of featureKeys) {
    const row = source[feature];
    const sourceRow = row && typeof row === "object" ? row as Record<string, unknown> : {};

    for (const role of roleKeys) {
      if (sourceRow[role] !== undefined) {
        matrix[feature][role] = Boolean(sourceRow[role]);
      }
    }
  }

  matrix.settings.admin = true;
  return matrix;
}

async function getPermissionMatrix() {
  const setting = await prisma.appSetting.findUnique({ where: { key: PERMISSION_KEY } });
  return normalizePermissions(setting?.value);
}

router.get("/settings/permissions", async (_req, res) => {
  const permissions = await getPermissionMatrix();
  return ok(res, { permissions });
});

router.put(
  "/settings/permissions",
  requireRoles([UserRole.admin]),
  async (req: ScopedRequest, res) => {
    const permissions = normalizePermissions(req.body?.permissions);

    try {
      const setting = await prisma.appSetting.upsert({
        where: { key: PERMISSION_KEY },
        update: { value: permissions as unknown as Prisma.InputJsonValue },
        create: { key: PERMISSION_KEY, value: permissions as unknown as Prisma.InputJsonValue },
      });

      await recordActivity(req, {
        action: "settings.permissions_updated",
        entityType: "app_setting",
        entityId: setting.key,
        description: "Role & Permission Matrix diperbarui.",
        metadata: { permissions } as Prisma.InputJsonValue,
      });

      return ok(res, { permissions });
    } catch (error) {
      return fail(res, 500, "Internal Server Error.");
    }
  },
);

router.get("/settings/certificate", async (_req, res) => {
  const settings = await getCertificateSettings();
  return ok(res, { settings });
});

router.get("/settings/security", requireRoles([UserRole.admin]), async (_req, res) => {
  const settings = await getSecuritySettings();
  return ok(res, { settings });
});

router.get("/ops/status", requireRoles([UserRole.admin]), async (_req, res) => {
  try {
    const [users, skillhubs, enrollments, certificates, security] = await Promise.all([
      prisma.user.count(),
      prisma.skillHub.count(),
      prisma.enrollment.count(),
      prisma.certificate.count(),
      getSecuritySettings(),
    ]);

    return ok(res, {
      status: "operational",
      checked_at: new Date().toISOString(),
      database: "connected",
      counts: { users, skillhubs, enrollments, certificates },
      security,
      email: {
        password_reset_delivery: isEmailDeliveryConfigured() ? "configured" : "not_configured",
        from: process.env.SMTP_FROM ? "configured" : "not_configured",
      },
    });
  } catch (error) {
    return fail(res, 503, "Operational status check failed.");
  }
});

router.put(
  "/settings/security",
  requireRoles([UserRole.admin]),
  async (req: ScopedRequest, res) => {
    try {
      const settings = normalizeSecuritySettings(req.body);
      const saved = await saveSecuritySettings(settings);

      await recordActivity(req, {
        action: "settings.security_updated",
        entityType: "app_setting",
        entityId: saved.key,
        description: "Security policy LMS diperbarui.",
        metadata: { settings } as Prisma.InputJsonValue,
      });

      return ok(res, { settings });
    } catch (error) {
      return fail(res, 500, "Internal Server Error.");
    }
  },
);

router.put(
  "/settings/certificate",
  requireRoles([UserRole.admin]),
  async (req: ScopedRequest, res) => {
    try {
      const current = await getCertificateSettings();
      const settings = normalizeCertificateSettings({
        ...current,
        ...req.body,
        asset_path: req.body?.asset_path === undefined ? current.asset_path : req.body.asset_path,
      });
      const saved = await saveCertificateSettings(settings);

      await recordActivity(req, {
        action: "settings.certificate_updated",
        entityType: "app_setting",
        entityId: saved.key,
        description: "Setting sertifikat diperbarui.",
        metadata: { settings } as Prisma.InputJsonValue,
      });

      return ok(res, { settings });
    } catch (error) {
      return fail(res, 500, "Internal Server Error.");
    }
  },
);

router.post(
  "/settings/certificate/upload",
  requireRoles([UserRole.admin]),
  certificateUpload.single("file"),
  async (req: ScopedRequest, res) => {
    if (!req.file) {
      return fail(res, 400, "File sertifikat wajib diupload.");
    }

    try {
      const current = await getCertificateSettings();
      const assetPath = `/uploads/certificates/${req.file.filename}`;
      const settings = normalizeCertificateSettings({ ...current, asset_path: assetPath });
      const saved = await saveCertificateSettings(settings);

      await recordActivity(req, {
        action: "settings.certificate_asset_uploaded",
        entityType: "app_setting",
        entityId: saved.key,
        description: "Asset/template sertifikat diupload.",
        metadata: { asset_path: assetPath, filename: req.file.originalname } as Prisma.InputJsonValue,
      });

      return ok(res, { settings, asset_path: assetPath }, 201);
    } catch (error) {
      return fail(res, 500, "Internal Server Error.");
    }
  },
);

export default router;
