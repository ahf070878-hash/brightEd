const materialDrafts = new Map();
const materialTypes = { pdf: ['PDF', '.pdf', 'PDF'], video: ['Video', '.mp4,.webm', 'MP4 / WebM atau YouTube'], scorm: ['SCORM', '.zip', 'ZIP'], article: ['Artikel', '.txt', 'TXT'] };
const materialCopy = (id, en) => uiLanguage === 'en' ? en : id;
function renderMaterialUpload(hub) {
  if (!materialDrafts.has(hub.id)) materialDrafts.set(hub.id, { step: 1, title: '', type: 'pdf', file: null, videoSource: 'upload', youtubeUrl: '', busy: false, error: '', done: false });
  return `<section class="material-upload" data-material-upload="${escapeHtml(hub.id)}"></section>`;
}
function isValidYouTubeUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') return Boolean(url.pathname.split('/').filter(Boolean)[0]);
    if (['youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) return url.pathname === '/watch' ? Boolean(url.searchParams.get('v')) : url.pathname.startsWith('/embed/') || url.pathname.startsWith('/shorts/');
  } catch {}
  return false;
}
function bindMaterialUpload() {
  document.querySelectorAll('[data-material-upload]').forEach(host => {
    const id = host.dataset.materialUpload;
    const state = materialDrafts.get(id);
    const t = materialCopy;
    const draw = (focus = false) => {
      if (!host.isConnected) return;
      const isYoutube = state.type === 'video' && state.videoSource === 'youtube';
      host.innerHTML = `<div class="material-heading"><div><p class="eyebrow">${t('TAMBAH MATERI', 'ADD MATERIAL')}</p><h3>${t('Tiga langkah. Materi siap.', 'Three steps. Ready to learn.')}</h3></div><span class="material-limit">${isYoutube ? 'YouTube URL' : t('Maks. 250 MB', 'Up to 250 MB')}</span></div>
        <ol class="material-steps">${[t('Buat judul', 'Enter title'), t('Jenis materi', 'Material type'), isYoutube ? 'YouTube' : t('Upload', 'Upload')].map((label, i) => `<li class="${state.step === i + 1 ? 'current' : state.step > i + 1 || state.done ? 'complete' : ''}" ${state.step === i + 1 ? 'aria-current="step"' : ''}><span>${i + 1}</span>${label}</li>`).join('')}</ol>
        ${state.done ? `<div class="material-success" role="status"><h4>${t('Materi berhasil ditambahkan', 'Material added successfully')}</h4><p>${escapeHtml(state.title)}</p><p>${t('Materi mengikuti status publikasi SkillHub.', 'Material follows the SkillHub publication status.')}</p><button class="button button-primary" data-material-again>${t('Tambah materi lagi', 'Add another material')}</button></div>` : `<form data-material-form aria-busy="${state.busy}">
        ${state.step === 1 ? `<label for="material-title">${t('Judul materi', 'Material title')}</label><input id="material-title" name="title" maxlength="255" required placeholder="${t('Contoh: Pengantar Kepemimpinan', 'e.g. Introduction to Leadership')}" value="${escapeHtml(state.title)}" />` : ''}
        ${state.step === 2 ? `<fieldset class="material-types"><legend>${t('Pilih jenis materi', 'Select material type')}</legend>${Object.entries(materialTypes).map(([value, [label, accept, hint]]) => `<label><input type="radio" name="material-type" value="${value}" ${state.type === value ? 'checked' : ''} /><span><strong>${label === 'Artikel' ? t('Artikel', 'Article') : label}</strong><small>${hint}</small></span></label>`).join('')}</fieldset>` : ''}
        ${state.step === 3 ? `<div class="material-recap"><strong>${escapeHtml(state.title)}</strong><span>${materialTypes[state.type][2]}</span></div>${state.type === 'video' ? `<fieldset class="material-source-toggle"><legend>${t('Sumber video', 'Video source')}</legend><label><input type="radio" name="video-source" value="upload" ${state.videoSource === 'upload' ? 'checked' : ''} ${state.busy ? 'disabled' : ''} /> <span>Upload MP4/WebM</span></label><label><input type="radio" name="video-source" value="youtube" ${state.videoSource === 'youtube' ? 'checked' : ''} ${state.busy ? 'disabled' : ''} /> <span>Link YouTube</span></label></fieldset>` : ''}${isYoutube ? `<label class="material-drop" for="material-youtube-url"><strong>Link YouTube</strong><span>Contoh: https://www.youtube.com/watch?v=...</span><input id="material-youtube-url" type="url" inputmode="url" placeholder="https://www.youtube.com/watch?v=..." value="${escapeHtml(state.youtubeUrl)}" ${state.busy ? 'disabled' : ''} /></label>` : `<label class="material-drop" for="material-file"><strong>${t('Pilih file materi', 'Choose a material file')}</strong><span>${materialTypes[state.type][2]} · ${state.type === 'article' ? '5 MB · UTF-8' : '250 MB'}</span><input id="material-file" type="file" accept="${materialTypes[state.type][1]}" ${state.busy ? 'disabled' : ''} /><span data-material-filename>${escapeHtml(state.file?.name || t('Belum ada file dipilih', 'No file selected'))}</span></label>`}` : ''}
        <p class="material-error" role="alert" ${state.error ? '' : 'hidden'}>${escapeHtml(state.error)}</p>
        <p data-material-progress role="status" ${state.busy ? '' : 'hidden'}>${isYoutube ? t('Menyimpan link…', 'Saving link…') : t('Mengunggah materi…', 'Uploading material…')}</p>
        <div class="material-actions">${state.step > 1 ? `<button type="button" class="button button-ghost" data-material-back ${state.busy ? 'disabled' : ''}>${t('Kembali', 'Back')}</button>` : '<span></span>'}<button type="submit" class="button button-primary" ${state.busy ? 'disabled' : ''}>${state.busy ? (isYoutube ? t('Menyimpan…', 'Saving…') : t('Mengunggah…', 'Uploading…')) : state.step === 3 ? (isYoutube ? t('Simpan link & selesai', 'Save link & finish') : t('Upload & selesai', 'Upload & finish')) : t('Lanjut', 'Continue')}</button></div></form>`}`;
      if (focus) host.querySelector('input,button')?.focus();
      host.querySelector('[data-material-again]')?.addEventListener('click', () => {
        Object.assign(state, { step: 1, title: '', type: 'pdf', file: null, videoSource: 'upload', youtubeUrl: '', done: false, error: '' }); draw(true);
      });
      host.querySelector('[name="title"]')?.addEventListener('input', event => { state.title = event.target.value; });
      host.querySelectorAll('[name="material-type"]').forEach(input => input.addEventListener('change', () => { if (state.type !== input.value) state.file = null; state.type = input.value; }));
      host.querySelectorAll('[name="video-source"]').forEach(input => input.addEventListener('change', () => { state.videoSource = input.value; state.file = null; state.error = ''; draw(true); }));
      host.querySelector('#material-youtube-url')?.addEventListener('input', event => { state.youtubeUrl = event.target.value; });
      host.querySelector('[data-material-back]')?.addEventListener('click', () => { state.step--; state.error = ''; draw(true); });
      host.querySelector('#material-file')?.addEventListener('change', event => {
        state.file = event.target.files[0] || null;
        host.querySelector('[data-material-filename]').textContent = state.file?.name || t('Belum ada file dipilih', 'No file selected');
      });
      host.querySelector('form')?.addEventListener('submit', async event => {
        event.preventDefault();
        if (state.busy) return;
        state.error = '';
        if (state.step === 1) {
          state.title = state.title.trim();
          if (!state.title) { state.error = t('Masukkan judul materi.', 'Enter a material title.'); draw(true); return; }
        }
        if (state.step < 3) { state.step++; draw(true); return; }
        const useYoutube = state.type === 'video' && state.videoSource === 'youtube';
        const file = state.file;
        if (useYoutube) {
          state.youtubeUrl = state.youtubeUrl.trim();
          if (!isValidYouTubeUrl(state.youtubeUrl)) { state.error = t('Masukkan link YouTube yang valid.', 'Enter a valid YouTube link.'); draw(true); return; }
        } else {
          const allowed = materialTypes[state.type][1].split(',');
          if (!file || !allowed.some(ext => file.name.toLowerCase().endsWith(ext)) || !file.size || file.size > (state.type === 'article' ? 5 : 250) * 1024 * 1024) {
            state.error = t('Pilih file sesuai jenis dan batas ukuran materi.', 'Choose a file matching the material type and size limit.'); draw(); return;
          }
        }
        state.busy = true; draw();
        try {
          const form = new FormData(); form.append('judul', state.title); form.append('tipe_konten', state.type);
          if (useYoutube) { form.append('video_source', 'youtube'); form.append('youtube_url', state.youtubeUrl); } else { form.append('file', file); }
          await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `/api/skillhubs/${encodeURIComponent(id)}/materials`);
            xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
            xhr.upload.onprogress = event => { if (event.lengthComputable) {
              const percent = Math.round(event.loaded / event.total * 100);
              const node = host.querySelector('[data-material-progress]');
              if (node) node.textContent = percent === 100 ? t('Menyimpan materi…', 'Saving material…') : `${t('Mengunggah', 'Uploading')} ${percent}%`;
            }};
            xhr.onload = () => { let body; try { body = JSON.parse(xhr.responseText); } catch {} if (xhr.status >= 200 && xhr.status < 300) resolve(body); else reject(new Error(body?.message || t('Upload gagal. Silakan coba lagi.', 'Upload failed. Please try again.'))); };
            xhr.onerror = () => reject(new Error(t('Koneksi terputus. Periksa daftar materi sebelum mencoba kembali.', 'Connection lost. Check the material list before trying again.')));
            xhr.send(form);
          });
          state.done = true; state.file = null;
          try { await loadDashboardState(); } catch { /* Upload succeeded; retain confirmation even if refresh fails. */ }
        } catch (error) { state.error = error.message; }
        finally { state.busy = false; if (state.done) rerenderAdminDashboardFromState(); else draw(); }
      });
    };
    draw();
  });
}
