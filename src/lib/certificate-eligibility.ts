import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export function assessmentConfig(value: Prisma.JsonValue) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

// SCORM exams are explicit requirements; unconfigured SkillHubs retain their existing rules.
export async function hasPassedCertificateRequirements(userId: string, skillhubId: string) {
  const assessments = (await prisma.assessment.findMany({ where: { skillhub_id: skillhubId } }))
    .filter(item => assessmentConfig(item.konfigurasi).archived !== true && assessmentConfig(item.konfigurasi).certificate_required !== false);
  const scormExams = assessments.filter(item => item.tipe === "scorm");
  for (const exam of scormExams) {
    const config = assessmentConfig(exam.konfigurasi);
    const packageId = config.scorm_package_id;
    const threshold = config.passing_score;
    if (typeof packageId !== "string" || typeof threshold !== "number" || threshold < 0 || threshold > 100) return false;
    const progress = await prisma.scormProgress.findFirst({ where: {
      user_id: userId, scorm_package_id: packageId,
      scorm_package: { lesson: { tipe_konten: "scorm", course: { skillhub_id: skillhubId } } },
    } });
    if (!progress || progress.status !== "passed" || progress.skor === null || Number(progress.skor) < threshold) return false;
  }
  const regularIds = assessments.filter(item => item.tipe !== "scorm").map(item => item.id);
  if (!regularIds.length) return true;
  return Boolean(await prisma.assessmentAttempt.findFirst({ where: {
    user_id: userId, status_lulus: true, assessment_id: { in: regularIds },
  } }));
}
