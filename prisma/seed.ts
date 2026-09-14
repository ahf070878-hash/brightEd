import "dotenv/config";

import bcrypt from "bcryptjs";
import {
  ContentStatus,
  ContentType,
  EnrollmentStatus,
  UserRole,
  StatusAkses,
} from "@prisma/client";

import { prisma } from "../src/lib/prisma";

const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@brighted.test";
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin12345!";
const adminName = process.env.SEED_ADMIN_NAME ?? "BrightEd Admin";

async function main() {
  const [password, pengawasPassword, fasilitatorPassword, siswaPassword] =
    await Promise.all([
      bcrypt.hash(adminPassword, 12),
      bcrypt.hash("Pengawas12345!", 12),
      bcrypt.hash("Fasilitator12345!", 12),
      bcrypt.hash("Siswa12345!", 12),
    ]);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      nama: adminName,
      role: UserRole.admin,
      status_akses: StatusAkses.aktif,
      password,
    },
    create: {
      nama: adminName,
      email: adminEmail,
      password,
      role: UserRole.admin,
      status_akses: StatusAkses.aktif,
    },
  });

  console.log(`Seeded admin user: ${admin.email}`);

  const sekolah = await prisma.sekolah.upsert({
    where: { kode_sekolah: "BRIGHTED-DEMO" },
    update: {
      nama: "Sekolah Demo BrightEd",
      alamat: "Data demo lokal",
    },
    create: {
      nama: "Sekolah Demo BrightEd",
      kode_sekolah: "BRIGHTED-DEMO",
      alamat: "Data demo lokal",
    },
  });

  const pengawas = await prisma.user.upsert({
    where: { email: "pengawas@brighted.test" },
    update: {
      nama: "Instructor Demo BrightEd",
      password: pengawasPassword,
      role: UserRole.pengawas,
      status_akses: StatusAkses.aktif,
      sekolah_id: sekolah.id,
    },
    create: {
      nama: "Instructor Demo BrightEd",
      email: "pengawas@brighted.test",
      password: pengawasPassword,
      role: UserRole.pengawas,
      status_akses: StatusAkses.aktif,
      sekolah_id: sekolah.id,
    },
  });

  const fasilitator = await prisma.user.upsert({
    where: { email: "fasilitator@brighted.test" },
    update: {
      nama: "Fasilitator Demo BrightEd",
      password: fasilitatorPassword,
      role: UserRole.fasilitator,
      status_akses: StatusAkses.aktif,
      sekolah_id: sekolah.id,
      pengawas_id: pengawas.id,
    },
    create: {
      nama: "Fasilitator Demo BrightEd",
      email: "fasilitator@brighted.test",
      password: fasilitatorPassword,
      role: UserRole.fasilitator,
      status_akses: StatusAkses.aktif,
      sekolah_id: sekolah.id,
      pengawas_id: pengawas.id,
    },
  });

  const activeStart = new Date();
  const activeEnd = new Date(activeStart);
  activeEnd.setFullYear(activeEnd.getFullYear() + 1);

  const siswa = await prisma.user.upsert({
    where: { email: "siswa@brighted.test" },
    update: {
      nama: "Siswa Demo BrightEd",
      password: siswaPassword,
      role: UserRole.peserta,
      status_akses: StatusAkses.aktif,
      sekolah_id: sekolah.id,
      fasilitator_id: fasilitator.id,
      masa_aktif_mulai: activeStart,
      masa_aktif_selesai: activeEnd,
    },
    create: {
      nama: "Siswa Demo BrightEd",
      email: "siswa@brighted.test",
      password: siswaPassword,
      role: UserRole.peserta,
      status_akses: StatusAkses.aktif,
      sekolah_id: sekolah.id,
      fasilitator_id: fasilitator.id,
      masa_aktif_mulai: activeStart,
      masa_aktif_selesai: activeEnd,
    },
  });

  console.log(`Seeded instructor user: ${pengawas.email}`);
  console.log(`Seeded facilitator user: ${fasilitator.email}`);
  console.log(`Seeded student user: ${siswa.email}`);

  const skillhub =
    (await prisma.skillHub.findFirst({
      where: { nama: "SkillHub Demo BrightEd" },
    })) ??
    (await prisma.skillHub.create({
      data: {
        nama: "SkillHub Demo BrightEd",
        deskripsi: "SkillHub demo untuk validasi role siswa dan fasilitator.",
        status: ContentStatus.publish,
      },
    }));

  const course =
    (await prisma.course.findFirst({
      where: {
        skillhub_id: skillhub.id,
        judul: "Course Demo BrightEd",
      },
    })) ??
    (await prisma.course.create({
      data: {
        skillhub_id: skillhub.id,
        judul: "Course Demo BrightEd",
        urutan: 1,
      },
    }));

  await prisma.lesson.upsert({
    where: {
      id:
        (
          await prisma.lesson.findFirst({
            where: {
              course_id: course.id,
              judul: "Lesson Pengenalan BrightEd",
            },
          })
        )?.id ?? "00000000-0000-0000-0000-000000000000",
    },
    update: {
      tipe_konten: ContentType.article,
      urutan: 1,
    },
    create: {
      course_id: course.id,
      judul: "Lesson Pengenalan BrightEd",
      tipe_konten: ContentType.article,
      urutan: 1,
    },
  });

  const existingAssessment = await prisma.assessment.findFirst({
    where: {
      skillhub_id: skillhub.id,
      judul: "Assessment Demo BrightEd",
    },
  });

  if (!existingAssessment) {
    await prisma.assessment.create({
      data: {
        skillhub_id: skillhub.id,
        judul: "Assessment Demo BrightEd",
        tipe: "quiz",
        konfigurasi: {
          passing_score: 70,
          max_attempts: 3,
          questions: [
            {
              id: "q1",
              prompt: "Apa fungsi utama SkillHub di LMS BrightEd?",
              options: [
                "Mengelola program belajar",
                "Menghapus data siswa",
                "Mengganti password admin",
              ],
              correct_answer: "Mengelola program belajar",
            },
            {
              id: "q2",
              prompt: "Apa yang tetap bisa dilihat siswa setelah masa belajar habis?",
              options: [
                "Materi belajar baru",
                "Hasil test dan sertifikat",
                "Panel administrasi",
              ],
              correct_answer: "Hasil test dan sertifikat",
            },
          ],
        },
      },
    });
  } else {
    await prisma.assessment.update({
      where: { id: existingAssessment.id },
      data: {
        konfigurasi: {
          passing_score: 70,
          max_attempts: 3,
          questions: [
            {
              id: "q1",
              prompt: "Apa fungsi utama SkillHub di LMS BrightEd?",
              options: [
                "Mengelola program belajar",
                "Menghapus data siswa",
                "Mengganti password admin",
              ],
              correct_answer: "Mengelola program belajar",
            },
            {
              id: "q2",
              prompt: "Apa yang tetap bisa dilihat siswa setelah masa belajar habis?",
              options: [
                "Materi belajar baru",
                "Hasil test dan sertifikat",
                "Panel administrasi",
              ],
              correct_answer: "Hasil test dan sertifikat",
            },
          ],
        },
      },
    });
  }

  await prisma.enrollment.upsert({
    where: {
      user_id_skillhub_id: {
        user_id: siswa.id,
        skillhub_id: skillhub.id,
      },
    },
    update: {
      status: EnrollmentStatus.enrolled,
      tanggal_assign: new Date(),
    },
    create: {
      user_id: siswa.id,
      skillhub_id: skillhub.id,
      status: EnrollmentStatus.enrolled,
      tanggal_assign: new Date(),
    },
  });

  console.log(`Seeded demo SkillHub enrollment for: ${siswa.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
