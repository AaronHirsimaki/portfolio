// Cat Mayhem, roguelike edition: a turn-based ASCII version of the Cat Mayhem demo that runs inside
// the terminal window (./catmayhem). Exposes CatMayhemRogue.start(host, { onExit, sound, reducedMotion }).
window.CatMayhemRogue = (() => {
  const W = 40, H = 16;
  const MAX_HP = 3, MAX_MICE = 25;
  const BEST_KEY = 'catMayhemRogueBest';

  // Key → direction. Arrows, WASD, vi keys (with yubn diagonals) and the numpad
  const DIRS = {
    arrowup: [0, -1], arrowdown: [0, 1], arrowleft: [-1, 0], arrowright: [1, 0],
    w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
    k: [0, -1], j: [0, 1], h: [-1, 0], l: [1, 0], y: [-1, -1], u: [1, -1], b: [-1, 1], n: [1, 1],
    8: [0, -1], 2: [0, 1], 4: [-1, 0], 6: [1, 0], 7: [-1, -1], 9: [1, -1], 1: [-1, 1], 3: [1, 1]
  };
  const NEIGHBOURS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
  const ARROWS = { '0,-1': '↑', '0,1': '↓', '-1,0': '←', '1,0': '→', '-1,-1': '↖', '1,-1': '↗', '-1,1': '↙', '1,1': '↘' };
  const TILE_CLASS = { '#': 'rg-wall', '.': 'rg-floor', '"': 'rg-grass', '&': 'rg-bush', 'O': 'rg-rock' };
  const BLOCKERS = { '#': 'There is a wall in the way.', '&': 'The bush is too thick to get through.', 'O': 'A rock blocks the way.' };

  const rand = (n) => Math.floor(Math.random() * n);
  const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function start(host, { onExit, sound = () => {}, reducedMotion = false }) {
    let best = 0;
    try { best = Number(localStorage.getItem(BEST_KEY)) || 0; } catch { /* storage unavailable */ }

    // --- World ---
    const tiles = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const edge = x === 0 || y === 0 || x === W - 1 || y === H - 1;
        tiles.push(edge ? '#' : Math.random() < 0.06 ? '"' : '.');
      }
    }
    const cat = { x: W >> 1, y: H >> 1, hp: MAX_HP, face: [1, 0] };
    // Scatter rocks and bushes, keeping the middle and the ring next to the walls clear
    // (mice come in along that ring, and it keeps every part of the map reachable)
    for (let i = 0; i < 14; i++) {
      const x = 3 + rand(W - 6), y = 3 + rand(H - 6);
      if (cheb({ x, y }, cat) < 4) continue;
      const ch = Math.random() < 0.5 ? '&' : 'O';
      tiles[y * W + x] = ch;
      if (Math.random() < 0.5 && x + 1 < W - 3) tiles[y * W + x + 1] = ch;
    }

    const mice = [];
    const corpses = new Set();
    let catnip = null;
    let turn = 0, kills = 0;
    let msgs = ['Welcome to Cat Mayhem! The mice are coming. Survive.'];
    let armed = false, busy = false, over = false, overAt = 0, newBest = false;
    let trail = null; // shot animation: Map of tile index → character

    const tileAt = (x, y) => tiles[y * W + x];
    const blocked = (x, y) => Object.hasOwn(BLOCKERS, tileAt(x, y));
    const mouseAt = (x, y) => mice.find(m => m.x === x && m.y === y);
    const free = (x, y) => !blocked(x, y) && !mouseAt(x, y) && !(cat.x === x && cat.y === y);
    const mouseName = (m) => (m.dark ? 'big mouse' : 'mouse');

    function spawnMouse() {
      if (mice.length >= MAX_MICE) return;
      for (let tries = 0; tries < 30; tries++) {
        const side = rand(4);
        const x = side < 2 ? 1 + rand(W - 2) : side === 2 ? 1 : W - 2;
        const y = side < 2 ? (side === 0 ? 1 : H - 2) : 1 + rand(H - 2);
        if (free(x, y) && cheb({ x, y }, cat) >= 6) {
          const dark = Math.random() < 0.3;
          mice.push({ x, y, dark, hp: dark ? 2 : 1 });
          return;
        }
      }
    }

    function placeCatnip() {
      for (let tries = 0; tries < 30; tries++) {
        const x = 1 + rand(W - 2), y = 1 + rand(H - 2);
        if (free(x, y) && cheb({ x, y }, cat) >= 4) {
          catnip = { x, y };
          return;
        }
      }
    }

    spawnMouse();
    spawnMouse();

    // --- Screen ---
    const el = document.createElement('div');
    el.className = 'rg';
    el.tabIndex = 0;
    el.setAttribute('role', 'application');
    el.setAttribute('aria-label', 'Cat Mayhem, roguelike edition. Arrow keys move, space fires, Q quits.');
    el.innerHTML =
      '<div class="rg__title">CAT MAYHEM <span class="rg-dim">// roguelike edition</span></div>' +
      '<div class="rg__msg" aria-live="polite"></div>' +
      '<div class="rg__map" aria-hidden="true"></div>' +
      '<div class="rg__status"></div>' +
      '<div class="rg__help rg-dim">arrows/hjkl move · bump attacks · space/shift+dir fire · q quit</div>' +
      '<div class="rg__pad">' +
      [['y', '↖'], ['k', '↑'], ['u', '↗'], ['h', '←'], ['.', '·'], ['l', '→'], ['b', '↙'], ['j', '↓'], ['n', '↘']]
        .map(([k, label]) => `<button type="button" class="btn" tabindex="-1" data-key="${k}">${label}</button>`).join('') +
      '<button type="button" class="btn rg__fire" tabindex="-1" data-key="f" aria-pressed="false">Fire</button>' +
      '<button type="button" class="btn rg__quit" tabindex="-1" data-key="q">Quit</button>' +
      '</div>';
    host.append(el);
    const msgEl = el.querySelector('.rg__msg');
    const mapEl = el.querySelector('.rg__map');
    const statusEl = el.querySelector('.rg__status');
    const fireBtn = el.querySelector('.rg__fire');

    function cell(x, y) {
      const i = y * W + x;
      if (trail?.has(i)) return [trail.get(i), 'rg-shot'];
      if (cat.x === x && cat.y === y) return ['@', over ? 'rg-dead' : 'rg-cat'];
      const m = mouseAt(x, y);
      if (m) return [m.dark ? 'M' : 'm', m.dark ? (m.hp < 2 ? 'rg-hurt' : 'rg-big') : 'rg-mouse'];
      if (catnip && catnip.x === x && catnip.y === y) return ['!', 'rg-nip'];
      if (corpses.has(i)) return ['%', 'rg-corpse'];
      const t = tiles[i];
      return [t, TILE_CLASS[t]];
    }

    // One span per run of same-coloured characters keeps the DOM small
    function render() {
      let html = '';
      for (let y = 0; y < H; y++) {
        let run = '', runCls = null;
        for (let x = 0; x < W; x++) {
          const [ch, cls] = cell(x, y);
          if (cls !== runCls) {
            if (run) html += `<span class="${runCls}">${esc(run)}</span>`;
            run = '';
            runCls = cls;
          }
          run += ch;
        }
        html += `<span class="${runCls}">${esc(run)}</span>\n`;
      }
      mapEl.innerHTML = html;
      msgEl.textContent = msgs.join(' ') || ' ';
      const hearts = '♥'.repeat(cat.hp) + '♡'.repeat(MAX_HP - cat.hp);
      statusEl.innerHTML = `HP: <span class="rg-hp">${hearts}</span>  Kills: ${kills}  Turn: ${turn}  Best: ${best}  ` +
        (armed ? '<span class="rg-shot">Fire which way?</span>' : `Aim: ${ARROWS[cat.face]}`);
      fireBtn.setAttribute('aria-pressed', String(armed));
    }

    // --- Turns ---
    function hitMouse(m, verb) {
      m.hp--;
      if (m.hp > 0) {
        msgs.push(`${verb} the ${mouseName(m)}. It squeaks angrily.`);
        return;
      }
      mice.splice(mice.indexOf(m), 1);
      corpses.add(m.y * W + m.x);
      kills++;
      msgs.push(`${verb} the ${mouseName(m)}. It dies.`);
      sound('hit');
    }

    function moveMouse(m) {
      if (cheb(m, cat) <= 1) {
        cat.hp--;
        msgs.push(`The ${mouseName(m)} bites you!`);
        return;
      }
      // Greedy chase: the free neighbouring tile that gets closest to the cat
      let bestStep = null, bestScore = cheb(m, cat) * 100 + (m.x - cat.x) ** 2 + (m.y - cat.y) ** 2;
      for (const [dx, dy] of NEIGHBOURS) {
        const p = { x: m.x + dx, y: m.y + dy };
        if (!free(p.x, p.y)) continue;
        const score = cheb(p, cat) * 100 + (p.x - cat.x) ** 2 + (p.y - cat.y) ** 2;
        if (score < bestScore) {
          bestScore = score;
          bestStep = p;
        }
      }
      if (bestStep) {
        m.x = bestStep.x;
        m.y = bestStep.y;
      }
    }

    function endTurn() {
      turn++;
      // Big mice are slow: they only act every other turn
      for (const m of [...mice]) if (!m.dark || turn % 2 === 0) moveMouse(m);
      if (cat.hp <= 0) {
        cat.hp = 0;
        over = true;
        overAt = Date.now();
        msgs.push('You die... Press any key.');
        sound('gameover');
        saveBest();
      } else {
        const every = Math.max(2, 6 - Math.floor(turn / 25)); // the swarm grows over time
        if (turn % every === 0) spawnMouse();
        if (!catnip && turn % 30 === 0) placeCatnip();
      }
      busy = false;
      render();
    }

    function fire([dx, dy]) {
      cat.face = [dx, dy];
      sound('shoot');
      const shot = new Map();
      const ch = dx === 0 ? '|' : dy === 0 ? '-' : dx === dy ? '\\' : '/';
      let x = cat.x, y = cat.y, hit = false;
      for (;;) {
        x += dx;
        y += dy;
        if (blocked(x, y)) break;
        const m = mouseAt(x, y);
        if (m) {
          hitMouse(m, 'You shoot');
          hit = true;
          break;
        }
        shot.set(y * W + x, ch);
      }
      if (!hit) msgs.push('Your shot misses.');
      if (reducedMotion || !shot.size) return endTurn();
      busy = true;
      trail = shot;
      render();
      setTimeout(() => {
        trail = null;
        endTurn();
      }, 90);
    }

    function move([dx, dy]) {
      cat.face = [dx, dy];
      const x = cat.x + dx, y = cat.y + dy;
      const m = mouseAt(x, y);
      if (m) {
        hitMouse(m, 'You scratch');
        return endTurn();
      }
      if (blocked(x, y)) {
        msgs.push(BLOCKERS[tileAt(x, y)]); // bumping into scenery doesn't cost a turn
        return render();
      }
      cat.x = x;
      cat.y = y;
      if (catnip && catnip.x === x && catnip.y === y) {
        catnip = null;
        if (cat.hp < MAX_HP) {
          cat.hp++;
          msgs.push('You eat the catnip. You feel much better.');
        } else {
          msgs.push('You roll around in the catnip. Purrfect.');
        }
      }
      endTurn();
    }

    function saveBest() {
      if (kills <= best) return;
      best = kills;
      newBest = true;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch { /* storage unavailable */ }
    }

    function finish(quit) {
      saveBest();
      el.removeEventListener('keydown', onKey);
      el.remove();
      onExit({ quit, kills, turns: turn, best, newBest });
    }

    // Returns false for keys the game doesn't use, so they keep working normally (Tab, shortcuts)
    function handle(key, shift) {
      if (over) {
        if (Date.now() - overAt > 400) finish(false); // a short pause so a held key doesn't skip the ending
        return true;
      }
      if (key === 'q' || key === 'escape') {
        finish(true);
        return true;
      }
      if (busy) return true;
      msgs = [];
      if (key === 'f') {
        armed = !armed;
        render();
        return true;
      }
      if (key === ' ') {
        armed = false;
        fire(cat.face);
        return true;
      }
      if (key === '.' || key === '5' || key === 'z') {
        armed = false;
        msgs.push('You wait.');
        endTurn();
        return true;
      }
      if (!Object.hasOwn(DIRS, key)) return false;
      if (shift || armed) {
        armed = false;
        fire(DIRS[key]);
      } else {
        move(DIRS[key]);
      }
      return true;
    }

    function onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (handle(e.key.toLowerCase(), e.shiftKey)) {
        e.preventDefault();
        e.stopPropagation(); // keeps Escape from closing the terminal window
      }
    }

    el.addEventListener('keydown', onKey);
    const pad = el.querySelector('.rg__pad');
    pad.addEventListener('pointerdown', (e) => e.preventDefault()); // keep keyboard focus on the game
    pad.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-key]');
      if (btn) handle(btn.dataset.key, false);
    });

    render();
    return { focus: () => el.focus({ preventScroll: true }) };
  }

  return { start };
})();
