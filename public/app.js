const heroPanel = document.querySelector(".hero-panel");
const moduleOverview = document.querySelector(".dashboard-panel");
const loginPanel = document.querySelector(".login-panel");
const adminDashboard = document.querySelector("[data-admin-dashboard]");

let authToken = localStorage.getItem("brighted_token") ?? "";
let currentUser = null;
let inAppNotifications = [];
let dashboardState = {
  sekolah: [],
  users: [],
  skillhubs: [],
  enrollments: [],
  certificates: [],
  scormProgresses: [],
  attempts: [],
  activityLogs: [],
  permissions: {},
  certificateSettings: {},
};
let studentState = {
  enrollments: [],
  skillhubs: [],
  certificates: [],
  assessmentHistories: {},
};
let staffState = {
  users: [],
  enrollments: [],
  skillhubs: [],
  certificates: [],
  scormProgresses: [],
  attempts: [],
};
let adminStudentFilters = {
  search: "",
  status: "",
  sekolah_id: "",
};
let schoolFilters = {
  search: "",
};
let appUserFilters = {
  search: "",
  role: "",
  status: "",
};
let staffStudentFilters = {
  search: "",
  status: "",
};
let adminStudentSort = { key: "nama", direction: "asc" };
let schoolSort = { key: "nama", direction: "asc" };
let appUserSort = { key: "nama", direction: "asc" };
let staffStudentSort = { key: "nama", direction: "asc" };
let auditLogSort = { key: "created_at", direction: "desc" };
let adminStudentPage = 1;
let schoolPage = 1;
let appUserPage = 1;
let staffStudentPage = 1;
let auditLogPage = 1;
let activeAdminStudentTool = "";
let activeSchoolTool = "";
let activeAppUserTool = "";
let selectedAppUserId = "";
let selectedSchoolId = "";
let selectedAssignStudentId = "";
let pendingDangerAction = null;
const STUDENT_PAGE_SIZE = 10;
const SCHOOL_PAGE_SIZE = 10;
const APP_USER_PAGE_SIZE = 10;
const AUDIT_LOG_PAGE_SIZE = 10;
const PERMISSION_ROLES = [
  ["admin", "Admin"],
  ["fasilitator", "Fasilitator"],
  ["pengawas", "Manager"],
  ["peserta", "Siswa"],
];
const PERMISSION_FEATURES = [
  ["students", "Siswa", "Kelola data siswa dan import massal."],
  ["schools", "Sekolah", "Kelola referensi sekolah."],
  ["app-users", "User", "Kelola akun Admin, Fasilitator, dan Manager."],
  ["content", "SkillHub & SCORM", "Kelola SkillHub, course, lesson, dan upload SCORM."],
  ["assessment", "Penilaian", "Kelola assessment dan hasil test."],
  ["certificates", "Sertifikasi", "Generate, revoke, verify, dan download sertifikat."],
  ["reports", "Laporan", "Lihat rekap enrollment, nilai, sertifikat, dan progress SCORM."],
  ["audit", "Audit Log", "Lihat catatan aktivitas penting."],
  ["settings", "Setting", "Kelola konfigurasi sistem dan permission."],
];
const DEFAULT_PERMISSIONS = {
  students: { admin: true, fasilitator: true, pengawas: true, peserta: false },
  schools: { admin: true, fasilitator: false, pengawas: true, peserta: false },
  "app-users": { admin: true, fasilitator: false, pengawas: false, peserta: false },
  content: { admin: true, fasilitator: false, pengawas: true, peserta: true },
  assessment: { admin: true, fasilitator: false, pengawas: true, peserta: true },
  certificates: { admin: true, fasilitator: false, pengawas: true, peserta: true },
  reports: { admin: true, fasilitator: true, pengawas: true, peserta: false },
  audit: { admin: true, fasilitator: false, pengawas: false, peserta: false },
  settings: { admin: true, fasilitator: false, pengawas: false, peserta: false },
};
const DEFAULT_CERTIFICATE_TEXT_CONFIG = {
  name: { x: 50, y: 52, size: 120, color: "#1A1A2E", weight: "bold", align: "center" },
  title: { x: 50, y: 63, size: 70, color: "#333366", weight: "bold", align: "center" },
  date: { x: 50, y: 73, size: 55, color: "#666666", weight: "normal", align: "center" },
};
const CERTIFICATE_TEXT_FIELDS = [
  ["name", "Nama peserta", "Budi Santoso"],
  ["title", "Judul SkillHub", "Pelatihan K3 Maritim"],
  ["date", "Tanggal", "15 September 2026"],
];
const DEFAULT_CERTIFICATE_SETTINGS = {
  title: "BrightEd Akademi",
  subtitle: "Sertifikat Penyelesaian",
  recipient_label: "Diberikan kepada",
  material_label: "Atas penyelesaian program",
  completion_label: "Tanggal Selesai",
  date_source: "certificate_date",
  asset_path: null,
  text_config: DEFAULT_CERTIFICATE_TEXT_CONFIG,
};
let activeAdminTab = "overview";
let activeSettingTab = "summary";
let activeStaffTab = "students";
let staffSidebarCollapsed = false;
let activeStudentTab = "learning";
let studentSidebarCollapsed = false;
let selectedSkillhubBuilderId = "";
let adminSidebarCollapsed = false;
let reportFilters = {
  search: "",
  skillhub_id: "",
  status_akses: "",
  status_lulus: "",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function localizeMarkup(markup) {
  return typeof uiMarkup === "function" ? uiMarkup(markup) : markup;
}

function localizeText(message) {
  return typeof tr === "function" ? tr(message) : message;
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function toDateInputValue(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : "Terjadi kesalahan.";
}

async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers);

  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message ?? `Request gagal: ${response.status}`);
  }

  return payload?.data ?? payload;
}

function jsonOptions(data) {
  return {
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  };
}

function setLoginPanelLoading(isLoading) {
  const button = loginPanel?.querySelector("button[type='submit']");

  if (!button) {
    return;
  }

  button.disabled = isLoading;
  button.textContent = isLoading ? localizeText("Memproses...") : localizeText("Masuk");
}

function setLoginMessage(message) {
  const note = loginPanel?.querySelector(".panel-note");

  if (note) {
    note.textContent = message;
  }
}

function setAuthenticatedLayout(isAuthenticated) {
  if (heroPanel) {
    heroPanel.hidden = isAuthenticated;
  }
  if (moduleOverview) {
    moduleOverview.hidden = isAuthenticated;
  }
}

function logoutUser() {
  localStorage.removeItem("brighted_token");
  authToken = "";
  currentUser = null;
  setAuthenticatedLayout(false);
  renderLoginForm();
  renderAdminDashboard(false);
  renderStudentDashboard(false);
  renderStaffDashboard(false);
  window.location.hash = "login";
}

function bindLogoutButtons(root = document) {
  root?.querySelectorAll("[data-logout]").forEach((button) => {
    button.setAttribute("data-logout-bound", "true");
  });
}

document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }

  const profileButton = event.target.closest("[data-show-profile]");
  if (profileButton) {
    event.preventDefault();
    showProfilePanel();
    profileButton.closest("details")?.removeAttribute("open");
    return;
  }

  const closeProfileButton = event.target.closest("[data-close-profile]");
  if (closeProfileButton) {
    event.preventDefault();
    closeProfilePanel();
    return;
  }

  const closeStudentDetailButton = event.target.closest("[data-close-student-detail]");
  if (closeStudentDetailButton) {
    event.preventDefault();
    closeStudentDetail();
    return;
  }

  const closeStudentToolButton = event.target.closest("[data-close-student-tool]");
  if (closeStudentToolButton) {
    event.preventDefault();
    closeStudentToolDialog();
    activeAdminStudentTool = "";
    selectedAssignStudentId = "";
    return;
  }

  const studentDetailButton = event.target.closest("[data-view-student]");
  if (studentDetailButton) {
    event.preventDefault();
    openStudentDetail(studentDetailButton.getAttribute("data-view-student"));
    return;
  }

  const resetStudentPasswordButton = event.target.closest("[data-reset-student-password]");
  if (resetStudentPasswordButton) {
    event.preventDefault();
    openResetPasswordConfirm(resetStudentPasswordButton.getAttribute("data-reset-student-password"));
    return;
  }

  const toggleStudentStatusButton = event.target.closest("[data-toggle-student-status]");
  if (toggleStudentStatusButton) {
    event.preventDefault();
    openStudentStatusConfirm(
      toggleStudentStatusButton.getAttribute("data-toggle-student-status"),
      toggleStudentStatusButton.getAttribute("data-next-status"),
    );
    return;
  }

  const closeConfirmButton = event.target.closest("[data-close-confirm-action]");
  if (closeConfirmButton) {
    const isBackdrop = closeConfirmButton.classList.contains("confirm-backdrop");
    const isBackdropClick = isBackdrop && event.target === closeConfirmButton;
    const isCloseControl = !isBackdrop;
    if (isBackdropClick || isCloseControl) {
      event.preventDefault();
      closeDangerActionModal();
      return;
    }
  }

  const assignStudentButton = event.target.closest("[data-open-assign-student]");
  if (assignStudentButton) {
    event.preventDefault();
    activeAdminTab = "students";
    openStudentToolDialog("assign", assignStudentButton.getAttribute("data-open-assign-student") ?? "");
    return;
  }

  const schoolToolButton = event.target.closest("[data-open-school-tool]");
  if (schoolToolButton) {
    event.preventDefault();
    activeAdminTab = "schools";
    openSchoolActionDialog(
      schoolToolButton.getAttribute("data-open-school-tool") ?? "",
      schoolToolButton.getAttribute("data-school-id") ?? "",
    );
    return;
  }

  const closeSchoolToolButton = event.target.closest("[data-close-school-tool]");
  if (closeSchoolToolButton) {
    event.preventDefault();
    closeSchoolActionDialog();
    activeSchoolTool = "";
    selectedSchoolId = "";
    return;
  }

  const archiveSchoolButton = event.target.closest("[data-archive-school]");
  if (archiveSchoolButton) {
    event.preventDefault();
    openSchoolArchiveConfirm(archiveSchoolButton.getAttribute("data-archive-school"));
    return;
  }

  const appUserToolButton = event.target.closest("[data-open-app-user-tool]");
  if (appUserToolButton) {
    event.preventDefault();
    activeAdminTab = "settings";
    activeSettingTab = "user";
    openAppUserActionDialog(
      appUserToolButton.getAttribute("data-open-app-user-tool") ?? "",
      appUserToolButton.getAttribute("data-user-id") ?? "",
    );
    return;
  }

  const closeAppUserToolButton = event.target.closest("[data-close-app-user-tool]");
  if (closeAppUserToolButton) {
    event.preventDefault();
    closeAppUserActionDialog();
    activeAppUserTool = "";
    selectedAppUserId = "";
    return;
  }

  const resetAppUserPasswordButton = event.target.closest("[data-reset-app-user-password]");
  if (resetAppUserPasswordButton) {
    event.preventDefault();
    openAppUserResetConfirm(resetAppUserPasswordButton.getAttribute("data-reset-app-user-password"));
    return;
  }

  const toggleAppUserStatusButton = event.target.closest("[data-toggle-app-user-status]");
  if (toggleAppUserStatusButton) {
    event.preventDefault();
    openAppUserStatusConfirm(
      toggleAppUserStatusButton.getAttribute("data-toggle-app-user-status"),
      toggleAppUserStatusButton.getAttribute("data-next-status"),
    );
    return;
  }

  const toggleLoginPasswordButton = event.target.closest("[data-toggle-login-password]");
  if (toggleLoginPasswordButton) {
    event.preventDefault();
    const field = loginPanel?.querySelector("[data-login-password]");
    if (field instanceof HTMLInputElement) {
      const shouldShow = field.type === "password";
      field.type = shouldShow ? "text" : "password";
      toggleLoginPasswordButton.setAttribute("aria-pressed", String(shouldShow));
      toggleLoginPasswordButton.setAttribute("aria-label", shouldShow ? localizeText("Sembunyikan password") : localizeText("Lihat password"));
      toggleLoginPasswordButton.querySelector("[data-password-toggle-text]").textContent = shouldShow ? localizeText("Sembunyikan") : localizeText("Lihat");
      toggleLoginPasswordButton.querySelector("[data-password-toggle-icon]").textContent = shouldShow ? "✦" : "👁";
      field.focus({ preventScroll: true });
    }
    return;
  }

  const logoutButton = event.target.closest("[data-logout]");

  if (!logoutButton) {
    return;
  }

  event.preventDefault();
  logoutUser();
});

function renderLoginForm(message = "Demo admin: admin@brighted.test / Admin12345!") {
  if (!loginPanel) {
    return;
  }

  loginPanel.innerHTML = localizeMarkup(`
    <div>
      <p class="eyebrow">Masuk akun</p>
      <h2>Selamat datang kembali</h2>
    </div>
    <form data-login-form>
      <label>
        Email
        <input
          name="email"
          type="email"
          placeholder="nama@email.com"
          value="admin@brighted.test"
          autocomplete="email"
          required
        />
      </label>
      <label>
        Password
        <span class="login-password-control">
          <input
            data-login-password
            name="password"
            type="password"
            placeholder="Password"
            value="Admin12345!"
            autocomplete="current-password"
            required
          />
          <button
            class="password-toggle"
            type="button"
            data-toggle-login-password
            aria-label="Lihat password"
            aria-pressed="false"
          >
            <span aria-hidden="true" data-password-toggle-icon>👁</span>
            <span data-password-toggle-text>Lihat</span>
          </button>
        </span>
      </label>
      <button class="button button-primary" type="submit">Masuk</button>
    </form>
    <p class="panel-note" role="status">${escapeHtml(message)}</p>
  `);

  loginPanel.querySelector("[data-login-form]")?.addEventListener("submit", handleLogin);
}

function renderSignedInState(user, access) {
  if (!loginPanel) {
    return;
  }

  const accessText = access?.canAccessLearningMaterial
    ? "Materi belajar aktif"
    : "Akses materi terkunci; hasil test dan sertifikat tetap tersedia";

  loginPanel.innerHTML = `
    <div>
      <p class="eyebrow">Sesi aktif</p>
      <h2>Berhasil masuk</h2>
    </div>
    <div class="account-card">
      <strong>${escapeHtml(user.nama)}</strong>
      <span>${escapeHtml(user.email)}</span>
      <span>Role: ${escapeHtml(user.role)}</span>
      <span>Status: ${accessText}</span>
    </div>
    <button class="button button-secondary" type="button" data-logout>Keluar</button>
  `;

  bindLogoutButtons(loginPanel);
}

function getRoleLabel(role) {
  const labels = {
    admin: "Admin",
    peserta: "Siswa",
    fasilitator: "Fasilitator",
    pengawas: "Instructor / Pengawas",
  };

  return labels[role] ?? role ?? "User";
}

function getStudentDisplayId(user) {
  return `STD-${String(user.id ?? "").replaceAll("-", "").slice(0, 8).toUpperCase() || "00000000"}`;
}

function renderStudentStatusBadge(status) {
  const normalized = String(status ?? "-").toLowerCase();
  const label = normalized === "aktif" ? "Aktif" : normalized === "arsip" ? "Arsip" : status;
  return `<span class="member-badge status-${escapeHtml(normalized)}">${escapeHtml(label)}</span>`;
}

function renderStudentRoleBadge(role) {
  return `<span class="member-badge role-badge">${escapeHtml(getRoleLabel(role))}</span>`;
}

function renderStudentActionButtons(user) {
  const nextStatus = user.status_akses === "aktif" ? "arsip" : "aktif";
  const nextStatusLabel = nextStatus === "aktif" ? "Aktifkan" : "Arsipkan";
  const nextStatusClass = nextStatus === "aktif" ? "button-success" : "button-danger";
  const assignButton = currentUser?.role === "admin"
    ? `<button class="mini-action" type="button" title="Assign SkillHub" data-open-assign-student="${escapeHtml(user.id)}">${renderNavIcon("content")} SkillHub</button>`
    : "";

  return `
    <div class="member-actions">
      <button class="mini-action" type="button" data-view-student="${escapeHtml(user.id)}">Detail</button>
      ${assignButton}
      <button class="mini-action" type="button" data-reset-student-password="${escapeHtml(user.id)}">Reset</button>
      <button class="mini-action ${nextStatusClass}" type="button" data-toggle-student-status="${escapeHtml(user.id)}" data-next-status="${escapeHtml(nextStatus)}">${nextStatusLabel}</button>
    </div>
  `;
}

function renderUserMenu() {
  if (!currentUser) {
    return "";
  }

  const initials = currentUser.nama
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return `
    <details class="user-menu">
      <summary>
        <span class="avatar">${escapeHtml(initials || "U")}</span>
        <span class="user-chip-copy">
          <strong>${escapeHtml(currentUser.nama)}</strong>
          <small>${escapeHtml(getRoleLabel(currentUser.role))}</small>
        </span>
      </summary>
      <div class="profile-menu" role="menu">
        <p class="eyebrow">Profile</p>
        <strong>${escapeHtml(currentUser.nama)}</strong>
        <span>${escapeHtml(currentUser.email)}</span>
        <span>Role: ${escapeHtml(getRoleLabel(currentUser.role))}</span>
        <button class="button button-ghost" type="button" data-show-profile>Profile</button>
        <button class="button button-secondary" type="button" data-logout>Exit</button>
      </div>
    </details>
  `;
}

function normalizePermissionMatrix(matrix = {}) {
  const normalized = JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS));

  PERMISSION_FEATURES.forEach(([featureKey]) => {
    PERMISSION_ROLES.forEach(([roleKey]) => {
      if (matrix?.[featureKey]?.[roleKey] !== undefined) {
        normalized[featureKey][roleKey] = Boolean(matrix[featureKey][roleKey]);
      }
    });
  });

  normalized.settings.admin = true;
  return normalized;
}

function clampNumber(value, fallback, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(Math.max(numeric, min), max);
}

function normalizeCertificateTextField(field = {}, fallback) {
  const align = ["left", "center", "right"].includes(field?.align) ? field.align : fallback.align;
  const color = typeof field?.color === "string" && /^#[0-9a-f]{6}$/i.test(field.color)
    ? field.color
    : fallback.color;

  return {
    x: clampNumber(field?.x, fallback.x, 0, 100),
    y: clampNumber(field?.y, fallback.y, 0, 100),
    size: clampNumber(field?.size, fallback.size, 1, 150),
    color,
    weight: field?.weight === "bold" || field?.weight === "normal" ? field.weight : fallback.weight,
    align,
  };
}

function normalizeCertificateTextConfig(config = {}) {
  const source = config && typeof config === "object" ? config : {};
  return {
    name: normalizeCertificateTextField(source.name, DEFAULT_CERTIFICATE_TEXT_CONFIG.name),
    title: normalizeCertificateTextField(source.title ?? source.course, DEFAULT_CERTIFICATE_TEXT_CONFIG.title),
    date: normalizeCertificateTextField(source.date, DEFAULT_CERTIFICATE_TEXT_CONFIG.date),
  };
}

function normalizeCertificateSettings(settings = {}) {
  const source = settings && typeof settings === "object" ? settings : {};
  return {
    ...DEFAULT_CERTIFICATE_SETTINGS,
    ...source,
    date_source: source?.date_source === "membership_end" ? "membership_end" : "certificate_date",
    asset_path: source?.asset_path || null,
    text_config: normalizeCertificateTextConfig(source?.text_config),
  };
}

function hasPermission(featureKey, role = currentUser?.role ?? "admin") {
  const permissions = normalizePermissionMatrix(dashboardState.permissions);
  return Boolean(permissions?.[featureKey]?.[role]);
}

function getAdminTabDefinitions() {
  const siswaCount = dashboardState.users.filter((user) => user.role === "peserta").length;
  const sekolahCount = dashboardState.sekolah.length;
  const appUserCount = dashboardState.users.filter((user) => isAppUser(user)).length;
  const skillhubCount = dashboardState.skillhubs.length;
  const assessmentCount = dashboardState.attempts.length;
  const certificateCount = dashboardState.certificates.length;
  const activityCount = dashboardState.activityLogs.length;

  return [
    ["overview", "Dashboard", ""],
    ["students", "Siswa", siswaCount],
    ["schools", "Sekolah", sekolahCount],
    ["content", "SkillHub & SCORM", skillhubCount],
    ["assessment", "Penilaian", assessmentCount],
    ["certificates", "Sertifikasi", certificateCount],
    ["reports", "Laporan", ""],
    ["audit", "Audit Log", activityCount],
    ["settings", "Setting", ""],
  ];
}

function getVisibleAdminTabs() {
  return getAdminTabDefinitions().filter(([tab]) => hasPermission(tab === "overview" ? "reports" : tab));
}

function ensureActiveAdminTabAllowed() {
  const visibleTabs = getVisibleAdminTabs();
  if (!visibleTabs.some(([tab]) => tab === activeAdminTab)) {
    activeAdminTab = visibleTabs[0]?.[0] ?? "settings";
  }
}

function normalizeNotificationItems(items = []) {
  return (Array.isArray(items) ? items : []).map((item, index) => ({
    id: String(item.id ?? `notification-${index}`),
    tone: item.severity ?? item.tone ?? "info",
    label: item.label ?? (item.severity === "high" ? "Penting" : item.severity === "medium" ? "Perhatian" : "Info"),
    title: String(item.title ?? "Notifikasi"),
    body: String(item.body ?? ""),
    tab: item.target_tab ?? item.tab ?? "overview",
    read: Boolean(item.read),
  })).slice(0, 8);
}

async function loadInAppNotifications() {
  try {
    const data = await apiRequest("/api/notifications");
    inAppNotifications = normalizeNotificationItems(data?.notifications);
  } catch {
    inAppNotifications = [];
  }
}

function getNotificationFallbackAction(tab) {
  if (currentUser?.role === "peserta") {
    return `data-student-tab="${escapeHtml(tab)}"`;
  }
  if (currentUser?.role === "admin") {
    return `data-admin-tab="${escapeHtml(tab)}"`;
  }
  return `data-staff-tab="${escapeHtml(tab)}"`;
}

function getNotificationActionLabel(tab) {
  const adminLabels = {
    overview: "Dashboard",
    students: "Siswa",
    schools: "Sekolah",
    content: "SkillHub",
    assessment: "Penilaian",
    certificates: "Sertifikat",
    reports: "Laporan",
    audit: "Audit Log",
    settings: "Setting",
    learning: "Materi belajar",
  };
  return adminLabels[tab] ?? "Buka";
}

async function markAllNotificationsRead(button) {
  try {
    button.disabled = true;
    await apiRequest("/api/notifications/read-all", { method: "POST" });
    inAppNotifications = inAppNotifications.map((item) => ({ ...item, read: true }));
    rerenderCurrentDashboardFromState();
  } catch (error) {
    setDashboardMessage(getErrorMessage(error), "error");
  } finally {
    button.disabled = false;
  }
}

function getActiveNotifications() {
  return inAppNotifications.length ? inAppNotifications : getInAppNotifications();
}

function getInAppNotifications() {
  const notifications = [];
  const role = currentUser?.role ?? "admin";
  const learners = dashboardState.users.filter((user) => user.role === "peserta");
  const inactiveLearners = learners.filter((user) => user.status_akses !== "aktif").length;
  const failedAttempts = dashboardState.attempts.filter((attempt) => ["failed", "gagal"].includes(String(attempt.status_lulus ?? attempt.status ?? "").toLowerCase())).length;
  const recentActivity = dashboardState.activityLogs[0];

  if (role === "admin" || role === "pengawas" || role === "fasilitator") {
    if (inactiveLearners > 0) {
      notifications.push({
        tone: "medium",
        label: "Perhatian",
        title: `${inactiveLearners} akses siswa perlu ditinjau`,
        body: "Cek status akses siswa agar penugasan dan materi tetap sesuai.",
        action: "Siswa",
        tab: role === "admin" ? "students" : "students",
      });
    }
    if (failedAttempts > 0) {
      notifications.push({
        tone: "high",
        label: "Assessment",
        title: `${failedAttempts} hasil test belum lulus`,
        body: "Tinjau hasil penilaian dan tindak lanjuti siswa yang membutuhkan pendampingan.",
        action: "Penilaian",
        tab: role === "admin" ? "assessment" : "students",
      });
    }
    if (recentActivity) {
      notifications.push({
        tone: "info",
        label: "Audit",
        title: "Aktivitas terbaru tercatat",
        body: String(recentActivity.aksi ?? recentActivity.action ?? "Audit log terbaru tersedia."),
        action: "Audit Log",
        tab: role === "admin" ? "audit" : "students",
      });
    }
  } else {
    const activeEnrollments = studentState.enrollments.filter((enrollment) => enrollment.status_akses !== "arsip").length;
    const certificates = studentState.certificates.length;
    if (activeEnrollments > 0) {
      notifications.push({
        tone: "info",
        label: "Materi",
        title: `${activeEnrollments} materi aktif`,
        body: "Lanjutkan pembelajaran dari ruang belajar Anda.",
        action: "Materi belajar",
        tab: "learning",
      });
    }
    if (certificates > 0) {
      notifications.push({
        tone: "info",
        label: "Sertifikat",
        title: `${certificates} sertifikat tersedia`,
        body: "Sertifikat yang sudah diterbitkan dapat dilihat dan diunduh.",
        action: "Sertifikat saya",
        tab: "certificates",
      });
    }
  }

  return notifications.slice(0, 5);
}

