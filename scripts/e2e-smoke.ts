import "dotenv/config";

import AdmZip from "adm-zip";
import { PrismaClient } from "@prisma/client";

const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000/api";
const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@brighted.test";
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin12345!";
const prisma = new PrismaClient();
const created = {
  suffix: "",
  userIds: [] as string[],
  sekolahIds: [] as string[],
  skillhubIds: [] as string[],
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  token?: string;
  user?: unknown;
  access?: unknown;
  message?: string;
};

async function request<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
) {
  const headers = new Headers(options.headers);

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? ((await response.json()) as ApiResponse<T>)
    : undefined;

  if (!response.ok || payload?.success === false) {
    throw new Error(
      `${options.method ?? "GET"} ${path} failed: ${response.status} ${
        payload?.message ?? response.statusText
      }`,
    );
  }

  return (payload?.data ?? payload) as T;
}

function jsonBody(data: unknown) {
  return {
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  };
}

async function cleanupCreatedData() {
  const suffix = created.suffix;
  const userIds = Array.from(new Set(created.userIds));
  const sekolahIds = Array.from(new Set(created.sekolahIds));
  const skillhubIds = Array.from(new Set(created.skillhubIds));

  if (!suffix && !userIds.length && !sekolahIds.length && !skillhubIds.length) {
    return;
  }

  await prisma.activityLog.deleteMany({
    where: {
      OR: [
        ...(userIds.length ? [{ actor_id: { in: userIds } }, { entity_id: { in: userIds } }] : []),
        ...(sekolahIds.length ? [{ entity_id: { in: sekolahIds } }] : []),
        ...(skillhubIds.length ? [{ entity_id: { in: skillhubIds } }] : []),
        ...(suffix ? [{ description: { contains: suffix } }] : []),
      ],
    },
  });

  if (skillhubIds.length) {
    await prisma.skillHub.deleteMany({ where: { id: { in: skillhubIds } } });
  }
  if (userIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
  if (sekolahIds.length) {
    await prisma.sekolah.deleteMany({ where: { id: { in: sekolahIds } } });
  }

  if (suffix) {
    await prisma.user.deleteMany({ where: { email: { contains: `.demo.${suffix}@brighted.test` } } });
    await prisma.skillHub.deleteMany({ where: { nama: { contains: suffix } } });
    await prisma.sekolah.deleteMany({ where: { kode_sekolah: `DEMO-${suffix}` } });
  }
}

function createMinimalScormZip() {
  const zip = new AdmZip();

  zip.addFile(
    "imsmanifest.xml",
    Buffer.from(
      `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="brighted-demo" version="1.0">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="org1">
    <organization identifier="org1">
      <title>BrightEd Demo SCORM</title>
      <item identifier="item1" identifierref="resource1">
        <title>Demo Lesson</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="resource1" type="webcontent" adlcp:scormType="sco" href="index.html">
      <file href="index.html" />
    </resource>
  </resources>
</manifest>`,
      "utf8",
    ),
  );
  zip.addFile(
    "index.html",
    Buffer.from("<!doctype html><title>BrightEd Demo SCORM</title>", "utf8"),
  );

  return zip.toBuffer();
}

async function main() {
  const suffix = Date.now();
  created.suffix = String(suffix);

  const login = await request<{
    token: string;
    user: { id: string; email: string };
  }>("/auth/login", {
    method: "POST",
    ...jsonBody({
      email: adminEmail,
      password: adminPassword,
    }),
  });

  const token = login.token;
  console.log(`Admin login OK: ${login.user.email}`);

  const sekolah = await request<{ id: string; nama: string }>("/sekolah", {
    method: "POST",
    token,
    ...jsonBody({
      nama: `Sekolah Demo ${suffix}`,
      kode_sekolah: `DEMO-${suffix}`,
    }),
  });
  created.sekolahIds.push(sekolah.id);
  console.log(`Sekolah OK: ${sekolah.nama}`);

  const peserta = await request<{ id: string; email: string }>("/users", {
    method: "POST",
    token,
    ...jsonBody({
      nama: `Peserta Demo ${suffix}`,
      email: `peserta.demo.${suffix}@brighted.test`,
      password: "Peserta12345!",
      role: "peserta",
      sekolah_id: sekolah.id,
    }),
  });
  created.userIds.push(peserta.id);
  console.log(`Peserta OK: ${peserta.email}`);

  const skillhub = await request<{ id: string; nama: string }>("/skillhubs", {
    method: "POST",
    token,
    ...jsonBody({
      nama: `SkillHub Demo ${suffix}`,
      deskripsi: "Demo otomatis untuk smoke test BrightEd LMS.",
      status: "publish",
    }),
  });
  created.skillhubIds.push(skillhub.id);
  console.log(`SkillHub OK: ${skillhub.nama}`);

  const course = await request<{ id: string; judul: string }>(
    `/skillhubs/${skillhub.id}/courses`,
    {
      method: "POST",
      token,
      ...jsonBody({
        judul: "Course Demo",
        urutan: 1,
      }),
    },
  );
  console.log(`Course OK: ${course.judul}`);

  const lesson = await request<{ id: string; judul: string }>(
    `/courses/${course.id}/lessons`,
    {
      method: "POST",
      token,
      ...jsonBody({
        judul: "SCORM Demo",
        tipe_konten: "scorm",
        urutan: 1,
      }),
    },
  );
  console.log(`Lesson OK: ${lesson.judul}`);

  const formData = new FormData();
  const zipBuffer = createMinimalScormZip();
  const zipArrayBuffer = zipBuffer.buffer.slice(
    zipBuffer.byteOffset,
    zipBuffer.byteOffset + zipBuffer.byteLength,
  ) as ArrayBuffer;
  formData.set(
    "package",
    new Blob([zipArrayBuffer], { type: "application/zip" }),
    "brighted-demo-scorm.zip",
  );

  const scormPackage = await request<{ id: string }>(
    `/lessons/${lesson.id}/scorm/upload`,
    {
      method: "POST",
      token,
      body: formData,
    },
  );
  console.log(`SCORM upload OK: ${scormPackage.id}`);

  await request(`/enrollments/assign`, {
    method: "POST",
    token,
    ...jsonBody({
      user_id: peserta.id,
      skillhub_id: skillhub.id,
    }),
  });
  console.log("Enrollment OK");

  const assessment = await request<{ id: string; judul: string }>(
    `/skillhubs/${skillhub.id}/assessments`,
    {
      method: "POST",
      token,
      ...jsonBody({
        judul: "Assessment Demo",
        tipe: "quiz",
        konfigurasi: {
          passing_score: 70,
          max_attempts: 3,
        },
      }),
    },
  );
  console.log(`Assessment OK: ${assessment.judul}`);

  const pesertaLogin = await request<{ token: string }>("/auth/login", {
    method: "POST",
    ...jsonBody({
      email: peserta.email,
      password: "Peserta12345!",
    }),
  });

  await request(`/scorm/${scormPackage.id}/initialize`, {
    token: pesertaLogin.token,
  });
  await request(`/scorm/${scormPackage.id}/commit`, {
    method: "POST",
    token: pesertaLogin.token,
    ...jsonBody({
      status: "incomplete",
      skor: 40,
      waktu_belajar: 120,
      suspend_data: "page=1",
    }),
  });
  await request(`/scorm/${scormPackage.id}/finish`, {
    method: "POST",
    token: pesertaLogin.token,
    ...jsonBody({
      status: "completed",
      skor: 100,
      waktu_belajar: 240,
    }),
  });
  console.log("SCORM runtime OK");

  const attempt = await request<{ id: string }>(
    `/assessments/${assessment.id}/start`,
    {
      method: "POST",
      token: pesertaLogin.token,
    },
  );
  await request(`/assessment-attempts/${attempt.id}/submit`, {
    method: "POST",
    token: pesertaLogin.token,
    ...jsonBody({
      skor: 90,
    }),
  });
  console.log("Assessment attempt OK");

  const certificate = await request<{
    nomor_sertifikat: string;
    kode_verifikasi: string;
  }>("/certificates/generate", {
    method: "POST",
    token,
    ...jsonBody({
      user_id: peserta.id,
      skillhub_id: skillhub.id,
    }),
  });
  console.log(`Certificate OK: ${certificate.nomor_sertifikat}`);

  await request(
    `/public/certificates/verify/${certificate.kode_verifikasi}`,
  );
  console.log("Public certificate verification OK");

  console.log("End-to-end smoke test completed successfully.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanupCreatedData();
      console.log("E2E smoke test cleanup completed.");
    } finally {
      await prisma.$disconnect();
    }
  });
