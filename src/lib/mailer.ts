import nodemailer from "nodemailer";

type PasswordResetEmail = {
  to: string;
  resetUrl: string;
};

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

export function isEmailDeliveryConfigured() {
  return smtpConfigured();
}

function getSmtpPort() {
  const port = Number(process.env.SMTP_PORT ?? 587);
  return Number.isFinite(port) && port > 0 ? port : 587;
}

function createTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: getSmtpPort(),
    secure: process.env.SMTP_SECURE === "true" || getSmtpPort() === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
}

export async function sendPasswordResetEmail({ to, resetUrl }: PasswordResetEmail) {
  if (!smtpConfigured()) {
    return { sent: false, reason: "smtp_not_configured" as const };
  }

  const appName = process.env.APP_NAME ?? "BrightEd LMS";
  const from = process.env.SMTP_FROM!;
  const transporter = createTransporter();

  await transporter.sendMail({
    from,
    to,
    subject: `${appName} password reset`,
    text: [
      `Kami menerima permintaan reset password untuk akun ${appName}.`,
      "",
      `Buka link berikut untuk membuat password baru:`,
      resetUrl,
      "",
      "Link ini berlaku selama 30 menit. Abaikan email ini jika Anda tidak meminta reset password.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2b24">
        <h2 style="margin:0 0 12px">${appName} password reset</h2>
        <p>Kami menerima permintaan reset password untuk akun ${appName}.</p>
        <p><a href="${resetUrl}" style="display:inline-block;padding:12px 16px;border-radius:8px;background:#1f2b24;color:#fff;text-decoration:none">Reset password</a></p>
        <p>Link ini berlaku selama 30 menit. Abaikan email ini jika Anda tidak meminta reset password.</p>
      </div>
    `,
  });

  return { sent: true, reason: null };
}