function renderNotificationDropdown() {
  const notifications = getActiveNotifications();
  const unreadCount = notifications.filter((item) => !item.read).length;
  const countLabel = unreadCount > 9 ? "9+" : String(unreadCount);
  const list = notifications.length
    ? notifications.map((item) => `
        <article class="notification-item is-${escapeHtml(item.tone)} ${item.read ? "is-read" : ""}">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(item.body)}</p>
          <div class="form-actions">
            <button class="button button-ghost" type="button" ${getNotificationFallbackAction(item.tab)}>${escapeHtml(getNotificationActionLabel(item.tab))} ↗</button>
          </div>
        </article>
      `).join("")
    : `<article class="notification-empty"><strong>Tidak ada notifikasi baru</strong><p>Semua aktivitas penting akan muncul di sini sebagai notifikasi in-app.</p></article>`;

  return `
    <details class="notification-menu">
      <summary class="button button-ghost notification-trigger icon-only-action" aria-label="Notifikasi">
        ${renderNavIcon("audit")}
        <span class="sr-only">Notifikasi</span>
        ${unreadCount ? `<strong>${escapeHtml(countLabel)}</strong>` : ""}
      </summary>
      <div class="notification-dropdown" role="menu">
        <div class="notification-dropdown-head">
          <div>
            <p class="eyebrow">In-app</p>
            <strong>Notifikasi</strong>
          </div>
        </div>
        ${notifications.length ? `<div class="notification-dropdown-actions"><button class="button button-ghost" type="button" data-notifications-read-all ${unreadCount ? "" : "disabled"}>Tandai semua dibaca</button></div>` : ""}
        <div class="notification-dropdown-list">${list}</div>
      </div>
    </details>
  `;
}

function renderDashboardActions(refreshAttribute) {
  return `
    <div class="section-actions">
      ${renderLanguageControl()}
      ${renderNotificationDropdown()}
      <button class="button button-ghost header-refresh-action" type="button" ${refreshAttribute} hidden aria-hidden="true" tabindex="-1">${renderNavIcon("refresh")}<span>Refresh data</span></button>
      ${renderUserMenu()}
    </div>
  `;
}

function renderTabButton(tab, activeTab, attribute, label, count = "") {
  return `
    <button
      class="tab-button ${activeTab === tab ? "is-active" : ""}"
      type="button"
      ${attribute}="${escapeHtml(tab)}"
      data-mobile-nav-icon="${escapeHtml(tab)}"
      aria-pressed="${activeTab === tab}"
      aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}"
    >
      ${renderNavIcon(tab)}<span>${escapeHtml(label)}</span>
      ${count !== "" ? `<strong>${escapeHtml(count)}</strong>` : ""}
    </button>
  `;
}

function renderAdminSidebarEntry(tab, label, count) {
  const button = renderTabButton(tab, activeAdminTab, "data-admin-tab", label, count);
  if (tab !== "settings") {
    return button;
  }

  return `<div class="settings-sidebar-group">${button}${renderSettingsSidebarSubmenu()}</div>`;
}

function renderAdminTabs() {
  ensureActiveAdminTabAllowed();
  const tabs = getVisibleAdminTabs();

  return `
    <aside class="admin-sidebar" aria-label="Menu admin">
      <div class="admin-sidebar-brand">
        <img class="sidebar-brand-logo" src="/assets/brighted-logo-on-orange.png" alt="BrightEd Akademi" />
      </div>
      <nav class="dashboard-tabs dashboard-sidebar-tabs" aria-label="Navigasi admin">
        ${tabs.map(([tab, label, count]) => renderAdminSidebarEntry(tab, label, count)).join("")}
      </nav>
    </aside>
  `;
}

function renderStaffTabs() {
  const siswaCount = staffState.users.filter((user) => user.role === "peserta").length;
  const enrollmentCount = staffState.enrollments.length;
  const attemptCount = staffState.attempts.length;

  return `
    <aside class="admin-sidebar staff-sidebar" aria-label="Menu bimbingan">
      <div class="admin-sidebar-brand">
        <img class="sidebar-brand-logo" src="/assets/brighted-logo-on-orange.png" alt="BrightEd Akademi" />
      </div>
      <nav class="dashboard-tabs dashboard-sidebar-tabs staff-sidebar-tabs" aria-label="Navigasi bimbingan">
        ${renderTabButton("students", activeStaffTab, "data-staff-tab", "Siswa", siswaCount)}
        ${renderTabButton("enrollments", activeStaffTab, "data-staff-tab", "Enrollment", enrollmentCount)}
        ${renderTabButton("reports", activeStaffTab, "data-staff-tab", "Hasil test", attemptCount)}
      </nav>
    </aside>
  `;
}

function renderStudentTabs() {
  const attemptCount = Object.values(studentState.assessmentHistories)
    .reduce((total, histories) => total + (histories?.length ?? 0), 0);

  return `
    <aside class="admin-sidebar student-sidebar" aria-label="Menu siswa">
      <div class="admin-sidebar-brand">
        <img class="sidebar-brand-logo" src="/assets/brighted-logo-on-orange.png" alt="BrightEd Akademi" />
      </div>
      <nav class="dashboard-tabs dashboard-sidebar-tabs student-sidebar-tabs" aria-label="Navigasi siswa">
        ${renderTabButton("learning", activeStudentTab, "data-student-tab", "Learning", studentState.enrollments.length)}
        ${renderTabButton("results", activeStudentTab, "data-student-tab", "Hasil Test", attemptCount)}
        ${renderTabButton("certificates", activeStudentTab, "data-student-tab", "Sertifikat", studentState.certificates.length)}
        ${renderTabButton("profile", activeStudentTab, "data-student-tab", "Profile", "")}
      </nav>
    </aside>
  `;
}

function renderProfilePanel() {
  if (!currentUser) {
    return "";
  }

  return `
    <article class="workspace-card profile-panel" data-profile-panel>
      <div class="profile-panel-head">
        <div>
          <p class="eyebrow">Profile</p>
          <h3>Data akun</h3>
        </div>
        <button class="button button-ghost" type="button" data-close-profile>Tutup</button>
      </div>
      <div class="profile-details">
        <span>Nama</span><strong>${escapeHtml(currentUser.nama)}</strong>
        <span>Email</span><strong>${escapeHtml(currentUser.email)}</strong>
        <span>Role</span><strong>${escapeHtml(getRoleLabel(currentUser.role))}</strong>
        <span>Status akses</span><strong>${escapeHtml(currentUser.status_akses ?? "-")}</strong>
        <span>Sekolah</span><strong>${escapeHtml(currentUser.sekolah?.nama ?? "-")}</strong>
        <span>Masa aktif</span><strong>${formatDate(currentUser.masa_aktif_mulai)} – ${formatDate(currentUser.masa_aktif_selesai)}</strong>
      </div>
      <form data-change-password class="password-form">
        <h4>Ganti password</h4>
        <label>Password lama <input name="current_password" type="password" autocomplete="current-password" required /></label>
        <label>Password baru <input name="new_password" type="password" autocomplete="new-password" minlength="8" required /></label>
        <label>Ulangi password baru <input name="confirm_password" type="password" autocomplete="new-password" minlength="8" required /></label>
        <button class="button button-primary" type="submit">Simpan password</button>
      </form>
    </article>
  `;
}

function showProfilePanel() {
  if (!adminDashboard || !currentUser) {
    return;
  }

  document.querySelector("[data-profile-dialog]")?.remove();
  const dialog = document.createElement("div");
  dialog.className = "profile-dialog";
  dialog.setAttribute("data-profile-dialog", "");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("open", "");
  dialog.innerHTML = localizeMarkup(renderProfilePanel());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeProfilePanel();
  });
  document.body.appendChild(dialog);
}

function closeProfilePanel() {
  document.querySelector("[data-profile-dialog]")?.remove();
}

function summarizeImportResult(result) {
  return `Import selesai: ${result.created_count} siswa dibuat, ${result.skipped_count} dilewati, ${result.error_count} error.`;
}

function normalizeText(value) {
  return String(value ?? "").toLowerCase().trim();
}

function matchesStudentFilters(user, filters) {
  if (user.role !== "peserta") {
    return false;
  }

  if (filters.status && user.status_akses !== filters.status) {
    return false;
  }

  if (filters.sekolah_id && user.sekolah_id !== filters.sekolah_id) {
    return false;
  }

  const search = normalizeText(filters.search);
  if (!search) {
    return true;
  }

  const haystack = [user.nama, user.email, user.sekolah?.nama, user.sekolah?.kode_sekolah]
    .map(normalizeText)
    .join(" ");

  return haystack.includes(search);
}

function getFilteredAdminStudents() {
  return dashboardState.users.filter((user) =>
    matchesStudentFilters(user, adminStudentFilters),
  );
}

function getFilteredStaffStudents() {
  return staffState.users.filter((user) =>
    matchesStudentFilters(user, staffStudentFilters),
  );
}


function getStudentSortValue(user, key) {
  const values = {
    id: getStudentDisplayId(user),
    nama: user.nama,
    email: user.email,
    sekolah: user.sekolah?.nama ?? "",
    akses: user.masa_aktif_selesai ?? "",
    status: user.status_akses,
  };

  return values[key] ?? "";
}

function getAuditSortValue(log, key) {
  const values = {
    created_at: log.created_at,
    action: getActivityActionLabel(log.action),
    description: log.description,
    actor: log.actor?.nama ?? "System",
    role: getRoleLabel(log.actor_role ?? log.actor?.role),
  };

  return values[key] ?? "";
}

function sortByState(items, sortState, getValue) {
  return [...items].sort((left, right) => {
    const leftValue = getValue(left, sortState.key);
    const rightValue = getValue(right, sortState.key);
    const direction = sortState.direction === "desc" ? -1 : 1;

    return String(leftValue).localeCompare(String(rightValue), "id-ID", {
      numeric: true,
      sensitivity: "base",
    }) * direction;
  });
}

function paginate(items, page, pageSize) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);

  return {
    page: safePage,
    totalPages,
    totalItems: items.length,
    items: items.slice((safePage - 1) * pageSize, safePage * pageSize),
  };
}

function renderSortHeader(label, key, table, sortState) {
  const active = sortState.key === key;
  const indicator = active ? (sortState.direction === "asc" ? "↑" : "↓") : "↕";

  return `<th><button class="sort-button" type="button" data-sort-table="${table}" data-sort-key="${escapeHtml(key)}">${escapeHtml(label)} <span>${indicator}</span></button></th>`;
}

function renderPagination(kind, page, totalPages, totalItems, pageSize) {
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return `
    <div class="table-pagination" data-pagination-kind="${escapeHtml(kind)}">
      <span>${start}-${end} dari ${totalItems}</span>
      <div>
        <button class="mini-action" type="button" data-page-kind="${escapeHtml(kind)}" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>‹</button>
        <strong>${page} / ${totalPages}</strong>
        <button class="mini-action" type="button" data-page-kind="${escapeHtml(kind)}" data-page="${page + 1}" ${page >= totalPages ? "disabled" : ""}>›</button>
      </div>
    </div>
  `;
}

function getSortedAdminStudents() {
  return sortByState(getFilteredAdminStudents(), adminStudentSort, getStudentSortValue);
}

function getSortedStaffStudents() {
  return sortByState(getFilteredStaffStudents(), staffStudentSort, getStudentSortValue);
}

function getSortedActivityLogs() {
  return sortByState(dashboardState.activityLogs, auditLogSort, getAuditSortValue);
}

function isAppUser(user) {
  return ["admin", "fasilitator", "pengawas"].includes(user?.role);
}

function getAppUserRoleLabel(role) {
  const labels = { admin: "Admin", fasilitator: "Fasilitator", pengawas: "Manager" };
  return labels[role] ?? getRoleLabel(role);
}

function renderAppUserRoleOptions(selectedRole = "") {
  return [["", "Semua tipe user"], ["admin", "Admin"], ["fasilitator", "Fasilitator"], ["pengawas", "Manager"]]
    .map(([value, label]) => `<option value="${escapeHtml(value)}" ${selectedRole === value ? "selected" : ""}>${escapeHtml(label)}</option>`)
    .join("");
}

function renderAppUserEditableRoleOptions(selectedRole = "fasilitator") {
  return [["admin", "Admin"], ["fasilitator", "Fasilitator"], ["pengawas", "Manager"]]
    .map(([value, label]) => `<option value="${escapeHtml(value)}" ${selectedRole === value ? "selected" : ""}>${escapeHtml(label)}</option>`)
    .join("");
}

function matchesAppUserFilters(user) {
  if (!isAppUser(user)) return false;
  if (appUserFilters.role && user.role !== appUserFilters.role) return false;
  if (appUserFilters.status && user.status_akses !== appUserFilters.status) return false;

  const search = normalizeText(appUserFilters.search);
  if (!search) return true;

  return [user.nama, user.email, getAppUserRoleLabel(user.role), user.status_akses]
    .map(normalizeText)
    .join(" ")
    .includes(search);
}

function getAppUserSortValue(user, key) {
  const values = {
    nama: user.nama,
    email: user.email,
    role: getAppUserRoleLabel(user.role),
    status: user.status_akses,
    created: user.created_at ?? "",
    updated: user.updated_at ?? "",
  };
  return values[key] ?? "";
}

function getFilteredAppUsers() {
  return dashboardState.users.filter(matchesAppUserFilters);
}

function getSortedAppUsers() {
  return sortByState(getFilteredAppUsers(), appUserSort, getAppUserSortValue);
}

function getAppUserById(id) {
  return dashboardState.users.find((user) => user.id === id && isAppUser(user)) ?? null;
}


function matchesSchoolFilters(sekolah) {
  const keyword = schoolFilters.search.trim().toLowerCase();
  if (!keyword) {
    return true;
  }

  return [sekolah.nama, sekolah.kode_sekolah, sekolah.alamat, sekolah.status_akses]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(keyword);
}

function getSchoolSortValue(sekolah, key) {
  const values = {
    nama: sekolah.nama,
    kode: sekolah.kode_sekolah,
    alamat: sekolah.alamat ?? "",
    status: sekolah.status_akses ?? "aktif",
    users: sekolah._count?.users ?? 0,
    updated: sekolah.updated_at ?? "",
  };

  return values[key] ?? "";
}

function getFilteredSchools() {
  return dashboardState.sekolah.filter(matchesSchoolFilters);
}

function getSortedSchools() {
  return sortByState(getFilteredSchools(), schoolSort, getSchoolSortValue);
}

function getSchoolById(id) {
  return dashboardState.sekolah.find((sekolah) => sekolah.id === id) ?? null;
}

function renderStatusFilterOptions(selectedStatus = "") {
  return ["", "aktif", "arsip"]
    .map((status) => {
      const label = status ? status : "Semua status";
      return `<option value="${escapeHtml(status)}" ${selectedStatus === status ? "selected" : ""}>${escapeHtml(label)}</option>`;
    })
    .join("");
}

function renderAdminStudentFilters() {
  return `
    <form class="filter-bar" data-admin-student-filters>
      <label>
        Cari siswa
        <input name="search" value="${escapeHtml(adminStudentFilters.search)}" placeholder="Nama, email, atau sekolah" />
      </label>
      <label>
        Status
        <select name="status">${renderStatusFilterOptions(adminStudentFilters.status)}</select>
      </label>
      <label>
        Sekolah
        <select name="sekolah_id">
          <option value="">Semua sekolah</option>
          ${getSekolahOptions(adminStudentFilters.sekolah_id)}
        </select>
      </label>
      <button class="button button-ghost" type="button" data-reset-student-filters>Reset</button>
    </form>
  `;
}

function renderStaffStudentFilters() {
  return `
    <form class="filter-bar compact-filter" data-staff-student-filters>
      <label>
        Cari siswa
        <input name="search" value="${escapeHtml(staffStudentFilters.search)}" placeholder="Nama, email, atau sekolah" />
      </label>
      <label>
        Status
        <select name="status">${renderStatusFilterOptions(staffStudentFilters.status)}</select>
      </label>
      <button class="button button-ghost" type="button" data-reset-staff-student-filters>Reset</button>
    </form>
  `;
}

function renderEmptyRows(message, colspan) {
  return `<tr><td colspan="${colspan}"><div class="designed-empty">${renderNavIcon("content")}<strong>${escapeHtml(message)}</strong><p>Data akan tampil di sini setelah tersedia. Jika menggunakan filter, coba ubah pencarian Anda.</p></div></td></tr>`;
}

function renderStudentRowActions(user) {
  return renderStudentActionButtons(user);
}

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadCsv(filename, headers, rows) {
  const csv = [headers, ...rows]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadImportTemplate() {
  const rows = [
    ["nama", "email", "password", "kode_sekolah", "fasilitator_id", "skillhub_nama"],
    ["Contoh Siswa", "contoh.siswa@email.com", "Siswa12345!", "", "", "SkillHub Demo BrightEd"],
  ];
  downloadCsv("template_import_siswa_brighted.csv", rows[0], rows.slice(1));
}

async function handleLogin(event) {
  event.preventDefault();

  const formData = new FormData(event.currentTarget);
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  setLoginPanelLoading(true);
  setLoginMessage("Memeriksa akun...");

  try {
    const payload = await apiRequest("/api/auth/login", {
      method: "POST",
      ...jsonOptions({ email, password }),
    });

    authToken = payload.token;
    localStorage.setItem("brighted_token", authToken);

    const me = await apiRequest("/api/auth/me");
    currentUser = me.user ?? payload.user;
    renderSignedInState(currentUser, me.access);
    setAuthenticatedLayout(true);
    await renderAdminDashboard(currentUser.role === "admin");
    await renderStudentDashboard(currentUser.role === "peserta");
    await renderStaffDashboard(
      currentUser.role === "fasilitator" || currentUser.role === "pengawas",
    );
  } catch (error) {
    setLoginMessage(getErrorMessage(error));
  } finally {
    setLoginPanelLoading(false);
  }
}

function getPesertaOptions(selectedId = "") {
  const peserta = dashboardState.users.filter((user) => user.role === "peserta");

  return peserta
    .map(
      (user) =>
        `<option value="${escapeHtml(user.id)}" ${
          user.id === selectedId ? "selected" : ""
        }>${escapeHtml(user.nama)} — ${escapeHtml(user.email)}</option>`,
    )
    .join("");
}

function getFasilitatorOptions(selectedId = "") {
  return dashboardState.users
    .filter((user) => user.role === "fasilitator")
    .map(
      (user) =>
        `<option value="${escapeHtml(user.id)}" ${
          user.id === selectedId ? "selected" : ""
        }>${escapeHtml(user.nama)} — ${escapeHtml(user.email)}</option>`,
    )
    .join("");
}

function getSkillHubOptions(selectedId = "") {
  return dashboardState.skillhubs
    .map(
      (skillhub) =>
        `<option value="${escapeHtml(skillhub.id)}" ${
          skillhub.id === selectedId ? "selected" : ""
        }>${escapeHtml(skillhub.nama)}</option>`,
    )
    .join("");
}

function getSekolahOptions(selectedId = "") {
  return dashboardState.sekolah
    .map(
      (sekolah) =>
        `<option value="${escapeHtml(sekolah.id)}" ${
          sekolah.id === selectedId ? "selected" : ""
        }>${escapeHtml(sekolah.nama)}</option>`,
    )
    .join("");
}

function getCourseOptions(selectedId = "") {
  return dashboardState.skillhubs
    .flatMap((skillhub) =>
      (skillhub.courses ?? []).map((course) => ({
        ...course,
        skillhubName: skillhub.nama,
      })),
    )
    .map(
      (course) =>
        `<option value="${escapeHtml(course.id)}" ${
          course.id === selectedId ? "selected" : ""
        }>${escapeHtml(course.skillhubName)} — ${escapeHtml(course.judul)}</option>`,
    )
    .join("");
}

function getLessonOptions(selectedId = "") {
  return dashboardState.skillhubs
    .flatMap((skillhub) =>
      (skillhub.courses ?? []).flatMap((course) =>
        (course.lessons ?? []).map((lesson) => ({
          ...lesson,
          courseName: course.judul,
          skillhubName: skillhub.nama,
        })),
      ),
    )
    .map(
      (lesson) =>
        `<option value="${escapeHtml(lesson.id)}" ${
          lesson.id === selectedId ? "selected" : ""
        }>${escapeHtml(lesson.skillhubName)} — ${escapeHtml(lesson.courseName)} — ${escapeHtml(lesson.judul)}</option>`,
    )
    .join("");
}


function getSelectedSkillHubBuilder() {
  return dashboardState.skillhubs.find((skillhub) => skillhub.id === selectedSkillhubBuilderId) ?? dashboardState.skillhubs[0] ?? null;
}

function getBuilderCourseOptions(skillhub, selectedId = "") {
  return (skillhub?.courses ?? [])
    .map(
      (course) =>
        `<option value="${escapeHtml(course.id)}" ${course.id === selectedId ? "selected" : ""}>${escapeHtml(course.judul)}</option>`,
    )
    .join("");
}

function getBuilderLessonOptions(skillhub, selectedId = "") {
  return (skillhub?.courses ?? [])
    .flatMap((course) =>
      (course.lessons ?? []).map((lesson) => ({
        ...lesson,
        courseName: course.judul,
      })),
    )
    .map(
      (lesson) =>
        `<option value="${escapeHtml(lesson.id)}" ${lesson.id === selectedId ? "selected" : ""}>${escapeHtml(lesson.courseName)} — ${escapeHtml(lesson.judul)}</option>`,
    )
    .join("");
}

function renderSkillHubSelectorOptions() {
  return dashboardState.skillhubs
    .map(
      (skillhub) =>
        `<option value="${escapeHtml(skillhub.id)}" ${skillhub.id === selectedSkillhubBuilderId ? "selected" : ""}>${escapeHtml(skillhub.nama)}</option>`,
    )
    .join("");
}

function renderLessonEditor(lesson) {
  return `
    <li class="builder-lesson-editor">
      <form data-update-lesson data-lesson-id="${escapeHtml(lesson.id)}">
        <input name="judul" value="${escapeHtml(lesson.judul)}" required aria-label="Judul lesson" />
        <select name="tipe_konten" aria-label="Tipe konten lesson">
          ${["scorm", "article", "video", "pdf", "quiz"]
            .map(
              (type) => `<option value="${type}" ${lesson.tipe_konten === type ? "selected" : ""}>${type}</option>`,
            )
            .join("")}
        </select>
        <input name="urutan" type="number" min="1" value="${escapeHtml(lesson.urutan)}" aria-label="Urutan lesson" />
        <button class="button button-ghost button-small" type="submit">Simpan</button>
        <button class="button button-ghost button-small" type="button" data-delete-lesson="${escapeHtml(lesson.id)}">Hapus</button>
      </form>
      <small>${lesson.scorm_package ? "SCORM uploaded" : "Belum ada SCORM"}</small>
    </li>
  `;
}

function renderBuilderCourseTree(skillhub) {
  if (!skillhub) {
    return `<p class="muted-copy">Belum ada SkillHub. Buat SkillHub dulu untuk mulai menyusun modul.</p>`;
  }

  const courses = skillhub.courses ?? [];
  if (courses.length === 0) {
    return `<p class="muted-copy">Belum ada course di SkillHub ini.</p>`;
  }

  return courses
    .map((course) => {
      const lessons = course.lessons ?? [];
      const lessonMarkup = lessons.length
        ? lessons.map(renderLessonEditor).join("")
        : `<li><span>Belum ada lesson</span><small>Tambahkan lesson dari form di kanan.</small></li>`;

      return `
        <article class="builder-course-card">
          <div class="builder-course-head">
            <form data-update-course data-course-id="${escapeHtml(course.id)}">
              <input name="judul" value="${escapeHtml(course.judul)}" required aria-label="Judul course" />
              <input name="urutan" type="number" min="1" value="${escapeHtml(course.urutan)}" aria-label="Urutan course" />
              <button class="button button-ghost button-small" type="submit">Simpan course</button>
              <button class="button button-ghost button-small" type="button" data-delete-course="${escapeHtml(course.id)}">Hapus</button>
            </form>
            <small>${lessons.length} lesson</small>
          </div>
          <ul>${lessonMarkup}</ul>
        </article>
      `;
    })
    .join("");
}

function getAssessmentConfigValue(assessment, key, fallback = "") {
  const config = assessment.konfigurasi;
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return fallback;
  }

  return config[key] ?? fallback;
}

function renderBuilderAssessments(skillhub) {
  const assessments = skillhub?.assessments ?? [];
  if (assessments.length === 0) {
    return `<p class="muted-copy">Belum ada assessment di SkillHub ini.</p>`;
  }

  return assessments
    .map(
      (assessment) => `
        <article class="detail-item builder-assessment-editor">
          <form data-update-assessment data-assessment-id="${escapeHtml(assessment.id)}">
            <label>Judul <input name="judul" value="${escapeHtml(assessment.judul)}" required /></label>
            <label>Passing score <input name="passing_score" type="number" min="0" max="100" value="${escapeHtml(getAssessmentConfigValue(assessment, "passing_score", 70))}" /></label>
            <label>Max attempts <input name="max_attempts" type="number" min="1" value="${escapeHtml(getAssessmentConfigValue(assessment, "max_attempts", 3))}" /></label>
            <div class="form-actions full-field">
              <button class="button button-ghost button-small" type="submit">Simpan assessment</button>
              <button class="button button-ghost button-small" type="button" data-delete-assessment="${escapeHtml(assessment.id)}">Hapus</button>
            </div>
          </form>
          <span>${escapeHtml(assessment.tipe)} · dibuat ${formatDate(assessment.created_at)}</span>
        </article>
      `,
    )
    .join("");
}

