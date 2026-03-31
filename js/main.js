document.addEventListener('DOMContentLoaded', () => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const palette = ['#ff6b9d', '#ffc800', '#2dd4bf', '#60a5fa', '#a78bfa', '#ff7170'];

  // --- Bento grid ---
  const bentoGrid = document.querySelector('.bento-grid');
  const bentoCards = document.querySelectorAll('.bento-card');
  const backBtn = document.querySelector('.bento-back');
  let expandedCard = null;
  let isAnimating = false;
  let savedRect = null; // store the card's grid position when expanding
  let savedMiniScale = null; // store the miniature scale for zoom-back

  const EXPAND_MS = 50;
  const COLLAPSE_MS = 450;

  // Calculate and apply miniature scale for each card
  function updateCardScales() {
    bentoCards.forEach(card => {
      if (card.classList.contains('bento-card--expanded')) return;
      const cardWidth = card.offsetWidth;
      const renderWidth = parseFloat(getComputedStyle(card).getPropertyValue('--content-render-width'));
      const scale = cardWidth / renderWidth;
      card.style.setProperty('--card-scale', scale);
    });
  }

  updateCardScales();
  window.addEventListener('resize', () => {
    if (!expandedCard) updateCardScales();
  });

  const ZOOM_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const ZOOM_TRANSITION = `top ${EXPAND_MS}ms ${ZOOM_EASING}, left ${EXPAND_MS}ms ${ZOOM_EASING}, width ${EXPAND_MS}ms ${ZOOM_EASING}, height ${EXPAND_MS}ms ${ZOOM_EASING}, border-radius ${EXPAND_MS}ms ${ZOOM_EASING}`;

  function expandCard(card) {
    if (expandedCard || isAnimating) return;
    isAnimating = true;
    expandedCard = card;

    // Save card's grid position so we can zoom back to it later
    const rect = card.getBoundingClientRect();
    savedRect = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };

    const renderWidth = parseFloat(getComputedStyle(card).getPropertyValue('--content-render-width'));
    savedMiniScale = rect.width / renderWidth;

    // Lock body scroll
    document.body.style.overflow = 'hidden';

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

    // 3. Apply transition inline, then set target values
    card.style.transition = ZOOM_TRANSITION;

    // 4. Force reflow so transition is registered before target changes
    card.offsetHeight;

    // 5. Set target — this triggers the smooth zoom-in
    card.style.top = '0';
    card.style.left = '0';
    card.style.width = '100vw';
    card.style.height = '100vh';
    card.style.borderRadius = '0';

    // 6. After zoom finishes, swap to expanded state (shows full content)
    const duration = prefersReducedMotion ? 0 : EXPAND_MS;
    setTimeout(() => {
      card.style.transition = '';
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

      backBtn.classList.add('bento-back--visible');
      isAnimating = false;
      card.scrollTop = 0;
    }, duration);
  }

  function collapseCard() {
    if (!expandedCard || isAnimating) return;
    isAnimating = true;
    const card = expandedCard;

    backBtn.classList.remove('bento-back--visible');

    // Show the rest of the grid behind so you see cards during zoom-out
    bentoGrid.classList.remove('bento-grid--has-expanded');

    const renderWidth = parseFloat(getComputedStyle(card).getPropertyValue('--content-render-width'));
    const fullScale = window.innerWidth / renderWidth;

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

    // 4. Animate back to saved grid position AND shrink content to mini scale
    card.style.top = savedRect.top + 'px';
    card.style.left = savedRect.left + 'px';
    card.style.width = savedRect.width + 'px';
    card.style.height = savedRect.height + 'px';
    card.style.borderRadius = 'var(--border-radius)';
    card.style.setProperty('--card-scale', savedMiniScale);

    const duration = prefersReducedMotion ? 0 : COLLAPSE_MS;
    setTimeout(() => {
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

      document.body.style.overflow = '';
      expandedCard = null;
      savedRect = null;
      isAnimating = false;

      updateCardScales();
    }, duration);
  }

  bentoCards.forEach(card => {
    card.addEventListener('click', (e) => {
      if (card.classList.contains('bento-card--expanded')) return;
      if (e.target.closest('a')) return;
      expandCard(card);
    });
  });

  backBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    collapseCard();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && expandedCard) {
      collapseCard();
    }
  });

  // --- Interactive color cycling on tags ---
  document.querySelectorAll('.tag').forEach(tag => {
    tag.addEventListener('click', (e) => {
      e.stopPropagation();
      const color = palette[Math.floor(Math.random() * palette.length)];
      tag.style.borderColor = color;
      tag.style.color = color;
      tag.style.transform = 'scale(1.1)';
      setTimeout(() => { tag.style.transform = ''; }, 200);
    });
  });

  // Stop link clicks from expanding card
  document.querySelectorAll('.bento-card a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  });

  // --- Mini Game ---
  const canvas = document.getElementById('mini-game');
  const startBtn = document.getElementById('game-start');
  if (canvas && startBtn) {
    const ctx = canvas.getContext('2d');
    const W = 400, H = 300;
    let running = false;
    let player, bullets, enemies, particles, score, spawnTimer, gameOver;
    const keys = {};

    const CLR = {
      bg: '#080808',
      grid: 'rgba(255,255,255,0.015)',
      player: '#ffffff',
      bullet: '#ffffff',
      bulletGlow: '#ffffff',
      enemy: '#555555',
      enemyEye: '#080808',
      killParticle: '#aaaaaa',
      deathParticle: '#ffffff',
      text: '#d4d4d4',
      score: '#ffffff',
      gameover: '#ffffff'
    };

    function initGame() {
      player = { x: W / 2, y: H / 2, r: 8, speed: 2.5 };
      bullets = [];
      enemies = [];
      particles = [];
      score = 0;
      spawnTimer = 0;
      gameOver = false;
    }

    function getMousePos(e) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (W / rect.width),
        y: (e.clientY - rect.top) * (H / rect.height)
      };
    }

    canvas.addEventListener('click', (e) => {
      if (!running || gameOver) return;
      e.preventDefault();
      e.stopPropagation();
      const m = getMousePos(e);
      const angle = Math.atan2(m.y - player.y, m.x - player.x);
      bullets.push({
        x: player.x, y: player.y,
        vx: Math.cos(angle) * 5,
        vy: Math.sin(angle) * 5,
        life: 80
      });
    });

    document.addEventListener('keydown', (e) => { if (running) keys[e.key.toLowerCase()] = true; });
    document.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

    function spawnEnemy() {
      const side = Math.random() * 4 | 0;
      let x, y;
      if (side === 0) { x = Math.random() * W; y = -10; }
      else if (side === 1) { x = W + 10; y = Math.random() * H; }
      else if (side === 2) { x = Math.random() * W; y = H + 10; }
      else { x = -10; y = Math.random() * H; }
      const speed = 0.8 + Math.random() * 0.8 + score * 0.01;
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

    function update() {
      if (keys['w'] || keys['arrowup']) player.y -= player.speed;
      if (keys['s'] || keys['arrowdown']) player.y += player.speed;
      if (keys['a'] || keys['arrowleft']) player.x -= player.speed;
      if (keys['d'] || keys['arrowright']) player.x += player.speed;
      player.x = Math.max(player.r, Math.min(W - player.r, player.x));
      player.y = Math.max(player.r, Math.min(H - player.r, player.y));

      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx; b.y += b.vy; b.life--;
        if (b.life <= 0 || b.x < -10 || b.x > W + 10 || b.y < -10 || b.y > H + 10)
          bullets.splice(i, 1);
      }

      spawnTimer++;
      const spawnRate = Math.max(30, 90 - score * 2);
      if (spawnTimer >= spawnRate) { spawnEnemy(); spawnTimer = 0; }

      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        const angle = Math.atan2(player.y - e.y, player.x - e.x);
        e.x += Math.cos(angle) * e.speed;
        e.y += Math.sin(angle) * e.speed;

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

        if (enemies[i]) {
          const dx = player.x - e.x, dy = player.y - e.y;
          if (dx * dx + dy * dy < (player.r + e.r) * (player.r + e.r)) {
            addParticles(player.x, player.y, CLR.deathParticle, 20);
            gameOver = true;
          }
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy; p.life--;
        p.vx *= 0.96; p.vy *= 0.96;
        if (p.life <= 0) particles.splice(i, 1);
      }
    }

    function draw() {
      ctx.fillStyle = CLR.bg;
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = CLR.grid;
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      particles.forEach(p => {
        ctx.globalAlpha = p.life / 35;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      ctx.fillStyle = CLR.player;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
      ctx.fill();

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

      if (gameOver) {
        ctx.fillStyle = 'rgba(8, 8, 8, 0.75)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = CLR.gameover;
        ctx.font = '700 26px "Space Grotesk", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Game Over', W / 2, H / 2 - 10);
        ctx.font = '500 14px "Space Grotesk", system-ui, sans-serif';
        ctx.fillStyle = CLR.score;
        ctx.fillText('Score: ' + score, W / 2, H / 2 + 16);
        ctx.fillStyle = '#737373';
        ctx.font = '400 12px "Space Grotesk", system-ui, sans-serif';
        ctx.fillText('Click to restart', W / 2, H / 2 + 38);
      }
    }

    function loop() {
      if (!running) return;
      if (!gameOver) update();
      draw();
      requestAnimationFrame(loop);
    }

    function startGame() {
      initGame();
      startBtn.classList.add('hidden');
      running = true;
      loop();
    }

    startBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      startGame();
    });

    canvas.addEventListener('click', (e) => {
      if (gameOver && running) {
        e.stopPropagation();
        initGame();
        loop();
      }
    });

    // Draw idle state
    initGame();
    ctx.fillStyle = CLR.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = CLR.grid;
    for (let x = 0; x < W; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.fillStyle = CLR.player;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 8, 0, Math.PI * 2);
    ctx.fill();
  }
});
