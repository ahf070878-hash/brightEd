/* SCORM 1.2 adapter: synchronous content API backed by serialized LMS commits. */
let activeScormRuntime = null;
async function prepareScormRuntime(packageId) {
  if (activeScormRuntime) await activeScormRuntime.flush();
  const progress = await apiRequest(`/api/scorm/${packageId}/initialize`);
  let stored = null;
  try { stored = JSON.parse(progress.suspend_data || 'null'); } catch {}
  const saved = stored?.brighted_scorm === 1 ? stored.cmi : null;
  const baseSeconds = progress.waktu_belajar || 0;
  const formatTime = seconds => `${String(Math.floor(seconds / 3600)).padStart(4, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const cmi = {
    'cmi.core.student_id': progress.user_id,
    'cmi.core.student_name': '',
    'cmi.core.lesson_location': saved?.['cmi.core.lesson_location'] || '',
    'cmi.core.lesson_status': progress.status === 'not_attempted' ? 'not attempted' : progress.status || 'incomplete',
    'cmi.core.score.raw': progress.skor == null ? '' : String(progress.skor),
    'cmi.core.score.min': '0', 'cmi.core.score.max': '100',
    'cmi.core.entry': progress.suspend_data ? 'resume' : 'ab-initio',
    'cmi.core.total_time': formatTime(baseSeconds), 'cmi.core.session_time': '0000:00:00',
    'cmi.core.exit': '', 'cmi.core.credit': 'credit', 'cmi.core.lesson_mode': 'normal',
    'cmi.suspend_data': saved?.['cmi.suspend_data'] ?? progress.suspend_data ?? '', 'cmi.launch_data': '',
  };
  let queue = Promise.resolve(), initialized = false, error = '0';
  function flush() {
    const time = String(cmi['cmi.core.session_time']).split(':').map(Number);
    const elapsed = time.length === 3 && time.every(Number.isFinite) ? Math.max(0, Math.floor(time[0] * 3600 + time[1] * 60 + time[2])) : 0;
    const payload = {
      status: cmi['cmi.core.lesson_status'] === 'not attempted' || cmi['cmi.core.lesson_status'] === 'browsed' ? 'incomplete' : cmi['cmi.core.lesson_status'],
      waktu_belajar: baseSeconds + elapsed,
      suspend_data: JSON.stringify({ brighted_scorm: 1, cmi: { 'cmi.core.lesson_location': cmi['cmi.core.lesson_location'], 'cmi.suspend_data': cmi['cmi.suspend_data'] } }),
    };
    if (cmi['cmi.core.score.raw'] !== '') payload.skor = Number(cmi['cmi.core.score.raw']);
    queue = queue.catch(() => {}).then(() => apiRequest(`/api/scorm/${packageId}/commit`, { method: 'POST', ...jsonOptions(payload) }));
    queue.catch(() => { error = '101'; setDashboardMessage(materialCopy('Progres belum tersimpan. Periksa koneksi, lalu klik Simpan progress.', 'Progress has not been saved. Check your connection and select Save progress.'), 'error'); });
    return queue;
  }
  const api = {
    LMSInitialize: () => { initialized = true; error = '0'; return 'true'; },
    LMSGetValue: key => { if (!initialized) { error = '301'; return ''; } error = '0'; return String(cmi[key] ?? ''); },
    LMSSetValue: (key, value) => { if (!initialized) { error = '301'; return 'false'; } cmi[key] = String(value); error = '0'; return 'true'; },
    LMSCommit: () => { if (!initialized) { error = '301'; return 'false'; } flush(); return 'true'; },
    LMSFinish: () => { if (!initialized) return 'false'; flush(); initialized = false; return 'true'; },
    LMSGetLastError: () => error,
    LMSGetErrorString: code => ({ '0': 'No error', '101': 'Unable to save progress', '301': 'Not initialized' }[code] || 'General error'),
    LMSGetDiagnostic: () => error,
  };
  activeScormRuntime = { packageId, flush, api, cmi };
  window.API = api;
}