function renderSkillHubBuilder() {
  const skillhub = getSelectedSkillHubBuilder();
  const nextStatus = skillhub?.status === "publish" ? "draft" : "publish";
  const nextStatusLabel = nextStatus === "publish" ? "Publish" : "Jadikan draft";

  return `
    <article class="workspace-card admin-section tab-content skillhub-builder">
      <div class="card-head builder-head">
        <div>
          <p class="eyebrow">SkillHub Builder</p>
          <h3>Susun modul belajar</h3>
          <p>Pilih SkillHub, lalu tambahkan course, lesson, SCORM, dan assessment dari satu tempat.</p>
        </div>
        <label class="builder-selector">
          SkillHub aktif
          <select data-builder-skillhub>
            ${renderSkillHubSelectorOptions() || '<option value="">Belum ada SkillHub</option>'}
          </select>
        </label>
      </div>

      ${
        skillhub
          ? `
            <div class="builder-summary">
              <article><span>Status</span><strong>${escapeHtml(skillhub.status)}</strong></article>
              <article><span>Course</span><strong>${skillhub.courses?.length ?? 0}</strong></article>
              <article><span>Assessment</span><strong>${skillhub.assessments?.length ?? 0}</strong></article>
              <article><span>Enrollment</span><strong>${skillhub._count?.enrollments ?? 0}</strong></article>
            </div>

            <form data-update-skillhub class="builder-edit-form">
              <input type="hidden" name="skillhub_id" value="${escapeHtml(skillhub.id)}" />
              <label>Nama SkillHub <input name="nama" value="${escapeHtml(skillhub.nama)}" required /></label>
              <label>Deskripsi <textarea name="deskripsi" rows="2">${escapeHtml(skillhub.deskripsi ?? "")}</textarea></label>
              <div class="form-actions full-field">
                <button class="button button-primary" type="submit">Simpan info SkillHub</button>
                <button class="button button-ghost" type="button" data-toggle-skillhub-status="${escapeHtml(skillhub.id)}" data-next-status="${escapeHtml(nextStatus)}">${nextStatusLabel}</button>
              </div>
            </form>

            <div class="builder-grid">
              <section class="builder-tree">
                <h4>Struktur course & lesson</h4>
                ${renderBuilderCourseTree(skillhub)}
              </section>

              <section class="builder-tools">
                <form data-create-course>
                  <h4>Tambah course</h4>
                  <input type="hidden" name="skillhub_id" value="${escapeHtml(skillhub.id)}" />
                  <label>Judul course <input name="judul" required /></label>
                  <label>Urutan <input name="urutan" type="number" min="1" value="${(skillhub.courses?.length ?? 0) + 1}" /></label>
                  <button class="button button-primary" type="submit">Tambah course</button>
                </form>

                <form data-create-lesson>
                  <h4>Tambah lesson</h4>
                  <label>
                    Course
                    <select name="course_id" required>
                      <option value="">Pilih course</option>
                      ${getBuilderCourseOptions(skillhub)}
                    </select>
                  </label>
                  <label>Judul lesson <input name="judul" required /></label>
                  <label>
                    Tipe konten
                    <select name="tipe_konten">
                      <option value="scorm">scorm</option>
                      <option value="article">article</option>
                      <option value="video">video</option>
                      <option value="pdf">pdf</option>
                      <option value="quiz">quiz</option>
                    </select>
                  </label>
                  <label>Urutan <input name="urutan" type="number" min="1" value="1" /></label>
                  <button class="button button-primary" type="submit">Tambah lesson</button>
                </form>

                <form data-upload-scorm>
                  <h4>Upload SCORM</h4>
                  <label>
                    Lesson
                    <select name="lesson_id" required>
                      <option value="">Pilih lesson</option>
                      ${getBuilderLessonOptions(skillhub)}
                    </select>
                  </label>
                  <label>Paket SCORM ZIP <input name="package" type="file" accept=".zip,application/zip" required /></label>
                  <button class="button button-primary" type="submit">Upload paket</button>
                </form>

                <form data-create-assessment>
                  <h4>Tambah assessment</h4>
                  <input type="hidden" name="skillhub_id" value="${escapeHtml(skillhub.id)}" />
                  <label>Judul assessment <input name="judul" required /></label>
                  <label>Passing score <input name="passing_score" type="number" min="0" max="100" value="70" /></label>
                  <label>Max attempts <input name="max_attempts" type="number" min="1" value="3" /></label>
                  <label class="full-field">Bank soal JSON <textarea name="questions_json" rows="5" placeholder='[{"id":"q1","prompt":"Pertanyaan?","options":["A","B"],"correct_answer":"A"}]'></textarea></label>
                  <button class="button button-primary" type="submit">Tambah assessment</button>
                </form>
              </section>

              <section class="builder-assessments">
                <h4>Assessment SkillHub</h4>
                <div class="detail-list">${renderBuilderAssessments(skillhub)}</div>
              </section>
            </div>
          `
          : `<p class="muted-copy">Buat SkillHub baru untuk mengaktifkan builder.</p>`
      }
    </article>
  `;
}

async function loadDashboardState() {
  const [sekolah, users, skillhubSummaries, enrollments, certificates, scormProgresses, attempts, activityLogs, permissionSettings, certificateSettings] =
    await Promise.all([
    apiRequest("/api/sekolah"),
    apiRequest("/api/users"),
    apiRequest("/api/skillhubs"),
    apiRequest("/api/enrollments"),
    apiRequest("/api/certificates"),
    apiRequest("/api/scorm-progress"),
    apiRequest("/api/assessment-attempts"),
    apiRequest("/api/activity-logs?limit=1000"),
    apiRequest("/api/settings/permissions"),
    apiRequest("/api/settings/certificate"),
  ]);
  const skillhubs = await Promise.all(
    skillhubSummaries.map((skillhub) => apiRequest(`/api/skillhubs/${skillhub.id}`)),
  );

  dashboardState = {
    sekolah,
    users,
    skillhubs,
    enrollments,
    certificates,
    scormProgresses,
    attempts,
    activityLogs,
    permissions: normalizePermissionMatrix(permissionSettings?.permissions),
    certificateSettings: normalizeCertificateSettings(certificateSettings?.settings),
  };

  await loadInAppNotifications();

  ensureActiveAdminTabAllowed();

  if (!selectedSkillhubBuilderId || !skillhubs.some((skillhub) => skillhub.id === selectedSkillhubBuilderId)) {
    selectedSkillhubBuilderId = skillhubs[0]?.id ?? "";
  }
}

async function loadStudentState() {
  const [enrollments, certificates] = await Promise.all([
    apiRequest("/api/enrollments/my-learning"),
    apiRequest("/api/certificates/my-certificates"),
  ]);
  const skillhubs = await Promise.all(
    enrollments.map((enrollment) =>
      apiRequest(`/api/skillhubs/${enrollment.skillhub_id}`),
    ),
  );
  const assessments = skillhubs.flatMap((skillhub) => skillhub.assessments ?? []);
  const assessmentHistoryPairs = await Promise.all(
    assessments.map(async (assessment) => [
      assessment.id,
      await apiRequest(`/api/assessments/${assessment.id}/history`).catch(() => []),
    ]),
  );

  studentState = {
    enrollments,
    skillhubs,
    certificates,
    assessmentHistories: Object.fromEntries(assessmentHistoryPairs),
  };
  await loadInAppNotifications();
}

async function loadStaffState() {
  const [users, enrollments, skillhubSummaries, certificates, scormProgresses, attempts] = await Promise.all([
    apiRequest("/api/users"),
    apiRequest("/api/enrollments"),
    apiRequest("/api/skillhubs"),
    apiRequest("/api/certificates"),
    apiRequest("/api/scorm-progress"),
    apiRequest("/api/assessment-attempts"),
  ]);
  const skillhubs = await Promise.all(
    skillhubSummaries.map((skillhub) => apiRequest(`/api/skillhubs/${skillhub.id}`)),
  );

  staffState = {
    users,
    enrollments,
    skillhubs,
    certificates,
    scormProgresses,
    attempts,
  };
  await loadInAppNotifications();
}

function renderStats() {
  const siswa = dashboardState.users.filter((user) => user.role === "peserta");
  const activeStudents = siswa.filter((user) => user.status_akses === "aktif");
  const courseCount = dashboardState.skillhubs.reduce(
    (total, skillhub) => total + (skillhub._count?.courses ?? 0),
    0,
  );

  return `
    <div class="stats-grid">
      <article class="stat-card">
        <span>Siswa</span>
        <strong>${siswa.length}</strong>
        <small>${activeStudents.length} aktif</small>
      </article>
      <article class="stat-card">
        <span>SkillHub</span>
        <strong>${dashboardState.skillhubs.length}</strong>
        <small>${courseCount} course tercatat</small>
      </article>
      <article class="stat-card">
        <span>Enrollment</span>
        <strong>${dashboardState.enrollments.length}</strong>
        <small>Assign siswa ke SkillHub</small>
      </article>
      <article class="stat-card">
        <span>Sekolah</span>
        <strong>${dashboardState.sekolah.length}</strong>
        <small>Referensi administrasi</small>
      </article>
      <article class="stat-card">
        <span>Sertifikat</span>
        <strong>${dashboardState.certificates.length}</strong>
        <small>Bukti belajar terbit</small>
      </article>
      <article class="stat-card">
        <span>Hasil test</span>
        <strong>${dashboardState.attempts.length}</strong>
        <small>${dashboardState.attempts.filter((attempt) => attempt.status_lulus).length} lulus</small>
      </article>
    </div>
  `;
}

function renderStudentRows() {
  const pagination = paginate(getSortedAdminStudents(), adminStudentPage, STUDENT_PAGE_SIZE);
  adminStudentPage = pagination.page;
  const rows = pagination.items
    .map(
      (user) => `
        <tr>
          <td><strong>${escapeHtml(getStudentDisplayId(user))}</strong></td>
          <td class="member-name-cell"><strong>${escapeHtml(user.nama)}</strong><span>${escapeHtml(user.email)}</span></td>
          <td>${escapeHtml(user.sekolah?.nama ?? "-")}</td>
          <td>${formatDate(user.masa_aktif_selesai)}</td>
          <td>${renderStudentStatusBadge(user.status_akses)}</td>
          <td>${renderStudentRowActions(user)}</td>
        </tr>
      `,
    )
    .join("");

  return rows || renderEmptyRows("Tidak ada siswa yang cocok dengan filter.", 6);
}

function renderEnrollmentRows() {
  const rows = dashboardState.enrollments
    .slice(0, 8)
    .map(
      (enrollment) => `
        <tr>
          <td>${escapeHtml(enrollment.user?.nama ?? "-")}</td>
          <td>${escapeHtml(enrollment.skillhub?.nama ?? "-")}</td>
          <td>${formatDate(enrollment.tanggal_assign)}</td>
          <td><span class="status-pill table-pill">${escapeHtml(enrollment.status)}</span></td>
        </tr>
      `,
    )
    .join("");

  return rows || `<tr><td colspan="4">Belum ada enrollment.</td></tr>`;
}

function renderSkillHubRows() {
  const rows = dashboardState.skillhubs
    .slice(0, 8)
    .map((skillhub) => {
      const lessons = (skillhub.courses ?? []).reduce(
        (total, course) => total + (course.lessons?.length ?? 0),
        0,
      );
      const scormPackages = (skillhub.courses ?? []).reduce(
        (total, course) =>
          total +
          (course.lessons ?? []).filter((lesson) => lesson.scorm_package).length,
        0,
      );

      return `
        <tr>
          <td>${escapeHtml(skillhub.nama)}</td>
          <td>${skillhub.courses?.length ?? 0}</td>
          <td>${lessons}</td>
          <td>${scormPackages}</td>
          <td><span class="status-pill table-pill">${escapeHtml(skillhub.status)}</span></td>
        </tr>
      `;
    })
    .join("");

  return rows || `<tr><td colspan="5">Belum ada SkillHub.</td></tr>`;
}

function renderCertificateRows() {
  const rows = dashboardState.certificates
    .slice(0, 10)
    .map(
      (certificate) => `
        <tr>
          <td>${escapeHtml(certificate.user?.nama ?? "-")}</td>
          <td>${escapeHtml(certificate.skillhub?.nama ?? "-")}</td>
          <td>${escapeHtml(certificate.nomor_sertifikat)}</td>
          <td>${formatDate(certificate.tanggal_terbit)}</td>
          <td><span class="status-pill table-pill">${escapeHtml(certificate.status)}</span></td>
          <td>
            <div class="row-actions">
              <a href="/api/public/certificates/verify/${escapeHtml(certificate.kode_verifikasi)}" target="_blank" rel="noreferrer">Verify</a>
              <a href="/api/public/certificates/download/${escapeHtml(certificate.kode_verifikasi)}" target="_blank" rel="noreferrer">PDF</a>
              ${
                certificate.status === "active"
                  ? `<button type="button" data-revoke-certificate="${escapeHtml(certificate.id)}">Revoke</button>`
                  : ""
              }
            </div>
          </td>
        </tr>
      `,
    )
    .join("");

  return rows || `<tr><td colspan="6">Belum ada sertifikat.</td></tr>`;
}

function getActivityActionLabel(action) {
  const labels = {
    "students.imported": "Import siswa",
    "student.status_changed": "Status siswa",
    "skillhub.assigned": "Assign SkillHub",
    "enrollment.status_changed": "Status enrollment",
    "scorm.uploaded": "Upload SCORM",
    "assessment.submitted": "Submit assessment",
    "certificate.generated": "Generate sertifikat",
    "certificate.revoked": "Revoke sertifikat",
    "school.created": "Tambah sekolah",
    "school.updated": "Edit sekolah",
    "school.archived": "Archive sekolah",
  };

  return labels[action] ?? action ?? "Aktivitas";
}

function renderActivityLogRows() {
  const pagination = paginate(getSortedActivityLogs(), auditLogPage, AUDIT_LOG_PAGE_SIZE);
  auditLogPage = pagination.page;
  const rows = pagination.items
    .map(
      (log) => `
        <tr>
          <td>${formatDateTime(log.created_at)}</td>
          <td><span class="member-badge role-badge">${escapeHtml(getActivityActionLabel(log.action))}</span></td>
          <td class="activity-description-cell"><strong>${escapeHtml(log.description)}</strong><span>${escapeHtml(log.entity_type)}${log.entity_id ? ` · ${escapeHtml(String(log.entity_id).slice(0, 8))}` : ""}</span></td>
          <td>${escapeHtml(log.actor?.nama ?? "System")}</td>
          <td>${escapeHtml(getRoleLabel(log.actor_role ?? log.actor?.role))}</td>
        </tr>
      `,
    )
    .join("");

  return rows || `<tr><td colspan="5">Belum ada aktivitas tercatat.</td></tr>`;
}

function renderAttemptRows(attempts = dashboardState.attempts) {
  const rows = attempts
    .slice(0, 10)
    .map(
      (attempt) => `
        <tr>
          <td>${escapeHtml(attempt.user?.nama ?? "-")}</td>
          <td>${escapeHtml(attempt.assessment?.judul ?? "-")}</td>
          <td>${Number(attempt.skor).toFixed(0)}</td>
          <td>${attempt.status_lulus ? "Lulus" : "Belum lulus"}</td>
          <td>${formatDate(attempt.waktu_selesai ?? attempt.created_at)}</td>
        </tr>
      `,
    )
    .join("");

  return rows || `<tr><td colspan="5">Belum ada hasil test.</td></tr>`;
}


function getReportSourceState() {
  return currentUser?.role === "admin" ? dashboardState : staffState;
}

function getReportRows() {
  const source = getReportSourceState();
  const students = source.users.filter((user) => user.role === "peserta");
  const search = normalizeText(reportFilters.search);

  return students
    .filter((user) => {
      if (reportFilters.status_akses && user.status_akses !== reportFilters.status_akses) {
        return false;
      }

      if (search) {
        const haystack = [user.nama, user.email, user.sekolah?.nama, user.sekolah?.kode_sekolah]
          .map(normalizeText)
          .join(" ");
        if (!haystack.includes(search)) {
          return false;
        }
      }

      return true;
    })
    .flatMap((user) => {
      const enrollments = source.enrollments.filter((enrollment) => enrollment.user_id === user.id);
      const userAttempts = source.attempts.filter((attempt) => attempt.user?.id === user.id);
      const certificates = (source.certificates ?? []).filter((certificate) => certificate.user?.id === user.id);
      const scopedEnrollments = enrollments.length ? enrollments : [{ user, skillhub: null, status: "-", tanggal_assign: null }];

      return scopedEnrollments
        .filter((enrollment) => !reportFilters.skillhub_id || enrollment.skillhub_id === reportFilters.skillhub_id)
        .map((enrollment) => {
          const skillhubId = enrollment.skillhub_id ?? enrollment.skillhub?.id;
          const attemptsForSkillhub = userAttempts.filter((attempt) => !skillhubId || attempt.assessment?.skillhub_id === skillhubId || attempt.assessment?.skillhub?.id === skillhubId);
          const scormForSkillhub = (source.scormProgresses ?? []).filter((progress) => {
            const progressSkillhubId = progress.scorm_package?.lesson?.course?.skillhub_id ?? progress.scorm_package?.lesson?.course?.skillhub?.id;
            return progress.user?.id === user.id && (!skillhubId || progressSkillhubId === skillhubId);
          });
          const latestAttempt = attemptsForSkillhub[0] ?? null;
          const latestScorm = scormForSkillhub[0] ?? null;
          const certificateForSkillhub = certificates.find((certificate) => !skillhubId || certificate.skillhub?.id === skillhubId) ?? null;
          const passed = latestAttempt?.status_lulus;

          return {
            user,
            enrollment,
            latestAttempt,
            latestScorm,
            certificate: certificateForSkillhub,
            statusLulus: passed === true ? "lulus" : passed === false ? "belum_lulus" : "belum_test",
          };
        });
    })
    .filter((row) => !reportFilters.status_lulus || row.statusLulus === reportFilters.status_lulus);
}

function renderReportSkillHubOptions() {
  return getReportSourceState().skillhubs
    .map(
      (skillhub) =>
        `<option value="${escapeHtml(skillhub.id)}" ${skillhub.id === reportFilters.skillhub_id ? "selected" : ""}>${escapeHtml(skillhub.nama)}</option>`,
    )
    .join("");
}

function renderReportFilters() {
  return `
    <form class="filter-bar report-filter" data-report-filters>
      <label>Cari siswa <input name="search" value="${escapeHtml(reportFilters.search)}" placeholder="Nama, email, atau sekolah" /></label>
      <label>Status akses <select name="status_akses">${renderStatusFilterOptions(reportFilters.status_akses)}</select></label>
      <label>SkillHub <select name="skillhub_id"><option value="">Semua SkillHub</option>${renderReportSkillHubOptions()}</select></label>
      <label>Kelulusan
        <select name="status_lulus">
          <option value="" ${reportFilters.status_lulus === "" ? "selected" : ""}>Semua hasil</option>
          <option value="lulus" ${reportFilters.status_lulus === "lulus" ? "selected" : ""}>Lulus</option>
          <option value="belum_lulus" ${reportFilters.status_lulus === "belum_lulus" ? "selected" : ""}>Belum lulus</option>
          <option value="belum_test" ${reportFilters.status_lulus === "belum_test" ? "selected" : ""}>Belum test</option>
        </select>
      </label>
      <div class="form-actions report-actions">
        <button class="button button-ghost" type="button" data-reset-report-filters>Reset</button>
        <button class="button button-primary" type="button" data-export-report-csv>Export CSV</button>
      </div>
    </form>
  `;
}

function renderReportSummary(rows) {
  const uniqueStudents = new Set(rows.map((row) => row.user.id)).size;
  const passed = rows.filter((row) => row.statusLulus === "lulus").length;
  const certificates = rows.filter((row) => row.certificate).length;
  const scormCompleted = rows.filter((row) => ["completed", "passed"].includes(row.latestScorm?.status)).length;

  return `
    <div class="report-summary-grid">
      <article><span>Siswa</span><strong>${uniqueStudents}</strong></article>
      <article><span>Baris laporan</span><strong>${rows.length}</strong></article>
      <article><span>Lulus</span><strong>${passed}</strong></article>
      <article><span>SCORM selesai</span><strong>${scormCompleted}</strong></article>
      <article><span>Sertifikat</span><strong>${certificates}</strong></article>
    </div>
  `;
}


function getPercentage(value, total) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function renderDonutChart(label, value, total, colorVar = "--color-accent") {
  const percentage = getPercentage(value, total);

  return `
    <article class="report-chart-card">
      <div class="donut-chart" style="--chart-value: ${percentage}; --chart-color: var(${colorVar});" aria-label="${escapeHtml(label)} ${percentage}%">
        <strong>${percentage}%</strong>
      </div>
      <div>
        <span>${escapeHtml(label)}</span>
        <strong>${value}/${total}</strong>
      </div>
    </article>
  `;
}

function renderStatusBar(label, value, total) {
  const percentage = getPercentage(value, total);

  return `
    <div class="status-bar-row">
      <span>${escapeHtml(label)}</span>
      <div class="status-bar-track"><i style="width: ${percentage}%"></i></div>
      <strong>${value}</strong>
    </div>
  `;
}

function renderReportCharts(rows) {
  const totalRows = rows.length;
  const uniqueStudents = new Set(rows.map((row) => row.user.id)).size;
  const activeStudents = new Set(rows.filter((row) => row.user.status_akses === "aktif").map((row) => row.user.id)).size;
  const passed = rows.filter((row) => row.statusLulus === "lulus").length;
  const scormCompleted = rows.filter((row) => ["completed", "passed"].includes(row.latestScorm?.status)).length;
  const certificates = rows.filter((row) => row.certificate).length;
  const scormStatuses = rows.reduce((accumulator, row) => {
    const status = row.latestScorm?.status ?? "belum_mulai";
    accumulator[status] = (accumulator[status] ?? 0) + 1;
    return accumulator;
  }, {});

  return `
    <div class="report-chart-grid">
      ${renderDonutChart("Akun aktif", activeStudents, uniqueStudents, "--color-growth")}
      ${renderDonutChart("Lulus", passed, totalRows, "--color-sky")}
      ${renderDonutChart("SCORM selesai", scormCompleted, totalRows, "--color-accent")}
      ${renderDonutChart("Sertifikat", certificates, totalRows, "--color-growth")}
      <article class="report-status-chart">
        <div>
          <span>Status SCORM</span>
          <strong>Distribusi progress</strong>
        </div>
        ${["completed", "passed", "incomplete", "failed", "not_attempted", "belum_mulai"]
          .filter((status) => scormStatuses[status])
          .map((status) => renderStatusBar(status, scormStatuses[status], totalRows))
          .join("") || '<p class="muted-copy">Belum ada progress SCORM.</p>'}
      </article>
    </div>
  `;
}

