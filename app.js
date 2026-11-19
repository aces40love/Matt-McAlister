(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const body = document.body;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let motionPaused = false;
  try { motionPaused = localStorage.getItem('drmac-motion') === 'paused'; } catch (_) { /* The control also works without storage. */ }
  const motionOff = () => reducedMotion.matches || motionPaused;
  const video = $('#commercial-video');
  const stage = $('.film-stage');
  const hero = $('.film-hero');
  const playButton = $('#film-play');
  const playLabel = $('#film-play-label');
  const playIcon = $('#film-play-icon');
  const startButton = $('#film-start');
  const soundButton = $('#film-sound');
  const seek = $('#film-seek');
  const captionsButton = $('#film-captions');
  const skipOpening = $('#skip-opening');
  const motionButton = $('#motion-toggle');
  let userPaused = false;
  let manualPlayback = false;
  let filmVisible = true;
  let filmEnded = false;
  let openingTimer;
  let playPending = false;
  const saveData = Boolean(navigator.connection && navigator.connection.saveData);

  function updatePlaybackControls() {
    const playing = !video.paused && !video.ended;
    playIcon.setAttribute('href', playing ? '#pause-icon' : '#play-icon');
    playLabel.textContent = playing ? 'Pause' : filmEnded ? 'Replay' : 'Play';
    playButton.setAttribute('aria-label', playing ? 'Pause film' : filmEnded ? 'Replay film' : 'Play film');
    startButton.hidden = playing || stage.classList.contains('is-opening');
    soundButton.setAttribute('aria-pressed', String(!video.muted));
    soundButton.setAttribute('aria-label', video.muted ? 'Turn film sound on' : 'Mute film sound');
    $('#film-sound-label').textContent = video.muted ? 'Sound on' : 'Mute';
  }

  function canPlay() {
    return filmVisible && !document.hidden && !document.querySelector('dialog[open]') && !userPaused && !filmEnded && !stage.classList.contains('is-opening') && (manualPlayback || (!motionOff() && !saveData));
  }

  function syncFilm() {
    if (!canPlay()) {
      video.pause();
      updatePlaybackControls();
      return;
    }
    if (!video.paused || playPending) return;
    playPending = true;
    const attempt = video.play();
    if (attempt) attempt.then(() => {
      playPending = false;
      if (!canPlay()) video.pause();
      updatePlaybackControls();
    }).catch(() => {
      playPending = false;
      updatePlaybackControls();
    });
    else playPending = false;
  }

  function finishOpening() {
    clearTimeout(openingTimer);
    const hadFocus = document.activeElement === skipOpening;
    stage.classList.remove('is-opening');
    skipOpening.hidden = true;
    if (hadFocus) playButton.focus({ preventScroll: true });
    syncFilm();
  }

  function playFromUser(restart = false) {
    finishOpening();
    if (restart || filmEnded) video.currentTime = 0;
    filmEnded = false;
    userPaused = false;
    manualPlayback = true;
    syncFilm();
  }

  playButton.addEventListener('click', () => {
    if (video.paused || video.ended || filmEnded) playFromUser();
    else { userPaused = true; video.pause(); }
  });
  startButton.addEventListener('click', () => playFromUser());
  $('#film-replay').addEventListener('click', () => playFromUser(true));
  skipOpening.addEventListener('click', finishOpening);
  soundButton.addEventListener('click', () => {
    video.muted = !video.muted;
    updatePlaybackControls();
    if (!video.muted && video.paused) playFromUser();
  });
  ['play', 'playing', 'pause', 'volumechange'].forEach(event => video.addEventListener(event, updatePlaybackControls));
  video.addEventListener('ended', () => {
    filmEnded = true;
    userPaused = true;
    video.currentTime = Math.max(0, video.duration - 0.65);
    updatePlaybackControls();
    updateFilmTime();
  });
  const formatTime = value => `00:${String(Math.floor(Number.isFinite(value) ? value : 0)).padStart(2, '0')}`;
  function updateFilmTime() {
    const duration = Number.isFinite(video.duration) ? video.duration : 30;
    const current = filmEnded ? duration : video.currentTime;
    seek.max = String(duration);
    seek.value = String(current);
    seek.style.setProperty('--film-progress', `${Math.min(100, current / duration * 100)}%`);
    seek.setAttribute('aria-valuetext', `${Math.floor(current)} of ${Math.round(duration)} seconds`);
    $('#film-time').textContent = `${formatTime(current)} / ${formatTime(duration)}`;
  }
  video.addEventListener('timeupdate', updateFilmTime);
  video.addEventListener('loadedmetadata', updateFilmTime);
  seek.addEventListener('input', () => {
    if (!Number.isFinite(video.duration)) return;
    filmEnded = false;
    video.currentTime = Math.min(video.duration, Number(seek.value));
    updateFilmTime();
    updatePlaybackControls();
  });
  captionsButton.addEventListener('click', () => {
    const track = video.textTracks[0];
    if (!track) return;
    const enabled = track.mode !== 'showing';
    track.mode = enabled ? 'showing' : 'disabled';
    captionsButton.setAttribute('aria-pressed', String(enabled));
    captionsButton.setAttribute('aria-label', enabled ? 'Hide film captions' : 'Show film captions');
  });
  const fullscreen = $('#film-fullscreen');
  if (!hero.requestFullscreen && !video.webkitEnterFullscreen) {
    fullscreen.hidden = true;
  } else {
    fullscreen.addEventListener('click', () => {
      const attempt = document.fullscreenElement ? document.exitFullscreen() : hero.requestFullscreen ? hero.requestFullscreen() : video.webkitEnterFullscreen();
      if (attempt && attempt.catch) attempt.catch(() => { fullscreen.setAttribute('aria-label', 'Fullscreen unavailable in this view'); });
    });
  }
  const mediaError = () => {
    $('#media-error').hidden = false;
    startButton.hidden = true;
    playButton.disabled = true;
    $('#film-replay').disabled = true;
  };
  video.addEventListener('error', mediaError);
  $('source', video).addEventListener('error', mediaError);

  function applyMotion() {
    body.classList.toggle('reduce-motion', motionOff());
    motionButton.setAttribute('aria-pressed', String(motionOff()));
    motionButton.disabled = reducedMotion.matches;
    $('#motion-label').textContent = reducedMotion.matches ? 'Reduced motion' : motionPaused ? 'Resume motion' : 'Pause motion';
    motionButton.firstElementChild.textContent = motionOff() ? '▷' : 'Ⅱ';
    if (motionOff()) { manualPlayback = false; finishOpening(); }
    syncFilm();
  }
  motionButton.addEventListener('click', () => {
    motionPaused = !motionPaused;
    try { localStorage.setItem('drmac-motion', motionPaused ? 'paused' : 'full'); } catch (_) { /* Motion still follows this selection. */ }
    applyMotion();
  });
  reducedMotion.addEventListener('change', applyMotion);
  document.addEventListener('visibilitychange', syncFilm);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { filmVisible = entry.isIntersecting; syncFilm(); }, { threshold: 0.1 }).observe(stage);
  }

  const servicePhotos = [
    ['project-living-room.webp', 'Living room with built-in shelves from the Dr. Mac project album', 'INTERIORS & REPAIRS'],
    ['pergola.webp', 'Timber pergola over an outdoor patio', 'DECKS, FENCES & OUTDOOR SPACES'],
    ['project-dining-room.webp', 'Dining room with pale painted walls, white trim, and wood flooring', 'PAINTING & FINISHES'],
    ['project-hallway.webp', 'Entry room with an arched window and detailed white trim', 'FIXTURES & FINISHING TOUCHES'],
    ['project-bedroom.webp', 'Bedroom with pale walls and carpeting from the project album', 'FLOORING & CARPET CARE'],
    ['project-fence.webp', 'Outdoor concrete area and wood privacy fence beside a house', 'OUTDOOR CARE & CLEANUP']
  ];
  let photoRequest = 0;
  function updateServicePhoto(index) {
    const request = ++photoRequest;
    const [filename, alt, label] = servicePhotos[index];
    const next = new Image();
    next.src = `images/${filename}`;
    next.decode().then(() => {
      if (request !== photoRequest) return;
      const image = $('#service-image');
      image.src = next.src;
      image.alt = alt;
      $('#service-photo-label').textContent = label;
      $('.services-visual').dataset.service = String(index);
    }).catch(() => { /* Keep the existing photograph if a request fails. */ });
  }
  $$('.service-toggle').forEach(button => button.addEventListener('click', () => {
    const selected = button.closest('.service');
    const open = button.getAttribute('aria-expanded') !== 'true';
    $$('.service').forEach(service => {
      const active = service === selected && open;
      service.classList.toggle('is-open', active);
      $('.service-toggle', service).setAttribute('aria-expanded', String(active));
      $('.service-panel', service).hidden = !active;
    });
    if (open) updateServicePhoto(Number(selected.dataset.service));
  }));
  $$('[data-project]').forEach(link => link.addEventListener('click', () => {
    const field = $('#contact-service');
    field.value = link.dataset.project;
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }));

  const album = window.DrMacGallery;
  const categories = {all: 'All work', interiors: 'Interiors & finishes', outdoor: 'Decks & outdoors', repairs: 'Repairs & details', flooring: 'Floors & carpet'};
  const allPhotos = () => album.map((_, index) => index);
  const gallery = $('#gallery-dialog');
  const grid = $('#project-grid');
  const morePhotos = $('#gallery-more');
  const galleryStatus = $('#gallery-status');
  const batchSize = 12;
  let selectedFilter = 'all';
  let visiblePhotos = 0;
  let filteredPhotos = allPhotos();
  let activePhotos = allPhotos();
  let activeFilter = 'all';
  let albumIndex = 0;
  let galleryRequest = 0;

  function showPhoto(index) {
    albumIndex = (index + activePhotos.length) % activePhotos.length;
    const actualIndex = activePhotos[albumIndex];
    const photo = album[actualIndex];
    const image = $('#gallery-image');
    const request = ++galleryRequest;
    image.src = photo.src;
    image.alt = photo.alt;
    $('#gallery-title').textContent = `DR. MAC PROJECT FILES / ${categories[photo.category].toUpperCase()}`;
    $('#gallery-caption').textContent = photo.caption + (photo.inProgress ? ' Work in progress.' : '');
    gallery.dataset.position = String(actualIndex);
    gallery.dataset.filter = activeFilter;
    image.decode().catch(() => {
      if (request === galleryRequest && gallery.open) $('#gallery-caption').textContent = 'This photograph could not load. Try the next photo.';
    });
  }
  function openPhoto(actualIndex, selection = allPhotos()) {
    activePhotos = selection;
    activeFilter = selection === filteredPhotos ? selectedFilter : 'all';
    showPhoto(Math.max(0, activePhotos.indexOf(actualIndex)));
    gallery.showModal();
    syncFilm();
  }
  function renderPhotos(reset = false) {
    if (reset) { grid.replaceChildren(); visiblePhotos = 0; }
    const next = filteredPhotos.slice(visiblePhotos, visiblePhotos + batchSize);
    const fragment = document.createDocumentFragment();
    next.forEach(index => {
      const photo = album[index];
      const figure = document.createElement('figure');
      figure.className = 'project-print';
      figure.dataset.category = photo.category;
      const link = document.createElement('a');
      link.className = 'project-print-link';
      link.href = photo.src;
      link.dataset.galleryPhoto = String(index);
      link.setAttribute('aria-label', `Enlarge: ${photo.alt}`);
      link.setAttribute('aria-haspopup', 'dialog');
      link.setAttribute('aria-controls', 'gallery-dialog');
      const image = document.createElement('img');
      image.src = photo.thumbnail;
      image.alt = photo.alt;
      image.width = photo.width;
      image.height = photo.height;
      image.loading = 'lazy';
      image.decoding = 'async';
      const corner = document.createElement('span');
      corner.className = 'print-enlarge';
      corner.setAttribute('aria-hidden', 'true');
      corner.textContent = '↗';
      link.append(image, corner);
      const caption = document.createElement('figcaption');
      const label = document.createElement('span');
      label.textContent = categories[photo.category] + (photo.inProgress ? ' / In progress' : '');
      const description = document.createElement('span');
      description.textContent = photo.caption;
      caption.append(label, description);
      figure.append(link, caption);
      fragment.append(figure);
    });
    grid.append(fragment);
    visiblePhotos += next.length;
    morePhotos.hidden = visiblePhotos >= filteredPhotos.length;
    galleryStatus.textContent = `${categories[selectedFilter]}. ${morePhotos.hidden ? 'All photographs in this selection are shown.' : 'More photographs below.'}`;
  }
  $$('.gallery-filters button').forEach(button => button.addEventListener('click', () => {
    selectedFilter = button.dataset.filter;
    filteredPhotos = allPhotos().filter(index => selectedFilter === 'all' || album[index].category === selectedFilter);
    $$('.gallery-filters button').forEach(filter => filter.setAttribute('aria-pressed', String(filter === button)));
    renderPhotos(true);
  }));
  morePhotos.addEventListener('click', () => {
    const firstNew = visiblePhotos;
    renderPhotos();
    const link = grid.children[firstNew]?.querySelector('a');
    if (link) link.focus({preventScroll: true});
  });
  grid.addEventListener('click', event => {
    const link = event.target.closest('[data-gallery-photo]');
    if (!link) return;
    event.preventDefault();
    openPhoto(Number(link.dataset.galleryPhoto), filteredPhotos);
  });
  renderPhotos(true);
  $$('[data-photo]').forEach(link => link.addEventListener('click', event => { event.preventDefault(); openPhoto(Number(link.dataset.photo)); }));
  $('#open-album').addEventListener('click', () => openPhoto(filteredPhotos[0], filteredPhotos));
  $('#gallery-prev').addEventListener('click', () => showPhoto(albumIndex - 1));
  $('#gallery-next').addEventListener('click', () => showPhoto(albumIndex + 1));
  gallery.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); showPhoto(albumIndex - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); showPhoto(albumIndex + 1); }
  });
  let touchStart = null;
  $('#gallery-image').addEventListener('touchstart', event => {
    touchStart = event.touches.length === 1 ? {x: event.touches[0].clientX, y: event.touches[0].clientY} : null;
  }, {passive: true});
  $('#gallery-image').addEventListener('touchend', event => {
    if (!touchStart || event.changedTouches.length !== 1) return;
    const dx = event.changedTouches[0].clientX - touchStart.x;
    const dy = event.changedTouches[0].clientY - touchStart.y;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) showPhoto(albumIndex + (dx < 0 ? 1 : -1));
    touchStart = null;
  }, {passive: true});
  $('#gallery-image').addEventListener('touchcancel', () => { touchStart = null; }, {passive: true});
  const menu = $('#mobile-menu');
  const menuToggle = $('.menu-toggle');
  menuToggle.addEventListener('click', () => { menu.showModal(); menuToggle.setAttribute('aria-expanded', 'true'); syncFilm(); });
  menu.addEventListener('close', () => menuToggle.setAttribute('aria-expanded', 'false'));
  $$('a[href^="#"]', menu).forEach(link => link.addEventListener('click', () => menu.close()));
  $$('[data-close]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.close).close()));
  $$('dialog').forEach(dialog => {
    dialog.addEventListener('close', syncFilm);
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    });
  });
  window.addEventListener('resize', () => { if (window.innerWidth > 960 && menu.open) menu.close(); });

  const form = $('#project-form');
  const ready = $('#email-ready');
  const draftLink = $('#email-draft-link');
  const emailStatus = $('#email-status');
  const copyProject = $('#copy-project');
  let draftDetails = '';
  let draftSnapshot = '';
  let draftVersion = 0;
  const requiredTextFields = [
    [$('#contact-name'), 'Please enter your name.'],
    [$('#contact-town'), 'Please enter your town.'],
    [$('#contact-message'), 'Please describe your project.']
  ];
  function invalidateDraft() {
    draftDetails = '';
    draftSnapshot = '';
    draftVersion += 1;
    ready.hidden = true;
    draftLink.removeAttribute('href');
    emailStatus.textContent = 'Your project email is ready.';
    copyProject.textContent = 'Copy project details instead';
  }
  function formChanged(event) {
    if (typeof event.target.setCustomValidity === 'function') event.target.setCustomValidity('');
    invalidateDraft();
  }
  function hasCurrentDraft() {
    if (!draftDetails || ready.hidden || draftSnapshot !== JSON.stringify([...new FormData(form)])) {
      invalidateDraft();
      return false;
    }
    return true;
  }
  form.addEventListener('input', formChanged);
  form.addEventListener('change', formChanged);
  form.addEventListener('invalid', invalidateDraft, true);
  form.addEventListener('reset', () => { requiredTextFields.forEach(([field]) => field.setCustomValidity('')); invalidateDraft(); });
  draftLink.addEventListener('click', event => { if (!hasCurrentDraft()) event.preventDefault(); });
  form.addEventListener('submit', event => {
    event.preventDefault();
    invalidateDraft();
    requiredTextFields.forEach(([field, emptyMessage]) => {
      const value = field.value.trim();
      field.setCustomValidity(!value ? emptyMessage : value.length < field.minLength ? `Please enter at least ${field.minLength} characters, not counting surrounding spaces.` : '');
    });
    if (!form.reportValidity()) return;
    const fields = new FormData(form);
    const clean = name => String(fields.get(name) || '').trim();
    const service = clean('service');
    draftDetails = [
      'Hello Dr. Mac,', '', "I'd like to talk about a home project.", '',
      `Name: ${clean('name')}`, `Email: ${clean('email')}`,
      ...(clean('phone') ? [`Phone: ${clean('phone')}`] : []),
      `Location: ${clean('town')}`, `Service: ${service}`, '',
      'Project details:', clean('message'), '', 'Please let me know the next step. Thank you.'
    ].join('\n');
    draftSnapshot = JSON.stringify([...fields]);
    draftLink.href = `mailto:dr.mac@att.net?subject=${encodeURIComponent(`Home project: ${service}`)}&body=${encodeURIComponent(draftDetails)}`;
    ready.hidden = false;
    ready.focus({ preventScroll: true });
    ready.scrollIntoView({ behavior: motionOff() ? 'instant' : 'smooth', block: 'nearest' });
  });
  copyProject.addEventListener('click', async () => {
    if (!hasCurrentDraft()) return;
    const version = draftVersion;
    try {
      await navigator.clipboard.writeText(draftDetails);
      if (version !== draftVersion || !hasCurrentDraft()) return;
      copyProject.textContent = 'Project details copied';
      emailStatus.textContent = 'Project details copied. Paste them into an email to dr.mac@att.net.';
    } catch (_) {
      if (version !== draftVersion || !hasCurrentDraft()) return;
      emailStatus.textContent = 'Your browser could not copy the details. Use Open my email draft or call 901.754.2215.';
    }
  });

  $('#copyright-year').textContent = String(new Date().getFullYear());
  if ('IntersectionObserver' in window) {
    const reveals = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -15px 0px' });
    $$('.reveal').forEach(element => reveals.observe(element));
    body.classList.add('js-motion');
    const navigation = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        $$('.desktop-nav a').forEach(link => {
          if (link.hash === `#${entry.target.id}`) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-15% 0px -65% 0px', threshold: 0 });
    $$('#film, #welcome, #work, #services, #story, #contact').forEach(section => navigation.observe(section));
  }
  let queued = false;
  function updateScroll() {
    const distance = document.documentElement.scrollHeight - window.innerHeight;
    const progress = distance > 0 ? Math.max(0, Math.min(1, window.scrollY / distance)) : 0;
    $('.scroll-progress').style.transform = `scaleX(${progress})`;
    queued = false;
  }
  window.addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(updateScroll); } }, { passive: true });
  body.classList.add('enhanced');
  video.controls = false;
  let openingSeen = false;
  try { openingSeen = sessionStorage.getItem('drmac-opening') === 'seen'; sessionStorage.setItem('drmac-opening', 'seen'); } catch (_) { /* The opening remains skippable when storage is disabled. */ }
  if (!openingSeen && !motionOff() && !saveData) {
    stage.classList.add('is-opening');
    skipOpening.hidden = false;
    openingTimer = setTimeout(finishOpening, 1800);
  }
  applyMotion();
  updateFilmTime();
  updatePlaybackControls();
  updateScroll();
})();
