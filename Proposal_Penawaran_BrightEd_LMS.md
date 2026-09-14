# Proposal Penawaran Pengembangan BrightEd LMS

Tanggal: 14 September 2026  
Nilai penawaran maksimal: **Rp75.000.000**  
Paket: **Production MVP / Pilot Operasional**

## 1. Ringkasan Penawaran

Proposal ini menawarkan pengembangan dan penyempurnaan aplikasi **BrightEd LMS**, sebuah Learning Management System untuk pengelolaan SkillHub, materi SCORM, penilaian, pendaftaran siswa, sertifikasi, dan laporan operasional.

Dengan batas harga maksimal Rp75.000.000, ruang lingkup diposisikan sebagai **Production MVP / Pilot Operasional**: aplikasi siap digunakan untuk operasional awal, demo komersial, pilot lembaga/sekolah, dan validasi kebutuhan bisnis sebelum pengembangan enterprise lanjutan.

## 2. Tujuan Implementasi

- Menyediakan LMS internal BrightEd yang dapat mengelola siswa tanpa login sekolah.
- Memungkinkan admin dan fasilitator mendaftarkan siswa.
- Mengelola masa keanggotaan siswa 1 tahun.
- Mengunci materi belajar setelah masa aktif selesai, tetapi tetap membuka akses hasil test dan sertifikat.
- Mengelola konten belajar berbasis SkillHub dan SCORM.
- Menyediakan penilaian, sertifikat PDF, audit log, dan laporan progress.

## 3. Ruang Lingkup Fitur

### 3.1 Autentikasi dan Hak Akses

- Login berbasis email dan password.
- JWT authentication.
- Role utama: Admin, Fasilitator, Instructor/Pengawas/Manager, Siswa.
- Data scope per role.
- Role & Permission Matrix editable dari menu Setting.
- Sidebar admin mengikuti permission aktif.

### 3.2 Manajemen Siswa

- Tambah siswa oleh admin.
- Import siswa massal dari CSV/XLS/XLSX.
- Download template import siswa.
- Edit profil siswa.
- Reset password siswa.
- Archive/aktifkan siswa.
- Assign siswa ke SkillHub dari kolom action.
- Sorting, filter, dan pagination nyata.

### 3.3 Manajemen User Aplikasi

- Menu khusus User Aplikasi.
- Kelola Admin, Fasilitator, dan Manager.
- Tambah, view, edit, reset password, archive/aktifkan.
- Sorting, filter, dan pagination.

### 3.4 Manajemen Sekolah

- Menu Sekolah terpisah.
- Tambah sekolah.
- View detail sekolah.
- Edit sekolah.
- Archive sekolah.
- Tabel sekolah dengan layout konsisten.

### 3.5 SkillHub dan Kurikulum

- Membuat SkillHub.
- Mengubah status draft/publish.
- Membuat course.
- Membuat lesson.
- Menyusun urutan materi.
- Menampilkan struktur SkillHub, course, lesson, assessment, dan SCORM.

### 3.6 SCORM

- Upload paket SCORM ZIP.
- SCORM runtime initialize.
- Commit progress SCORM.
- Finish progress SCORM.
- Tracking status SCORM.
- Tracking skor SCORM.
- Tracking waktu belajar.
- Rekap progress SCORM global untuk laporan.

### 3.7 Penilaian / Assessment

- Membuat assessment/quiz.
- Konfigurasi passing score.
- Konfigurasi maksimal attempt.
- Submit assessment oleh siswa.
- Riwayat hasil test.
- Status lulus/tidak lulus.
- Laporan hasil test.

### 3.8 Enrollment

- Assign siswa ke SkillHub oleh admin.
- Update status enrollment.
- View enrollment terbaru.
- Data enrollment masuk dalam laporan.

### 3.9 Sertifikasi

- Generate sertifikat PDF.
- Nomor sertifikat unik.
- Kode verifikasi unik.
- Public certificate verification.
- Download PDF sertifikat.
- Revoke sertifikat.
- Setting sertifikat dinamis:
  - Nama institusi / judul.
  - Nama dokumen.
  - Label nama peserta.
  - Label materi.
  - Label tanggal selesai.
  - Sumber tanggal selesai.
  - Upload gambar/header sertifikat PNG/JPG.

### 3.10 Audit Log

Audit log mencatat aktivitas penting, termasuk:

- Import siswa.
- Assign SkillHub.
- Perubahan status akses.
- Upload SCORM.
- Generate sertifikat.
- Revoke sertifikat.
- Submit assessment.
- Create/update/reset/archive user aplikasi.
- Update permission.
- Update setting sertifikat.

