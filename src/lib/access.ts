import { StatusAkses, User } from "@prisma/client";

type LearningAccessUser = Pick<
  User,
  "status_akses" | "masa_aktif_mulai" | "masa_aktif_selesai"
>;

export function getDefaultLearningWindow(startDate = new Date()) {
  const endDate = new Date(startDate);
  endDate.setFullYear(endDate.getFullYear() + 1);

  return {
    masa_aktif_mulai: startDate,
    masa_aktif_selesai: endDate,
  };
}

export function isLearningExpired(user: LearningAccessUser) {
  return (
    user.status_akses === StatusAkses.arsip ||
    (user.masa_aktif_selesai ? user.masa_aktif_selesai < new Date() : false)
  );
}

export function getLearningAccess(user: LearningAccessUser) {
  const expired = isLearningExpired(user);

  return {
    canLogin: true,
    canAccessLearningMaterial: !expired,
    canViewAssessmentResults: true,
    canViewCertificates: true,
  };
}
