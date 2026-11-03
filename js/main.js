document.addEventListener('DOMContentLoaded', () => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- Bento grid ---
  const bentoGrid = document.querySelector('.bento-grid');
  const bentoCards = document.querySelectorAll('.bento-card');
  const backBtn = document.querySelector('.bento-back');
  // Everything outside the grid that must drop out of the tab order while a card is open
  const pageChrome = document.querySelectorAll('.bento-header, .contact, .footer');
  let expandedCard = null;
  let isAnimating = false;
  let placeholder = null; // invisible stand-in that holds the card's grid slot while it's expanded

  const ZOOM_MS = 650; // must match the transition duration in .bento-card--zooming (bento.css)

  // Runs `cb` once the card's zoom transition finishes. Uses transitionend for exact
  // timing (setTimeout drifts and leaves a dead pause before the finishing DOM swap runs),
  // with a safety-net timeout in case the event never fires.
  function afterZoom(card, cb) {
    if (prefersReducedMotion) {
      cb();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      card.removeEventListener('transitionend', onEnd);
      clearTimeout(fallback);
      cb();
    };
    const onEnd = (e) => {
      if (e.target === card && e.propertyName === 'width') finish();
    };
    card.addEventListener('transitionend', onEnd);
    const fallback = setTimeout(finish, ZOOM_MS + 100);
  }

  function getRenderWidth(card) {
    return parseFloat(getComputedStyle(card).getPropertyValue('--content-render-width'));
  }

  // Collapsed cards act as buttons; their scaled-down content is inert so the
  // invisible miniature links can't be tabbed to or read out by screen readers.
  // Names come from the visible label (title + teaser) so voice-control users can
  // say what they see; an open card is named by its title alone.
  function labelIds(card) {
    const id = card.dataset.card;
    const title = card.querySelector('.bento-card__title');
    const teaser = card.querySelector('.bento-card__teaser');
    title.id = title.id || `card-title-${id}`;
    if (teaser) teaser.id = teaser.id || `card-teaser-${id}`;
    return { title: title.id, teaser: teaser && teaser.id };
  }

  function setCollapsedA11y(card) {
    const ids = labelIds(card);
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-labelledby', ids.teaser ? `${ids.title} ${ids.teaser}` : ids.title);
    card.removeAttribute('aria-modal');
    card.querySelector('.bento-card__content').inert = true;
  }

  function setExpandedA11y(card) {
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', labelIds(card).title);
    card.setAttribute('tabindex', '-1');
    card.querySelector('.bento-card__content').inert = false;
  }

  // While a card is open, everything behind it leaves the tab order
  function setBackgroundInert(activeCard, inert) {
    bentoCards.forEach(c => { if (c !== activeCard) c.inert = inert; });
    pageChrome.forEach(el => { el.inert = inert; });
  }

  // Calculate and apply miniature scale for each card
  function updateCardScales() {
    bentoCards.forEach(card => {
      if (card.classList.contains('bento-card--expanded')) return;
      const scale = card.offsetWidth / getRenderWidth(card);
      card.style.setProperty('--card-scale', scale);
    });
  }

  bentoCards.forEach(setCollapsedA11y);
  updateCardScales();
  window.addEventListener('resize', () => {
    if (!expandedCard) updateCardScales();
  });

  function expandCard(card) {
    if (expandedCard || isAnimating) return;
    isAnimating = true;
    expandedCard = card;

    const rect = card.getBoundingClientRect();
    // Content is centered at its natural size once expanded (.container caps at --max-width),
    // so never scale it up past 1:1 — only shrink to fit narrower viewports.
    const fullScale = Math.min(1, window.innerWidth / getRenderWidth(card));

    // Lock body scroll
    document.body.style.overflow = 'hidden';
    setBackgroundInert(card, true);

    // Leave an invisible same-sized placeholder in the grid so pulling the card
    // into `position: fixed` doesn't reflow the other cards into its old slot.
    placeholder = document.createElement('div');
    placeholder.className = card.className;
    placeholder.style.visibility = 'hidden';
    placeholder.setAttribute('aria-hidden', 'true');
    card.insertAdjacentElement('afterend', placeholder);

    // 1. Pin card at its current position (no transition yet)
    card.style.position = 'fixed';
    card.style.top = rect.top + 'px';
    card.style.left = rect.left + 'px';
    card.style.width = rect.width + 'px';
    card.style.height = rect.height + 'px';
    card.style.borderRadius = 'var(--border-radius)';
    card.style.zIndex = '1000';
    card.style.overflow = 'hidden';
    card.style.aspectRatio = 'auto';

    // Hide other cards
    bentoGrid.classList.add('bento-grid--has-expanded');

    // 2. Force reflow — browser locks in the starting position
    card.offsetHeight;

    // 3. Bring in CSS transitions (card box AND content scale), then set target values
    card.classList.add('bento-card--zooming');

    // 4. Force reflow so transition is registered before target changes
    card.offsetHeight;

    // 5. Set target — this triggers the smooth zoom-in, content scales up with it
    card.style.top = '0';
    card.style.left = '0';
    card.style.width = '100vw';
    card.style.height = '100vh';
    card.style.borderRadius = '0';
    card.style.setProperty('--card-scale', fullScale);
    card.style.setProperty('--preview-shift', '0px');

    // 6. After zoom finishes, swap to expanded state (shows full content)
    afterZoom(card, () => {
      card.classList.remove('bento-card--zooming');
      card.style.overflow = '';
      card.style.aspectRatio = '';
      card.classList.add('bento-card--expanded');
      card.style.position = 'fixed';
      card.style.top = '0';
      card.style.left = '0';
      card.style.width = '100vw';
      card.style.height = '100vh';
      card.style.borderRadius = '0';
      card.style.zIndex = '1000';

      setExpandedA11y(card);
      backBtn.classList.add('bento-back--visible');
      isAnimating = false;
      card.scrollTop = 0;
      backBtn.focus({ preventScroll: true });
      syncWithHash(); // the URL may have changed mid-animation (e.g. browser Back)
    });
  }

  function collapseCard() {
    if (!expandedCard || isAnimating) return;
    isAnimating = true;
    const card = expandedCard;

    // Let anything living inside the card (e.g. the mini-game) shut itself down
    card.dispatchEvent(new CustomEvent('bento:collapse'));
    card.querySelector('.bento-card__content').inert = true;
    backBtn.classList.remove('bento-back--visible');

    // Show the rest of the grid behind so you see cards during zoom-out
    bentoGrid.classList.remove('bento-grid--has-expanded');

    const renderWidth = getRenderWidth(card);
    const fullScale = Math.min(1, window.innerWidth / renderWidth);

    // Measure the target from the placeholder now rather than reusing the rect from
    // expand time, so a window resize while the card was open still lands correctly.
    const target = placeholder.getBoundingClientRect();
    const miniScale = target.width / renderWidth;

    // 1. Remove expanded, keep card fixed at fullscreen with viewport-scale content
    card.classList.remove('bento-card--expanded');
    card.style.position = 'fixed';
    card.style.top = '0';
    card.style.left = '0';
    card.style.width = '100vw';
    card.style.height = '100vh';
    card.style.borderRadius = '0';
    card.style.zIndex = '1000';
    card.style.overflow = 'hidden';
    card.style.setProperty('--card-scale', fullScale);

    // 2. Force reflow — browser registers starting position + scale
    card.offsetHeight;

    // 3. Add zooming class (brings in CSS transitions for card AND content)
    card.classList.add('bento-card--zooming');
    card.offsetHeight;

    // 4. Animate back to the grid slot AND shrink content to mini scale
    card.style.top = target.top + 'px';
    card.style.left = target.left + 'px';
    card.style.width = target.width + 'px';
    card.style.height = target.height + 'px';
    card.style.borderRadius = 'var(--border-radius)';
    card.style.setProperty('--card-scale', miniScale);
    card.style.removeProperty('--preview-shift');

    afterZoom(card, () => {
      // Clean up — return card to normal grid flow
      card.classList.remove('bento-card--zooming');
      card.style.position = '';
      card.style.top = '';
      card.style.left = '';
      card.style.width = '';
      card.style.height = '';
      card.style.borderRadius = '';
      card.style.zIndex = '';
      card.style.overflow = '';

      if (placeholder) {
        placeholder.remove();
        placeholder = null;
      }

      document.body.style.overflow = '';
      setBackgroundInert(card, false);
      setCollapsedA11y(card);
      expandedCard = null;
      isAnimating = false;

      updateCardScales();
      card.focus({ preventScroll: true });
      syncWithHash();
    });
  }

  // --- URL hash routing ---
  // The hash (#projects, #skills…) is the source of truth for which card is open, so the
  // browser Back button closes a card and an open card can be shared as a link.
  function cardFromHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    return id ? document.querySelector(`.bento-card[data-card="${CSS.escape(id)}"]`) : null;
  }

  function syncWithHash() {
    if (isAnimating) return; // re-run from the animation's completion callback
    const target = cardFromHash();
    if (expandedCard && expandedCard !== target) collapseCard();
    else if (!expandedCard && target) expandCard(target);
  }

  function requestOpen(card) {
    if (expandedCard || isAnimating) return;
    history.pushState({ bentoCard: card.dataset.card }, '', '#' + card.dataset.card);
    syncWithHash();
  }

  function requestClose() {
    if (history.state && history.state.bentoCard) {
      history.back(); // popstate → syncWithHash collapses the card
    } else {
      // Opened via a shared link: there's no in-page history entry to go back to
      history.replaceState(null, '', location.pathname + location.search);
      syncWithHash();
    }
  }

  window.addEventListener('popstate', syncWithHash);

  bentoCards.forEach(card => {
    card.addEventListener('click', (e) => {
      if (card.classList.contains('bento-card--expanded')) return;
      if (e.target.closest('a')) return;
      requestOpen(card);
    });
    card.addEventListener('keydown', (e) => {
      if (e.target !== card || card.classList.contains('bento-card--expanded')) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        requestOpen(card);
      }
    });
  });

  backBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    requestClose();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && expandedCard) {
      requestClose();
    }
  });

  // Deep link (e.g. /#projects): skip the entrance animation and open that card
  const linkedCard = cardFromHash();
  if (linkedCard) {
    linkedCard.getAnimations().forEach(a => a.finish());
    syncWithHash();
  }

  // --- Mini Game ---
  const canvas = document.getElementById('mini-game');
  const startBtn = document.getElementById('game-start');
  if (canvas && startBtn) {
    const ctx = canvas.getContext('2d');
    const W = 400, H = 300; // logical game size; the backing store is scaled for sharp HiDPI rendering
    const FRAME_MS = 1000 / 60; // all speeds below are tuned in "per 60 fps frame" units
    const GAME_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);
    let running = false;
    let rafId = null;
    let lastTime = 0;
    let player, bullets, enemies, particles, score, spawnTimer, gameOver;
    const keys = {};
    let touchTarget = null;     // finger position (game coords) while a touch is held
    let autoFireTimer = 0;
    let lastPointerType = 'mouse';
    const AUTO_FIRE_FRAMES = 18;
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
      const hint = document.querySelector('.featured__demo-hint');
      if (hint) hint.textContent = 'Drag to move · auto-fire';
    }

    // Pull the palette from the CSS tokens so the game always matches the site theme
    const rootStyle = getComputedStyle(document.documentElement);
    const accent = rootStyle.getPropertyValue('--clr-accent').trim();
    const accent2 = rootStyle.getPropertyValue('--clr-accent-2').trim();

    const CLR = {
      bg: '#050505',
      grid: 'rgba(255,255,255,0.025)',
      player: '#ffffff',
      bullet: accent,
      bulletGlow: accent,
      enemy: accent2,
      enemyEye: '#ffffff',
      killParticle: accent,
      deathParticle: '#ffffff',
      text: '#d4d4d4',
      score: '#ffffff',
      gameover: '#ffffff'
    };

    // Size the canvas backing store to its displayed size × devicePixelRatio, then
    // draw in logical W×H units. clientWidth ignores the miniature's CSS transform.
    function resizeCanvas() {
      const scale = Math.max(1, (canvas.clientWidth || W) * (window.devicePixelRatio || 1) / W);
      canvas.width = Math.round(W * scale);
      canvas.height = Math.round(H * scale);
      ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    }

    function initGame() {
      isNewBest = false;
      player = { x: W / 2, y: H / 2, r: 8, speed: 2.5 };
      bullets = [];
      enemies = [];
      particles = [];
      score = 0;
      spawnTimer = 0;
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
        x: player.x, y: player.y,
        vx: Math.cos(angle) * 5,
        vy: Math.sin(angle) * 5,
        life: 80
      });
    }

    canvas.addEventListener('click', (e) => {
      if (!running) return;
      e.stopPropagation();
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
      if (touchTarget && e.pointerType === 'touch') touchTarget = getMousePos(e);
    });
    const endTouch = () => { touchTarget = null; };
    canvas.addEventListener('pointerup', endTouch);
    canvas.addEventListener('pointercancel', endTouch);

    // Only swallow the movement keys, and only mid-game, so they don't scroll the card
    document.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (!running || !GAME_KEYS.has(k)) return;
      e.preventDefault();
      keys[k] = true;
    });
    document.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
    // Releasing a key while the window is unfocused never fires keyup — avoid stuck movement
    window.addEventListener('blur', clearKeys);

    function spawnEnemy() {
      const side = Math.random() * 4 | 0;
      let x, y;
      if (side === 0) { x = Math.random() * W; y = -10; }
      else if (side === 1) { x = W + 10; y = Math.random() * H; }
      else if (side === 2) { x = Math.random() * W; y = H + 10; }
      else { x = -10; y = Math.random() * H; }
      const speed = 0.8 + Math.random() * 0.8;
      const r = 6 + Math.random() * 4;
      enemies.push({ x, y, r, speed });
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

    // dt = elapsed time in 60 fps frames, so the game plays the same at 60 Hz and 144 Hz
    function update(dt) {
      const step = player.speed * dt;
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
        autoFireTimer += dt;
        if (autoFireTimer >= AUTO_FIRE_FRAMES && enemies.length) {
          autoFireTimer = 0;
          let nearest = enemies[0];
          for (const e of enemies) {
            if (Math.hypot(e.x - player.x, e.y - player.y) < Math.hypot(nearest.x - player.x, nearest.y - player.y)) nearest = e;
          }
          shootAt(nearest.x, nearest.y);
        }
      }
      player.x = Math.max(player.r, Math.min(W - player.r, player.x));
      player.y = Math.max(player.r, Math.min(H - player.r, player.y));

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

        for (let j = bullets.length - 1; j >= 0; j--) {
          const b = bullets[j];
          const dx = b.x - e.x, dy = b.y - e.y;
          if (dx * dx + dy * dy < (e.r + 3) * (e.r + 3)) {
            addParticles(e.x, e.y, CLR.killParticle, 8);
            enemies.splice(i, 1);
            bullets.splice(j, 1);
            score++;
            break;
          }
        }

        if (enemies[i] === e) {
          const dx = player.x - e.x, dy = player.y - e.y;
          if (dx * dx + dy * dy < (player.r + e.r) * (player.r + e.r)) {
            addParticles(player.x, player.y, CLR.deathParticle, 20);
            gameOver = true;
            saveBest();
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

    function drawBackground() {
      ctx.fillStyle = CLR.bg;
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = CLR.grid;
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    }

    function drawPlayer() {
      ctx.fillStyle = CLR.player;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
      ctx.fill();
    }

    function draw() {
      drawBackground();

      particles.forEach(p => {
        ctx.globalAlpha = Math.max(0, p.life / 35);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      drawPlayer();

      ctx.fillStyle = CLR.bullet;
      ctx.shadowColor = CLR.bulletGlow;
      ctx.shadowBlur = 8;
      bullets.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.shadowBlur = 0;

      enemies.forEach(e => {
        ctx.fillStyle = CLR.enemy;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = CLR.enemyEye;
        ctx.beginPath();
        ctx.arc(e.x - 2, e.y - 1, 1.5, 0, Math.PI * 2);
        ctx.arc(e.x + 2, e.y - 1, 1.5, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.fillStyle = CLR.score;
      ctx.font = '700 14px "Space Grotesk", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Score: ' + score, 10, 22);
      if (best > 0) {
        ctx.textAlign = 'right';
        ctx.fillStyle = '#8a8a8a';
        ctx.fillText('Best: ' + best, W - 10, 22);
      }

      if (gameOver) {
        ctx.fillStyle = 'rgba(8, 8, 8, 0.75)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = CLR.gameover;
        ctx.font = '700 26px "Space Grotesk", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Game Over', W / 2, H / 2 - 10);
        ctx.font = '500 14px "Space Grotesk", system-ui, sans-serif';
        ctx.fillStyle = CLR.score;
        ctx.fillText((isNewBest ? 'New best! ' : '') + 'Score: ' + score, W / 2, H / 2 + 16);
        ctx.fillStyle = '#737373';
        ctx.font = '400 12px "Space Grotesk", system-ui, sans-serif';
        ctx.fillText((isTouchDevice ? 'Tap' : 'Click') + ' to restart', W / 2, H / 2 + 38);
      }
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
      startBtn.classList.add('hidden');
      running = true;
      lastTime = performance.now();
      rafId = requestAnimationFrame(loop);
    }

    // Stop the loop when the card closes so it doesn't keep burning CPU in the background
    function stopGame() {
      running = false;
      cancelAnimationFrame(rafId);
      clearKeys();
      initGame();
      drawIdle();
      startBtn.classList.remove('hidden');
    }

    startBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      startGame();
    });

    canvas.closest('.bento-card').addEventListener('bento:collapse', stopGame);

    window.addEventListener('resize', () => {
      resizeCanvas();
      if (running) draw(); else drawIdle();
    });

    // Draw idle state
    initGame();
    resizeCanvas();
    drawIdle();
  }
});
