(function () {
  const PROTECTED_SELECTORS = [
    '[data-scorm-player]',
    '.student-learning-list',
    '.student-focus-card',
    '.student-assessment-list',
    '.scorm-player-card iframe',
    '.lesson-card',
    'video',
    'iframe'
  ];

  const state = {
    installed: false,
    userLabel: 'BrightEd LMS',
    noticeTimer: null,
  };

  function getUserLabel() {
    const user = window.BrightEdCurrentUser || null;
    if (user) {
      const name = user.nama || user.name || '';
      const email = user.email || '';
      return [name, email].filter(Boolean).join(' · ') || state.userLabel;
    }

    const profileMenu = document.querySelector('.profile-menu');
    const menuName = profileMenu?.querySelector('strong')?.textContent?.trim() || '';
    const menuEmail = profileMenu?.querySelector('span')?.textContent?.trim() || '';
    return [menuName, menuEmail].filter(Boolean).join(' · ') || state.userLabel;
  }

  function markProtectedAreas() {
    const label = getUserLabel();
    document.querySelectorAll(PROTECTED_SELECTORS.join(',')).forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      node.setAttribute('data-content-protected', '');
      node.setAttribute('data-watermark', label);
    });
  }

  function isInsideProtectedArea(target) {
    return Boolean(target?.closest?.('[data-content-protected], [data-scorm-player], .student-learning-list, .student-focus-card, .lesson-card, video, iframe'));
  }

  function blockEvent(event) {
    if (!isInsideProtectedArea(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    showProtectionNotice();
  }

  function blockShortcut(event) {
    const key = String(event.key || '').toLowerCase();
    const blocked =
      key === 'printscreen' ||
      ((event.ctrlKey || event.metaKey) && ['p', 's', 'u', 'c', 'x'].includes(key)) ||
      ((event.ctrlKey || event.metaKey) && event.shiftKey && ['i', 'j', 'c'].includes(key));

    if (!blocked) return;
    event.preventDefault();
    event.stopPropagation();
    showProtectionNotice();
  }

  function showProtectionNotice() {
    let notice = document.querySelector('[data-content-protection-notice]');
    if (!notice) {
      notice = document.createElement('div');
      notice.setAttribute('data-content-protection-notice', '');
      notice.setAttribute('role', 'status');
      notice.textContent = 'Materi belajar dilindungi. Menyalin, mencetak, screenshot, dan screen recording tidak diizinkan.';
      document.body.appendChild(notice);
    }
    notice.classList.add('is-visible');
    window.clearTimeout(state.noticeTimer);
    state.noticeTimer = window.setTimeout(() => notice.classList.remove('is-visible'), 2600);
  }

  function setAwayMode(active) {
    document.documentElement.toggleAttribute('data-content-away', Boolean(active));
  }

  function protectMedia() {
    document.querySelectorAll('video').forEach((video) => {
      video.setAttribute('controlsList', 'nodownload noplaybackrate noremoteplayback');
      video.setAttribute('disablePictureInPicture', '');
      video.setAttribute('oncontextmenu', 'return false');
    });

    document.querySelectorAll('iframe').forEach((frame) => {
      frame.setAttribute('data-content-protected', '');
      frame.setAttribute('data-watermark', getUserLabel());
    });
  }

  function patchScreenCaptureApi() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia || navigator.mediaDevices.__brightedProtected) return;
    Object.defineProperty(navigator.mediaDevices, '__brightedProtected', { value: true });
    navigator.mediaDevices.getDisplayMedia = function () {
      showProtectionNotice();
      return Promise.reject(new DOMException('Screen recording is disabled for BrightEd learning content.', 'NotAllowedError'));
    };
  }

  function install() {
    if (state.installed) return;
    state.installed = true;

    document.addEventListener('contextmenu', blockEvent, true);
    document.addEventListener('copy', blockEvent, true);
    document.addEventListener('cut', blockEvent, true);
    document.addEventListener('dragstart', blockEvent, true);
    document.addEventListener('selectstart', (event) => {
      if (isInsideProtectedArea(event.target)) event.preventDefault();
    }, true);
    document.addEventListener('keydown', blockShortcut, true);
    document.addEventListener('visibilitychange', () => setAwayMode(document.hidden));
    window.addEventListener('blur', () => setAwayMode(true));
    window.addEventListener('focus', () => setAwayMode(false));
    window.addEventListener('beforeprint', (event) => {
      event.preventDefault();
      showProtectionNotice();
    });

    patchScreenCaptureApi();
    markProtectedAreas();
    protectMedia();

    const observer = new MutationObserver(() => {
      markProtectedAreas();
      protectMedia();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  window.BrightEdContentProtection = { install, refresh: markProtectedAreas, notice: showProtectionNotice };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