function renderReportRows(rows) {
  const markup = rows
    .slice(0, 50)
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.user.nama)}</td>
          <td>${escapeHtml(row.user.email)}</td>
          <td>${escapeHtml(row.user.sekolah?.nama ?? "-")}</td>
          <td>${escapeHtml(row.user.status_akses)}</td>
          <td>${escapeHtml(row.enrollment.skillhub?.nama ?? "-")}</td>
          <td>${escapeHtml(row.enrollment.status ?? "-")}</td>
          <td>${row.latestAttempt ? Number(row.latestAttempt.skor).toFixed(0) : "-"}</td>
          <td>${row.statusLulus === "lulus" ? "Lulus" : row.statusLulus === "belum_lulus" ? "Belum lulus" : "Belum test"}</td>
          <td>${escapeHtml(row.latestScorm?.status ?? "-")}</td>
          <td>${row.latestScorm?.skor ?? "-"}</td>
          <td>${row.latestScorm?.waktu_belajar ?? 0}</td>
          <td>${escapeHtml(row.certificate?.nomor_sertifikat ?? "-")}</td>
        </tr>
      `,
    )
    .join("");

  return markup || renderEmptyRows("Belum ada data yang cocok dengan filter laporan.", 12);
}

function renderReportCard(scopeLabel = "Admin") {
  const rows = getReportRows();

  return `
    <article class="workspace-card data-card report-card ${currentUser?.role === "admin" ? "admin-section" : "staff-section"} tab-reports">
      <div class="card-head">
        <div>
          <p class="eyebrow">Laporan ${escapeHtml(scopeLabel)}</p>
          <h3>Rekap siswa dan hasil belajar</h3>
          <p>Rekap enrollment, nilai terakhir, status lulus, dan sertifikat. CSV mengikuti filter aktif.</p>
        </div>
      </div>
      ${renderReportFilters()}
      ${renderReportSummary(rows)}
      ${renderReportCharts(rows)}
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Siswa</th>
              <th>Email</th>
              <th>Sekolah</th>
              <th>Akses</th>
              <th>SkillHub</th>
              <th>Enrollment</th>
              <th>Skor</th>
              <th>Status test</th>
              <th>Status SCORM</th>
              <th>Skor SCORM</th>
              <th>Waktu SCORM</th>
              <th>Sertifikat</th>
            </tr>
          </thead>
          <tbody>${renderReportRows(rows)}</tbody>
        </table>
      </div>
    </article>
  `;
}

function exportReportCsv() {
  const rows = getReportRows();
  downloadCsv(
    `laporan_siswa_brighted_${new Date().toISOString().slice(0, 10)}.csv`,
    ["nama", "email", "sekolah", "status_akses", "masa_aktif_selesai", "skillhub", "status_enrollment", "skor_terakhir", "status_test", "status_scorm", "skor_scorm", "waktu_scorm_detik", "nomor_sertifikat"],
    rows.map((row) => [
      row.user.nama,
      row.user.email,
      row.user.sekolah?.nama ?? "",
      row.user.status_akses,
      toDateInputValue(row.user.masa_aktif_selesai),
      row.enrollment.skillhub?.nama ?? "",
      row.enrollment.status ?? "",
      row.latestAttempt ? Number(row.latestAttempt.skor).toFixed(0) : "",
      row.statusLulus,
      row.latestScorm?.status ?? "",
      row.latestScorm?.skor ?? "",
      row.latestScorm?.waktu_belajar ?? 0,
      row.certificate?.nomor_sertifikat ?? "",
    ]),
  );
}

function renderSchoolToolbar() {
  return `
    <div class="table-icon-toolbar" aria-label="Aksi data sekolah">
      <button class="icon-action" type="button" title="Tambah sekolah" data-open-school-tool="add">＋ <span>Tambah</span></button>
    </div>
  `;
}

function renderSchoolFilters() {
  return `
    <form class="filter-bar compact-filter" data-school-filters>
      <label>
        Cari sekolah
        <input name="search" value="${escapeHtml(schoolFilters.search)}" placeholder="Nama, kode, alamat, atau status" />
      </label>
      <button class="button button-ghost" type="button" data-reset-school-filters>Reset</button>
    </form>
  `;
}

function renderSchoolToolPanel() {
  if (!activeSchoolTool) {
    return "";
  }

  const school = selectedSchoolId ? getSchoolById(selectedSchoolId) : null;

  if (activeSchoolTool === "view" && school) {
    return `
      <div class="inline-tool-panel" data-school-tool-panel>
        <div class="card-head">
          <div><h3>Detail sekolah</h3><p>${escapeHtml(school.nama)} · ${escapeHtml(school.kode_sekolah)}</p></div>
          <button class="mini-action" type="button" data-close-school-tool>×</button>
        </div>
        <div class="detail-summary-grid">
          <article><span>Kode</span><strong>${escapeHtml(school.kode_sekolah)}</strong></article>
          <article><span>Status</span><strong>${escapeHtml(school.status_akses ?? "aktif")}</strong></article>
          <article><span>User terkait</span><strong>${school._count?.users ?? 0}</strong></article>
          <article><span>Update terakhir</span><strong>${formatDate(school.updated_at)}</strong></article>
        </div>
        <p class="muted-copy">${escapeHtml(school.alamat ?? "Alamat belum diisi.")}</p>
      </div>
    `;
  }

  if (activeSchoolTool === "add" || (activeSchoolTool === "edit" && school)) {
    const isEdit = activeSchoolTool === "edit";

    return `
      <div class="inline-tool-panel" data-school-tool-panel>
        <div class="card-head">
          <div><h3>${isEdit ? "Edit sekolah" : "Tambah sekolah"}</h3><p>${isEdit ? "Perbarui data sekolah." : "Tambahkan referensi sekolah baru."}</p></div>
          <button class="mini-action" type="button" data-close-school-tool>×</button>
        </div>
        <form ${isEdit ? `data-update-school="${escapeHtml(school.id)}"` : "data-create-school"}>
          <label>Nama sekolah <input name="nama" value="${escapeHtml(school?.nama ?? "")}" required /></label>
          <label>Kode sekolah <input name="kode_sekolah" value="${escapeHtml(school?.kode_sekolah ?? "")}" required /></label>
          <label class="full-field">Alamat <textarea name="alamat" rows="3">${escapeHtml(school?.alamat ?? "")}</textarea></label>
          <button class="button button-primary" type="submit">${isEdit ? "Simpan perubahan" : "Simpan sekolah"}</button>
        </form>
      </div>
    `;
  }

  return "";
}


function closeSchoolActionDialog() {
  document.querySelector("[data-school-action-dialog]")?.remove();
}

function openSchoolActionDialog(action, schoolId = "") {
  activeSchoolTool = action;
  selectedSchoolId = schoolId;
  const content = renderSchoolToolPanel();
  if (!content) {
    activeSchoolTool = "";
    selectedSchoolId = "";
    setDashboardMessage("Sekolah tidak ditemukan di data saat ini.", "error");
    return;
  }

  closeSchoolActionDialog();
  const dialog = document.createElement("dialog");
  dialog.className = "student-detail-dialog school-action-dialog";
  dialog.setAttribute("data-school-action-dialog", action);
  dialog.setAttribute("aria-label", action === "view" ? "Detail sekolah" : action === "edit" ? "Edit sekolah" : "Tambah sekolah");
  dialog.innerHTML = localizeMarkup(content);
  dialog.addEventListener("close", closeSchoolActionDialog, { once: true });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });
  adminDashboard.append(dialog);
  dialog.showModal();
  dialog.querySelector(action === "view" ? "[data-close-school-tool]" : "input,textarea,button")?.focus();
}

function renderSchoolRows() {
  const pagination = paginate(getSortedSchools(), schoolPage, SCHOOL_PAGE_SIZE);
  schoolPage = pagination.page;
  const rows = pagination.items
    .map(
      (sekolah) => `
        <tr>
          <td class="member-name-cell"><strong>${escapeHtml(sekolah.nama)}</strong><span>${escapeHtml(sekolah.kode_sekolah)}</span></td>
          <td>${escapeHtml(sekolah.alamat ?? "-")}</td>
          <td>${sekolah._count?.users ?? 0}</td>
          <td>${renderStudentStatusBadge(sekolah.status_akses ?? "aktif")}</td>
          <td>${formatDate(sekolah.updated_at)}</td>
          <td>
            <div class="member-actions">
              <button class="mini-action" type="button" data-open-school-tool="view" data-school-id="${escapeHtml(sekolah.id)}">View</button>
              <button class="mini-action" type="button" data-open-school-tool="edit" data-school-id="${escapeHtml(sekolah.id)}">Edit</button>
              <button class="mini-action button-danger" type="button" data-archive-school="${escapeHtml(sekolah.id)}">Archive</button>
            </div>
          </td>
        </tr>
      `,
    )
    .join("");

  return rows || renderEmptyRows("Tidak ada sekolah yang cocok dengan filter.", 6);
}

function renderAppUserToolbar() {
  return `
    <div class="table-icon-toolbar" aria-label="Aksi user aplikasi">
      <button class="icon-action" type="button" title="Tambah user aplikasi" data-open-app-user-tool="add">＋ <span>Tambah</span></button>
    </div>
  `;
}

function renderAppUserFilters() {
  return `
    <form class="filter-bar compact-filter" data-app-user-filters>
      <label>
        Cari user
        <input name="search" value="${escapeHtml(appUserFilters.search)}" placeholder="Nama atau email" />
      </label>
      <label>
        Tipe user
        <select name="role">${renderAppUserRoleOptions(appUserFilters.role)}</select>
      </label>
      <label>
        Status
        <select name="status">${renderStatusFilterOptions(appUserFilters.status)}</select>
      </label>
      <button class="button button-ghost" type="button" data-reset-app-user-filters>Reset</button>
    </form>
  `;
}

function renderAppUserToolPanel() {
  if (!activeAppUserTool) return "";
  const user = selectedAppUserId ? getAppUserById(selectedAppUserId) : null;

  if (activeAppUserTool === "view" && user) {
    return `
      <div class="inline-tool-panel" data-app-user-tool-panel>
        <div class="card-head">
          <div><h3>Detail user aplikasi</h3><p>${escapeHtml(user.nama)} · ${escapeHtml(user.email)}</p></div>
          <button class="mini-action" type="button" data-close-app-user-tool>×</button>
        </div>
        <div class="detail-summary-grid">
          <article><span>Tipe user</span><strong>${escapeHtml(getAppUserRoleLabel(user.role))}</strong></article>
          <article><span>Status</span><strong>${escapeHtml(user.status_akses ?? "aktif")}</strong></article>
          <article><span>Dibuat</span><strong>${formatDate(user.created_at)}</strong></article>
          <article><span>Update terakhir</span><strong>${formatDate(user.updated_at)}</strong></article>
        </div>
      </div>
    `;
  }

  if (activeAppUserTool === "add" || (activeAppUserTool === "edit" && user)) {
    const isEdit = activeAppUserTool === "edit";
    return `
      <div class="inline-tool-panel" data-app-user-tool-panel>
        <div class="card-head">
          <div><h3>${isEdit ? "Edit user aplikasi" : "Tambah user aplikasi"}</h3><p>${isEdit ? "Perbarui akses internal LMS." : "Buat akun untuk admin, fasilitator, atau manager."}</p></div>
          <button class="mini-action" type="button" data-close-app-user-tool>×</button>
        </div>
        <form ${isEdit ? `data-update-app-user="${escapeHtml(user.id)}"` : "data-create-app-user"}>
          <label>Nama <input name="nama" value="${escapeHtml(user?.nama ?? "")}" required /></label>
          <label>Email <input name="email" type="email" value="${escapeHtml(user?.email ?? "")}" required /></label>
          ${isEdit ? "" : `<label>Password awal <input name="password" value="User12345!" minlength="8" required /></label>`}
          <label>
            Tipe user
            <select name="role" required>${renderAppUserEditableRoleOptions(user?.role ?? "fasilitator")}</select>
          </label>
          <label>
            Status
            <select name="status_akses">
              <option value="aktif" ${(user?.status_akses ?? "aktif") === "aktif" ? "selected" : ""}>aktif</option>
              <option value="arsip" ${user?.status_akses === "arsip" ? "selected" : ""}>arsip</option>
            </select>
          </label>
          <button class="button button-primary" type="submit">${isEdit ? "Simpan perubahan" : "Simpan user"}</button>
        </form>
      </div>
    `;
  }

  return "";
}

function closeAppUserActionDialog() {
  document.querySelector("[data-app-user-action-dialog]")?.remove();
}

function openAppUserActionDialog(action, userId = "") {
  activeAppUserTool = action;
  selectedAppUserId = userId;
  const content = renderAppUserToolPanel();
  if (!content) {
    activeAppUserTool = "";
    selectedAppUserId = "";
    setDashboardMessage("User tidak ditemukan di data saat ini.", "error");
    return;
  }

  closeAppUserActionDialog();
  const dialog = document.createElement("dialog");
  dialog.className = "student-detail-dialog app-user-action-dialog";
  dialog.setAttribute("data-app-user-action-dialog", action);
  dialog.setAttribute("aria-label", action === "view" ? "Detail user" : action === "edit" ? "Edit user" : "Tambah user");
  dialog.innerHTML = localizeMarkup(content);
  dialog.addEventListener("close", closeAppUserActionDialog, { once: true });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });
  adminDashboard.append(dialog);
  dialog.showModal();
  dialog.querySelector(action === "view" ? "[data-close-app-user-tool]" : "input,select,button")?.focus();
}

function renderAppUserRows() {
  const pagination = paginate(getSortedAppUsers(), appUserPage, APP_USER_PAGE_SIZE);
  appUserPage = pagination.page;
  const rows = pagination.items.map((user) => {
    const nextStatus = user.status_akses === "arsip" ? "aktif" : "arsip";
    const statusLabel = nextStatus === "arsip" ? "Archive" : "Aktifkan";
    return `
      <tr>
        <td class="member-name-cell"><strong>${escapeHtml(user.nama)}</strong><span>${escapeHtml(user.email)}</span></td>
        <td><span class="role-pill">${escapeHtml(getAppUserRoleLabel(user.role))}</span></td>
        <td>${renderStudentStatusBadge(user.status_akses ?? "aktif")}</td>
        <td>${formatDate(user.created_at)}</td>
        <td>${formatDate(user.updated_at)}</td>
        <td>
          <div class="member-actions">
            <button class="mini-action" type="button" data-open-app-user-tool="view" data-user-id="${escapeHtml(user.id)}">View</button>
            <button class="mini-action" type="button" data-open-app-user-tool="edit" data-user-id="${escapeHtml(user.id)}">Edit</button>
            <button class="mini-action" type="button" data-reset-app-user-password="${escapeHtml(user.id)}">Reset</button>
            <button class="mini-action ${nextStatus === "arsip" ? "button-danger" : ""}" type="button" data-toggle-app-user-status="${escapeHtml(user.id)}" data-next-status="${escapeHtml(nextStatus)}">${statusLabel}</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  return rows || renderEmptyRows("Tidak ada user aplikasi yang cocok dengan filter.", 6);
}

function renderAppUserCard() {
  const filtered = getFilteredAppUsers();
  const sorted = getSortedAppUsers();
  const pagination = paginate(sorted, appUserPage, APP_USER_PAGE_SIZE);

  return `
    <article class="workspace-card data-card admin-section tab-app-users">
      <div class="card-head">
        <div>
          <h3>User aplikasi</h3>
          <p>${filtered.length} user tampil dari ${dashboardState.users.filter((user) => isAppUser(user)).length} total.</p>
        </div>
        ${renderAppUserToolbar()}
      </div>
      ${renderAppUserFilters()}
      <div class="table-wrap">
        <table class="member-table app-user-table">
          <thead>
            <tr>
              ${renderSortHeader("Nama", "nama", "app-users", appUserSort)}
              ${renderSortHeader("Tipe User", "role", "app-users", appUserSort)}
              ${renderSortHeader("Status", "status", "app-users", appUserSort)}
              ${renderSortHeader("Dibuat", "created", "app-users", appUserSort)}
              ${renderSortHeader("Update", "updated", "app-users", appUserSort)}
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>${renderAppUserRows()}</tbody>
        </table>
        ${renderPagination("app-users", appUserPage, pagination.totalPages, sorted.length, APP_USER_PAGE_SIZE)}
      </div>
    </article>
  `;
}

