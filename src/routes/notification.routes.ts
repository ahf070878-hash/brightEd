import { Router } from "express";
import { Prisma, UserRole } from "@prisma/client";

import { getSecuritySettings } from "../lib/security-settings";
import { fail, getRequiredParam, ok } from "../lib/http";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middlewares/auth.middleware";
import type { ScopedRequest } from "../middlewares/rbac.middleware";

const router = Router();

type NotificationItem = {
  id: string;
  severity: "high" | "medium" | "info";
  title: string;
  body: string;
  target_tab: string;
  read?: boolean;
};

function readSettingKey(userId: string) {
  return `notifications_read:${userId}`;
}

function normalizeReadIds(value: unknown) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return Array.isArray(source.ids) ? source.ids.filter((id): id is string => typeof id === "string") : [];
}

async function getReadIds(userId: string) {
  const setting = await prisma.appSetting.findUnique({ where: { key: readSettingKey(userId) } });
  return new Set(normalizeReadIds(setting?.value));
}

async function saveReadIds(userId: string, ids: string[]) {
  const value = { ids: Array.from(new Set(ids)).slice(-250), updated_at: new Date().toISOString() };
  await prisma.appSetting.upsert({
    where: { key: readSettingKey(userId) },
    update: { value: value as Prisma.InputJsonValue },
    create: { key: readSettingKey(userId), value: value as Prisma.InputJsonValue },
  });
}

async function buildAdminNotifications(): Promise<NotificationItem[]> {
  const [users, skillhubs, enrollments, certificates, attempts, progresses, security] = await Promise.all([
    prisma.user.findMany({ where: { role: UserRole.peserta }, include: { sekolah: true } }),
    prisma.skillHub.findMany({ include: { courses: { include: { lessons: { include: { scorm_package: true } } } } } }),
    prisma.enrollment.findMany({ include: { user: true, skillhub: true } }),
    prisma.certificate.findMany({ where: { status: "active" }, include: { user: true, skillhub: true } }),
    prisma.assessmentAttempt.findMany({ include: { user: true, assessment: { include: { skillhub: true } } }, orderBy: { updated_at: "desc" } }),
    prisma.scormProgress.findMany({ include: { user: true, scorm_package: { include: { lesson: { include: { course: { include: { skillhub: true } } } } } } }, orderBy: { updated_at: "desc" } }),
    getSecuritySettings(),
  ]);

  const notifications: NotificationItem[] = [];
  const now = new Date();
  const soon = new Date(now);
  soon.setDate(now.getDate() + 14);

  const unresolvedLearners = enrollments.filter((enrollment) => {
    if (enrollment.user.status_akses !== "aktif") return false;
    const hasCertificate = certificates.some((certificate) => certificate.user_id === enrollment.user_id && certificate.skillhub_id === enrollment.skillhub_id);
    if (hasCertificate) return false;
    const passedAttempt = attempts.some((attempt) => attempt.user_id === enrollment.user_id && attempt.status_lulus && attempt.assessment.skillhub_id === enrollment.skillhub_id);
    if (passedAttempt) return false;
    const completedScorm = progresses.some((progress) => {
      const skillhubId = progress.scorm_package.lesson.course.skillhub_id;
      return progress.user_id === enrollment.user_id && skillhubId === enrollment.skillhub_id && ["completed", "passed"].includes(progress.status);
    });
    return !completedScorm;
  });

  const certificateReady = enrollments.filter((enrollment) => {
    const hasCertificate = certificates.some((certificate) => certificate.user_id === enrollment.user_id && certificate.skillhub_id === enrollment.skillhub_id);
    if (hasCertificate) return false;
    const passedAttempt = attempts.some((attempt) => attempt.user_id === enrollment.user_id && attempt.status_lulus && attempt.assessment.skillhub_id === enrollment.skillhub_id);
    const completedScorm = progresses.some((progress) => {
      const skillhubId = progress.scorm_package.lesson.course.skillhub_id;
      return progress.user_id === enrollment.user_id && skillhubId === enrollment.skillhub_id && ["completed", "passed"].includes(progress.status);
    });
    return passedAttempt || completedScorm;
  });

  const hubsWithoutMaterial = skillhubs.filter((hub) => !(hub.courses ?? []).some((course) => (course.lessons ?? []).some((lesson) => lesson.scorm_package)));
  const expiringUsers = users.filter((user) => {
    if (user.status_akses !== "aktif" || !user.masa_aktif_selesai) return false;
    const end = new Date(user.masa_aktif_selesai);
    return end >= now && end <= soon;
  });

  if (unresolvedLearners.length) notifications.push({
    id: "admin-learning-followup",
    severity: "high",
    title: "Learner perlu follow-up",
    body: `${unresolvedLearners.length} siswa aktif belum menyelesaikan pembelajaran yang ditugaskan.`,
    target_tab: "reports",
  });
  if (certificateReady.length) notifications.push({
    id: "admin-certificate-ready",
    severity: "high",
    title: "Sertifikat siap diterbitkan",
    body: `${certificateReady.length} hasil belajar sudah lulus tetapi belum punya sertifikat aktif.`,
    target_tab: "certificates",
  });
  if (hubsWithoutMaterial.length) notifications.push({
    id: "admin-content-without-material",
    severity: "medium",
    title: "SkillHub belum punya materi",
    body: `${hubsWithoutMaterial.length} SkillHub belum memiliki materi yang bisa dibuka siswa.`,
    target_tab: "content",
  });
  if (expiringUsers.length) notifications.push({
    id: "admin-access-expiring",
    severity: "medium",
    title: "Akses siswa hampir berakhir",
    body: `${expiringUsers.length} siswa aktif akan habis masa akses dalam 14 hari.`,
    target_tab: "students",
  });
  if (security.session_hours > 8 || security.password_min_length < 10) notifications.push({
    id: "admin-security-policy",
    severity: "info",
    title: "Security policy bisa diperketat",
    body: `Sesi ${security.session_hours} jam, password minimum ${security.password_min_length} karakter.`,
    target_tab: "settings",
  });

  return notifications;
}

