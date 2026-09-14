# BrightEd LMS Backend

Backend LMS BrightEd menggunakan Node.js, TypeScript, Express, Prisma ORM, dan PostgreSQL.

## Setup lokal

1. Salin environment:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Jalankan PostgreSQL:

   ```powershell
   docker compose up -d
   ```

3. Jalankan migration dan seed admin:

   ```powershell
   pnpm prisma:migrate
   pnpm prisma:seed
   ```

4. Jalankan server:

   ```powershell
   pnpm dev
   ```

Default admin seed:

- Email: `admin@brighted.test`
- Password: `Admin12345!`

## Smoke test end-to-end

Setelah database dan server aktif, jalankan:

```powershell
pnpm smoke:e2e
```

Skrip ini menjalankan flow utama:

1. Admin login.
2. Admin membuat sekolah, peserta, SkillHub, course, lesson, dan assessment.
3. Admin upload paket SCORM demo.
4. Admin mendaftarkan peserta ke SkillHub.
5. Peserta login, initialize/commit/finish SCORM.
6. Peserta submit assessment.
7. Admin generate sertifikat.
8. Public certificate verification dijalankan.

## Endpoint utama

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/users`
- `POST /api/skillhubs`
- `POST /api/skillhubs/:skillhub_id/courses`
- `POST /api/courses/:course_id/lessons`
- `POST /api/lessons/:lesson_id/scorm/upload`
- `GET /api/scorm/:scorm_package_id/initialize`
- `POST /api/scorm/:scorm_package_id/commit`
- `POST /api/scorm/:scorm_package_id/finish`
- `POST /api/skillhubs/:skillhub_id/assessments`
- `POST /api/assessments/:id/start`
- `POST /api/assessment-attempts/:attempt_id/submit`
- `POST /api/certificates/generate`
- `GET /api/public/certificates/verify/:kode_verifikasi`
- `GET /api/public/certificates/download/:kode_verifikasi`