function renderPermissionMatrix() {
  const permissions = normalizePermissionMatrix(dashboardState.permissions);

  return `
    <section class="settings-permission-card">
      <div class="card-head">
        <div>
          <p class="eyebrow">Role & Permission Matrix</p>
          <h3>Matriks hak akses LMS</h3>
          <p>Centang akses yang boleh tampil di menu dan dipakai sebagai dasar penguncian fitur.</p>
        </div>
      </div>
      <form data-update-permissions>
        <div class="table-wrap">
          <table class="permission-matrix-table">
            <thead>
              <tr>
                <th>Fitur</th>
                ${PERMISSION_ROLES.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${PERMISSION_FEATURES.map(([featureKey, label, description]) => `
                <tr>
                  <td><strong>${escapeHtml(label)}</strong><span>${escapeHtml(description)}</span></td>
                  ${PERMISSION_ROLES.map(([roleKey]) => {
                    const checked = permissions?.[featureKey]?.[roleKey] ? "checked" : "";
                    const disabled = featureKey === "settings" && roleKey === "admin" ? "disabled" : "";
                    return `
                      <td>
                        <label class="permission-toggle" title="${escapeHtml(label)} untuk ${escapeHtml(getRoleLabel(roleKey))}">
                          <input type="checkbox" name="${escapeHtml(featureKey)}.${escapeHtml(roleKey)}" ${checked} ${disabled} />
                          <span>${checked ? "Aktif" : "Off"}</span>
                        </label>
                      </td>
                    `;
                  }).join("")}
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
        <div class="form-actions permission-actions">
          <p class="form-help">Akses Setting untuk Admin selalu aktif supaya konfigurasi tidak terkunci.</p>
          <button class="button button-primary" type="submit">Simpan permission</button>
        </div>
      </form>
    </section>
  `;
}

function renderPermissionValue(value) {
  if (value === "✓") {
    return `<span class="permission-badge permission-yes">✓</span>`;
  }
  if (value === "-") {
    return `<span class="permission-badge permission-no">-</span>`;
  }
  return `<span class="permission-badge permission-limited">${escapeHtml(value)}</span>`;
}

function getSettingsSubTabDefinitions() {
  return [
    ["summary", "Ikhtisar"],
    ...(hasPermission("app-users") ? [["user", "User"]] : []),
    ["certificate", "Sertifikat"],
    ["permissions", "Permission"],
  ];
}

function renderSettingsSubTabs() {
  const tabs = getSettingsSubTabDefinitions();

  return `
    <div class="settings-subtabs" role="tablist" aria-label="Sub menu setting">
      ${tabs.map(([tab, label]) => `
        <button class="settings-subtab ${activeSettingTab === tab ? "is-active" : ""}" type="button" data-setting-tab="${escapeHtml(tab)}" aria-pressed="${activeSettingTab === tab}">${escapeHtml(label)}</button>
      `).join("")}
    </div>
  `;
}

function renderSettingsSidebarSubmenu() {
  if (activeAdminTab !== "settings") {
    return "";
  }

  return `
    <div class="settings-sidebar-submenu" role="tablist" aria-label="Sub menu setting">
      ${getSettingsSubTabDefinitions().map(([tab, label]) => `
        <button class="settings-sidebar-subitem ${activeSettingTab === tab ? "is-active" : ""}" type="button" data-setting-tab="${escapeHtml(tab)}" aria-pressed="${activeSettingTab === tab}">${escapeHtml(label)}</button>
      `).join("")}
    </div>
  `;
}

function renderCertificateFieldPreview(fieldKey, label, sample, config) {
  const field = config[fieldKey];
  const transform = field.align === "center"
    ? "translate(-50%, -50%)"
    : field.align === "right"
      ? "translate(-100%, -50%)"
      : "translateY(-50%)";

  return `
    <span
      class="certificate-overlay-text"
      data-certificate-preview-field="${escapeHtml(fieldKey)}"
      style="left:${field.x}%;top:${field.y}%;--certificate-field-size:${field.size};color:${escapeHtml(field.color)};font-weight:${escapeHtml(field.weight)};text-align:${escapeHtml(field.align)};transform:${transform};"
      title="${escapeHtml(label)}"
    >${escapeHtml(sample)}</span>
  `;
}

function renderCertificateFieldControls(fieldKey, label, config) {
  const field = config[fieldKey];

  return `
    <article class="certificate-field-control" data-certificate-field-control="${escapeHtml(fieldKey)}">
      <div>
        <strong>${escapeHtml(label)}</strong>
        <span>Atur posisi dan gaya teks di atas template.</span>
      </div>
      <div class="certificate-control-grid">
        <label>Kiri (%) <input name="${fieldKey}.x" type="number" min="0" max="100" step="0.5" value="${escapeHtml(field.x)}" data-certificate-config-field="${escapeHtml(fieldKey)}" data-certificate-config-key="x" /></label>
        <label>Atas (%) <input name="${fieldKey}.y" type="number" min="0" max="100" step="0.5" value="${escapeHtml(field.y)}" data-certificate-config-field="${escapeHtml(fieldKey)}" data-certificate-config-key="y" /></label>
        <label>Ukuran (%) <input name="${fieldKey}.size" type="number" min="1" max="150" step="1" value="${escapeHtml(field.size)}" data-certificate-config-field="${escapeHtml(fieldKey)}" data-certificate-config-key="size" /></label>
        <label>Warna <input name="${fieldKey}.color" type="color" value="${escapeHtml(field.color)}" data-certificate-config-field="${escapeHtml(fieldKey)}" data-certificate-config-key="color" /></label>
        <label>Ketebalan
          <select name="${fieldKey}.weight" data-certificate-config-field="${escapeHtml(fieldKey)}" data-certificate-config-key="weight">
            <option value="normal" ${field.weight === "normal" ? "selected" : ""}>Normal</option>
            <option value="bold" ${field.weight === "bold" ? "selected" : ""}>Tebal</option>
          </select>
        </label>
        <label>Perataan
          <select name="${fieldKey}.align" data-certificate-config-field="${escapeHtml(fieldKey)}" data-certificate-config-key="align">
            <option value="left" ${field.align === "left" ? "selected" : ""}>Kiri</option>
            <option value="center" ${field.align === "center" ? "selected" : ""}>Tengah</option>
            <option value="right" ${field.align === "right" ? "selected" : ""}>Kanan</option>
          </select>
        </label>
      </div>
    </article>
  `;
}

function renderCertificateSettingsPanel() {
  const settings = normalizeCertificateSettings(dashboardState.certificateSettings);
  const textConfig = normalizeCertificateTextConfig(settings.text_config);

  return `
    <section class="settings-certificate-card" ${activeSettingTab === "certificate" ? "" : "hidden"}>
      <div class="card-head">
        <div>
          <p class="eyebrow">Setting Sertifikat</p>
          <h3>Template dan penempatan teks dinamis</h3>
          <p>Upload template landscape, lalu atur posisi nama peserta, judul SkillHub, dan tanggal seperti editor sertifikat IZI Learning.</p>
        </div>
      </div>
      <div class="certificate-template-editor">
        <div class="certificate-template-preview-panel">
          <div class="certificate-template-toolbar">
            <div>
              <strong>Preview template</strong>
              <span>Contoh data hanya untuk mengatur posisi. PDF asli memakai data sertifikat.</span>
            </div>
          </div>
          <div class="certificate-canvas" data-certificate-preview>
            <div class="certificate-template-fallback" aria-hidden="true"></div>
            ${settings.asset_path ? `<img class="certificate-template-image" src="${escapeHtml(settings.asset_path)}" alt="Template sertifikat" />` : ""}
            ${CERTIFICATE_TEXT_FIELDS.map(([fieldKey, label, sample]) => renderCertificateFieldPreview(fieldKey, label, sample, textConfig)).join("")}
          </div>
          <form data-upload-certificate-asset class="certificate-upload-form">
            <label>Upload template sertifikat <input name="file" type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" required /></label>
            <p class="form-help">Gunakan PNG/JPG landscape minimal 1200px. Gambar menjadi background penuh PDF sertifikat.</p>
            <button class="button button-secondary" type="submit">Upload template</button>
          </form>
        </div>

        <form data-update-certificate-settings class="certificate-template-config">
          <input name="asset_path" type="hidden" value="${escapeHtml(settings.asset_path ?? "")}" />
          <div class="certificate-copy-settings">
            <label>Nama institusi <input name="title" value="${escapeHtml(settings.title)}" required /></label>
            <label>Nama dokumen <input name="subtitle" value="${escapeHtml(settings.subtitle)}" required /></label>
            <label>Label nama peserta <input name="recipient_label" value="${escapeHtml(settings.recipient_label)}" required /></label>
            <label>Label materi <input name="material_label" value="${escapeHtml(settings.material_label)}" required /></label>
            <label>Label tanggal <input name="completion_label" value="${escapeHtml(settings.completion_label)}" required /></label>
            <label>
              Sumber tanggal
              <select name="date_source">
                <option value="certificate_date" ${settings.date_source === "certificate_date" ? "selected" : ""}>Tanggal sertifikat dibuat</option>
                <option value="membership_end" ${settings.date_source === "membership_end" ? "selected" : ""}>Tanggal masa aktif siswa selesai</option>
              </select>
            </label>
          </div>
          <div class="certificate-field-settings">
            ${CERTIFICATE_TEXT_FIELDS.map(([fieldKey, label]) => renderCertificateFieldControls(fieldKey, label, textConfig)).join("")}
          </div>
          <div class="form-actions">
            <button class="button button-ghost" type="button" data-reset-certificate-layout>Reset posisi default</button>
            <button class="button button-primary" type="submit">Simpan setting sertifikat</button>
          </div>
        </form>
      </div>
    </section>
  `;
}


function buildCertificateTextConfigFromForm(formData) {
  return Object.fromEntries(
    CERTIFICATE_TEXT_FIELDS.map(([fieldKey]) => {
      const fallback = DEFAULT_CERTIFICATE_TEXT_CONFIG[fieldKey];
      const field = {
        x: clampNumber(formData.get(`${fieldKey}.x`), fallback.x, 0, 100),
        y: clampNumber(formData.get(`${fieldKey}.y`), fallback.y, 0, 100),
        size: clampNumber(formData.get(`${fieldKey}.size`), fallback.size, 1, 150),
        color: formData.get(`${fieldKey}.color`) || fallback.color,
        weight: formData.get(`${fieldKey}.weight`) === "bold" ? "bold" : "normal",
        align: ["left", "center", "right"].includes(formData.get(`${fieldKey}.align`))
          ? formData.get(`${fieldKey}.align`)
          : fallback.align,
      };
      return [fieldKey, normalizeCertificateTextField(field, fallback)];
    }),
  );
}

function updateCertificatePreviewField(input) {
  const fieldKey = input.getAttribute("data-certificate-config-field");
  const key = input.getAttribute("data-certificate-config-key");
  const preview = adminDashboard?.querySelector(`[data-certificate-preview-field="${fieldKey}"]`);

  if (!fieldKey || !key || !preview) {
    return;
  }

  if (key === "x") preview.style.left = `${clampNumber(input.value, 50, 0, 100)}%`;
  if (key === "y") preview.style.top = `${clampNumber(input.value, 50, 0, 100)}%`;
  if (key === "size") preview.style.setProperty("--certificate-field-size", String(clampNumber(input.value, 70, 1, 150)));
  if (key === "color") preview.style.color = input.value;
  if (key === "weight") preview.style.fontWeight = input.value === "bold" ? "bold" : "normal";
  if (key === "align") {
    preview.style.textAlign = input.value;
    preview.style.transform = input.value === "center"
      ? "translate(-50%, -50%)"
      : input.value === "right"
        ? "translate(-100%, -50%)"
        : "translateY(-50%)";
  }
}

function renderSettingsSummaryPanel(activeStudents, archivedSchools, publishedSkillhubs, appUsers) {
  return `
    <section class="settings-summary-panel" ${activeSettingTab === "summary" ? "" : "hidden"}>
      <div class="settings-grid">
        <article>
          <span>Masa keanggotaan siswa</span>
          <strong>1 tahun</strong>
          <p>Siswa tetap bisa login setelah masa aktif selesai, tetapi materi belajar terkunci.</p>
        </article>
        <article>
          <span>Role</span>
          <strong>4 role sistem</strong>
          <p>Siswa, instructor/pengawas, fasilitator, dan admin.</p>
        </article>
        <article>
          <span>User</span>
          <strong>Admin · Fasilitator · Manager</strong>
          <p>User dipakai untuk operasional, pengawasan, dan administrasi LMS.</p>
        </article>
        <article>
          <span>Import siswa</span>
          <strong>CSV / Excel</strong>
          <p>Password default import: Siswa12345!.</p>
        </article>
        <article>
          <span>Upload SCORM</span>
          <strong>ZIP · 250 MB</strong>
          <p>Upload materi SCORM dilakukan dari admin.</p>
        </article>
      </div>
      <div class="settings-role-grid">
        <article><span>Role</span><strong>Siswa</strong><p>Akses belajar, hasil test, dan sertifikat.</p></article>
        <article><span>Role</span><strong>Instructor</strong><p>Melihat laporan dan progress siswa dalam scope.</p></article>
        <article><span>Role</span><strong>Fasilitator</strong><p>Mendaftarkan siswa dan memantau bimbingan.</p></article>
        <article><span>Role</span><strong>Admin</strong><p>Mengelola data utama, konten, sertifikat, dan setting.</p></article>
      </div>
      <div class="settings-app-user-grid">
        <article><span>User</span><strong>Admin</strong><p>${appUsers.admin} akun</p></article>
        <article><span>User</span><strong>Fasilitator</strong><p>${appUsers.fasilitator} akun</p></article>
        <article><span>User</span><strong>Manager</strong><p>${appUsers.manager} akun</p></article>
      </div>
      <div class="settings-summary-grid">
        <article><span>Siswa aktif</span><strong>${activeStudents}</strong></article>
        <article><span>Sekolah arsip</span><strong>${archivedSchools}</strong></article>
        <article><span>SkillHub publish</span><strong>${publishedSkillhubs}</strong></article>
        <article><span>Audit log</span><strong>${dashboardState.activityLogs.length}</strong></article>
      </div>
    </section>
  `;
}

function renderSettingsUserPanel() {
  const userCard = renderAppUserCard()
    .replace('workspace-card data-card admin-section tab-app-users', 'workspace-card data-card settings-user-card')
    .replace('<p class="eyebrow">Admin, Fasilitator, dan Manager</p>', '<p class="eyebrow">Setting / User</p>')
    .replace('<h3>User aplikasi</h3>', '<h3>User</h3>');

  return `
    <section class="settings-user-panel" ${activeSettingTab === "user" ? "" : "hidden"}>
      ${userCard}
    </section>
  `;
}

function renderSettingsCard() {
  const activeStudents = dashboardState.users.filter((user) => user.role === "peserta" && user.status_akses === "aktif").length;
  const archivedSchools = dashboardState.sekolah.filter((sekolah) => sekolah.status_akses === "arsip").length;
  const publishedSkillhubs = dashboardState.skillhubs.filter((skillhub) => skillhub.status === "publish").length;
  const appUsers = {
    admin: dashboardState.users.filter((user) => user.role === "admin").length,
    fasilitator: dashboardState.users.filter((user) => user.role === "fasilitator").length,
    manager: dashboardState.users.filter((user) => user.role === "pengawas").length,
  };

  return `
    <article class="workspace-card data-card admin-section tab-settings settings-card">
      <div class="card-head">
        <div>
          <p class="eyebrow">Setting Admin</p>
          <h3>Konfigurasi LMS BrightEd</h3>
          <p>Atur konfigurasi umum, sertifikat, dan hak akses role.</p>
        </div>
      </div>
      ${renderSettingsSummaryPanel(activeStudents, archivedSchools, publishedSkillhubs, appUsers)}
      ${hasPermission("app-users") ? renderSettingsUserPanel() : ""}
      ${renderCertificateSettingsPanel()}
      <div ${activeSettingTab === "permissions" ? "" : "hidden"}>
        ${renderPermissionMatrix()}
      </div>
    </article>
  `;
}

function closeStudentToolDialog() {
  document.querySelector("[data-student-tool-dialog]")?.remove();
}

function bindDialogSubmitHandlers(dialog) {
  dialog.querySelectorAll("form:not([data-edit-student]):not([data-confirm-action]):not([data-change-password])").forEach((form) => {
    form.addEventListener("submit", (event) => {
      const submitter = event.submitter ?? form.querySelector("button[type='submit']");
      submitAndRefresh(event, submitter);
    });
  });
}

function openStudentToolDialog(action, studentId = "") {
  activeAdminStudentTool = action;
  selectedAssignStudentId = studentId;
  const content = renderAdminStudentToolPanel();
  if (!content) {
    activeAdminStudentTool = "";
    selectedAssignStudentId = "";
    setDashboardMessage("Aksi siswa tidak tersedia.", "error");
    return;
  }

  closeStudentToolDialog();
  const dialog = document.createElement("dialog");
  dialog.className = "student-detail-dialog student-tool-dialog";
  dialog.setAttribute("data-student-tool-dialog", action);
  dialog.setAttribute("aria-label", action === "import" ? "Import siswa" : action === "assign" ? "Assign SkillHub" : "Tambah siswa");
  dialog.innerHTML = localizeMarkup(content);
  bindDialogSubmitHandlers(dialog);
  dialog.addEventListener("close", closeStudentToolDialog, { once: true });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });
  adminDashboard.append(dialog);
  dialog.showModal();
  dialog.querySelector("input,select,button")?.focus();
}

function renderStudentTableToolbar() {
  return `
    <div class="table-icon-toolbar" aria-label="Aksi data siswa">
      <button class="icon-action" type="button" title="Tambah siswa" data-open-student-tool="add">＋ <span>Tambah</span></button>
      <button class="icon-action" type="button" title="Download template" data-download-import-template>⇩ <span>Template</span></button>
      <button class="icon-action" type="button" title="Import siswa" data-open-student-tool="import">⇧ <span>Import</span></button>
    </div>
  `;
}

function renderAdminStudentToolPanel() {
  if (!activeAdminStudentTool) {
    return "";
  }

  if (activeAdminStudentTool === "add") {
    return `
      <div class="inline-tool-panel" data-student-tool-panel>
        <div class="card-head">
          <div><h3>Tambah siswa</h3><p>Admin mendaftarkan siswa baru dan menentukan akses awal.</p></div>
          <button class="mini-action" type="button" data-close-student-tool>×</button>
        </div>
        <form data-create-student>
          <input type="hidden" name="role" value="peserta" />
          <label>Nama siswa <input name="nama" required /></label>
          <label>Email <input name="email" type="email" required /></label>
          <label>Password <input name="password" value="Siswa12345!" required /></label>
          <label>
            Sekolah
            <select name="sekolah_id">
              <option value="">Tanpa sekolah</option>
              ${getSekolahOptions()}
            </select>
          </label>
          <label>
            Fasilitator
            <select name="fasilitator_id">
              <option value="">Tanpa fasilitator</option>
              ${getFasilitatorOptions()}
            </select>
          </label>
          <button class="button button-primary" type="submit">Simpan siswa</button>
        </form>
      </div>
    `;
  }

  if (activeAdminStudentTool === "import") {
    return `
      <div class="inline-tool-panel" data-student-tool-panel>
        <div class="card-head">
          <div><h3>Import siswa massal</h3><p>Gunakan file CSV/Excel sesuai template. Password default: Siswa12345!.</p></div>
          <button class="mini-action" type="button" data-close-student-tool>×</button>
        </div>
        <form data-import-students>
          <label>File CSV / Excel <input name="file" type="file" accept=".csv,.xlsx,.xls" required /></label>
          <label>
            Default sekolah
            <select name="default_sekolah_id">
              <option value="">Ikuti file / tanpa sekolah</option>
              ${getSekolahOptions()}
            </select>
          </label>
          <label>
            Default fasilitator
            <select name="default_fasilitator_id">
              <option value="">Ikuti file / tanpa fasilitator</option>
              ${getFasilitatorOptions()}
            </select>
          </label>
          <label>
            Auto assign SkillHub
            <select name="default_skillhub_id">
              <option value="">Tidak auto assign</option>
              ${getSkillHubOptions()}
            </select>
          </label>
          <button class="button button-primary" type="submit">Import siswa</button>
        </form>
      </div>
    `;
  }

  if (activeAdminStudentTool === "assign") {
    const selectedUser = dashboardState.users.find((user) => user.id === selectedAssignStudentId);

    return `
      <div class="inline-tool-panel" data-student-tool-panel>
        <div class="card-head">
          <div><h3>Assign SkillHub</h3><p>${selectedUser ? `Pilih SkillHub untuk ${escapeHtml(selectedUser.nama)}.` : "Pilih siswa dan SkillHub."}</p></div>
          <button class="mini-action" type="button" data-close-student-tool>×</button>
        </div>
        <form data-assign-enrollment>
          <label>
            Siswa
            <select name="user_id" required>
              <option value="">Pilih siswa</option>
              ${getPesertaOptions(selectedAssignStudentId)}
            </select>
          </label>
          <label>
            SkillHub
            <select name="skillhub_id" required>
              <option value="">Pilih SkillHub</option>
              ${getSkillHubOptions()}
            </select>
          </label>
          <button class="button button-primary" type="submit">Assign SkillHub</button>
        </form>
      </div>
    `;
  }

  return "";
}

function getScopedStudentById(userId) {
  const source = currentUser?.role === "admin" ? dashboardState : staffState;
  return source.users.find((user) => user.id === userId) ?? null;
}

function getCertificateById(certificateId) {
  return dashboardState.certificates.find((certificate) => certificate.id === certificateId) ?? null;
}

function openResetPasswordConfirm(userId) {
  const user = getScopedStudentById(userId);
  if (!user) {
    setDashboardMessage("Siswa tidak ditemukan di data saat ini.", "error");
    return;
  }

  pendingDangerAction = {
    type: "reset-password",
    userId,
    title: "Reset password siswa",
    description: `Password untuk ${user.nama} (${user.email}) akan diganti.`,
    confirmLabel: "Reset password",
    tone: "warning",
  };
  rerenderCurrentDashboardFromState();
}

function openStudentStatusConfirm(userId, nextStatus) {
  const user = getScopedStudentById(userId);
  if (!user || !nextStatus) {
    setDashboardMessage("Siswa atau status tidak valid.", "error");
    return;
  }

  pendingDangerAction = {
    type: "student-status",
    userId,
    nextStatus,
    title: nextStatus === "aktif" ? "Aktifkan akses siswa" : "Arsipkan akses siswa",
    description: `${user.nama} (${user.email}) akan diubah menjadi ${nextStatus}.`,
    confirmLabel: nextStatus === "aktif" ? "Aktifkan" : "Arsipkan",
    tone: nextStatus === "aktif" ? "success" : "danger",
  };
  rerenderCurrentDashboardFromState();
}

function openSchoolArchiveConfirm(schoolId) {
  const school = getSchoolById(schoolId);
  if (!school) {
    setDashboardMessage("Sekolah tidak ditemukan di data saat ini.", "error");
    return;
  }

  pendingDangerAction = {
    type: "school-archive",
    schoolId,
    title: "Archive sekolah",
    description: `Sekolah ${school.nama} (${school.kode_sekolah}) akan diarsipkan. Data siswa tetap tersimpan.`,
    confirmLabel: "Archive sekolah",
    tone: "danger",
  };
  rerenderAdminDashboardFromState();
}

function openRevokeCertificateConfirm(certificateId) {
  const certificate = getCertificateById(certificateId);
  if (!certificate) {
    setDashboardMessage("Sertifikat tidak ditemukan di data saat ini.", "error");
    return;
  }

  pendingDangerAction = {
    type: "revoke-certificate",
    certificateId,
    title: "Revoke sertifikat",
    description: `Sertifikat ${certificate.nomor_sertifikat} milik ${certificate.user?.nama ?? "siswa"} akan direvoke.`,
    confirmLabel: "Revoke sertifikat",
    tone: "danger",
  };
  rerenderAdminDashboardFromState();
}

function openBuilderDeleteConfirm(kind, id) {
  if (!id) {
    return;
  }
  const labels = {
    course: "course",
    lesson: "lesson",
    assessment: "assessment",
  };
  if (!labels[kind]) {
    return;
  }
  pendingDangerAction = {
    type: "builder-delete",
    kind,
    id,
    title: `Hapus ${labels[kind]}`,
    description: `${labels[kind]} ini akan dihapus dari struktur SkillHub.`,
    confirmLabel: `Hapus ${labels[kind]}`,
    tone: "danger",
  };
  rerenderAdminDashboardFromState();
}

function openAppUserResetConfirm(userId) {
  const user = getAppUserById(userId);
  if (!user) {
    setDashboardMessage("User aplikasi tidak ditemukan di data saat ini.", "error");
    return;
  }

  pendingDangerAction = {
    type: "app-user-reset-password",
    userId,
    title: "Reset password user aplikasi",
    description: `Password ${getAppUserRoleLabel(user.role)} ${user.nama} akan direset.`,
    confirmLabel: "Reset password",
    tone: "warning",
  };
  activeAdminTab = "settings";
  activeSettingTab = "user";
  rerenderAdminDashboardFromState();
}

function openAppUserStatusConfirm(userId, nextStatus) {
  const user = getAppUserById(userId);
  if (!user || !nextStatus) {
    setDashboardMessage("User aplikasi tidak ditemukan di data saat ini.", "error");
    return;
  }

  pendingDangerAction = {
    type: "app-user-status",
    userId,
    nextStatus,
    title: nextStatus === "arsip" ? "Archive user aplikasi" : "Aktifkan user aplikasi",
    description: `${getAppUserRoleLabel(user.role)} ${user.nama} akan diubah statusnya menjadi ${nextStatus}.`,
    confirmLabel: nextStatus === "arsip" ? "Archive user" : "Aktifkan user",
    tone: nextStatus === "arsip" ? "danger" : "success",
  };
  activeAdminTab = "settings";
  activeSettingTab = "user";
  rerenderAdminDashboardFromState();
}

function closeDangerActionModal() {
  pendingDangerAction = null;
  rerenderCurrentDashboardFromState();
}

function renderDangerActionModal() {
  if (!pendingDangerAction) {
    return "";
  }

  const isReset = ["reset-password", "app-user-reset-password"].includes(pendingDangerAction.type);

  return `
    <div class="confirm-backdrop" role="presentation" data-close-confirm-action>
      <section class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <div class="confirm-icon confirm-${escapeHtml(pendingDangerAction.tone)}">!</div>
        <div>
          <p class="eyebrow">Konfirmasi aksi</p>
          <h3 id="confirm-title">${escapeHtml(pendingDangerAction.title)}</h3>
          <p>${escapeHtml(pendingDangerAction.description)}</p>
        </div>
        <form data-confirm-action>
          ${
            isReset
              ? `<label>Password baru <input name="password" value="${pendingDangerAction.type === "app-user-reset-password" ? "User12345!" : "Siswa12345!"}" minlength="8" required /></label>`
              : ""
          }
          <div class="confirm-actions">
            <button class="button button-ghost" type="button" data-close-confirm-action>Batal</button>
            <button class="button ${pendingDangerAction.tone === "success" ? "button-primary" : "button-secondary"}" type="submit">${escapeHtml(pendingDangerAction.confirmLabel)}</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

function renderAdminMarkup() {
  return `
    <div class="section-head admin-section-head">
      <div class="section-title-row">
        <button class="sidebar-toggle" type="button" data-toggle-admin-sidebar aria-label="Tampilkan atau sembunyikan menu admin">☰</button>
        <div>
          <p class="eyebrow">Admin Console</p>
          <h2>${escapeHtml(getAdminTabDefinitions().find(([tab]) => tab === activeAdminTab)?.[1] ?? "BrightEd")}</h2>
        </div>
      </div>
      ${renderDashboardActions("data-refresh-dashboard")}
    </div>

    <div class="admin-layout admin-console-layout">
      ${renderAdminTabs()}
      <div class="admin-main admin-main-card">
        ${renderExecutiveOverview()}
        ${renderStats()}

        <div class="admin-grid">
      ${renderSkillHubBuilder()}
      <article class="workspace-card admin-section tab-schools legacy-school-form">
        <h3>Buat sekolah</h3>
        <form data-create-school>
          <label>Nama sekolah <input name="nama" required /></label>
          <label>Kode sekolah <input name="kode_sekolah" required /></label>
          <label>Alamat <textarea name="alamat" rows="3"></textarea></label>
          <button class="button button-primary" type="submit">Simpan sekolah</button>
        </form>
      </article>

      <article class="workspace-card admin-section tab-students legacy-student-form">
        <h3>Daftarkan user</h3>
        <form data-create-student>
          <label>Nama user <input name="nama" required /></label>
          <label>Email <input name="email" type="email" required /></label>
          <label>Password <input name="password" value="Siswa12345!" required /></label>
          <label>
            Role
            <select name="role">
              <option value="peserta">siswa</option>
              <option value="fasilitator">fasilitator</option>
              <option value="pengawas">instructor / pengawas</option>
              <option value="admin">admin</option>
            </select>
          </label>
          <label>
            Sekolah
            <select name="sekolah_id">
              <option value="">Tanpa sekolah</option>
              ${getSekolahOptions()}
            </select>
          </label>
          <label>
            Fasilitator siswa
            <select name="fasilitator_id">
              <option value="">Tanpa fasilitator</option>
              ${getFasilitatorOptions()}
            </select>
          </label>
          <button class="button button-primary" type="submit">Buat user</button>
        </form>
      </article>

      <article class="workspace-card import-card admin-section tab-students legacy-student-form">
        <h3>Import siswa massal</h3>
        <form data-import-students>
          <label>File CSV / Excel <input name="file" type="file" accept=".csv,.xlsx,.xls" required /></label>
          <label>
            Default sekolah
            <select name="default_sekolah_id">
              <option value="">Ikuti file / tanpa sekolah</option>
              ${getSekolahOptions()}
            </select>
          </label>
          <label>
            Default fasilitator
            <select name="default_fasilitator_id">
              <option value="">Ikuti file / tanpa fasilitator</option>
              ${getFasilitatorOptions()}
            </select>
          </label>
          <label>
            Auto assign SkillHub
            <select name="default_skillhub_id">
              <option value="">Tidak auto assign</option>
              ${getSkillHubOptions()}
            </select>
          </label>
          <p class="form-help">Kolom yang dibaca: nama, email, password, kode_sekolah/sekolah_id, fasilitator_id, skillhub_id/skillhub_nama. Password default: Siswa12345!.</p>
          <div class="form-actions">
            <button class="button button-ghost" type="button" data-download-import-template>Download template CSV</button>
            <button class="button button-primary" type="submit">Import siswa</button>
          </div>
        </form>
      </article>

      <article class="workspace-card admin-section tab-content">
        <h3>Buat SkillHub</h3>
        <form data-create-skillhub>
          <label>Nama SkillHub <input name="nama" required /></label>
          <label>Deskripsi <textarea name="deskripsi" rows="3"></textarea></label>
          <label>
            Status
            <select name="status">
              <option value="publish">publish</option>
              <option value="draft">draft</option>
            </select>
          </label>
          <button class="button button-primary" type="submit">Buat SkillHub</button>
        </form>
      </article>

      <article class="workspace-card admin-section tab-students legacy-student-form">
        <h3>Assign siswa ke SkillHub</h3>
        <form data-assign-enrollment>
          <label>
            Siswa
            <select name="user_id" required>
              <option value="">Pilih siswa</option>
              ${getPesertaOptions()}
            </select>
          </label>
          <label>
            SkillHub
            <select name="skillhub_id" required>
              <option value="">Pilih SkillHub</option>
              ${getSkillHubOptions()}
            </select>
          </label>
          <button class="button button-primary" type="submit">Assign</button>
        </form>
      </article>

      <article class="workspace-card admin-section tab-content legacy-content-form">
        <h3>Tambah course</h3>
        <form data-create-course>
          <label>
            SkillHub
            <select name="skillhub_id" required>
              <option value="">Pilih SkillHub</option>
              ${getSkillHubOptions()}
            </select>
          </label>
          <label>Judul course <input name="judul" required /></label>
          <label>Urutan <input name="urutan" type="number" min="1" value="1" /></label>
          <button class="button button-primary" type="submit">Buat course</button>
        </form>
      </article>

      <article class="workspace-card admin-section tab-content legacy-content-form">
        <h3>Tambah lesson</h3>
        <form data-create-lesson>
          <label>
            Course
            <select name="course_id" required>
              <option value="">Pilih course</option>
              ${getCourseOptions()}
            </select>
          </label>
          <label>Judul lesson <input name="judul" required /></label>
          <label>
            Tipe konten
            <select name="tipe_konten">
              <option value="scorm">scorm</option>
              <option value="article">article</option>
              <option value="video">video</option>
              <option value="pdf">pdf</option>
              <option value="quiz">quiz</option>
            </select>
          </label>
          <label>Urutan <input name="urutan" type="number" min="1" value="1" /></label>
          <button class="button button-primary" type="submit">Buat lesson</button>
        </form>
      </article>

      <article class="workspace-card admin-section tab-content legacy-content-form">
        <h3>Upload SCORM</h3>
        <form data-upload-scorm>
          <label>
            Lesson
            <select name="lesson_id" required>
              <option value="">Pilih lesson</option>
              ${getLessonOptions()}
            </select>
          </label>
          <label>Paket SCORM ZIP <input name="package" type="file" accept=".zip,application/zip" required /></label>
          <button class="button button-primary" type="submit">Upload SCORM</button>
        </form>
      </article>

      <article class="workspace-card admin-section tab-assessment legacy-content-form">
        <h3>Buat assessment</h3>
        <form data-create-assessment>
          <label>
            SkillHub
            <select name="skillhub_id" required>
              <option value="">Pilih SkillHub</option>
              ${getSkillHubOptions()}
            </select>
          </label>
          <label>Judul assessment <input name="judul" required /></label>
          <label>Passing score <input name="passing_score" type="number" min="0" max="100" value="70" /></label>
          <label>Max attempts <input name="max_attempts" type="number" min="1" value="3" /></label>
          <label class="full-field">
            Bank soal JSON opsional
            <textarea name="questions_json" rows="8" placeholder='[{"id":"q1","prompt":"Pertanyaan?","options":["A","B","C"],"correct_answer":"A"}]'></textarea>
          </label>
          <button class="button button-primary" type="submit">Buat assessment</button>
        </form>
      </article>

      <article class="workspace-card admin-section tab-certificates">
        <h3>Generate sertifikat</h3>
        <form data-generate-certificate>
          <label>
            Siswa
            <select name="user_id" required>
              <option value="">Pilih siswa</option>
              ${getPesertaOptions()}
            </select>
          </label>
          <label>
            SkillHub
            <select name="skillhub_id" required>
              <option value="">Pilih SkillHub</option>
              ${getSkillHubOptions()}
            </select>
          </label>
          <button class="button button-primary" type="submit">Generate sertifikat</button>
        </form>
      </article>
    </div>

    <div class="data-grid">
      <article class="workspace-card data-card admin-section tab-schools">
        <div class="card-head">
          <div>
            <h3>Data sekolah</h3>
            <p>${getFilteredSchools().length} sekolah tampil dari ${dashboardState.sekolah.length} total.</p>
          </div>
          ${renderSchoolToolbar()}
        </div>
        ${renderSchoolFilters()}
        <div class="table-wrap">
          <table class="member-table school-table">
            <thead>
              <tr>
                ${renderSortHeader("Sekolah", "nama", "schools", schoolSort)}
                ${renderSortHeader("Alamat", "alamat", "schools", schoolSort)}
                ${renderSortHeader("User", "users", "schools", schoolSort)}
                ${renderSortHeader("Status", "status", "schools", schoolSort)}
                ${renderSortHeader("Update", "updated", "schools", schoolSort)}
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>${renderSchoolRows()}</tbody>
          </table>
          ${renderPagination("schools", schoolPage, paginate(getSortedSchools(), schoolPage, SCHOOL_PAGE_SIZE).totalPages, getSortedSchools().length, SCHOOL_PAGE_SIZE)}
        </div>
      </article>

      <article class="workspace-card data-card admin-section tab-students">
        <div class="card-head">
          <div>
            <h3>Data siswa</h3>
            <p>${getFilteredAdminStudents().length} siswa tampil dari ${dashboardState.users.filter((user) => user.role === "peserta").length} total.</p>
          </div>
          ${renderStudentTableToolbar()}
        </div>
        ${renderAdminStudentFilters()}
        <div class="table-wrap">
          <table class="member-table">
            <thead>
              <tr>
                ${renderSortHeader("ID Siswa", "id", "admin-students", adminStudentSort)}
                ${renderSortHeader("Nama", "nama", "admin-students", adminStudentSort)}
                ${renderSortHeader("Sekolah", "sekolah", "admin-students", adminStudentSort)}
                ${renderSortHeader("Akses sampai", "akses", "admin-students", adminStudentSort)}
                ${renderSortHeader("Status", "status", "admin-students", adminStudentSort)}
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>${renderStudentRows()}</tbody>
          </table>
          ${renderPagination("admin-students", adminStudentPage, paginate(getSortedAdminStudents(), adminStudentPage, STUDENT_PAGE_SIZE).totalPages, getSortedAdminStudents().length, STUDENT_PAGE_SIZE)}
        </div>
      </article>

      <article class="workspace-card data-card admin-section tab-content">
        <h3>SkillHub terbaru</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Course</th>
                <th>Lesson</th>
                <th>SCORM</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${renderSkillHubRows()}</tbody>
          </table>
        </div>
      </article>

      <article class="workspace-card data-card admin-section tab-students">
        <h3>Enrollment terbaru</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Siswa</th>
                <th>SkillHub</th>
                <th>Tanggal assign</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${renderEnrollmentRows()}</tbody>
          </table>
        </div>
      </article>

      <article class="workspace-card data-card admin-section tab-certificates">
        <h3>Sertifikat terbaru</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Siswa</th>
                <th>SkillHub</th>
                <th>Nomor</th>
                <th>Terbit</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>${renderCertificateRows()}</tbody>
          </table>
        </div>
      </article>

      <article class="workspace-card data-card admin-section tab-assessment">
        <h3>Hasil test terbaru</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Siswa</th>
                <th>Assessment</th>
                <th>Skor</th>
                <th>Status</th>
                <th>Waktu</th>
              </tr>
            </thead>
            <tbody>${renderAttemptRows()}</tbody>
          </table>
        </div>
      </article>

      <article class="workspace-card data-card admin-section tab-audit">
        <div class="card-head">
          <div>
            <h3>Audit log aktivitas</h3>
            <p>${dashboardState.activityLogs.length} aktivitas terbaru dari aksi penting LMS.</p>
          </div>
        </div>
        <div class="table-wrap">
          <table class="member-table activity-table">
            <thead>
              <tr>
                ${renderSortHeader("Waktu", "created_at", "audit", auditLogSort)}
                ${renderSortHeader("Aktivitas", "action", "audit", auditLogSort)}
                ${renderSortHeader("Detail", "description", "audit", auditLogSort)}
                ${renderSortHeader("Aktor", "actor", "audit", auditLogSort)}
                ${renderSortHeader("Role", "role", "audit", auditLogSort)}
              </tr>
            </thead>
            <tbody>${renderActivityLogRows()}</tbody>
          </table>
          ${renderPagination("audit", auditLogPage, paginate(getSortedActivityLogs(), auditLogPage, AUDIT_LOG_PAGE_SIZE).totalPages, getSortedActivityLogs().length, AUDIT_LOG_PAGE_SIZE)}
        </div>
      </article>

      ${renderReportCard("Admin")}
      ${renderSettingsCard()}
    </div>

        <p class="workspace-message" data-dashboard-message></p>
      </div>
    </div>
    ${renderDangerActionModal()}
  `;
}


function renderStudentDetailList(title, items, renderItem, emptyMessage) {
  const content = items.length
    ? items.map(renderItem).join("")
    : `<p class="muted-copy">${escapeHtml(emptyMessage)}</p>`;

  return `
    <section class="detail-section">
      <h4>${escapeHtml(title)}</h4>
      <div class="detail-list">${content}</div>
    </section>
  `;
}


function renderStudentManagementForm(user) {
  const isAdmin = currentUser?.role === "admin";

  return `
    <section class="detail-section student-edit-section">
      <h4>Edit data siswa</h4>
      <form data-edit-student data-student-id="${escapeHtml(user.id)}" class="student-edit-form">
        <label>Nama siswa <input name="nama" value="${escapeHtml(user.nama)}" required /></label>
        <label>Email <input name="email" type="email" value="${escapeHtml(user.email)}" required /></label>
        ${
          isAdmin
            ? `
              <label>
                Sekolah
                <select name="sekolah_id">
                  <option value="">Tanpa sekolah</option>
                  ${getSekolahOptions(user.sekolah_id ?? "")}
                </select>
              </label>
              <label>
                Fasilitator
                <select name="fasilitator_id">
                  <option value="">Tanpa fasilitator</option>
                  ${getFasilitatorOptions(user.fasilitator_id ?? "")}
                </select>
              </label>
            `
            : ""
        }
        <label>Masa aktif mulai <input name="masa_aktif_mulai" type="date" value="${toDateInputValue(user.masa_aktif_mulai)}" /></label>
        <label>Masa aktif selesai <input name="masa_aktif_selesai" type="date" value="${toDateInputValue(user.masa_aktif_selesai)}" /></label>
        <div class="form-actions full-field">
          <button class="button button-primary" type="submit">Simpan perubahan</button>
          <button class="button button-ghost" type="button" data-reset-student-password="${escapeHtml(user.id)}">Reset password</button>
          <button class="button button-secondary" type="button" data-toggle-student-status="${escapeHtml(user.id)}" data-next-status="${user.status_akses === "aktif" ? "arsip" : "aktif"}">${user.status_akses === "aktif" ? "Arsipkan akses" : "Aktifkan akses"}</button>
        </div>
      </form>
    </section>
  `;
}

async function saveStudentProfile(form) {
  const userId = form.getAttribute("data-student-id");
  const formData = new FormData(form);

  if (!userId) {
    return;
  }

  const payload = {
    nama: formData.get("nama"),
    email: formData.get("email"),
    masa_aktif_mulai: formData.get("masa_aktif_mulai") || null,
    masa_aktif_selesai: formData.get("masa_aktif_selesai") || null,
  };

  if (currentUser?.role === "admin") {
    payload.sekolah_id = formData.get("sekolah_id") || null;
    payload.fasilitator_id = formData.get("fasilitator_id") || null;
  }

  const submitter = form.querySelector("button[type='submit']");

  try {
    submitter.disabled = true;
    await apiRequest(`/api/users/${encodeURIComponent(userId)}/student-profile`, {
      method: "PATCH",
      ...jsonOptions(payload),
    });
    if (currentUser?.role === "admin") {
      await renderAdminDashboard(true);
    } else {
      await renderStaffDashboard(true);
    }
    await openStudentDetail(userId);
    setDashboardMessage("Data siswa berhasil diperbarui.", "success");
  } catch (error) {
    setDashboardMessage(getErrorMessage(error), "error");
  } finally {
    submitter.disabled = false;
  }
}

async function resetStudentPassword(userId, password) {
  const result = await apiRequest(`/api/users/${encodeURIComponent(userId)}/reset-password`, {
    method: "PATCH",
    ...jsonOptions({ password }),
  });
  return result;
}

async function toggleStudentStatus(userId, nextStatus) {
  await apiRequest(`/api/users/${encodeURIComponent(userId)}/status`, {
    method: "PATCH",
    ...jsonOptions({ status_akses: nextStatus }),
  });
}

async function executeDangerAction(form) {
  if (!pendingDangerAction) {
    return;
  }

  const submitter = form.querySelector("button[type='submit']");
  const action = pendingDangerAction;

  try {
    submitter.disabled = true;

    if (action.type === "reset-password") {
      const formData = new FormData(form);
      const password = String(formData.get("password") ?? "").trim();
      const result = await resetStudentPassword(action.userId, password);
      pendingDangerAction = null;
      setDashboardMessage(`Password siswa berhasil direset: ${result.temporary_password}`, "success");
      return;
    }

    if (action.type === "app-user-reset-password") {
      const formData = new FormData(form);
      const password = String(formData.get("password") ?? "").trim();
      const result = await resetStudentPassword(action.userId, password);
      pendingDangerAction = null;
      activeAdminTab = "settings";
  activeSettingTab = "user";
      await renderAdminDashboard(true);
      setDashboardMessage(`Password user aplikasi berhasil direset: ${result.temporary_password}`, "success");
      return;
    }

    if (action.type === "app-user-status") {
      await toggleStudentStatus(action.userId, action.nextStatus);
      pendingDangerAction = null;
      activeAdminTab = "settings";
  activeSettingTab = "user";
      await renderAdminDashboard(true);
      setDashboardMessage(`Status user aplikasi diubah menjadi ${action.nextStatus}.`, "success");
      return;
    }

    if (action.type === "student-status") {
      await toggleStudentStatus(action.userId, action.nextStatus);
      pendingDangerAction = null;
      if (currentUser?.role === "admin") {
        await renderAdminDashboard(true);
      } else {
        await renderStaffDashboard(true);
      }
      await openStudentDetail(action.userId);
      setDashboardMessage(`Status akses siswa diubah menjadi ${action.nextStatus}.`, "success");
      return;
    }

    if (action.type === "school-archive") {
      await apiRequest(`/api/sekolah/${action.schoolId}`, {
        method: "DELETE",
      });
      pendingDangerAction = null;
      activeAdminTab = "schools";
      activeSchoolTool = "";
      selectedSchoolId = "";
      await renderAdminDashboard(true);
      setDashboardMessage("Sekolah berhasil diarsipkan.", "success");
      return;
    }

    if (action.type === "revoke-certificate") {
      await apiRequest(`/api/certificates/${action.certificateId}/revoke`, {
        method: "PATCH",
      });
      pendingDangerAction = null;
      await renderAdminDashboard(true);
      setDashboardMessage("Sertifikat berhasil direvoke.", "success");
      return;
    }

    if (action.type === "builder-delete") {
      await deleteBuilderItem(action.kind, action.id);
      pendingDangerAction = null;
      return;
    }
  } catch (error) {
    setDashboardMessage(getErrorMessage(error), "error");
  } finally {
    if (submitter) {
      submitter.disabled = false;
    }
  }
}


function getAssessmentConfigFromForm(formData) {
  return {
    passing_score: Number(formData.get("passing_score") || 70),
    max_attempts: Number(formData.get("max_attempts") || 3),
  };
}

async function deleteBuilderItem(kind, id) {
  if (!id) {
    return;
  }

  const labels = {
    course: "course",
    lesson: "lesson",
    assessment: "assessment",
  };
  const paths = {
    course: `/api/courses/${encodeURIComponent(id)}`,
    lesson: `/api/lessons/${encodeURIComponent(id)}`,
    assessment: `/api/assessments/${encodeURIComponent(id)}`,
  };

  if (!paths[kind]) {
    return;
  }

  try {
    await apiRequest(paths[kind], { method: "DELETE" });
    activeAdminTab = kind === "assessment" ? "assessment" : "content";
    await renderAdminDashboard(true);
    setDashboardMessage(`${labels[kind]} berhasil dihapus.`, "success");
  } catch (error) {
    setDashboardMessage(getErrorMessage(error), "error");
  }
}

function renderStudentDetailPanel(user) {
  const access = user.access ?? {};
  const enrollments = user.enrollments ?? [];
  const attempts = user.assessment_attempts ?? [];
  const scormProgresses = user.scorm_progresses ?? [];
  const certificates = user.certificates ?? [];

  return `
    <article class="workspace-card student-detail-panel" data-student-detail-panel>
      <div class="profile-panel-head">
        <div>
          <p class="eyebrow">Detail siswa</p>
          <h3>${escapeHtml(user.nama)}</h3>
          <p class="muted-copy">${escapeHtml(user.email)} · ${escapeHtml(user.sekolah?.nama ?? "Tanpa sekolah")}</p>
        </div>
        <button class="button button-ghost" type="button" data-close-student-detail>Tutup</button>
      </div>
      <div class="detail-summary-grid">
        <article>
          <span>Status akses</span>
          <strong>${escapeHtml(user.status_akses)}</strong>
        </article>
        <article>
          <span>Masa aktif</span>
          <strong>${formatDate(user.masa_aktif_mulai)} – ${formatDate(user.masa_aktif_selesai)}</strong>
        </article>
        <article>
          <span>Materi belajar</span>
          <strong>${access.canAccessLearningMaterial ? "Aktif" : "Terkunci"}</strong>
        </article>
        <article>
          <span>Sertifikat</span>
          <strong>${certificates.length}</strong>
        </article>
      </div>
      <div class="detail-grid">
        ${renderStudentManagementForm(user)}
        ${renderStudentDetailList(
          "Enrollment",
          enrollments,
          (enrollment) => `
            <article class="detail-item">
              <strong>${escapeHtml(enrollment.skillhub?.nama ?? "-")}</strong>
              <span>${escapeHtml(enrollment.status)} · assign ${formatDate(enrollment.tanggal_assign)}</span>
            </article>
          `,
          "Belum ada enrollment.",
        )}
        ${renderStudentDetailList(
          "Hasil test",
          attempts,
          (attempt) => `
            <article class="detail-item">
              <strong>${escapeHtml(attempt.assessment?.judul ?? "-")}</strong>
              <span>Skor ${Number(attempt.skor).toFixed(0)} · ${attempt.status_lulus ? "Lulus" : "Belum lulus"} · ${formatDate(attempt.waktu_selesai ?? attempt.created_at)}</span>
            </article>
          `,
          "Belum ada hasil test.",
        )}
        ${renderStudentDetailList(
          "Progress SCORM",
          scormProgresses,
          (progress) => `
            <article class="detail-item">
              <strong>${escapeHtml(progress.scorm_package?.lesson?.judul ?? "Paket SCORM")}</strong>
              <span>${escapeHtml(progress.status)} · skor ${progress.skor ?? "-"} · ${progress.waktu_belajar ?? 0} detik</span>
            </article>
          `,
          "Belum ada progress SCORM.",
        )}
        ${renderStudentDetailList(
          "Sertifikat",
          certificates,
          (certificate) => `
            <article class="detail-item detail-item-actions">
              <div>
                <strong>${escapeHtml(certificate.skillhub?.nama ?? "-")}</strong>
                <span>${escapeHtml(certificate.nomor_sertifikat)} · ${escapeHtml(certificate.status)} · ${formatDate(certificate.tanggal_terbit)}</span>
              </div>
              <div class="row-actions">
                <a href="/api/public/certificates/verify/${escapeHtml(certificate.kode_verifikasi)}" target="_blank" rel="noreferrer">Verify</a>
                <a href="/api/public/certificates/download/${escapeHtml(certificate.kode_verifikasi)}" target="_blank" rel="noreferrer">PDF</a>
              </div>
            </article>
          `,
          "Belum ada sertifikat.",
        )}
      </div>
    </article>
  `;
}

async function openStudentDetail(userId) {
  if (!adminDashboard || !userId) {
    return;
  }

  try {
    setDashboardMessage("Memuat detail siswa...");
    const detail = await apiRequest(`/api/users/${encodeURIComponent(userId)}/detail`);
    closeStudentDetail();
    const dialog = document.createElement("dialog");
    dialog.className = "student-detail-dialog";
    dialog.setAttribute("data-student-detail-dialog", "");
    dialog.setAttribute("aria-label", `Detail siswa ${detail.nama ?? ""}`.trim());
    dialog.innerHTML = localizeMarkup(renderStudentDetailPanel(detail));
    bindDialogSubmitHandlers(dialog);
    dialog.addEventListener("close", closeStudentDetail, { once: true });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        dialog.close();
      }
    });
    adminDashboard.append(dialog);
    dialog.showModal();
    dialog.querySelector("[data-close-student-detail], input, select, button")?.focus();
    setDashboardMessage("Detail siswa siap dilihat.", "success");
  } catch (error) {
    setDashboardMessage(getErrorMessage(error), "error");
  }
}