async function buildParticipantNotifications(userId: string): Promise<NotificationItem[]> {
  const [enrollments, certificates] = await Promise.all([
    prisma.enrollment.findMany({
      where: { user_id: userId },
      include: { skillhub: { include: { courses: { include: { lessons: { include: { scorm_package: true } } } } } } },
    }),
    prisma.certificate.findMany({ where: { user_id: userId, status: "active" }, include: { skillhub: true } }),
  ]);
  const notifications: NotificationItem[] = [];
  const emptyHubs = enrollments.filter((enrollment) => !(enrollment.skillhub.courses ?? []).some((course) => (course.lessons ?? []).some((lesson) => lesson.scorm_package)));

  if (emptyHubs.length) notifications.push({
    id: "learner-material-pending",
    severity: "info",
    title: "Materi belum tersedia",
    body: `${emptyHubs.length} SkillHub sudah ditugaskan tetapi belum memiliki materi yang bisa dibuka.`,
    target_tab: "learning",
  });
  if (certificates.length) notifications.push({
    id: "learner-certificates-ready",
    severity: "info",
    title: "Sertifikat tersedia",
    body: `${certificates.length} sertifikat aktif bisa diunduh dari tab Sertifikat.`,
    target_tab: "certificates",
  });

  return notifications;
}

router.get("/notifications", authenticate, async (req: ScopedRequest, res) => {
  if (!req.user) return fail(res, 401, "Unauthorized");
  const items = req.user.role === UserRole.admin
    ? await buildAdminNotifications()
    : req.user.role === UserRole.peserta
      ? await buildParticipantNotifications(req.user.id)
      : [];
  const readIds = await getReadIds(req.user.id);
  return ok(res, { notifications: items.map((item) => ({ ...item, read: readIds.has(item.id) })) });
});

router.post("/notifications/:id/read", authenticate, async (req: ScopedRequest, res) => {
  if (!req.user) return fail(res, 401, "Unauthorized");
  const id = getRequiredParam(req.params, "id");
  if (!id) return fail(res, 400, "Notification id is required.");
  const readIds = await getReadIds(req.user.id);
  readIds.add(id);
  await saveReadIds(req.user.id, Array.from(readIds));
  return ok(res, { id, read: true });
});

router.post("/notifications/read-all", authenticate, async (req: ScopedRequest, res) => {
  if (!req.user) return fail(res, 401, "Unauthorized");
  const items = req.user.role === UserRole.admin
    ? await buildAdminNotifications()
    : req.user.role === UserRole.peserta
      ? await buildParticipantNotifications(req.user.id)
      : [];
  await saveReadIds(req.user.id, items.map((item) => item.id));
  return ok(res, { count: items.length });
});

export default router;
