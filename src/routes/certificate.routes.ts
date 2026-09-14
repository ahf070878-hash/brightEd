import { CertificateStatus, Prisma, UserRole } from "@prisma/client";
import PDFDocument from "pdfkit";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Router } from "express";

import { recordActivity } from "../lib/activity-log";
import { hasPassedCertificateRequirements } from "../lib/certificate-eligibility";
import { getCertificateSettings } from "../lib/certificate-settings";
import { fail, getRequiredParam, ok } from "../lib/http";
import { prisma } from "../lib/prisma";
import {
  enforceDataScope,
  requireRoles,
  ScopedRequest,
} from "../middlewares/rbac.middleware";

const router = Router();

const certificateInclude = {
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
} satisfies Prisma.CertificateInclude;

function generateCertificateNumber() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = randomBytes(4).toString("hex").toUpperCase();
  return `BRIGHTED-${datePart}-${randomPart}`;
}

function generateVerificationCode() {
  return randomBytes(16).toString("hex");
}

async function streamCertificatePdf(
  res: Parameters<Parameters<typeof router.get>[1]>[1],
  certificate: Prisma.CertificateGetPayload<{ include: typeof certificateInclude }>,
) {
  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: 56,
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${certificate.nomor_sertifikat}.pdf"`,
  );

  doc.pipe(res);

  const settings = await getCertificateSettings();
  const completionDate = settings.date_source === "membership_end"
    ? certificate.user.masa_aktif_selesai ?? certificate.tanggal_terbit
    : certificate.tanggal_terbit;
  const assetPath = settings.asset_path
    ? path.join(process.cwd(), "public", settings.asset_path.replace(/^\//, ""))
    : null;

  if (assetPath && assetPath.startsWith(path.join(process.cwd(), "public", "uploads", "certificates")) && fs.existsSync(assetPath)) {
    try {
      doc.image(assetPath, 56, 46, { fit: [120, 68], align: "center" });
    } catch (error) {
      console.error("Failed to render certificate asset", error);
    }
  }

  doc
    .rect(28, 28, doc.page.width - 56, doc.page.height - 56)
    .lineWidth(2)
    .stroke("#F3702A");

  doc
    .fontSize(28)
    .fillColor("#F3702A")
    .text(settings.title, { align: "center" });

  doc.moveDown(0.8);
  doc
    .fontSize(16)
    .fillColor("#22302A")
    .text(settings.subtitle, { align: "center" });

  doc.moveDown(1.4);
  doc
    .fontSize(12)
    .fillColor("#5B6B61")
    .text(settings.recipient_label, { align: "center" });

  doc.moveDown(0.4);
  doc
    .fontSize(32)
    .fillColor("#22302A")
    .text(certificate.user.nama, { align: "center" });

  doc.moveDown(0.8);
  doc
    .fontSize(13)
    .fillColor("#5B6B61")
    .text(settings.material_label, { align: "center" });

  doc.moveDown(0.3);
  doc
    .fontSize(22)
    .fillColor("#22302A")
    .text(certificate.skillhub.nama, { align: "center" });

  doc.moveDown(1.8);
  doc
    .fontSize(10)
    .fillColor("#5B6B61")
    .text(`Nomor Sertifikat: ${certificate.nomor_sertifikat}`, {
      align: "center",
    })
    .text(`Kode Verifikasi: ${certificate.kode_verifikasi}`, {
      align: "center",
    })
    .text(
      `${settings.completion_label}: ${completionDate.toISOString().slice(0, 10)}`,
      { align: "center" },
    );

  doc.end();
}

router.get(
  "/public/certificates/verify/:kode_verifikasi",
  async (req, res) => {
    const kodeVerifikasi = getRequiredParam(req.params, "kode_verifikasi");

    if (!kodeVerifikasi) {
      return fail(res, 400, "Kode verifikasi is required.");
    }

    const certificate = await prisma.certificate.findUnique({
      where: { kode_verifikasi: kodeVerifikasi },
      include: certificateInclude,
    });

    if (!certificate || certificate.status !== CertificateStatus.active) {
      return fail(res, 404, "Certificate not found or inactive.");
    }

    return ok(res, certificate);
  },
);

router.get(
  "/public/certificates/download/:kode_verifikasi",
  async (req, res) => {
    const kodeVerifikasi = getRequiredParam(req.params, "kode_verifikasi");

    if (!kodeVerifikasi) {
      return fail(res, 400, "Kode verifikasi is required.");
    }

    const certificate = await prisma.certificate.findUnique({
      where: { kode_verifikasi: kodeVerifikasi },
      include: certificateInclude,
    });

    if (!certificate || certificate.status !== CertificateStatus.active) {
      return fail(res, 404, "Certificate not found or inactive.");
    }

    return await streamCertificatePdf(res, certificate);
  },
);

router.get(
  "/certificates/my-certificates",
  requireRoles([UserRole.peserta]),
  async (req: ScopedRequest, res) => {
    if (!req.user) {
      return fail(res, 401, "Unauthorized");
    }

    const certificates = await prisma.certificate.findMany({
      where: {
        user_id: req.user.id,
      },
      include: certificateInclude,
      orderBy: { tanggal_terbit: "desc" },
    });

    return ok(res, certificates);
  },
);

router.get(
  "/certificates",
  enforceDataScope,
  async (req: ScopedRequest, res) => {
    const status =
      typeof req.query.status === "string" &&
      Object.values(CertificateStatus).includes(req.query.status as CertificateStatus)
        ? (req.query.status as CertificateStatus)
        : undefined;
    const skillhubId =
      typeof req.query.skillhub_id === "string" ? req.query.skillhub_id : undefined;

    const certificates = await prisma.certificate.findMany({
      where: {
        AND: [
          status ? { status } : {},
          skillhubId ? { skillhub_id: skillhubId } : {},
          { user: req.dataScope?.userWhereClause ?? {} },
        ],
      },
      include: certificateInclude,
      orderBy: { tanggal_terbit: "desc" },
    });

    return ok(res, certificates);
  },
);

router.post(
  "/certificates/generate",
  requireRoles([UserRole.admin]),
  async (req, res) => {
    const { user_id, skillhub_id } = req.body as {
      user_id?: string;
      skillhub_id?: string;
    };

    if (!user_id || !skillhub_id) {
      return fail(res, 400, "User id and SkillHub id are required.");
    }

    const [user, skillhub] = await Promise.all([
      prisma.user.findUnique({ where: { id: user_id } }),
      prisma.skillHub.findUnique({ where: { id: skillhub_id } }),
    ]);

    if (!user || user.role !== UserRole.peserta) {
      return fail(res, 404, "Peserta not found.");
    }

    if (!skillhub) {
      return fail(res, 404, "SkillHub not found.");
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: {
        user_id_skillhub_id: {
          user_id,
          skillhub_id,
        },
      },
    });

    if (!enrollment) {
      return fail(res, 403, "Peserta is not enrolled to this SkillHub.");
    }

    const eligible = await hasPassedCertificateRequirements(user_id, skillhub_id);

    if (!eligible) {
      return fail(res, 403, "Peserta has not passed the required assessment or SCORM examination.");
    }

    const existingCertificate = await prisma.certificate.findFirst({
      where: {
        user_id,
        skillhub_id,
        status: CertificateStatus.active,
      },
      include: certificateInclude,
    });

    if (existingCertificate) {
      return ok(res, existingCertificate);
    }

    try {
      const certificate = await prisma.certificate.create({
        data: {
          user_id,
          skillhub_id,
          nomor_sertifikat: generateCertificateNumber(),
          kode_verifikasi: generateVerificationCode(),
          status: CertificateStatus.active,
        },
        include: certificateInclude,
      });

      await recordActivity(req, {
        action: "certificate.generated",
        entityType: "certificate",
        entityId: certificate.id,
        description: `Sertifikat ${certificate.nomor_sertifikat} dibuat untuk ${certificate.user.nama}.`,
        metadata: {
          certificate_id: certificate.id,
          nomor_sertifikat: certificate.nomor_sertifikat,
          kode_verifikasi: certificate.kode_verifikasi,
          user_id,
          skillhub_id,
        },
      });

      return ok(res, certificate, 201);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return fail(res, 409, "Certificate number collision, please retry.");
      }

      return fail(res, 500, "Internal Server Error.");
    }
  },
);

router.patch(
  "/certificates/:id/revoke",
  requireRoles([UserRole.admin]),
  async (req, res) => {
    const id = getRequiredParam(req.params, "id");

    if (!id) {
      return fail(res, 400, "Certificate id is required.");
    }

    try {
      const certificate = await prisma.certificate.update({
        where: { id },
        data: { status: CertificateStatus.revoked },
        include: certificateInclude,
      });

      await recordActivity(req, {
        action: "certificate.revoked",
        entityType: "certificate",
        entityId: certificate.id,
        description: `Sertifikat ${certificate.nomor_sertifikat} milik ${certificate.user.nama} direvoke.`,
        metadata: {
          certificate_id: certificate.id,
          nomor_sertifikat: certificate.nomor_sertifikat,
          kode_verifikasi: certificate.kode_verifikasi,
          user_id: certificate.user_id,
          skillhub_id: certificate.skillhub_id,
        },
      });

      return ok(res, certificate);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return fail(res, 404, "Certificate not found.");
      }

      return fail(res, 500, "Internal Server Error.");
    }
  },
);

export default router;