function closeStudentDetail() {
  document.querySelector("[data-student-detail-dialog]")?.remove();
  adminDashboard?.querySelector("[data-student-detail-panel]")?.remove();
}

function rerenderAdminDashboardFromState() {
  if (!adminDashboard) {
    return;
  }
  adminDashboard.dataset.adminTab = activeAdminTab;
  adminDashboard.dataset.sidebar = adminSidebarCollapsed ? "collapsed" : "expanded";
  adminDashboard.innerHTML = localizeMarkup(renderAdminMarkup());
  bindAdminDashboardEvents();
}

function rerenderStaffDashboardFromState() {
  if (!adminDashboard) {
    return;
  }
  adminDashboard.dataset.staffTab = activeStaffTab;
  adminDashboard.dataset.staffSidebar = staffSidebarCollapsed ? "collapsed" : "expanded";
  adminDashboard.innerHTML = localizeMarkup(renderStaffMarkup());
  bindStaffDashboardEvents();
}

function rerenderStudentDashboardFromState() {
  if (!adminDashboard) {
    return;
  }
  adminDashboard.dataset.studentTab = activeStudentTab;
  adminDashboard.dataset.studentSidebar = studentSidebarCollapsed ? "collapsed" : "expanded";
  adminDashboard.innerHTML = localizeMarkup(renderStudentMarkup());
  bindStudentDashboardEvents();
}

function getToastRoot() {
  let toastRoot = document.querySelector("[data-toast-root]");

  if (!toastRoot) {
    toastRoot = document.createElement("div");
    toastRoot.className = "toast-root";
    toastRoot.setAttribute("data-toast-root", "");
    toastRoot.setAttribute("aria-live", "polite");
    toastRoot.setAttribute("aria-atomic", "true");
    document.body.appendChild(toastRoot);
  }

  return toastRoot;
}

function showToast(message, type = "info") {
  if (!message) {
    return;
  }

  const toastRoot = getToastRoot();
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", type === "error" ? "alert" : "status");
  toast.innerHTML = `
    <strong>${type === "success" ? "Berhasil" : type === "error" ? "Gagal" : "Info"}</strong>
    <span>${escapeHtml(message)}</span>
    <button type="button" aria-label="Tutup notifikasi">×</button>
  `;

  toast.querySelector("button")?.addEventListener("click", () => toast.remove());
  toastRoot.appendChild(toast);

  window.setTimeout(() => {
    toast.classList.add("is-hiding");
    window.setTimeout(() => toast.remove(), 180);
  }, type === "error" ? 6200 : 4200);
}

function setDashboardMessage(message, type = "info") {
  const messageElement = adminDashboard?.querySelector("[data-dashboard-message]");

  if (messageElement) {
    messageElement.textContent = message;
    messageElement.dataset.type = type;
  }

  showToast(message, type);
}

async function submitAndRefresh(event, submitter) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  let successMessage = "Perubahan berhasil disimpan.";

  try {
    submitter.disabled = true;

    if (form.matches("[data-update-permissions]")) {
      const permissions = {};
      PERMISSION_FEATURES.forEach(([featureKey]) => {
        permissions[featureKey] = {};
        PERMISSION_ROLES.forEach(([roleKey]) => {
          permissions[featureKey][roleKey] = formData.has(`${featureKey}.${roleKey}`);
        });
      });
      permissions.settings.admin = true;

      const result = await apiRequest("/api/settings/permissions", {
        method: "PUT",
        ...jsonOptions({ permissions }),
      });
      dashboardState.permissions = normalizePermissionMatrix(result.permissions);
      ensureActiveAdminTabAllowed();
      activeAdminTab = "settings";
      successMessage = "Role & Permission Matrix berhasil disimpan.";
    }

    if (form.matches("[data-update-certificate-settings]")) {
      const result = await apiRequest("/api/settings/certificate", {
        method: "PUT",
        ...jsonOptions({
          title: formData.get("title"),
          subtitle: formData.get("subtitle"),
          recipient_label: formData.get("recipient_label"),
          material_label: formData.get("material_label"),
          completion_label: formData.get("completion_label"),
          date_source: formData.get("date_source"),
          asset_path: formData.get("asset_path") || null,
          text_config: buildCertificateTextConfigFromForm(formData),
        }),
      });
      dashboardState.certificateSettings = normalizeCertificateSettings(result.settings);
      activeAdminTab = "settings";
      activeSettingTab = "certificate";
      successMessage = "Setting sertifikat berhasil disimpan.";
    }

    if (form.matches("[data-upload-certificate-asset]")) {
      const uploadData = new FormData();
      uploadData.set("file", formData.get("file"));
      const result = await apiRequest("/api/settings/certificate/upload", {
        method: "POST",
        body: uploadData,
      });
      dashboardState.certificateSettings = normalizeCertificateSettings(result.settings);
      activeAdminTab = "settings";
      activeSettingTab = "certificate";
      successMessage = "Asset sertifikat berhasil diupload.";
    }

    if (form.matches("[data-create-school]")) {
      await apiRequest("/api/sekolah", {
        method: "POST",
        ...jsonOptions({
          nama: formData.get("nama"),
          kode_sekolah: formData.get("kode_sekolah"),
          alamat: formData.get("alamat"),
        }),
      });
      activeAdminTab = "schools";
      activeSchoolTool = "";
      closeSchoolActionDialog();
      successMessage = "Sekolah berhasil dibuat.";
    }

    if (form.matches("[data-update-school]")) {
      await apiRequest(`/api/sekolah/${form.getAttribute("data-update-school")}`, {
        method: "PUT",
        ...jsonOptions({
          nama: formData.get("nama"),
          kode_sekolah: formData.get("kode_sekolah"),
          alamat: formData.get("alamat"),
        }),
      });
      activeAdminTab = "schools";
      activeSchoolTool = "";
      selectedSchoolId = "";
      closeSchoolActionDialog();
      successMessage = "Sekolah berhasil diperbarui.";
    }

    if (form.matches("[data-create-app-user]")) {
      await apiRequest("/api/users", {
        method: "POST",
        ...jsonOptions({
          nama: formData.get("nama"),
          email: formData.get("email"),
          password: formData.get("password"),
          role: formData.get("role"),
          status_akses: formData.get("status_akses"),
        }),
      });
      activeAdminTab = "settings";
  activeSettingTab = "user";
      activeAppUserTool = "";
      selectedAppUserId = "";
      closeAppUserActionDialog();
      successMessage = "User aplikasi berhasil dibuat.";
    }

    if (form.matches("[data-update-app-user]")) {
      const userId = form.getAttribute("data-update-app-user");
      await apiRequest(`/api/users/${encodeURIComponent(userId)}`, {
        method: "PUT",
        ...jsonOptions({
          nama: formData.get("nama"),
          email: formData.get("email"),
          role: formData.get("role"),
          status_akses: formData.get("status_akses"),
        }),
      });
      activeAdminTab = "settings";
  activeSettingTab = "user";
      activeAppUserTool = "";
      selectedAppUserId = "";
      closeAppUserActionDialog();
      successMessage = "User aplikasi berhasil diperbarui.";
    }

    if (form.matches("[data-create-student]")) {
      const role = String(formData.get("role") || "peserta");
      await apiRequest("/api/users", {
        method: "POST",
        ...jsonOptions({
          nama: formData.get("nama"),
          email: formData.get("email"),
          password: formData.get("password"),
          role,
          sekolah_id: formData.get("sekolah_id") || null,
          fasilitator_id:
            role === "peserta" ? formData.get("fasilitator_id") || null : null,
        }),
      });
      successMessage = "Siswa berhasil didaftarkan.";
      activeAdminStudentTool = "";
      closeStudentToolDialog();
    }

    if (form.matches("[data-create-skillhub]")) {
      const skillhub = await apiRequest("/api/skillhubs", {
        method: "POST",
        ...jsonOptions({
          nama: formData.get("nama"),
          deskripsi: formData.get("deskripsi"),
          status: formData.get("status"),
        }),
      });
      selectedSkillhubBuilderId = skillhub.id;
      activeAdminTab = "content";
      successMessage = "SkillHub berhasil dibuat.";
    }

    if (form.matches("[data-update-skillhub]")) {
      await apiRequest(`/api/skillhubs/${formData.get("skillhub_id")}`, {
        method: "PUT",
        ...jsonOptions({
          nama: formData.get("nama"),
          deskripsi: formData.get("deskripsi"),
        }),
      });
      activeAdminTab = "content";
      successMessage = "Info SkillHub berhasil diperbarui.";
    }

    if (form.matches("[data-assign-enrollment]")) {
      await apiRequest("/api/enrollments/assign", {
        method: "POST",
        ...jsonOptions({
          user_id: formData.get("user_id"),
          skillhub_id: formData.get("skillhub_id"),
        }),
      });
      successMessage = "Siswa berhasil di-assign ke SkillHub.";
      activeAdminStudentTool = "";
      selectedAssignStudentId = "";
      closeStudentToolDialog();
    }

    if (form.matches("[data-update-course]")) {
      await apiRequest(`/api/courses/${form.getAttribute("data-course-id")}`, {
        method: "PUT",
        ...jsonOptions({
          judul: formData.get("judul"),
          urutan: Number(formData.get("urutan") || 1),
        }),
      });
      activeAdminTab = "content";
      successMessage = "Course berhasil diperbarui.";
    }

    if (form.matches("[data-update-lesson]")) {
      await apiRequest(`/api/lessons/${form.getAttribute("data-lesson-id")}`, {
        method: "PUT",
        ...jsonOptions({
          judul: formData.get("judul"),
          tipe_konten: formData.get("tipe_konten"),
          urutan: Number(formData.get("urutan") || 1),
        }),
      });
      activeAdminTab = "content";
      successMessage = "Lesson berhasil diperbarui.";
    }

    if (form.matches("[data-update-assessment]")) {
      await apiRequest(`/api/assessments/${form.getAttribute("data-assessment-id")}`, {
        method: "PUT",
        ...jsonOptions({
          judul: formData.get("judul"),
          tipe: "quiz",
          konfigurasi: getAssessmentConfigFromForm(formData),
        }),
      });
      activeAdminTab = "assessment";
      successMessage = "Assessment berhasil diperbarui.";
    }

    if (form.matches("[data-create-course]")) {
      await apiRequest(`/api/skillhubs/${formData.get("skillhub_id")}/courses`, {
        method: "POST",
        ...jsonOptions({
          judul: formData.get("judul"),
          urutan: Number(formData.get("urutan") || 1),
        }),
      });
      activeAdminTab = "content";
      successMessage = "Course berhasil dibuat.";
    }

    if (form.matches("[data-create-lesson]")) {
      await apiRequest(`/api/courses/${formData.get("course_id")}/lessons`, {
        method: "POST",
        ...jsonOptions({
          judul: formData.get("judul"),
          tipe_konten: formData.get("tipe_konten"),
          urutan: Number(formData.get("urutan") || 1),
        }),
      });
      activeAdminTab = "content";
      successMessage = "Lesson berhasil dibuat.";
    }

    if (form.matches("[data-upload-scorm]")) {
      const uploadData = new FormData();
      uploadData.set("package", formData.get("package"));
      await apiRequest(`/api/lessons/${formData.get("lesson_id")}/scorm/upload`, {
        method: "POST",
        body: uploadData,
      });
      activeAdminTab = "content";
      successMessage = "Paket SCORM berhasil diupload.";
    }

    if (form.matches("[data-create-assessment]")) {
      const questionsJson = String(formData.get("questions_json") || "").trim();
      const konfigurasi = {
        passing_score: Number(formData.get("passing_score") || 70),
        max_attempts: Number(formData.get("max_attempts") || 3),
      };

      if (questionsJson) {
        const questions = JSON.parse(questionsJson);
        if (!Array.isArray(questions)) {
          throw new Error("Bank soal harus berupa array JSON.");
        }
        konfigurasi.questions = questions;
      }

      await apiRequest(`/api/skillhubs/${formData.get("skillhub_id")}/assessments`, {
        method: "POST",
        ...jsonOptions({
          judul: formData.get("judul"),
          tipe: "quiz",
          konfigurasi,
        }),
      });
      activeAdminTab = "assessment";
      successMessage = "Assessment berhasil dibuat.";
    }

    if (form.matches("[data-generate-certificate]")) {
      const certificate = await apiRequest("/api/certificates/generate", {
        method: "POST",
        ...jsonOptions({
          user_id: formData.get("user_id"),
          skillhub_id: formData.get("skillhub_id"),
        }),
      });
      successMessage = `Sertifikat siap: ${certificate.nomor_sertifikat}. Link verify dan PDF tersedia di tabel sertifikat.`;
    }

    if (form.matches("[data-import-students]")) {
      const result = await apiRequest("/api/users/import-students", {
        method: "POST",
        body: formData,
      });
      successMessage = summarizeImportResult(result);
      activeAdminStudentTool = "";
      closeStudentToolDialog();
    }

    form.reset();
    await renderAdminDashboard(true);
    setDashboardMessage(successMessage, "success");
  } catch (error) {
    setDashboardMessage(getErrorMessage(error), "error");
  } finally {
    submitter.disabled = false;
  }
}


