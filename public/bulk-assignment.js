const bulkAssignment = { selected: new Set(), search: '', school: '', hub: '', busy: false, message: '', error: '' };
function renderBulkAssignment() { return '<section class="inline-tool-panel bulk-assignment" data-bulk-assignment></section>'; }
function bindBulkAssignment() {
  const host = document.querySelector('[data-bulk-assignment]');
  if (!host) return;
  const state = bulkAssignment, t = materialCopy;
  const learners = dashboardState.users.filter(user => user.role === 'peserta');
  const validIds = new Set(learners.map(user => user.id));
  state.selected.forEach(id => { if (!validIds.has(id)) state.selected.delete(id); });
  const matches = () => learners.filter(user => (!state.school || user.sekolah_id === state.school) && `${user.nama} ${user.email}`.toLowerCase().includes(state.search.toLowerCase().trim()));
  const assigned = id => dashboardState.enrollments.some(row => row.user_id === id && row.skillhub_id === state.hub);
  const drawList = () => {
    const rows = matches();
    host.querySelector('[data-bulk-list]').innerHTML = rows.length ? rows.map(user => `<label class="bulk-learner"><input type="checkbox" data-bulk-user="${escapeHtml(user.id)}" ${state.selected.has(user.id) ? 'checked' : ''} ${state.busy ? 'disabled' : ''}><span><strong>${escapeHtml(user.nama)}</strong><small>${escapeHtml(user.email)} · ${escapeHtml(user.sekolah?.nama || t('Tanpa sekolah','No school'))}</small></span><small>${assigned(user.id) ? t('Sudah terdaftar','Already enrolled') : user.status_akses === 'arsip' ? t('Akses diarsipkan','Access archived') : ''}</small></label>`).join('') : `<p class="muted-copy">${t('Tidak ada siswa sesuai filter.','No learners match these filters.')}</p>`;
    host.querySelector('[data-bulk-all]').textContent = `${t('Pilih semua hasil','Select all results')} (${rows.length})`;
    const duplicate = [...state.selected].filter(assigned).length;
    host.querySelector('[data-bulk-count]').textContent = `${state.selected.size} ${t('siswa dipilih','learners selected')}${state.hub ? ` · ${duplicate} ${t('sudah terdaftar, akan dilewati','already enrolled; will be skipped')}` : ''}`;
    const submit = host.querySelector('[data-bulk-submit]');
    submit.disabled = state.busy || !state.hub || !state.selected.size || state.selected.size > 500;
    submit.textContent = state.busy ? t('Menugaskan…','Assigning…') : `${t('Assign ke','Assign to')} ${state.selected.size} ${t('siswa','learners')}`;
    host.querySelectorAll('[data-bulk-user]').forEach(input => input.addEventListener('change', () => {
      input.checked ? state.selected.add(input.dataset.bulkUser) : state.selected.delete(input.dataset.bulkUser); const id = input.dataset.bulkUser; drawList(); host.querySelector(`[data-bulk-user="${CSS.escape(id)}"]`)?.focus();
    }));
  };
  const draw = () => {
    host.innerHTML = `<div class="card-head"><div><h3>${t('Penugasan SkillHub massal','Bulk SkillHub assignment')}</h3><p>${t('Pilih siswa dan satu SkillHub. Maksimal 500 siswa per penugasan.','Select learners and one SkillHub. Up to 500 learners per assignment.')}</p></div><button type="button" class="mini-action" data-bulk-close aria-label="${t('Tutup','Close')}" ${state.busy?'disabled':''}>×</button></div>
      <div class="bulk-filters"><label>${t('Cari siswa','Find learners')}<input data-bulk-search value="${escapeHtml(state.search)}" placeholder="${t('Nama atau email','Name or email')}" ${state.busy?'disabled':''}></label><label>${t('Sekolah','School')}<select data-bulk-school ${state.busy?'disabled':''}><option value="">${t('Semua sekolah','All schools')}</option>${dashboardState.sekolah.map(s=>`<option value="${escapeHtml(s.id)}" ${state.school===s.id?'selected':''}>${escapeHtml(s.nama)}</option>`).join('')}</select></label><label>SkillHub<select data-bulk-hub ${state.busy?'disabled':''}><option value="">${t('Pilih SkillHub','Select a SkillHub')}</option>${dashboardState.skillhubs.map(s=>`<option value="${escapeHtml(s.id)}" ${state.hub===s.id?'selected':''}>${escapeHtml(s.nama)}${s.status==='draft'?' (draft)':''}</option>`).join('')}</select></label></div>
      <div class="bulk-selection-actions"><button type="button" class="button button-ghost" data-bulk-all ${state.busy?'disabled':''}></button><button type="button" class="button button-ghost" data-bulk-clear ${state.busy?'disabled':''}>${t('Hapus pilihan','Clear selection')}</button></div>
      <div class="bulk-learner-list" data-bulk-list></div>
      <p data-bulk-count role="status"></p><p class="muted-copy">${t('Pilihan tetap tersimpan saat filter berubah. Penugasan yang sudah ada dilewati; masa akses dan progres siswa tetap dipertahankan.','Selections remain when filters change. Existing enrolments are skipped; access periods and learning progress are preserved.')}</p>
      <p class="bulk-error" data-bulk-error role="alert" ${state.error?'':'hidden'}>${escapeHtml(state.error)}</p><p class="bulk-success" role="status" ${state.message?'':'hidden'}>${escapeHtml(state.message)}</p>
      <button type="button" class="button button-primary" data-bulk-submit></button>`;
    drawList();
    host.querySelector('[data-bulk-search]').addEventListener('input', event => { state.search = event.target.value; drawList(); });
    host.querySelector('[data-bulk-school]').addEventListener('change', event => { state.school = event.target.value; drawList(); });
    host.querySelector('[data-bulk-hub]').addEventListener('change', event => { state.hub = event.target.value; drawList(); });
    host.querySelector('[data-bulk-all]').addEventListener('click', () => { const ids = new Set([...state.selected,...matches().map(u=>u.id)]); if(ids.size>500){const el=host.querySelector('[data-bulk-error]');el.hidden=false;el.textContent=t('Maksimal 500 siswa. Persempit filter pencarian.','Maximum 500 learners. Narrow your search filters.');return;}state.selected=ids;drawList(); });
    host.querySelector('[data-bulk-clear]').addEventListener('click', () => { state.selected.clear();drawList(); });
    host.querySelector('[data-bulk-close]').addEventListener('click', () => { activeAdminStudentTool='';rerenderAdminDashboardFromState(); });
    host.querySelector('[data-bulk-submit]').addEventListener('click', async () => {
      if(state.busy || !state.hub || !state.selected.size || state.selected.size>500)return;
      state.busy=true;state.error='';state.message='';draw();
      try {
        const result=await apiRequest('/api/enrollments/assign-bulk',{method:'POST',...jsonOptions({user_ids:[...state.selected],skillhub_id:state.hub})});
        state.message=`${result.skillhub.nama}: ${result.assigned} ${t('siswa berhasil ditugaskan','learners assigned')}; ${result.skipped} ${t('sudah terdaftar dan dilewati','already enrolled and skipped')}.`;
        state.selected.clear();
        try{await loadDashboardState();}catch{state.message+=' '+t('Muat ulang daftar untuk melihat perubahan.','Refresh the list to see the changes.');}
      }catch(error){state.error=error.message;}
      finally{state.busy=false;if(document.querySelector("[data-bulk-assignment]"))rerenderAdminDashboardFromState();}
    });
  };draw();
}