### 3.11 Laporan

- Rekap siswa dan hasil belajar.
- Rekap enrollment.
- Rekap nilai assessment.
- Rekap status lulus.
- Rekap sertifikat.
- Rekap progress SCORM.
- Export laporan CSV.

### 3.12 UI/UX

- Theme mengikuti gaya BrightEd Akademi.
- Dashboard full page dan responsive.
- Layout dinamis mengikuti resolusi layar.
- Sidebar menu kiri dengan toggle.
- Card menu dan card utama terpisah.
- Toast notification kanan atas.
- Mobile view priority.
- Tabel siswa, sekolah, user aplikasi, dan audit log dibuat rapi dengan filter, sorting, dan pagination.

## 4. Teknologi

- Node.js
- TypeScript
- Express.js
- Prisma ORM
- PostgreSQL
- HTML, CSS, JavaScript frontend
- Docker untuk database lokal/deployment awal

## 5. Deliverables

- Source code aplikasi BrightEd LMS.
- Database schema Prisma.
- Backend API LMS.
- Frontend admin, fasilitator/manager, dan siswa.
- Seed/demo account.
- Dokumentasi ringkas penggunaan dan kredensial demo.
- Setup lokal/deployment awal.
- Validasi build dan smoke test.

## 6. Harga Penawaran

Total harga penawaran maksimal:

**Rp75.000.000**

Rincian estimasi:

| Komponen | Nilai |
|---|---:|
| Backend LMS, database, auth, RBAC | Rp18.000.000 |
| Manajemen siswa, user aplikasi, sekolah, import | Rp14.000.000 |
| SkillHub, SCORM, assessment, enrollment | Rp18.000.000 |
| Sertifikat PDF, setting dinamis, public verification | Rp9.000.000 |
| Dashboard, laporan, audit log, UI responsive | Rp11.000.000 |
| Testing, setup, dokumentasi, handover | Rp5.000.000 |
| **Total** | **Rp75.000.000** |

## 7. Skema Pembayaran

Opsi pembayaran yang disarankan:

- 40% saat project dimulai: Rp30.000.000.
- 40% saat fitur inti selesai dan bisa diuji: Rp30.000.000.
- 20% setelah handover dan validasi akhir: Rp15.000.000.

## 8. Estimasi Waktu

Estimasi pengerjaan dan finalisasi: **4 sampai 6 minggu kerja**, bergantung pada kesiapan materi, feedback, dan revisi.

Tahapan:

1. Finalisasi scope dan setup - 3 sampai 5 hari kerja.
2. Backend dan database - 7 sampai 10 hari kerja.
3. Frontend dashboard dan role flow - 8 sampai 12 hari kerja.
4. SCORM, assessment, sertifikat, laporan - 8 sampai 12 hari kerja.
5. Testing, perapihan UI, dokumentasi, handover - 5 sampai 7 hari kerja.

## 9. Batasan Paket Rp75 Juta

Paket ini mencakup MVP operasional. Item berikut belum termasuk dan dapat ditawarkan sebagai fase lanjutan:

- SSO enterprise.
- Payment gateway.
- Multi-tenant penuh per organisasi.
- Mobile app native Android/iOS.
- SLA 24/7.
- Penetration test formal pihak ketiga.
- Integrasi HRIS/ERP eksternal.
- Email/SMS/WhatsApp notification production.
- Object storage production seperti S3/Cloudflare R2.
- CI/CD production tingkat enterprise.

## 10. Garansi dan Support

- Garansi bug fixing selama 30 hari setelah handover.
- Support penggunaan awal selama masa garansi.
- Perubahan fitur di luar scope dihitung sebagai change request.

Opsional maintenance setelah garansi:

- Maintenance ringan: Rp5.000.000/bulan.
- Maintenance standar: Rp8.000.000/bulan.
- Maintenance plus pengembangan minor: Rp12.000.000/bulan.

## 11. Kredensial Demo

| Role | Email | Password |
|---|---|---|
| Admin | admin@brighted.test | Admin12345! |
| Fasilitator | fasilitator@brighted.test | Fasilitator12345! |
| Instructor/Pengawas | pengawas@brighted.test | Pengawas12345! |

## 12. Penutup

Dengan nilai Rp75.000.000, BrightEd mendapatkan LMS custom yang sudah mencakup proses utama pembelajaran, administrasi siswa, SCORM, assessment, sertifikasi, laporan, audit log, dan setting operasional. Paket ini ideal untuk pilot production dan dapat dikembangkan bertahap menuju versi enterprise sesuai kebutuhan bisnis berikutnya.