function updateReportFiltersFromForm(form) {
  const formData = new FormData(form);
  reportFilters = {
    search: String(formData.get("search") ?? ""),
    skillhub_id: String(formData.get("skillhub_id") ?? ""),
    status_akses: String(formData.get("status_akses") ?? ""),
    status_lulus: String(formData.get("status_lulus") ?? ""),
  };
}

function rerenderCurrentDashboardFromState() {
  if (currentUser?.role === "admin") {
    rerenderAdminDashboardFromState();
  } else {
    rerenderStaffDashboardFromState();
  }
}

function updateSortState(sortState, key) {
  if (sortState.key === key) {
    sortState.direction = sortState.direction === "asc" ? "desc" : "asc";
    return;
  }

  sortState.key = key;
  sortState.direction = "asc";
}

function bindSortAndPaginationEvents() {
  adminDashboard?.querySelectorAll("[data-sort-table]").forEach((button) => {
    button.addEventListener("click", () => {
      const table = button.getAttribute("data-sort-table");
      const key = button.getAttribute("data-sort-key") ?? "nama";

      if (table === "admin-students") {
        updateSortState(adminStudentSort, key);
        adminStudentPage = 1;
        rerenderAdminDashboardFromState();
      }

      if (table === "staff-students") {
        updateSortState(staffStudentSort, key);
        staffStudentPage = 1;
        rerenderStaffDashboardFromState();
      }

      if (table === "schools") {
        updateSortState(schoolSort, key);
        schoolPage = 1;
        rerenderAdminDashboardFromState();
      }

      if (table === "app-users") {
        updateSortState(appUserSort, key);
        appUserPage = 1;
        rerenderAdminDashboardFromState();
      }

      if (table === "audit") {
        updateSortState(auditLogSort, key);
        auditLogPage = 1;
        rerenderAdminDashboardFromState();
      }
    });
  });

  adminDashboard?.querySelectorAll("[data-page-kind]").forEach((button) => {
    button.addEventListener("click", () => {
      const kind = button.getAttribute("data-page-kind");
      const page = Number(button.getAttribute("data-page") ?? 1);

      if (kind === "admin-students") {
        adminStudentPage = page;
        rerenderAdminDashboardFromState();
      }

      if (kind === "staff-students") {
        staffStudentPage = page;
        rerenderStaffDashboardFromState();
      }

      if (kind === "schools") {
        schoolPage = page;
        rerenderAdminDashboardFromState();
      }

      if (kind === "app-users") {
        appUserPage = page;
        rerenderAdminDashboardFromState();
      }

      if (kind === "audit") {
        auditLogPage = page;
        rerenderAdminDashboardFromState();
      }
    });
  });
}

function bindReportEvents() {
  const reportFilterForm = adminDashboard?.querySelector("[data-report-filters]");
  reportFilterForm?.addEventListener("submit", (event) => event.preventDefault());
  reportFilterForm?.addEventListener("input", () => {
    updateReportFiltersFromForm(reportFilterForm);
    rerenderCurrentDashboardFromState();
  });
  reportFilterForm?.addEventListener("change", () => {
    updateReportFiltersFromForm(reportFilterForm);
    rerenderCurrentDashboardFromState();
  });
  adminDashboard?.querySelector("[data-reset-report-filters]")?.addEventListener("click", () => {
    reportFilters = { search: "", skillhub_id: "", status_akses: "", status_lulus: "" };
    rerenderCurrentDashboardFromState();
  });
  adminDashboard?.querySelector("[data-export-report-csv]")?.addEventListener("click", exportReportCsv);
}

function bindNotificationEvents(root = adminDashboard) {
  root?.querySelector("[data-notifications-read-all]")?.addEventListener("click", (event) => {
    markAllNotificationsRead(event.currentTarget);
  });
}

function bindAdminDashboardEvents() {
  bindLogoutButtons(adminDashboard);
  bindNotificationEvents(adminDashboard);
  adminDashboard.dataset.adminTab = activeAdminTab;

  adminDashboard?.querySelector("[data-toggle-admin-sidebar]")?.addEventListener("click", () => {
    adminSidebarCollapsed = !adminSidebarCollapsed;
    adminDashboard.dataset.sidebar = adminSidebarCollapsed ? "collapsed" : "expanded";
  });

  adminDashboard?.querySelectorAll("[data-admin-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      activeAdminTab = button.getAttribute("data-admin-tab") ?? "students";
      activeAdminStudentTool = "";
      activeSchoolTool = "";
      activeAppUserTool = "";
      selectedAppUserId = "";
      selectedSchoolId = "";
      closeStudentDetail();
      rerenderAdminDashboardFromState();
    });
  });

  adminDashboard?.querySelectorAll("[data-setting-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      activeSettingTab = button.getAttribute("data-setting-tab") ?? "summary";
      activeAdminTab = "settings";
      rerenderAdminDashboardFromState();
    });
  });

  adminDashboard?.querySelectorAll("[data-certificate-config-field]").forEach((input) => {
    input.addEventListener("input", () => updateCertificatePreviewField(input));
    input.addEventListener("change", () => updateCertificatePreviewField(input));
  });

  adminDashboard?.querySelector("[data-reset-certificate-layout]")?.addEventListener("click", () => {
    dashboardState.certificateSettings = normalizeCertificateSettings({
      ...dashboardState.certificateSettings,
      text_config: DEFAULT_CERTIFICATE_TEXT_CONFIG,
    });
    activeAdminTab = "settings";
    activeSettingTab = "certificate";
    rerenderAdminDashboardFromState();
  });

  bindSortAndPaginationEvents();

  adminDashboard?.querySelectorAll("[data-open-student-tool]").forEach((button) => {
    button.addEventListener("click", () => {
      activeAdminTab = "students";
      openStudentToolDialog(button.getAttribute("data-open-student-tool") ?? "");
    });
  });

  adminDashboard?.querySelector("[data-close-student-tool]")?.addEventListener("click", () => {
    activeAdminStudentTool = "";
    selectedAssignStudentId = "";
    closeStudentToolDialog();
  });

  adminDashboard?.querySelector("[data-builder-skillhub]")?.addEventListener("change", (event) => {
    selectedSkillhubBuilderId = event.target.value;
    activeAdminTab = "content";
    rerenderAdminDashboardFromState();
  });

  adminDashboard?.querySelectorAll("[data-toggle-skillhub-status]").forEach((button) => {
    button.addEventListener("click", async () => {
      const skillhubId = button.getAttribute("data-toggle-skillhub-status");
      const nextStatus = button.getAttribute("data-next-status");

      try {
        button.disabled = true;
        await apiRequest(`/api/skillhubs/${skillhubId}/status`, {
          method: "PATCH",
          ...jsonOptions({ status: nextStatus }),
        });
        activeAdminTab = "content";
        await renderAdminDashboard(true);
        setDashboardMessage(`Status SkillHub diubah menjadi ${nextStatus}.`, "success");
      } catch (error) {
        setDashboardMessage(getErrorMessage(error), "error");
      } finally {
        button.disabled = false;
      }
    });
  });

  adminDashboard?.querySelectorAll("[data-delete-course]").forEach((button) => {
    button.addEventListener("click", () => openBuilderDeleteConfirm("course", button.getAttribute("data-delete-course")));
  });

  adminDashboard?.querySelectorAll("[data-delete-lesson]").forEach((button) => {
    button.addEventListener("click", () => openBuilderDeleteConfirm("lesson", button.getAttribute("data-delete-lesson")));
  });

  adminDashboard?.querySelectorAll("[data-delete-assessment]").forEach((button) => {
    button.addEventListener("click", () => openBuilderDeleteConfirm("assessment", button.getAttribute("data-delete-assessment")));
  });

  const schoolFilterForm = adminDashboard?.querySelector("[data-school-filters]");
  schoolFilterForm?.addEventListener("submit", (event) => event.preventDefault());
  schoolFilterForm?.addEventListener("input", () => {
    const formData = new FormData(schoolFilterForm);
    schoolFilters = { search: String(formData.get("search") ?? "") };
    schoolPage = 1;
    rerenderAdminDashboardFromState();
  });
  schoolFilterForm?.addEventListener("change", () => {
    const formData = new FormData(schoolFilterForm);
    schoolFilters = { search: String(formData.get("search") ?? "") };
    schoolPage = 1;
    rerenderAdminDashboardFromState();
  });
  adminDashboard?.querySelector("[data-reset-school-filters]")?.addEventListener("click", () => {
    schoolFilters = { search: "" };
    schoolPage = 1;
    rerenderAdminDashboardFromState();
  });

  const appUserFilterForm = adminDashboard?.querySelector("[data-app-user-filters]");
  appUserFilterForm?.addEventListener("submit", (event) => event.preventDefault());
  const updateAppUserFilters = () => {
    const formData = new FormData(appUserFilterForm);
    appUserFilters = {
      search: String(formData.get("search") ?? ""),
      role: String(formData.get("role") ?? ""),
      status: String(formData.get("status") ?? ""),
    };
    appUserPage = 1;
    rerenderAdminDashboardFromState();
  };
  appUserFilterForm?.addEventListener("input", updateAppUserFilters);
  appUserFilterForm?.addEventListener("change", updateAppUserFilters);
  adminDashboard?.querySelector("[data-reset-app-user-filters]")?.addEventListener("click", () => {
    appUserFilters = { search: "", role: "", status: "" };
    appUserPage = 1;
    rerenderAdminDashboardFromState();
  });

  const adminFilters = adminDashboard?.querySelector("[data-admin-student-filters]");
  adminFilters?.addEventListener("submit", (event) => event.preventDefault());
  adminFilters?.addEventListener("input", () => {
    const formData = new FormData(adminFilters);
    adminStudentFilters = {
      search: String(formData.get("search") ?? ""),
      status: String(formData.get("status") ?? ""),
      sekolah_id: String(formData.get("sekolah_id") ?? ""),
    };
    adminStudentPage = 1;
    rerenderAdminDashboardFromState();
  });
  adminFilters?.addEventListener("change", () => {
    const formData = new FormData(adminFilters);
    adminStudentFilters = {
      search: String(formData.get("search") ?? ""),
      status: String(formData.get("status") ?? ""),
      sekolah_id: String(formData.get("sekolah_id") ?? ""),
    };
    adminStudentPage = 1;
    rerenderAdminDashboardFromState();
  });
  adminDashboard?.querySelector("[data-reset-student-filters]")?.addEventListener("click", () => {
    adminStudentFilters = { search: "", status: "", sekolah_id: "" };
    adminStudentPage = 1;
    rerenderAdminDashboardFromState();
  });
  adminDashboard
    ?.querySelector("[data-refresh-dashboard]")
    ?.addEventListener("click", () => renderAdminDashboard(true));

  bindReportEvents();

  adminDashboard?.querySelectorAll("[data-download-import-template]").forEach((button) => {
    button.addEventListener("click", downloadImportTemplate);
  });

  adminDashboard?.querySelectorAll("form:not([data-admin-student-filters]):not([data-school-filters]):not([data-app-user-filters]):not([data-report-filters])").forEach((form) => {
    form.addEventListener("submit", (event) => {
      const submitter = event.submitter ?? form.querySelector("button[type='submit']");
      submitAndRefresh(event, submitter);
    });
  });

  adminDashboard?.querySelectorAll("[data-revoke-certificate]").forEach((button) => {
    button.addEventListener("click", () => {
      openRevokeCertificateConfirm(button.getAttribute("data-revoke-certificate"));
    });
  });
}

async function renderAdminDashboard(shouldShow) {
  if (!adminDashboard) {
    return;
  }

  if (!shouldShow) {
    adminDashboard.hidden = true;
    adminDashboard.innerHTML = "";
    return;
  }

  adminDashboard.hidden = false;
  adminDashboard.innerHTML = localizeMarkup(renderWorkspaceLoading());

  try {
    await loadDashboardState();
    adminDashboard.dataset.adminTab = activeAdminTab;
    adminDashboard.dataset.sidebar = adminSidebarCollapsed ? "collapsed" : "expanded";
    adminDashboard.innerHTML = localizeMarkup(renderAdminMarkup());
    bindAdminDashboardEvents();
    // The loaded view provides confirmation without an interrupting toast.
  } catch (error) {
    adminDashboard.innerHTML = localizeMarkup(renderWorkspaceError(error));
    adminDashboard.querySelector("[data-retry-workspace]").addEventListener("click", () => renderAdminDashboard(true));
  }
}

function findEnrollmentForSkillHub(skillhubId) {
  return studentState.enrollments.find(
    (enrollment) => enrollment.skillhub_id === skillhubId,
  );
}

function renderLessonCards(skillhub, access) {
  const lessons = (skillhub.courses ?? []).flatMap((course) =>
    (course.lessons ?? []).map((lesson) => ({
      ...lesson,
      courseTitle: course.judul,
    })),
  );

  if (lessons.length === 0) {
    return `<p class="muted-copy">Belum ada lesson di SkillHub ini.</p>`;
  }

  return lessons
    .map((lesson) => {
      const hasScorm = Boolean(lesson.scorm_package);
      const disabled = !hasScorm || !access?.canAccessLearningMaterial;
      const buttonLabel = hasScorm ? "Mulai / resume SCORM" : "Belum ada SCORM";

      return `
        <article class="lesson-card">
          <div>
            <span>${escapeHtml(lesson.courseTitle)}</span>
            <strong>${escapeHtml(lesson.judul)}</strong>
            <small>Tipe: ${escapeHtml(lesson.tipe_konten)}</small>
          </div>
          <button
            class="button button-secondary"
            type="button"
            data-start-scorm="${escapeHtml(lesson.scorm_package?.id ?? "")}"
            ${disabled ? "disabled" : ""}
          >
            ${buttonLabel}
          </button>
        </article>
      `;
    })
    .join("");
}

function renderLearningCards() {
  if (studentState.skillhubs.length === 0) {
    return `
      <article class="workspace-card">
        <h3>Belum ada pembelajaran</h3>
        <p class="muted-copy">Admin belum meng-assign SkillHub ke akun ini.</p>
      </article>
    `;
  }

  return studentState.skillhubs
    .map((skillhub) => {
      const enrollment = findEnrollmentForSkillHub(skillhub.id);
      const access = enrollment?.access;
      const accessLabel = access?.canAccessLearningMaterial
        ? "Materi aktif"
        : "Materi terkunci";

      return `
        <article class="workspace-card learning-card">
          <div class="learning-head">
            <div>
              <p class="eyebrow">${escapeHtml(enrollment?.status ?? "enrolled")}</p>
              <h3>${escapeHtml(skillhub.nama)}</h3>
              <p>${escapeHtml(skillhub.deskripsi ?? "SkillHub BrightEd")}</p>
            </div>
            <span class="status-pill">${accessLabel}</span>
          </div>
          <div class="learning-meta">
            <span>Assign: ${formatDate(enrollment?.tanggal_assign)}</span>
            <span>Akses sampai: ${formatDate(enrollment?.user?.masa_aktif_selesai)}</span>
          </div>
          <div class="lesson-grid">
            ${renderLessonCards(skillhub, access)}
          </div>
          <div class="assessment-grid">
            ${renderAssessmentCards(skillhub, access)}
          </div>
        </article>
      `;
    })
    .join("");
}

function getPassingScore(config) {
  return typeof config?.passing_score === "number" ? config.passing_score : 70;
}

function getAssessmentQuestions(config) {
  return Array.isArray(config?.questions) ? config.questions : [];
}

function renderQuestionInputs(assessment, canTake) {
  const questions = getAssessmentQuestions(assessment.konfigurasi);

  if (questions.length === 0) {
    return `
      <input
        name="skor"
        type="number"
        min="0"
        max="100"
        value="90"
        ${canTake ? "" : "disabled"}
        required
      />
      <button class="button button-primary" type="submit" ${canTake ? "" : "disabled"}>
        Submit skor
      </button>
    `;
  }

  return `
    <div class="question-list">
      ${questions
        .map(
          (question, index) => `
            <fieldset>
              <legend>${index + 1}. ${escapeHtml(question.prompt)}</legend>
              ${(question.options ?? [])
                .map(
                  (option) => `
                    <label class="choice-option">
                      <input
                        type="radio"
                        name="answer_${escapeHtml(question.id)}"
                        value="${escapeHtml(option)}"
                        ${canTake ? "" : "disabled"}
                        required
                      />
                      ${escapeHtml(option)}
                    </label>
                  `,
                )
                .join("")}
            </fieldset>
          `,
        )
        .join("")}
    </div>
    <button class="button button-primary" type="submit" ${canTake ? "" : "disabled"}>
      Submit jawaban
    </button>
  `;
}

function renderAssessmentCards(skillhub, access) {
  const assessments = skillhub.assessments ?? [];

  if (assessments.length === 0) {
    return `<p class="muted-copy">Belum ada assessment untuk SkillHub ini.</p>`;
  }

  return assessments
    .map((assessment) => {
      const histories = studentState.assessmentHistories[assessment.id] ?? [];
      const latest = histories[0];
      const passingScore = getPassingScore(assessment.konfigurasi);
      const canTake = access?.canAccessLearningMaterial;
      const questionCount = getAssessmentQuestions(assessment.konfigurasi).length;

      return `
        <article class="assessment-card">
          <div>
            <span>Assessment</span>
            <strong>${escapeHtml(assessment.judul)}</strong>
            <small>Passing score: ${passingScore}</small>
            <small>${questionCount ? `${questionCount} soal pilihan` : "Mode skor manual"}</small>
            <small>Hasil terakhir: ${
              latest
                ? `${Number(latest.skor).toFixed(0)} — ${
                    latest.status_lulus ? "Lulus" : "Belum lulus"
                  }`
                : "Belum pernah submit"
            }</small>
          </div>
          <form data-submit-assessment="${escapeHtml(assessment.id)}">
            ${renderQuestionInputs(assessment, canTake)}
          </form>
        </article>
      `;
    })
    .join("");
}


function getStudentAssessmentAttempts() {
  return Object.values(studentState.assessmentHistories)
    .flatMap((histories) => histories ?? [])
    .sort((a, b) => new Date(b.waktu_selesai ?? b.created_at).getTime() - new Date(a.waktu_selesai ?? a.created_at).getTime());
}

function renderStudentResultRows() {
  const attempts = getStudentAssessmentAttempts();
  const rows = attempts
    .map(
      (attempt) => `
        <tr>
          <td>${escapeHtml(attempt.assessment?.skillhub?.nama ?? attempt.assessment?.skillhub?.id ?? "-")}</td>
          <td>${escapeHtml(attempt.assessment?.judul ?? "-")}</td>
          <td>${Number(attempt.skor).toFixed(0)}</td>
          <td>${attempt.status_lulus ? "Lulus" : "Belum lulus"}</td>
          <td>${formatDate(attempt.waktu_selesai ?? attempt.created_at)}</td>
        </tr>
      `,
    )
    .join("");

  return rows || renderEmptyRows("Belum ada hasil test.", 5);
}

function renderStudentResultsSection() {
  const attempts = getStudentAssessmentAttempts();
  const passed = attempts.filter((attempt) => attempt.status_lulus).length;

  return `
    <article class="workspace-card student-section tab-results student-results-card">
      <div class="card-head">
        <div>
          <p class="eyebrow">Hasil Test</p>
          <h3>Riwayat nilai siswa</h3>
          <p>${passed} lulus dari ${attempts.length} attempt.</p>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>SkillHub</th>
              <th>Assessment</th>
              <th>Skor</th>
              <th>Status</th>
              <th>Waktu</th>
            </tr>
          </thead>
          <tbody>${renderStudentResultRows()}</tbody>
        </table>
      </div>
    </article>
  `;
}

function renderStudentProfileSection() {
  const profileMarkup = renderProfilePanel()
    .replace('data-profile-panel', 'data-profile-panel data-student-profile-panel')
    .replace('<button class="button button-ghost" type="button" data-close-profile>Tutup</button>', '');

  return `
    <article class="workspace-card student-section tab-profile student-profile-card">
      ${profileMarkup}
    </article>
  `;
}

function renderCertificateCards() {
  if (studentState.certificates.length === 0) {
    return `<p class="muted-copy">Belum ada sertifikat.</p>`;
  }

  return studentState.certificates
    .map(
      (certificate) => `
        <article class="certificate-card">
          <strong>${escapeHtml(certificate.skillhub?.nama ?? "Sertifikat")}</strong>
          <span>${escapeHtml(certificate.nomor_sertifikat)}</span>
          <span>Status: ${escapeHtml(certificate.status)}</span>
          <a
            class="button button-ghost"
            href="/api/public/certificates/download/${escapeHtml(certificate.kode_verifikasi)}"
            target="_blank"
            rel="noreferrer"
          >
            Download PDF
          </a>
        </article>
      `,
    )
    .join("");
}

function renderStudentMarkup() {
  const activeLearning = studentState.enrollments.filter(
    (enrollment) => enrollment.access?.canAccessLearningMaterial,
  );

  return `
    <div class="section-head admin-section-head">
      <div class="section-title-row">
        <button class="sidebar-toggle" type="button" data-toggle-student-sidebar aria-label="Tampilkan atau sembunyikan menu siswa">☰</button>
        <div>
          <p class="eyebrow">Siswa</p>
          <h2>My Learning BrightEd</h2>
        </div>
      </div>
      ${renderDashboardActions("data-refresh-student")}
    </div>

    <div class="admin-layout student-layout">
      ${renderStudentTabs()}
      <div class="admin-main student-main">
        <div class="stats-grid">
          <article class="stat-card">
            <span>SkillHub</span>
            <strong>${studentState.enrollments.length}</strong>
            <small>Terdaftar</small>
          </article>
          <article class="stat-card">
            <span>Materi aktif</span>
            <strong>${activeLearning.length}</strong>
            <small>Bisa diakses saat ini</small>
          </article>
          <article class="stat-card">
            <span>Sertifikat</span>
            <strong>${studentState.certificates.length}</strong>
            <small>Tetap terlihat setelah masa aktif habis</small>
          </article>
          <article class="stat-card">
            <span>Status akun</span>
            <strong>${escapeHtml(currentUser?.status_akses ?? "-")}</strong>
            <small>${escapeHtml(currentUser?.email ?? "")}</small>
          </article>
        </div>

        <div class="data-grid">
          <article class="workspace-card scorm-player-card student-section tab-learning" data-scorm-player hidden>
            <div class="learning-head">
              <div>
                <p class="eyebrow">SCORM Player</p>
                <h3 data-scorm-title>Memuat materi...</h3>
              </div>
              <button class="button button-ghost" type="button" data-close-scorm>Tutup player</button>
            </div>
            <iframe
              title="SCORM player"
              data-scorm-frame
              loading="lazy"
            ></iframe>
            <div class="player-actions">
              <button class="button button-secondary" type="button" data-commit-scorm>
                Simpan progress
              </button>
              <button class="button button-primary" type="button" data-finish-scorm>
                Tandai selesai
              </button>
            </div>
          </article>
          <div class="student-section tab-learning student-learning-list">
            ${renderLearningCards()}
          </div>
          ${renderStudentResultsSection()}
          <article class="workspace-card student-section tab-certificates">
            <h3>Sertifikat saya</h3>
            <div class="certificate-grid">
              ${renderCertificateCards()}
            </div>
          </article>
          ${renderStudentProfileSection()}
        </div>

        <p class="workspace-message" data-dashboard-message></p>
      </div>
    </div>
  `;
}

