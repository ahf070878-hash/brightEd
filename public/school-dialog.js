function openSchoolActionDialog(action, schoolId) {
  if(currentUser?.role!=='admin'||!['view','edit','add','archive'].includes(action))return;
  const school=schoolId?getSchoolById(schoolId):null;
  if(action!=='add'&&!school){setDashboardMessage(tr('Sekolah tidak ditemukan di data saat ini.'),'error');return;}
  const returnFocus=document.activeElement,dialog=document.createElement('dialog');
  dialog.className='student-detail-dialog school-action-dialog';
  dialog.setAttribute('data-school-action-dialog',action);
  dialog.setAttribute('aria-label',tr({view:'Detail sekolah',edit:'Edit sekolah',add:'Tambah sekolah',archive:'Archive sekolah'}[action]));
  dialog.innerHTML=action==='archive'?uiHTML`<section class="school-archive-content"><div class="card-head"><div><p class="eyebrow">Konfirmasi aksi</p><h3>Archive sekolah</h3></div><button type="button" class="button button-ghost" data-close-school-tool>Tutup</button></div><p><strong>${escapeHtml(school.nama)}</strong> (${escapeHtml(school.kode_sekolah)})</p><p>${materialCopy('Sekolah akan diarsipkan. Data sekolah dan siswa yang terkait tetap tersimpan.','The school will be archived. The school and its associated learner records will be retained.')}</p><form data-school-archive-popup><div class="form-actions"><button type="button" class="button button-ghost" data-close-school-tool>Batal</button><button type="submit" class="button button-secondary">Archive</button></div></form></section>`:renderSchoolToolPanel(action,schoolId);
  const feedback=document.createElement('div');feedback.className='school-dialog-feedback';feedback.innerHTML='<p data-school-dialog-error role="alert" hidden></p><p data-school-dialog-progress role="status" hidden></p>';dialog.append(feedback);
  let busy=false;
  const close=()=>{if(busy)return;dialog.close();dialog.remove();if(returnFocus?.isConnected)returnFocus.focus();};
  dialog.querySelectorAll('[data-close-school-tool]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();close();}));
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('click',event=>{const r=dialog.getBoundingClientRect();if(event.target===dialog&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))close();});
  dialog.querySelector('form')?.addEventListener('submit',async event=>{
    event.preventDefault();event.stopPropagation();if(busy)return;
    const form=event.currentTarget,data=new FormData(form),error=dialog.querySelector('[data-school-dialog-error]'),progress=dialog.querySelector('[data-school-dialog-progress]');
    const payload=action==='archive'?null:{nama:String(data.get('nama')||'').trim(),kode_sekolah:String(data.get('kode_sekolah')||'').trim(),alamat:String(data.get('alamat')||'').trim()};
    if(payload&&(!payload.nama||!payload.kode_sekolah)){error.textContent=materialCopy('Nama dan kode sekolah wajib diisi.','School name and code are required.');error.hidden=false;return;}
    busy=true;dialog.setAttribute('aria-busy','true');error.hidden=true;progress.hidden=false;progress.textContent=materialCopy('Menyimpan…','Saving…');dialog.querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=true);
    try{
      await apiRequest(action==='add'?'/api/sekolah':`/api/sekolah/${encodeURIComponent(schoolId)}`,{method:action==='add'?'POST':action==='edit'?'PUT':'DELETE',...(payload?jsonOptions(payload):{})});
      let refreshed=true;try{await loadDashboardState();}catch{refreshed=false;}
      busy=false;close();
      if(refreshed){rerenderAdminDashboardFromState();const selector=action==='archive'?`[data-archive-school="${CSS.escape(schoolId)}"]`:action==='add'?'[data-open-school-tool="add"]':`[data-open-school-tool="${action}"][data-school-id="${CSS.escape(schoolId)}"]`;adminDashboard.querySelector(selector)?.focus();}
      setDashboardMessage(tr({add:'Sekolah berhasil dibuat.',edit:'Sekolah berhasil diperbarui.',archive:'Sekolah berhasil diarsipkan.'}[action])+(refreshed?'':' '+materialCopy('Muat ulang daftar untuk melihat perubahan.','Refresh the list to see the changes.')),'success');
    }catch(failure){error.textContent=getErrorMessage(failure);error.hidden=false;}
    finally{busy=false;dialog.removeAttribute('aria-busy');progress.hidden=true;dialog.querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=false);}
  });
  adminDashboard.append(dialog);dialog.showModal();dialog.querySelector(action==='archive'?'[data-close-school-tool]':action==='view'?'[data-close-school-tool]':'input')?.focus();
}
