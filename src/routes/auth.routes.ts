import { Router, type Request } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { Prisma, StatusAkses } from "@prisma/client";

import { authenticate } from "../middlewares/auth.middleware";
import type { ScopedRequest } from "../middlewares/rbac.middleware";
import { prisma } from "../lib/prisma";
import { getSecuritySettings } from "../lib/security-settings";
import { sendPasswordResetEmail } from "../lib/mailer";

const router = Router();

function passwordResetKey(token: string) {
  return `password_reset:${token}`;
}

function publicResetUrl(req: Request, token: string) {
  const configuredBaseUrl = process.env.PUBLIC_APP_URL?.replace(/\/$/, "");
  const baseUrl = configuredBaseUrl || `${req.protocol}://${req.get("host")}`;
  return `${baseUrl}/?reset_token=${encodeURIComponent(token)}#login`;
}

async function createToken(user: {
  id: string;
  role: string;
  sekolah_id: string | null;
  status_akses: string;
}) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  const settings = await getSecuritySettings();

  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      sekolah_id: user.sekolah_id,
      status_akses: user.status_akses,
    },
    secret,
    { expiresIn: `${settings.session_hours}h` },
  );
}

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        nama: true,
        email: true,
        password: true,
        role: true,
        sekolah_id: true,
        status_akses: true,
        masa_aktif_mulai: true,
        masa_aktif_selesai: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const token = await createToken(user);
    const { password: _password, ...safeUser } = user;

    return res.json({
      success: true,
      token,
      user: safeUser,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error.",
    });
  }
});

router.post("/password-reset/request", async (req, res) => {
  try {
    const email = String(req.body?.email ?? "").toLowerCase().trim();
    if (!email) {
      return res.status(400).json({ success: false, message: "Email wajib diisi." });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, status_akses: true },
    });

    let resetUrl: string | null = null;
    let emailSent = false;
    if (user && user.status_akses === StatusAkses.aktif) {
      const token = crypto.randomBytes(32).toString("hex");
      const value = {
        user_id: user.id,
        email: user.email,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      };
      await prisma.appSetting.create({
        data: { key: passwordResetKey(token), value: value as Prisma.InputJsonValue },
      });
      resetUrl = publicResetUrl(req, token);
      const delivery = await sendPasswordResetEmail({ to: user.email, resetUrl });
      emailSent = delivery.sent;
    }

    return res.json({
      success: true,
      message: "Jika email terdaftar dan aktif, instruksi reset password telah disiapkan.",
      email_sent: emailSent,
      reset_url: process.env.NODE_ENV === "production" ? null : resetUrl,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal Server Error." });
  }
});

router.post("/password-reset/confirm", async (req, res) => {
  try {
    const token = String(req.body?.token ?? "");
    const password = String(req.body?.password ?? "");
    if (!token || !password) {
      return res.status(400).json({ success: false, message: "Token dan password baru wajib diisi." });
    }

    const settings = await getSecuritySettings();
    if (password.length < settings.password_min_length) {
      return res.status(400).json({ success: false, message: `Password minimal ${settings.password_min_length} karakter.` });
    }

    const key = passwordResetKey(token);
    const setting = await prisma.appSetting.findUnique({ where: { key } });
    const value = setting?.value && typeof setting.value === "object" && !Array.isArray(setting.value)
      ? setting.value as { user_id?: string; expires_at?: string }
      : {};
    if (!setting || !value.user_id || !value.expires_at || new Date(value.expires_at) < new Date()) {
      if (setting) await prisma.appSetting.delete({ where: { key } }).catch(() => undefined);
      return res.status(400).json({ success: false, message: "Token reset tidak valid atau sudah kedaluwarsa." });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    await prisma.$transaction([
      prisma.user.update({ where: { id: value.user_id }, data: { password: hashedPassword } }),
      prisma.appSetting.delete({ where: { key } }),
    ]);

    return res.json({ success: true, message: "Password berhasil direset. Silakan login dengan password baru." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal Server Error." });
  }
});

router.get("/me", authenticate, async (req: ScopedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        nama: true,
        email: true,
        role: true,
        sekolah_id: true,
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
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const now = new Date();
    const isLearningExpired =
      user.status_akses === StatusAkses.arsip ||
      (user.masa_aktif_selesai ? user.masa_aktif_selesai < now : false);

    return res.json({
      success: true,
      user,
      access: {
        canLogin: true,
        canAccessLearningMaterial: !isLearningExpired,
        canViewAssessmentResults: true,
        canViewCertificates: true,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error.",
    });
  }
});


router.patch("/me/password", authenticate, async (req: ScopedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { current_password, new_password } = req.body as {
      current_password?: string;
      new_password?: string;
    };

    if (!current_password || !new_password) {
      return res.status(400).json({
        success: false,
        message: "Password lama dan password baru wajib diisi.",
      });
    }

    const settings = await getSecuritySettings();

    if (new_password.length < settings.password_min_length) {
      return res.status(400).json({
        success: false,
        message: `Password baru minimal ${settings.password_min_length} karakter.`,
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, password: true },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const passwordMatches = await bcrypt.compare(current_password, user.password);

    if (!passwordMatches) {
      return res.status(400).json({
        success: false,
        message: "Password lama tidak sesuai.",
      });
    }

    const hashedPassword = await bcrypt.hash(new_password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return res.json({
      success: true,
      message: "Password berhasil diperbarui.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error.",
    });
  }
});

export default router;
