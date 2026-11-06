document.addEventListener('DOMContentLoaded', () => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const smallScreen = window.matchMedia('(max-width: 699px)');
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  // --- Sound ---
  // Tiny chiptune blips synthesised with Web Audio: no audio files to download.
  // Off by default; the choice is remembered.
  const Sound = (() => {
    const KEY = 'retroSound';
    const btn = document.getElementById('sound-toggle');
    let enabled = false;
    let ctx = null;
    try { enabled = localStorage.getItem(KEY) === 'on'; } catch { /* storage unavailable */ }

    function tone(freq, start, dur, { type = 'square', vol = 0.04, slideTo } = {}) {
      const t = ctx.currentTime + start;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    }

    const SOUNDS = {
      click: () => tone(1400, 0, 0.025, { vol: 0.02 }),
      open: () => { tone(523, 0, 0.06); tone(784, 0.05, 0.09); },
      close: () => { tone(784, 0, 0.06); tone(523, 0.05, 0.09); },
      startup: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.45, { type: 'triangle', vol: 0.06 })),
      shutdown: () => [1047, 784, 659, 523].forEach((f, i) => tone(f, i * 0.13, 0.5, { type: 'triangle', vol: 0.06 })),
      shoot: () => tone(900, 0, 0.06, { vol: 0.012, slideTo: 300 }),
      hit: () => tone(260, 0, 0.09, { type: 'sawtooth', vol: 0.03, slideTo: 70 }),
      gameover: () => tone(440, 0, 0.6, { type: 'sawtooth', vol: 0.04, slideTo: 55 })
    };

    function play(name) {
      // Browsers block audio until the visitor has interacted with the page
      if (!enabled || (navigator.userActivation && !navigator.userActivation.hasBeenActive)) return;
      if (!ctx) ctx = new AudioContext();
      if (ctx.state === 'suspended') ctx.resume();
      SOUNDS[name]();
    }

    function sync() {
      btn.setAttribute('aria-pressed', String(enabled));
      btn.title = 'Sound: ' + (enabled ? 'on' : 'off');
    }

    btn.addEventListener('click', () => {
      enabled = !enabled;
      try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch { /* storage unavailable */ }
      sync();
      play('startup');
    });
    sync();
    return { play };
  })();
  // Other scripts (the terminal game) play sounds by event
  document.addEventListener('desktop:sound', (e) => Sound.play(e.detail));

  // --- Window manager ---
  const desktop = document.getElementById('desktop');
  const taskbarList = document.querySelector('.taskbar__windows');
  const ALIASES = { featured: 'catmayhem' }; // old bento-grid links keep working
  const windows = new Map();
  const GAP = 16; // space kept between a newly opened window and the desktop edges / taskbar
  let zTop = 10;
  let activeId = null;

  function initWindow(el) {
    const titlebar = el.querySelector('.window__titlebar');
    const s = {
      id: el.id,
      el,
      title: el.querySelector('.window__title').textContent,
      icon: titlebar.querySelector('use').getAttribute('href'),
      open: false,
      minimized: false,
      placed: false,
      userSized: false, // resized by hand: may then grow right up to the desktop edges
      taskBtn: null
    };
    windows.set(s.id, s);
    el.setAttribute('role', 'dialog');
    el.tabIndex = -1;

    const controls = document.createElement('div');
    controls.className = 'window__controls';
    controls.innerHTML =
      '<button type="button" class="window__btn window__btn--min" aria-label="Minimize"></button>' +
      '<button type="button" class="window__btn window__btn--max" aria-label="Maximize"></button>' +
      '<button type="button" class="window__btn window__btn--close" aria-label="Close"></button>';
    titlebar.append(controls);
    controls.querySelector('.window__btn--min').addEventListener('click', () => minimizeWindow(s.id));
    controls.querySelector('.window__btn--max').addEventListener('click', () => toggleMaximize(s));
    controls.querySelector('.window__btn--close').addEventListener('click', () => closeWindow(s.id));

    titlebar.addEventListener('dblclick', (e) => {
      if (!e.target.closest('button')) toggleMaximize(s);
    });
    // Capture phase so a click anywhere in the window raises it first
    el.addEventListener('pointerdown', () => focusWindow(s.id), true);
    el.addEventListener('focusin', () => { if (activeId !== s.id) focusWindow(s.id); });
    makeDraggable(s, titlebar);
    makeResizable(s);
  }

  // Grab handles on all four sides and corners; dragging one moves only the edges it names
  function makeResizable(s) {
    for (const dir of ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw']) {
      const handle = document.createElement('div');
      handle.className = `window__resize window__resize--${dir}`;
      handle.setAttribute('aria-hidden', 'true');
      s.el.append(handle);

      handle.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || smallScreen.matches || s.el.classList.contains('window--maximized')) return;
        e.preventDefault();
        const css = getComputedStyle(s.el);
        const minW = parseFloat(css.minWidth) || 0, minH = parseFloat(css.minHeight) || 0;
        const startX = e.clientX, startY = e.clientY;
        const left = s.el.offsetLeft, top = s.el.offsetTop;
        const w = s.el.offsetWidth, h = s.el.offsetHeight;
        s.userSized = true;
        // Pin the current height before lifting the cap, or tall content would make the window grow
        // under the taskbar
        s.el.style.height = h + 'px';
        s.el.style.maxHeight = desktop.clientHeight + 'px';
        handle.setPointerCapture(e.pointerId);

        const move = (ev) => {
          const dx = ev.clientX - startX, dy = ev.clientY - startY;
          if (dir.includes('e')) s.el.style.width = clamp(w + dx, minW, desktop.clientWidth - left) + 'px';
          if (dir.includes('s')) s.el.style.height = clamp(h + dy, minH, desktop.clientHeight - top) + 'px';
          if (dir.includes('w')) {
            const nw = clamp(w - dx, minW, left + w);
            s.el.style.width = nw + 'px';
            s.el.style.left = left + w - nw + 'px';
          }
          if (dir.includes('n')) {
            const nh = clamp(h - dy, minH, top + h);
            s.el.style.height = nh + 'px';
            s.el.style.top = top + h - nh + 'px';
          }
        };
        const end = () => {
          handle.removeEventListener('pointermove', move);
          handle.removeEventListener('pointerup', end);
          handle.removeEventListener('pointercancel', end);
          handle.removeEventListener('lostpointercapture', end);
        };
        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', end);
        handle.addEventListener('pointercancel', end);
        handle.addEventListener('lostpointercapture', end);
      });
    }
  }

  function makeDraggable(s, bar) {
    bar.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('button') || smallScreen.matches ||
        s.el.classList.contains('window--maximized')) return;
      e.preventDefault(); // no text selection or native drag while moving the window
      const startX = e.clientX, startY = e.clientY;
      const startLeft = s.el.offsetLeft, startTop = s.el.offsetTop;
      bar.setPointerCapture(e.pointerId);
      const move = (ev) => {
        // Keep enough of the title bar on screen to grab it again
        s.el.style.left = clamp(startLeft + ev.clientX - startX, 80 - s.el.offsetWidth, desktop.clientWidth - 80) + 'px';
        s.el.style.top = clamp(startTop + ev.clientY - startY, 0, desktop.clientHeight - 30) + 'px';
      };
      const end = () => {
        bar.removeEventListener('pointermove', move);
        bar.removeEventListener('pointerup', end);
        bar.removeEventListener('pointercancel', end);
        bar.removeEventListener('lostpointercapture', end);
      };
      bar.addEventListener('pointermove', move);
      bar.addEventListener('pointerup', end);
      bar.addEventListener('pointercancel', end);
      bar.addEventListener('lostpointercapture', end);
    });
  }

  const randomBetween = (min, max) => Math.round(min + Math.random() * (max - min));

  // Right edge of the desktop icon column, so windows can open beside it instead of on top
  function iconsRight() {
    const origin = desktop.getBoundingClientRect().left;
    let right = 0;
    desktop.querySelectorAll('.desktop-icon').forEach(icon => {
      right = Math.max(right, icon.getBoundingClientRect().right - origin);
    });
    return right;
  }

  // First open: size from data-width, then drop the window at a random spot right of the icons
  // (Welcome is centred instead).
  // If the screen is too narrow for that, it shrinks to fit, and only overlaps the icons as a last resort.
  function placeWindow(s) {
    const dw = desktop.clientWidth, dh = desktop.clientHeight;
    const minLeft = iconsRight() + GAP;
    const wanted = Number(s.el.dataset.width) || 600;
    const besideIcons = dw - minLeft - GAP;
    const fitsBeside = besideIcons >= Math.min(wanted, parseFloat(getComputedStyle(s.el).minWidth) || 0);
    const w = Math.min(wanted, fitsBeside ? besideIcons : dw - 2 * GAP);
    s.el.style.width = w + 'px';
    s.el.style.height = '';
    s.el.style.maxHeight = (dh - 2 * GAP) + 'px';
    const h = s.el.offsetHeight;
    const maxLeft = Math.max(GAP, dw - w - GAP);
    const maxTop = Math.max(GAP, dh - h - GAP);
    if (s.id === 'welcome') {
      // The first thing visitors see: centred, clear of the icons, and nudged left on smaller
      // screens so it doesn't hide the name on the wallpaper
      const lo = fitsBeside ? minLeft : GAP;
      const wallpaper = desktop.querySelector('.wallpaper');
      const beforeName = wallpaper ? wallpaper.offsetLeft - GAP - w : maxLeft;
      const hi = beforeName >= lo ? Math.min(maxLeft, beforeName) : maxLeft;
      s.el.style.left = clamp(Math.round((dw - w) / 2), lo, hi) + 'px';
      s.el.style.top = clamp(Math.round((dh - h) / 2), GAP, maxTop) + 'px';
    } else {
      s.el.style.left = (fitsBeside ? randomBetween(minLeft, maxLeft) : maxLeft) + 'px';
      s.el.style.top = randomBetween(GAP, maxTop) + 'px';
    }
    s.placed = true;
    s.userSized = false;
  }

  function topmostVisible(exceptId) {
    let best = null;
    windows.forEach(s => {
      if (s.id === exceptId || !s.open || s.minimized) return;
      if (!best || Number(s.el.style.zIndex) > Number(best.el.style.zIndex)) best = s;
    });
    return best;
  }

  // The URL hash follows the front window. Windows opened from a link get their own history
  // entry (so Back closes them); focus changes just rewrite the current entry.
  // state.n numbers our entries so popstate can tell Back from Forward.
  let histIndex = history.state?.n ?? 0;

  function updateHash(push = false) {
    const hash = activeId && activeId !== 'welcome' ? '#' + activeId : '';
    if (hash === location.hash) return;
    const url = hash || location.pathname + location.search;
    if (push) history.pushState({ n: ++histIndex }, '', url);
    else history.replaceState({ n: histIndex }, '', url);
  }

  function focusWindow(id, push = false) {
    const s = windows.get(id);
    if (s.el.style.zIndex !== String(zTop)) s.el.style.zIndex = ++zTop;
    activeId = id;
    windows.forEach(w => {
      w.el.classList.toggle('window--active', w === s);
      if (w.taskBtn) w.taskBtn.setAttribute('aria-pressed', String(w === s && !w.minimized));
    });
    updateHash(push);
  }

  function activateNext(exceptId, moveFocus) {
    const next = topmostVisible(exceptId);
    if (next) {
      focusWindow(next.id);
      if (moveFocus) next.el.focus({ preventScroll: true });
    } else {
      activeId = null;
      windows.forEach(w => {
        w.el.classList.remove('window--active');
        if (w.taskBtn) w.taskBtn.setAttribute('aria-pressed', 'false');
      });
      updateHash();
    }
    return next;
  }

  function addTaskButton(s) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn taskbar__window';
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-label', s.title);
    btn.innerHTML = `<svg aria-hidden="true"><use href="${s.icon}"/></svg><span></span>`;
    btn.querySelector('span').textContent = s.title;
    btn.addEventListener('click', () => {
      if (s.minimized) openWindow(s.id);
      else if (activeId === s.id) minimizeWindow(s.id);
      else {
        focusWindow(s.id);
        s.el.focus({ preventScroll: true });
      }
    });
    li.append(btn);
    taskbarList.append(li);
    s.taskBtn = btn;
  }

  function openWindow(rawId, { animate = true, push = false } = {}) {
    const id = ALIASES[rawId] || rawId;
    const s = windows.get(id);
    if (!s) return;
    closeStartMenu();
    const wasHidden = !s.open || s.minimized;
    s.el.classList.add('window--open');
    if (!s.open) {
      s.open = true;
      if (!s.placed) placeWindow(s);
      addTaskButton(s);
      Sound.play('open');
    }
    s.minimized = false;
    if (wasHidden && animate && !prefersReducedMotion) {
      s.el.classList.remove('window--opening');
      void s.el.offsetWidth; // restart the animation
      s.el.classList.add('window--opening');
    }
    focusWindow(id, push);
    s.el.focus({ preventScroll: true });
  }

  function hideWindow(s) {
    s.el.classList.remove('window--open', 'window--opening');
    s.el.dispatchEvent(new CustomEvent('window:hide'));
  }

  function minimizeWindow(id) {
    const s = windows.get(id);
    const hadFocus = s.el.contains(document.activeElement);
    s.minimized = true;
    hideWindow(s);
    activateNext(id, false);
    if (hadFocus) s.taskBtn.focus();
  }

  function closeWindow(id, silent) {
    const s = windows.get(id);
    if (!s.open) return;
    const hadFocus = s.el.contains(document.activeElement);
    hideWindow(s);
    s.open = false;
    s.minimized = false;
    s.placed = false;
    s.el.classList.remove('window--maximized');
    s.taskBtn.parentElement.remove();
    s.taskBtn = null;
    if (!silent) Sound.play('close');
    const next = activateNext(id, hadFocus);
    // Nothing left open: hand focus back to the desktop icon that opens this window
    if (hadFocus && !next) {
      const icon = desktop.querySelector(`.desktop-icon[data-open="${id}"]`);
      if (icon) icon.focus();
    }
  }

  function toggleMaximize(s) {
    if (smallScreen.matches) return;
    const max = s.el.classList.toggle('window--maximized');
    s.el.querySelector('.window__btn--max').setAttribute('aria-label', max ? 'Restore' : 'Maximize');
    Sound.play('click');
  }

  document.querySelectorAll('.window').forEach(initWindow);

  // Keep windows reachable when the browser window shrinks
  window.addEventListener('resize', () => {
    const dw = desktop.clientWidth, dh = desktop.clientHeight;
    windows.forEach(s => {
      if (!s.placed) return;
      s.el.style.maxHeight = (s.userSized ? dh : dh - 2 * GAP) + 'px';
      if (s.el.offsetWidth > dw) s.el.style.width = dw + 'px';
      s.el.style.left = clamp(s.el.offsetLeft, 80 - s.el.offsetWidth, dw - 80) + 'px';
      s.el.style.top = clamp(s.el.offsetTop, 0, dh - 30) + 'px';
    });
  });

  // Anything with data-open (desktop icons, Start menu, in-window links) opens that window
  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-open]');
    if (!opener) return;
    e.preventDefault();
    if (opener.classList.contains('desktop-icon')) selectIcon(opener);
    openWindow(opener.dataset.open, { push: true });
  });

  // Other scripts (the terminal) open windows by event, so they don't need the window manager's internals
  document.addEventListener('desktop:open', (e) => openWindow(e.detail, { push: true }));

  // Desktop icons highlight like the real thing; clicking empty desktop clears it
  function selectIcon(icon) {
    desktop.querySelectorAll('.desktop-icon--selected').forEach(i => i.classList.remove('desktop-icon--selected'));
    if (icon) icon.classList.add('desktop-icon--selected');
  }
  desktop.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.desktop-icon, .window')) selectIcon(null);
  });

  const windowFromHash = () => {
    const raw = decodeURIComponent(location.hash.slice(1));
    const id = ALIASES[raw] || raw;
    return windows.has(id) ? id : 'welcome';
  };

  // Back closes the front window and returns to the one in the earlier entry; Forward reopens.
  // A hash typed into the address bar arrives without our state and just opens that window.
  window.addEventListener('popstate', (e) => {
    const target = windowFromHash();
    const n = e.state?.n;
    if (n === undefined) {
      history.replaceState({ n: ++histIndex }, '', location.href);
      openWindow(target);
      return;
    }
    const back = n < histIndex;
    histIndex = n;
    if (back && activeId && activeId !== target) closeWindow(activeId);
    openWindow(target);
  });

  // --- Start menu ---
  const startBtn = document.getElementById('start-button');
  const startMenu = document.getElementById('start-menu');
  const menuItems = [...startMenu.querySelectorAll('[role="menuitem"]')];

  function openStartMenu(focusIndex) {
    startMenu.hidden = false;
    startBtn.setAttribute('aria-expanded', 'true');
    Sound.play('click');
    if (focusIndex !== undefined) menuItems.at(focusIndex).focus();
  }

  function closeStartMenu(returnFocus) {
    if (startMenu.hidden) return;
    startMenu.hidden = true;
    startBtn.setAttribute('aria-expanded', 'false');
    if (returnFocus) startBtn.focus();
  }

  startBtn.addEventListener('click', (e) => {
    if (startMenu.hidden) openStartMenu(e.detail === 0 ? 0 : undefined); // keyboard → focus first item
    else closeStartMenu();
  });

  startBtn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      openStartMenu(e.key === 'ArrowUp' ? -1 : 0);
    }
  });

  startMenu.addEventListener('keydown', (e) => {
    const i = menuItems.indexOf(document.activeElement);
    let next = null;
    if (e.key === 'ArrowDown') next = (i + 1) % menuItems.length;
    else if (e.key === 'ArrowUp') next = (i - 1 + menuItems.length) % menuItems.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = menuItems.length - 1;
    else if (e.key === 'Escape') {
      e.stopPropagation();
      closeStartMenu(true);
    } else if (e.key === 'Tab') closeStartMenu();
    if (next !== null) {
      e.preventDefault();
      menuItems[next].focus();
    }
  });

  // External links in the menu still close it
  startMenu.addEventListener('click', (e) => {
    if (e.target.closest('a[target="_blank"]')) closeStartMenu();
  });

  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('#start-menu, #start-button')) closeStartMenu();
  });

  // --- Shut down ---
  const shutdownScreen = document.getElementById('shutdown');
  document.getElementById('shutdown-button').addEventListener('click', () => {
    closeStartMenu();
    windows.forEach(s => closeWindow(s.id, true));
    Sound.play('shutdown');
    shutdownScreen.hidden = false;
    document.getElementById('restart-button').focus();
  });
  document.getElementById('restart-button').addEventListener('click', () => {
    shutdownScreen.hidden = true;
    Sound.play('startup');
    openWindow('welcome');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!startMenu.hidden) closeStartMenu(true);
    else if (activeId && shutdownScreen.hidden) closeWindow(activeId);
  });

  // --- Clock ---
  const clock = document.getElementById('clock');
  function tick() {
    const now = new Date();
    clock.textContent = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    clock.dateTime = now.toISOString();
    clock.title = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    setTimeout(tick, 60000 - (now.getSeconds() * 1000 + now.getMilliseconds()));
  }
  tick();

  // --- Mini Game ---
  const canvas = document.getElementById('mini-game');
  const startGameBtn = document.getElementById('game-start');
  const gameWindow = document.getElementById('catmayhem');
  if (canvas && startGameBtn) {
    const ctx = canvas.getContext('2d');
    const W = 400, H = 300; // logical game size; the backing store is scaled for sharp HiDPI rendering
    const FRAME_MS = 1000 / 60; // all speeds below are tuned in "per 60 fps frame" units
    const GAME_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);
    let running = false;
    let rafId = null;
    let lastTime = 0;
    let player, bullets, enemies, particles, decals, score, spawnTimer, elapsed, gameOver;
    const keys = {};
    let touchTarget = null;     // finger position (game coords) while a touch is held
    let autoFireTimer = 0;
    let lastPointerType = 'mouse';
    let aim = { x: W, y: H / 2 }; // where the gun points: the mouse, or the nearest enemy on touch
    let pointerInside = false;
    const AUTO_FIRE_FRAMES = 18;
    const CAT_PX = 1.8; // sprite scale: logical pixels per sprite pixel
    const MAX_DECALS = 600;
    const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;

    // Best score survives reloads; storage can throw in private modes, so fail quietly
    const BEST_KEY = 'catMayhemBest';
    let best = 0;
    let isNewBest = false;
    try { best = Number(localStorage.getItem(BEST_KEY)) || 0; } catch { /* storage unavailable */ }
    function saveBest() {
      if (score <= best) return;
      best = score;
      isNewBest = true;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch { /* storage unavailable */ }
    }

    if (isTouchDevice) {
      const hint = gameWindow.querySelector('.game__hint');
      if (hint) hint.textContent = 'Drag to move · auto-fire';
    }

    // Palette from the full game: purple ground, white cat, grey mice
    const CLR = {
      ground: '#6f5383',
      tuft: '#5e4572',
      outline: '#24162b',
      bush: '#8a5f9c',
      bushLight: '#a477b5',
      rock: '#7b7681',
      rockLight: '#98939e',
      gun: '#1d1822',
      bullet: '#ffe14d',
      blood: ['#7d0d16', '#5e0910', '#951820'],
      deathParticle: '#ffffff',
      shadow: 'rgba(20, 8, 28, 0.3)',
      hudBg: 'rgba(255, 255, 255, 0.92)',
      hudText: '#24162b',
      hudCorner: '#c58ac9',
      crosshair: '#e0303a',
      overlay: 'rgba(36, 22, 43, 0.75)',
      text: '#ffffff',
      best: '#ffe14d'
    };
    const FONT = '"Courier New", Courier, monospace';

    // Pixel sprites, one character per pixel ('.' is transparent). Each is drawn once into a tiny
    // offscreen canvas and scaled up with smoothing off, so it stays crisp at any size.
    const CAT = [
      '.o.......o.',
      'oWo.....oWo',
      'oWWo...oWWo',
      'oWpWoooWpWo',
      'oWWWWWWWWWo',
      'oWWkWWWkWWo',
      'oWWWWpWWWWo',
      'oSWWWWWWWSo',
      '.ooWWWWWoo.',
      '..oWWWWWo..',
      '..oWWWWWo..',
      '..oSWWWSo..',
      '..oWWoWWo..',
      '..oWo.oWo..',
      '..oo...oo..'
    ];
    const MOUSE = [
      '.ooo...ooo.',
      'oGGGo.oGGGo',
      'oGPGoooGPGo',
      'oGGGGGGGGGo',
      '.oGGGGGGGo.',
      '.oGrGGGrGo.',
      '.oGGGGGGGo.',
      '.oGGkkkGGo.',
      '..oGGGGGo..',
      '.oGoGGGoGo.',
      '.oGoGGGoGo.',
      '..oGGGGGo..',
      '..oGo.oGo..',
      '..oo...oo..'
    ];

    function makeSprite(rows, colors) {
      const c = document.createElement('canvas');
      c.width = rows[0].length;
      c.height = rows.length;
      const g = c.getContext('2d');
      rows.forEach((row, y) => [...row].forEach((ch, x) => {
        if (!colors[ch]) return;
        g.fillStyle = colors[ch];
        g.fillRect(x, y, 1, 1);
      }));
      return c;
    }

    const SPRITES = {
      cat: makeSprite(CAT, { o: CLR.outline, W: '#f4f1f6', S: '#c9c2d0', k: CLR.outline, p: '#ff9ec8' }),
      mouseLight: makeSprite(MOUSE, { o: CLR.outline, G: '#b3aeb9', P: '#d99ab5', r: '#e0303a', k: CLR.outline }),
      mouseDark: makeSprite(MOUSE, { o: CLR.outline, G: '#5b5762', P: '#a0708a', r: '#e0303a', k: CLR.outline })
    };

    // Scenery is generated once, so the ground looks the same on every run
    const scenery = {
      tufts: Array.from({ length: 45 }, () => ({ x: Math.random() * W, y: Math.random() * H })),
      rocks: [
        [[86, 58, 10], [96, 62, 7]],
        [[352, 182, 7], [359, 186, 5]]
      ],
      bushes: [
        [[52, 244, 7], [60, 239, 8], [68, 244, 7]],
        [[322, 70, 6], [329, 66, 7], [336, 70, 6]],
        [[292, 256, 6], [300, 251, 7], [308, 256, 6]]
      ]
    };

    // Size the canvas backing store to its displayed size × devicePixelRatio, then
    // draw in logical W×H units
    function resizeCanvas() {
      const scale = Math.max(1, (canvas.clientWidth || W) * (window.devicePixelRatio || 1) / W);
      canvas.width = Math.round(W * scale);
      canvas.height = Math.round(H * scale);
      ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
      ctx.imageSmoothingEnabled = false; // resizing resets the context, so set this every time
    }

    function initGame() {
      isNewBest = false;
      player = { x: W / 2, y: H / 2, r: 8, speed: 2.5, walk: 0, moving: false };
      bullets = [];
      enemies = [];
      particles = [];
      decals = [];
      score = 0;
      spawnTimer = 0;
      elapsed = 0;
      gameOver = false;
    }

    function clearKeys() {
      for (const k in keys) keys[k] = false;
      touchTarget = null;
    }

    function getMousePos(e) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (W / rect.width),
        y: (e.clientY - rect.top) * (H / rect.height)
      };
    }

    function shootAt(x, y) {
      const angle = Math.atan2(y - player.y, x - player.x);
      bullets.push({
        x: player.x + Math.cos(angle) * 15, y: player.y + 4 + Math.sin(angle) * 15,
        vx: Math.cos(angle) * 5,
        vy: Math.sin(angle) * 5,
        life: 80
      });
      Sound.play('shoot');
    }

    canvas.addEventListener('click', (e) => {
      if (!running) return;
      if (lastPointerType === 'touch') return; // touch is handled by the pointer events below
      if (gameOver) {
        initGame();
        return;
      }
      const m = getMousePos(e);
      shootAt(m.x, m.y);
    });

    // Touch: hold and drag to steer the player towards your finger; it auto-fires at
    // the nearest enemy (aiming and moving with one thumb on a small canvas isn't fun)
    canvas.addEventListener('pointerdown', (e) => {
      lastPointerType = e.pointerType;
      if (e.pointerType !== 'touch' || !running) return;
      e.preventDefault();
      if (gameOver) {
        initGame();
        return;
      }
      touchTarget = getMousePos(e);
      // Keep receiving moves if the finger slides off the canvas (throws if the pointer is already gone)
      try { canvas.setPointerCapture(e.pointerId); } catch { /* pointer already released */ }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') {
        if (touchTarget) touchTarget = getMousePos(e);
      } else {
        lastPointerType = e.pointerType;
        aim = getMousePos(e);
      }
    });
    canvas.addEventListener('pointerenter', () => { pointerInside = true; });
    canvas.addEventListener('pointerleave', () => { pointerInside = false; });
    const endTouch = () => { touchTarget = null; };
    canvas.addEventListener('pointerup', endTouch);
    canvas.addEventListener('pointercancel', endTouch);

    // Only swallow the movement keys while the game window is in front, so they
    // still scroll the other windows
    document.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (!running || !GAME_KEYS.has(k) || !gameWindow.classList.contains('window--active')) return;
      e.preventDefault();
      keys[k] = true;
    });
    document.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
    // Releasing a key while the window is unfocused never fires keyup — avoid stuck movement
    window.addEventListener('blur', clearKeys);

    function spawnEnemy() {
      const side = Math.random() * 4 | 0;
      let x, y;
      if (side === 0) { x = Math.random() * W; y = -14; }
      else if (side === 1) { x = W + 14; y = Math.random() * H; }
      else if (side === 2) { x = Math.random() * W; y = H + 14; }
      else { x = -14; y = Math.random() * H; }
      // Dark mice are bigger and slower, light ones small and quick
      const dark = Math.random() < 0.3;
      const r = dark ? 8 : 6 + Math.random() * 1.5;
      const speed = dark ? 0.7 + Math.random() * 0.4 : 0.9 + Math.random() * 0.7;
      enemies.push({ x, y, r, speed, sprite: dark ? SPRITES.mouseDark : SPRITES.mouseLight, walk: Math.random() * 6 });
    }

    function addParticles(x, y, color, count) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 3;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 20 + Math.random() * 15,
          color, r: 1.5 + Math.random() * 2
        });
      }
    }

    // Blocky splats that stay on the ground for the rest of the run
    function addSplat(x, y) {
      for (let i = 0; i < 16; i++) {
        decals.push({
          x: Math.round(x + (Math.random() - 0.5) * 26),
          y: Math.round(y + 6 + (Math.random() - 0.5) * 14),
          w: 1 + (Math.random() * 4 | 0),
          h: 1 + (Math.random() * 2 | 0),
          c: CLR.blood[i % CLR.blood.length]
        });
      }
      if (decals.length > MAX_DECALS) decals.splice(0, decals.length - MAX_DECALS);
    }

    function nearestEnemy() {
      let nearest = null, bestDist = Infinity;
      for (const e of enemies) {
        const d = Math.hypot(e.x - player.x, e.y - player.y);
        if (d < bestDist) { bestDist = d; nearest = e; }
      }
      return nearest;
    }

    // dt = elapsed time in 60 fps frames, so the game plays the same at 60 Hz and 144 Hz
    function update(dt) {
      elapsed += dt;
      const step = player.speed * dt;
      const startX = player.x, startY = player.y;
      if (keys['w'] || keys['arrowup']) player.y -= step;
      if (keys['s'] || keys['arrowdown']) player.y += step;
      if (keys['a'] || keys['arrowleft']) player.x -= step;
      if (keys['d'] || keys['arrowright']) player.x += step;
      if (touchTarget) {
        const dx = touchTarget.x - player.x, dy = touchTarget.y - player.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 2) {
          const move = Math.min(step, dist);
          player.x += dx / dist * move;
          player.y += dy / dist * move;
        }
        const target = nearestEnemy();
        if (target) aim = { x: target.x, y: target.y };
        autoFireTimer += dt;
        if (autoFireTimer >= AUTO_FIRE_FRAMES && target) {
          autoFireTimer = 0;
          shootAt(target.x, target.y);
        }
      }
      player.x = Math.max(player.r, Math.min(W - player.r, player.x));
      player.y = Math.max(player.r, Math.min(H - player.r, player.y));
      player.moving = player.x !== startX || player.y !== startY;
      if (player.moving) player.walk += dt * 0.35;

      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        if (b.life <= 0 || b.x < -10 || b.x > W + 10 || b.y < -10 || b.y > H + 10)
          bullets.splice(i, 1);
      }

      spawnTimer += dt;
      if (spawnTimer >= 70) { spawnEnemy(); spawnTimer = 0; }

      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        const angle = Math.atan2(player.y - e.y, player.x - e.x);
        e.x += Math.cos(angle) * e.speed * dt;
        e.y += Math.sin(angle) * e.speed * dt;
        e.walk += dt * 0.3;

        for (let j = bullets.length - 1; j >= 0; j--) {
          const b = bullets[j];
          const dx = b.x - e.x, dy = b.y - e.y;
          if (dx * dx + dy * dy < (e.r + 3) * (e.r + 3)) {
            addSplat(e.x, e.y);
            addParticles(e.x, e.y, CLR.blood[2], 8);
            enemies.splice(i, 1);
            bullets.splice(j, 1);
            score++;
            Sound.play('hit');
            break;
          }
        }

        if (enemies[i] === e) {
          const dx = player.x - e.x, dy = player.y - e.y;
          if (dx * dx + dy * dy < (player.r + e.r) * (player.r + e.r)) {
            addParticles(player.x, player.y, CLR.deathParticle, 20);
            gameOver = true;
            saveBest();
            Sound.play('gameover');
          }
        }
      }

      const drag = Math.pow(0.96, dt);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
        p.vx *= drag; p.vy *= drag;
        if (p.life <= 0) particles.splice(i, 1);
      }
    }

    // Outlined, lightly shaded blob (bushes and rocks) built from overlapping circles
    function drawBlob(parts, fill, light) {
      const circles = (color, grow, shift, shrink) => {
        ctx.fillStyle = color;
        parts.forEach(([x, y, r]) => {
          ctx.beginPath();
          ctx.arc(x - r * shift, y - r * shift, r * shrink + grow, 0, Math.PI * 2);
          ctx.fill();
        });
      };
      circles(CLR.outline, 1.5, 0, 1);
      circles(fill, 0, 0, 1);
      circles(light, 0, 0.3, 0.45);
    }

    function drawBackground() {
      ctx.fillStyle = CLR.ground;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = CLR.tuft;
      scenery.tufts.forEach(({ x, y }) => {
        ctx.fillRect(x, y, 1, 3);
        ctx.fillRect(x + 2, y - 1, 1, 4);
        ctx.fillRect(x + 4, y + 1, 1, 2);
      });
      scenery.rocks.forEach(parts => drawBlob(parts, CLR.rock, CLR.rockLight));
      scenery.bushes.forEach(parts => drawBlob(parts, CLR.bush, CLR.bushLight));
      if (decals) decals.forEach(d => {
        ctx.fillStyle = d.c;
        ctx.fillRect(d.x, d.y, d.w, d.h);
      });
    }

    function drawShadow(x, y, rx) {
      ctx.fillStyle = CLR.shadow;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, rx * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawSprite(img, x, y, px, bob) {
      const w = img.width * px, h = img.height * px;
      ctx.drawImage(img, Math.round(x - w / 2), Math.round(y - h / 2 + bob), w, h);
    }

    function drawPlayer() {
      const bob = player.moving && Math.sin(player.walk) > 0 ? -1 : 0;
      drawShadow(player.x, player.y + SPRITES.cat.height * CAT_PX / 2 - 1, 9);
      drawSprite(SPRITES.cat, player.x, player.y, CAT_PX, bob);
      // The gun follows the aim
      ctx.save();
      ctx.translate(player.x, player.y + 4 + bob);
      ctx.rotate(Math.atan2(aim.y - player.y, aim.x - player.x));
      ctx.fillStyle = CLR.gun;
      ctx.fillRect(4, -2, 13, 4);
      ctx.fillRect(4, 0, 4, 5);
      ctx.restore();
    }

    function drawEnemy(e) {
      const px = e.r / 4;
      drawShadow(e.x, e.y + e.sprite.height * px / 2 - 1, e.r * 0.9);
      drawSprite(e.sprite, e.x, e.y, px, Math.sin(e.walk) > 0 ? -1 : 0);
    }

    function drawHud() {
      const x = W - 94, y = 6, w = 88, h = 50;
      ctx.fillStyle = CLR.hudBg;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = CLR.outline;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      ctx.fillStyle = CLR.hudCorner;
      [[x, y], [x + w - 3, y], [x, y + h - 3], [x + w - 3, y + h - 3]].forEach(([cx, cy]) => ctx.fillRect(cx, cy, 3, 3));
      const secs = Math.floor(elapsed / 60);
      ctx.fillStyle = CLR.hudText;
      ctx.font = `700 11px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, x + 7, y + 15);
      ctx.fillText('Kills: ' + score, x + 7, y + 29);
      ctx.fillText('Best:  ' + best, x + 7, y + 43);
    }

    function drawCrosshair() {
      if (!pointerInside || lastPointerType !== 'mouse') return;
      const { x, y } = aim;
      ctx.strokeStyle = CLR.crosshair;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.moveTo(x - 9, y); ctx.lineTo(x + 9, y);
      ctx.moveTo(x, y - 9); ctx.lineTo(x, y + 9);
      ctx.stroke();
    }

    function draw() {
      drawBackground();

      // Draw characters back to front so the ones lower on screen overlap the ones behind them
      const actors = gameOver ? enemies : [...enemies, player];
      actors.sort((a, b) => a.y - b.y).forEach(a => (a === player ? drawPlayer() : drawEnemy(a)));

      particles.forEach(p => {
        ctx.globalAlpha = Math.max(0, p.life / 35);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r);
      });
      ctx.globalAlpha = 1;

      ctx.fillStyle = CLR.bullet;
      ctx.shadowColor = CLR.bullet;
      ctx.shadowBlur = 8;
      bullets.forEach(b => ctx.fillRect(b.x - 2, b.y - 2, 4, 4));
      ctx.shadowBlur = 0;

      drawHud();

      if (gameOver) {
        ctx.fillStyle = CLR.overlay;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = CLR.text;
        ctx.font = `700 26px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', W / 2, H / 2 - 10);
        ctx.font = `700 14px ${FONT}`;
        ctx.fillText((isNewBest ? 'NEW BEST! ' : '') + 'KILLS ' + score, W / 2, H / 2 + 16);
        ctx.fillStyle = CLR.best;
        ctx.font = `400 12px ${FONT}`;
        ctx.fillText((isTouchDevice ? 'Tap' : 'Click') + ' to restart', W / 2, H / 2 + 38);
      }

      drawCrosshair();
    }

    function drawIdle() {
      drawBackground();
      drawPlayer();
    }

    function loop(now) {
      if (!running) return;
      // Clamp so returning from a background tab doesn't teleport enemies onto the player
      const dt = Math.min((now - lastTime) / FRAME_MS, 3);
      lastTime = now;
      if (!gameOver) update(dt);
      draw();
      rafId = requestAnimationFrame(loop);
    }

    function startGame() {
      initGame();
      resizeCanvas();
      startGameBtn.classList.add('hidden');
      canvas.classList.add('game__canvas--running');
      running = true;
      lastTime = performance.now();
      rafId = requestAnimationFrame(loop);
    }

    // Stop the loop when the window is minimised or closed so it doesn't burn CPU in the background
    function stopGame() {
      running = false;
      cancelAnimationFrame(rafId);
      clearKeys();
      initGame();
      drawIdle();
      startGameBtn.classList.remove('hidden');
      canvas.classList.remove('game__canvas--running');
    }

    startGameBtn.addEventListener('click', startGame);
    gameWindow.addEventListener('window:hide', stopGame);

    // Re-render sharply whenever the window is opened, resized or maximised
    new ResizeObserver(() => {
      resizeCanvas();
      if (running) draw(); else drawIdle();
    }).observe(canvas);

    initGame();
    resizeCanvas();
    drawIdle();
  }

  // --- Boot: open the linked window, or the Welcome screen ---
  history.replaceState({ n: histIndex }, '', location.href);
  openWindow(windowFromHash(), { animate: false });
});