function bindStudentDashboardEvents() {
  bindLogoutButtons(adminDashboard);
  bindNotificationEvents(adminDashboard);
  adminDashboard.dataset.studentTab = activeStudentTab;
  adminDashboard.dataset.studentSidebar = studentSidebarCollapsed ? "collapsed" : "expanded";

  adminDashboard?.querySelector("[data-toggle-student-sidebar]")?.addEventListener("click", () => {
    studentSidebarCollapsed = !studentSidebarCollapsed;
    adminDashboard.dataset.studentSidebar = studentSidebarCollapsed ? "collapsed" : "expanded";
  });

  adminDashboard?.querySelectorAll("[data-student-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      activeStudentTab = button.getAttribute("data-student-tab") ?? "learning";
      rerenderStudentDashboardFromState();
    });
  });
  adminDashboard
    ?.querySelector("[data-refresh-student]")
    ?.addEventListener("click", () => renderStudentDashboard(true));

  adminDashboard?.querySelectorAll("[data-start-scorm]").forEach((button) => {
    button.addEventListener("click", async () => {
      const scormPackageId = button.getAttribute("data-start-scorm");

      if (!scormPackageId) {
        return;
      }

      try {
        button.disabled = true;
        const launch = await apiRequest(
          `/api/scorm/${scormPackageId}/launch?token=${encodeURIComponent(authToken)}`,
        );
        const player = adminDashboard.querySelector("[data-scorm-player]");
        const frame = adminDashboard.querySelector("[data-scorm-frame]");
        const title = adminDashboard.querySelector("[data-scorm-title]");

        title.textContent = launch.scorm_package?.lesson?.judul ?? "Materi SCORM";
        frame.src = launch.launch_url;
        player.hidden = false;
        player.dataset.scormPackageId = scormPackageId;
        player.scrollIntoView({ behavior: "smooth", block: "start" });
        setDashboardMessage("SCORM player dibuka dan progress diinisialisasi.", "success");
      } catch (error) {
        setDashboardMessage(getErrorMessage(error), "error");
      } finally {
        button.disabled = false;
      }
    });
  });

  adminDashboard
    ?.querySelector("[data-close-scorm]")
    ?.addEventListener("click", () => {
      const player = adminDashboard.querySelector("[data-scorm-player]");
      const frame = adminDashboard.querySelector("[data-scorm-frame]");

      frame.src = "about:blank";
      player.hidden = true;
      delete player.dataset.scormPackageId;
    });

  adminDashboard
    ?.querySelector("[data-commit-scorm]")
    ?.addEventListener("click", async () => {
      const player = adminDashboard.querySelector("[data-scorm-player]");
      const scormPackageId = player?.dataset.scormPackageId;

      if (!scormPackageId) {
        return;
      }

      try {
        await apiRequest(`/api/scorm/${scormPackageId}/commit`, {
          method: "POST",
          ...jsonOptions({
            status: "incomplete",
            waktu_belajar: 60,
            suspend_data: `saved_at=${new Date().toISOString()}`,
          }),
        });
        setDashboardMessage("Progress SCORM tersimpan.", "success");
      } catch (error) {
        setDashboardMessage(getErrorMessage(error), "error");
      }
    });

  adminDashboard
    ?.querySelector("[data-finish-scorm]")
    ?.addEventListener("click", async () => {
      const player = adminDashboard.querySelector("[data-scorm-player]");
      const scormPackageId = player?.dataset.scormPackageId;

      if (!scormPackageId) {
        return;
      }

      try {
        await apiRequest(`/api/scorm/${scormPackageId}/finish`, {
          method: "POST",
          ...jsonOptions({
            status: "completed",
            skor: 100,
            waktu_belajar: 120,
          }),
        });
        await renderStudentDashboard(true);
        setDashboardMessage("SCORM ditandai selesai.", "success");
      } catch (error) {
        setDashboardMessage(getErrorMessage(error), "error");
      }
    });

  adminDashboard?.querySelectorAll("[data-submit-assessment]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const assessmentId = form.getAttribute("data-submit-assessment");
      const formData = new FormData(form);
      const skorValue = formData.get("skor");
      const answers = {};
      formData.forEach((value, key) => {
        if (key.startsWith("answer_")) {
          answers[key.replace("answer_", "")] = String(value);
        }
      });
      const button = form.querySelector("button[type='submit']");

      try {
        button.disabled = true;
        const attempt = await apiRequest(`/api/assessments/${assessmentId}/start`, {
          method: "POST",
        });
        const result = await apiRequest(
          `/api/assessment-attempts/${attempt.id}/submit`,
          {
            method: "POST",
            ...jsonOptions(
              Object.keys(answers).length > 0
                ? { answers }
                : { skor: Number(skorValue) },
            ),
          },
        );

        await renderStudentDashboard(true);
        setDashboardMessage(
          `Assessment tersubmit: skor ${Number(result.skor).toFixed(0)} (${
            result.status_lulus ? "lulus" : "belum lulus"
          }).`,
          "success",
        );
      } catch (error) {
        setDashboardMessage(getErrorMessage(error), "error");
      } finally {
        button.disabled = false;
      }
    });
  });
}

async function renderStudentDashboard(shouldShow) {
  if (!adminDashboard) {
    return;
  }

  if (!shouldShow) {
    if (currentUser?.role !== "admin") {
      adminDashboard.hidden = true;
      adminDashboard.innerHTML = "";
    }
    return;
  }

  adminDashboard.hidden = false;
  adminDashboard.innerHTML = localizeMarkup(renderWorkspaceLoading());

  try {
    await loadStudentState();
    adminDashboard.dataset.studentTab = activeStudentTab;
    adminDashboard.dataset.studentSidebar = studentSidebarCollapsed ? "collapsed" : "expanded";
    adminDashboard.innerHTML = localizeMarkup(renderStudentMarkup());
    bindStudentDashboardEvents();
    // The loaded view provides confirmation without an interrupting toast.
  } catch (error) {
    adminDashboard.innerHTML = localizeMarkup(renderWorkspaceError(error));
    adminDashboard.querySelector("[data-retry-workspace]").addEventListener("click", () => renderStudentDashboard(true));
  }
}

function renderStaffUserRows() {
  const pagination = paginate(getSortedStaffStudents(), staffStudentPage, STUDENT_PAGE_SIZE);
  staffStudentPage = pagination.page;
  const rows = pagination.items
    .map(
      (user) => `
        <tr>
          <td><strong>${escapeHtml(getStudentDisplayId(user))}</strong></td>
          <td class="member-name-cell"><strong>${escapeHtml(user.nama)}</strong><span>${escapeHtml(user.email)}</span></td>
          <td>${escapeHtml(user.sekolah?.nama ?? "-")}</td>
          <td>${formatDate(user.masa_aktif_selesai)}</td>
          <td>${renderStudentStatusBadge(user.status_akses)}</td>
          <td>${renderStudentRowActions(user)}</td>
        </tr>
      `,
    )
    .join("");

  return rows || renderEmptyRows("Tidak ada siswa dalam scope Anda yang cocok dengan filter.", 6);
}

function renderStaffEnrollmentRows() {
  const rows = staffState.enrollments
    .slice(0, 12)
    .map((enrollment) => {
      const canUpdate = currentUser?.role === "fasilitator";

      return `
        <tr>
          <td>${escapeHtml(enrollment.user?.nama ?? "-")}</td>
          <td>${escapeHtml(enrollment.skillhub?.nama ?? "-")}</td>
          <td>${formatDate(enrollment.tanggal_assign)}</td>
          <td>
            ${
              canUpdate
                ? `<select data-update-enrollment="${escapeHtml(enrollment.id)}">
                    ${["enrolled", "in_progress", "completed", "dropped"]
                      .map(
                        (status) =>
                          `<option value="${status}" ${
                            enrollment.status === status ? "selected" : ""
                          }>${status}</option>`,
                      )
                      .join("")}
                  </select>`
                : `<span class="status-pill table-pill">${escapeHtml(enrollment.status)}</span>`
            }
          </td>
        </tr>
      `;
    })
    .join("");

  return rows || `<tr><td colspan="4">Belum ada enrollment dalam scope Anda.</td></tr>`;
}

function getStaffSkillHubOptions(selectedId = "") {
  return staffState.skillhubs
    .map(
      (skillhub) =>
        `<option value="${escapeHtml(skillhub.id)}" ${
          skillhub.id === selectedId ? "selected" : ""
        }>${escapeHtml(skillhub.nama)}</option>`,
    )
    .join("");
}

function renderFacilitatorImportCard() {
  if (currentUser?.role !== "fasilitator") {
    return "";
  }

  return `
    <article class="workspace-card import-card full-width-card staff-section tab-students">
      <h3>Import siswa bimbingan</h3>
      <form data-import-students>
        <label>File CSV / Excel <input name="file" type="file" accept=".csv,.xlsx,.xls" required /></label>
        <label>
          Auto assign SkillHub
          <select name="default_skillhub_id">
            <option value="">Tidak auto assign</option>
            ${getStaffSkillHubOptions()}
          </select>
        </label>
        <p class="form-help">Siswa otomatis masuk ke bimbingan Anda. Kolom minimal: nama dan email. Password default: Siswa12345!.</p>
        <div class="form-actions">
          <button class="button button-ghost" type="button" data-download-import-template>Download template CSV</button>
          <button class="button button-primary" type="submit">Import siswa</button>
        </div>
      </form>
    </article>
  `;
}

function renderStaffMarkup() {
  const siswa = staffState.users.filter((user) => user.role === "peserta");
  const roleLabel =
    currentUser?.role === "pengawas"
      ? "Instructor / Pengawas"
      : "Fasilitator";
  const modeLabel =
    currentUser?.role === "pengawas"
      ? "Mode pantau: read-only"
      : "Mode fasilitator: bisa update status enrollment";

  return `
    <div class="section-head admin-section-head">
      <div class="section-title-row">
        <button class="sidebar-toggle" type="button" data-toggle-staff-sidebar aria-label="Tampilkan atau sembunyikan menu bimbingan">☰</button>
        <div>
          <p class="eyebrow">${roleLabel}</p>
          <h2>Dashboard Bimbingan</h2>
        </div>
      </div>
      ${renderDashboardActions("data-refresh-staff")}
    </div>

    <div class="admin-layout staff-layout">
      ${renderStaffTabs()}
      <div class="admin-main staff-main">
        <div class="stats-grid">
      <article class="stat-card">
        <span>Siswa scope</span>
        <strong>${siswa.length}</strong>
        <small>Terhubung ke role Anda</small>
      </article>
      <article class="stat-card">
        <span>Enrollment</span>
        <strong>${staffState.enrollments.length}</strong>
        <small>${modeLabel}</small>
      </article>
      <article class="stat-card">
        <span>SkillHub</span>
        <strong>${staffState.skillhubs.length}</strong>
        <small>Katalog referensi</small>
      </article>
      <article class="stat-card">
        <span>Hasil test</span>
        <strong>${staffState.attempts.length}</strong>
        <small>${staffState.attempts.filter((attempt) => attempt.status_lulus).length} lulus</small>
      </article>
      <article class="stat-card">
        <span>Role</span>
        <strong>${escapeHtml(currentUser?.role ?? "-")}</strong>
        <small>${escapeHtml(currentUser?.email ?? "")}</small>
      </article>
        </div>

        <div class="data-grid">
      ${renderFacilitatorImportCard()}
      <article class="workspace-card data-card staff-section tab-students">
        <div class="card-head">
          <div>
            <h3>Siswa bimbingan</h3>
            <p>${getFilteredStaffStudents().length} siswa tampil dari ${siswa.length} total scope.</p>
          </div>
          ${currentUser?.role === "fasilitator" ? `<div class="table-icon-toolbar" aria-label="Aksi data siswa"><button class="icon-action" type="button" title="Download template" data-download-import-template>⇩ <span>Template</span></button></div>` : ""}
        </div>
        ${renderStaffStudentFilters()}
        <div class="table-wrap">
          <table class="member-table">
            <thead>
              <tr>
                ${renderSortHeader("ID Siswa", "id", "staff-students", staffStudentSort)}
                ${renderSortHeader("Nama", "nama", "staff-students", staffStudentSort)}
                ${renderSortHeader("Sekolah", "sekolah", "staff-students", staffStudentSort)}
                ${renderSortHeader("Akses sampai", "akses", "staff-students", staffStudentSort)}
                ${renderSortHeader("Status", "status", "staff-students", staffStudentSort)}
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>${renderStaffUserRows()}</tbody>
          </table>
          ${renderPagination("staff-students", staffStudentPage, paginate(getSortedStaffStudents(), staffStudentPage, STUDENT_PAGE_SIZE).totalPages, getSortedStaffStudents().length, STUDENT_PAGE_SIZE)}
        </div>
      </article>

      <article class="workspace-card data-card staff-section tab-enrollments">
        <h3>Enrollment siswa</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Siswa</th>
                <th>SkillHub</th>
                <th>Tanggal assign</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${renderStaffEnrollmentRows()}</tbody>
          </table>
        </div>
      </article>

      <article class="workspace-card data-card staff-section tab-reports">
        <h3>Hasil test siswa</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Siswa</th>
                <th>Assessment</th>
                <th>Skor</th>
                <th>Status</th>
                <th>Waktu</th>
              </tr>
            </thead>
            <tbody>${renderAttemptRows(staffState.attempts)}</tbody>
          </table>
        </div>
      </article>

      ${renderReportCard(roleLabel)}
        </div>

        <p class="workspace-message" data-dashboard-message></p>
      </div>
    </div>
    ${renderDangerActionModal()}
  `;
}

function bindStaffDashboardEvents() {
  bindLogoutButtons(adminDashboard);
  bindNotificationEvents(adminDashboard);
  adminDashboard.dataset.staffTab = activeStaffTab;
  adminDashboard.dataset.staffSidebar = staffSidebarCollapsed ? "collapsed" : "expanded";

  adminDashboard?.querySelector("[data-toggle-staff-sidebar]")?.addEventListener("click", () => {
    staffSidebarCollapsed = !staffSidebarCollapsed;
    adminDashboard.dataset.staffSidebar = staffSidebarCollapsed ? "collapsed" : "expanded";
  });

  adminDashboard?.querySelectorAll("[data-staff-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      activeStaffTab = button.getAttribute("data-staff-tab") ?? "students";
      closeStudentDetail();
      rerenderStaffDashboardFromState();
    });
  });

  bindSortAndPaginationEvents();

  const staffFilters = adminDashboard?.querySelector("[data-staff-student-filters]");
  staffFilters?.addEventListener("submit", (event) => event.preventDefault());
  staffFilters?.addEventListener("input", () => {
    const formData = new FormData(staffFilters);
    staffStudentFilters = {
      search: String(formData.get("search") ?? ""),
      status: String(formData.get("status") ?? ""),
    };
    staffStudentPage = 1;
    rerenderStaffDashboardFromState();
  });
  staffFilters?.addEventListener("change", () => {
    const formData = new FormData(staffFilters);
    staffStudentFilters = {
      search: String(formData.get("search") ?? ""),
      status: String(formData.get("status") ?? ""),
    };
    staffStudentPage = 1;
    rerenderStaffDashboardFromState();
  });
  adminDashboard?.querySelector("[data-reset-staff-student-filters]")?.addEventListener("click", () => {
    staffStudentFilters = { search: "", status: "" };
    staffStudentPage = 1;
    rerenderStaffDashboardFromState();
  });
  adminDashboard
    ?.querySelector("[data-refresh-staff]")
    ?.addEventListener("click", () => renderStaffDashboard(true));

  bindReportEvents();

  adminDashboard?.querySelectorAll("[data-download-import-template]").forEach((button) => {
    button.addEventListener("click", downloadImportTemplate);
  });

  adminDashboard?.querySelectorAll("[data-import-students]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitter = event.submitter ?? form.querySelector("button[type='submit']");
      const formData = new FormData(form);

      try {
        submitter.disabled = true;
        const result = await apiRequest("/api/users/import-students", {
          method: "POST",
          body: formData,
        });
        await renderStaffDashboard(true);
        setDashboardMessage(summarizeImportResult(result), "success");
      } catch (error) {
        setDashboardMessage(getErrorMessage(error), "error");
      } finally {
        submitter.disabled = false;
      }
    });
  });

  adminDashboard?.querySelectorAll("[data-update-enrollment]").forEach((select) => {
    select.addEventListener("change", async () => {
      const enrollmentId = select.getAttribute("data-update-enrollment");

      try {
        select.disabled = true;
        await apiRequest(`/api/enrollments/${enrollmentId}/status`, {
          method: "PATCH",
          ...jsonOptions({ status: select.value }),
        });
        await renderStaffDashboard(true);
        setDashboardMessage("Status enrollment berhasil diperbarui.", "success");
      } catch (error) {
        setDashboardMessage(getErrorMessage(error), "error");
      } finally {
        select.disabled = false;
      }
    });
  });
}

async function renderStaffDashboard(shouldShow) {
  if (!adminDashboard) {
    return;
  }

  if (!shouldShow) {
    if (currentUser?.role !== "admin" && currentUser?.role !== "peserta") {
      adminDashboard.hidden = true;
      adminDashboard.innerHTML = "";
    }
    return;
  }

  adminDashboard.hidden = false;
  adminDashboard.innerHTML = localizeMarkup(renderWorkspaceLoading());

  try {
    await loadStaffState();
    adminDashboard.dataset.staffTab = activeStaffTab;
    adminDashboard.dataset.staffSidebar = staffSidebarCollapsed ? "collapsed" : "expanded";
    adminDashboard.innerHTML = localizeMarkup(renderStaffMarkup());
    bindStaffDashboardEvents();
    // The loaded view provides confirmation without an interrupting toast.
  } catch (error) {
    adminDashboard.innerHTML = localizeMarkup(renderWorkspaceError(error));
    adminDashboard.querySelector("[data-retry-workspace]").addEventListener("click", () => renderStaffDashboard(true));
  }
}

document.addEventListener("submit", async (event) => {
  if (!(event.target instanceof HTMLFormElement)) {
    return;
  }

  const form = event.target;

  if (form.matches("[data-confirm-action]")) {
    event.preventDefault();
    executeDangerAction(form);
    return;
  }

  if (form.matches("[data-edit-student]")) {
    event.preventDefault();
    saveStudentProfile(form);
    return;
  }

  if (!form.matches("[data-change-password]")) {
    return;
  }

  event.preventDefault();
  const formData = new FormData(form);
  const currentPassword = String(formData.get("current_password") ?? "");
  const newPassword = String(formData.get("new_password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");
  const button = form.querySelector("button[type='submit']");

  if (newPassword !== confirmPassword) {
    setDashboardMessage("Konfirmasi password baru tidak sama.", "error");
    return;
  }

  try {
    button.disabled = true;
    await apiRequest("/api/auth/me/password", {
      method: "PATCH",
      ...jsonOptions({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });
    form.reset();
    setDashboardMessage("Password berhasil diperbarui.", "success");
  } catch (error) {
    setDashboardMessage(getErrorMessage(error), "error");
  } finally {
    button.disabled = false;
  }
});

async function restoreSession() {
  if (!authToken) {
    setAuthenticatedLayout(false);
    renderLoginForm();
    return;
  }

  try {
    const payload = await apiRequest("/api/auth/me");
    currentUser = payload.user;
    renderSignedInState(payload.user, payload.access);
    setAuthenticatedLayout(true);
    await renderAdminDashboard(payload.user.role === "admin");
    await renderStudentDashboard(payload.user.role === "peserta");
    await renderStaffDashboard(
      payload.user.role === "fasilitator" || payload.user.role === "pengawas",
    );
  } catch (error) {
    localStorage.removeItem("brighted_token");
    authToken = "";
    setAuthenticatedLayout(false);
    renderLoginForm("Sesi lama habis. Silakan masuk lagi.");
  }
}

restoreSession();



// Presentation helpers: derive summaries only from the existing dashboard response.
function renderNavIcon(name) {
  const paths = {
    overview: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    students: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5"/>',
    schools: '<path d="m3 10 9-7 9 7v11H3Zm6 11v-7h6v7M7 10h.01M17 10h.01"/>',
    content: '<path d="M12 5v16M3 4c4-1 7 0 9 2 2-2 5-3 9-2v15c-4-1-7 0-9 2-2-2-5-3-9-2Z"/>',
    assessment: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="m9 12 2 2 4-5M9 17h6"/>',
    certificates: '<circle cx="12" cy="9" r="6"/><path d="m8 14-2 7 6-3 6 3-2-7"/>',
    reports: '<path d="M4 3v17h17M8 16v-5m5 5V6m5 10V9"/>',
    audit: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
    profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    enrollments: '<path d="M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4"/>',
    refresh: '<path d="M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 14 6M4 12a8 8 0 0 0 14 6"/>',
  };
  const key = ({'app-users':'profile',learning:'content',results:'assessment'})[name] ?? name;
  return `<svg class="ui-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[key] ?? paths.overview}</svg>`;
}

function renderWorkspaceLoading() {
  return `<section class="workspace-loading" role="status" aria-busy="true"><span class="brand-mark">B</span><p class="eyebrow">BRIGHTED WORKSPACE</p><h2>Menyiapkan ruang Anda…</h2><p>Memuat data dan aktivitas terbaru.</p><div class="skeleton-grid" aria-hidden="true"><i></i><i></i><i></i></div></section>`;
}
function renderWorkspaceError(error) {
  return `<section class="workspace-error" role="alert">${renderNavIcon('refresh')}<p class="eyebrow">Koneksi terhenti</p><h2>Data belum bisa ditampilkan.</h2><p>${escapeHtml(getErrorMessage(error))}</p><button type="button" class="button button-primary" data-retry-workspace>Coba lagi</button><p class="muted-copy">Periksa koneksi, lalu muat kembali workspace Anda.</p></section>`;
}
function renderExecutiveOverview() {
  if (activeAdminTab !== 'overview') return '';
  const students = dashboardState.users.filter(user => user.role === 'peserta');
  const active = students.filter(user => user.status_akses === 'aktif').length;
  const now = new Date();
  const months = Array.from({length: 6}, (_, i) => new Date(now.getFullYear(), now.getMonth() - 5 + i, 1));
  const counts = months.map(month => dashboardState.enrollments.filter(row => {
    const date = new Date(row.tanggal_assign);
    return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
  }).length);
  const max = Math.max(...counts, 1);
  const total = counts.reduce((a, b) => a + b, 0);
  const chart = `<div class="enrollment-chart" role="img" aria-label="Enrollment enam bulan terakhir: ${months.map((m,i) => `${m.toLocaleDateString('id-ID',{month:'long',year:'numeric'})}: ${counts[i]}`).join('; ')}"><div class="chart-gridlines" aria-hidden="true"><span>${max}</span><span>${max / 2}</span><span>0</span></div><div class="chart-columns">${months.map((m,i) => `<div class="chart-column" style="--bar-ratio:${counts[i]/max}"><strong>${counts[i]}</strong><div class="chart-bar ${i === 5 ? 'current' : ''}" style="--bar-height:${Math.max(0,counts[i]/max*100)}%" title="${escapeHtml(m.toLocaleDateString('id-ID',{month:'long',year:'numeric'}))}: ${counts[i]} enrollment"></div><span>${m.toLocaleDateString('id-ID',{month:'short'})}</span></div>`).join('')}</div></div>`;
  const programs = dashboardState.skillhubs.map(hub => ({...hub, enrolled: dashboardState.enrollments.filter(row => row.skillhub_id === hub.id).length})).sort((a,b) => b.enrolled - a.enrolled).slice(0,4);
  const maxProgram = Math.max(...programs.map(p => p.enrolled),1);
  const passed = dashboardState.attempts.filter(row => row.status_lulus).length;
  const rate = students.length ? Math.round(active/students.length*100) : 0;
  return `<section class="executive-overview">
    <div class="overview-heading"><div><p class="eyebrow">LEARNING OPERATIONS / OVERVIEW</p><h1>Ruang tumbuh, <em>terukur.</em></h1><p>Selamat datang, ${escapeHtml(currentUser?.nama ?? 'Admin')}. Berikut gambaran pembelajaran Anda.</p></div><span class="overview-date">${renderNavIcon('audit')}${escapeHtml(now.toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}))}</span></div>
    <div class="executive-metrics">
      ${[["Siswa terdaftar",students.length,`${active} siswa dengan akses aktif`,'students'],['SkillHub',dashboardState.skillhubs.length,'Program dalam katalog belajar','content'],['Enrollment',dashboardState.enrollments.length,'Pendaftaran siswa ke program','enrollments'],['Sertifikat terbit',dashboardState.certificates.length,'Bukti pencapaian pembelajaran','certificates']].map(([label,value,detail,icon],i) => `<article class="executive-metric ${i===0?'featured':''}"><div><span>${label}</span>${renderNavIcon(icon)}</div><strong>${value.toLocaleString('id-ID')}</strong><small>${detail}</small></article>`).join('')}
    </div>
    <div class="overview-charts"><article class="insight-card enrollment-insight"><div class="insight-heading"><div><p class="eyebrow">PARTISIPASI</p><h3>Aktivitas enrollment</h3></div><span class="quiet-tag">6 bulan terakhir</span></div><div class="chart-total"><strong>${total}</strong><span>pendaftaran dalam periode ini</span></div>${chart}${total ? '' : '<p class="chart-empty">Belum ada enrollment pada periode ini.</p>'}<div class="chart-caption"><span><i></i>Enrollment bulanan</span><span>${months[0].getFullYear() === now.getFullYear() ? now.getFullYear() : `${months[0].getFullYear()}–${now.getFullYear()}`}</span></div></article>
    <article class="insight-card engagement-insight"><p class="eyebrow">AKSES BELAJAR</p><h3>Siap untuk berkembang</h3><div class="engagement-donut" style="--percent:${rate}%" role="img" aria-label="${active} dari ${students.length} siswa memiliki akses aktif"><div><strong>${students.length ? rate+'%' : '—'}</strong><span>siswa aktif</span></div></div><div class="engagement-legend"><span><i></i>Akses aktif<strong>${active}</strong></span><span><i></i>Akses lainnya<strong>${students.length-active}</strong></span></div><p class="insight-footnote">Status akses akun, bukan tingkat penyelesaian materi.</p></article></div>
    <div class="overview-bottom"><article class="insight-card"><div class="insight-heading"><div><p class="eyebrow">KATALOG PEMBELAJARAN</p><h3>SkillHub dengan enrollment terbanyak</h3></div>${hasPermission('content')?'<button type="button" class="text-action" data-admin-tab="content">Lihat semua ↗</button>':''}</div><div class="program-list">${programs.length?programs.map((hub,i)=>`<div class="program-row"><span class="program-number">${String(i+1).padStart(2,'0')}</span><div><strong>${escapeHtml(hub.nama)}</strong><div class="program-track"><i style="width:${hub.enrolled/maxProgram*100}%"></i></div></div><span><strong>${hub.enrolled}</strong> siswa</span></div>`).join(''):'<div class="designed-empty">'+renderNavIcon('content')+'<strong>Katalog masih kosong</strong><p>Program yang dibuat akan muncul di sini.</p></div>'}</div></article><article class="insight-card achievement-card"><p class="eyebrow">HASIL PEMBELAJARAN</p><h3>Setiap langkah berarti.</h3><div class="achievement-number">${passed}<span>hasil test lulus</span></div><p>Dari ${dashboardState.attempts.length} hasil test yang tercatat di workspace.</p>${hasPermission('reports')?'<button type="button" class="button button-secondary" data-admin-tab="reports">Jelajahi laporan ↗</button>':''}</article></div>
    <footer class="overview-footer"><span>BrightEd Akademi · Learning workspace</span><span>Dashboard berdasarkan data yang dimuat</span></footer>
  </section>`;
}

