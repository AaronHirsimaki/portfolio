// Terminal window: a small bash-like shell. Its files are read from the other windows when the page
// loads, so the terminal always shows the same content as the rest of the site.
document.addEventListener('DOMContentLoaded', () => {
  const win = document.getElementById('terminal');
  if (!win) return;
  const term = document.getElementById('term');
  const out = document.getElementById('term-output');
  const form = document.getElementById('term-form');
  const input = document.getElementById('term-input');
  const promptEl = document.getElementById('term-prompt');
  const finePointer = window.matchMedia('(pointer: fine)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const USER = 'aaron', HOST = 'portfolio', HOME = ['home', 'aaron'];
  const pageLoaded = Date.now();

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const pad2 = (n) => String(n).padStart(2, '0');

  // Visible text with whitespace collapsed; <br> becomes a line break
  function textOf(el) {
    if (!el) return '';
    const copy = el.cloneNode(true);
    copy.querySelectorAll('br').forEach(br => br.replaceWith('\u0000'));
    return copy.textContent.replace(/\s+/g, ' ').trim().replace(/ ?\u0000 ?/g, '\n');
  }

  // A line is a string or an array of parts; a part is a string or { t, cls, href, open, run }
  const hl = (t) => ({ t, cls: 'term__h' });
  const dim = (t) => ({ t, cls: 'term__dim' });
  const link = (t, href) => ({ t, href });
  const lineText = (l) => (typeof l === 'string' ? l : l.map(p => (typeof p === 'string' ? p : p.t)).join(''));

  // --- Files, built from the windows ---
  const about = [];
  $$('#about .about__text p').forEach((p, i) => {
    if (i) about.push('');
    about.push(...textOf(p).split('\n'));
  });

  const experience = [];
  $$('#about .journey > article').forEach((article, i) => {
    if (i) experience.push('');
    for (const el of article.children) {
      if (el.matches('.groupbox__legend')) experience.push([hl(`== ${textOf(el)} ==`)]);
      else if (el.matches('h4')) {
        if (el.matches('.journey__title--next')) experience.push('');
        experience.push([{ t: textOf(el), cls: 'term__b' }]);
      } else if (el.matches('.journey__meta')) experience.push([dim(textOf(el))]);
      else if (el.matches('ul')) $$('li', el).forEach(li => experience.push('  * ' + textOf(li)));
      else if (el.matches('.tags')) experience.push([dim('tags: ' + $$('.tag', el).map(textOf).join(', '))]);
      else experience.push(textOf(el));
    }
  });

  const projects = {};
  $$('#projects .project').forEach(article => {
    const title = textOf($('.project__title', article));
    const lines = [[hl('# ' + title)], [dim(textOf($('.project__type', article)))], ''];
    for (const el of $$('p, .bullets, .tags, .project__links', article)) {
      if (el.matches('.project__type')) continue;
      if (el.matches('.bullets')) {
        $$('li', el).forEach(li => lines.push('  * ' + textOf(li)));
        lines.push('');
      } else if (el.matches('.tags')) {
        lines.push([dim('tags: ' + $$('.tag', el).map(textOf).join(', '))]);
      } else if (el.matches('.project__links')) {
        $$('a', el).forEach(a => lines.push(a.dataset.open
          ? ['-> ', { t: textOf(a), open: a.dataset.open }]
          : ['-> ', link(`${textOf(a)}: ${a.href.replace(/^https?:\/\//, '')}`, a.href)]));
      } else {
        lines.push(textOf(el), '');
      }
    }
    const shots = $$('.project__image', article).length;
    if (shots) lines.push(['-> ', { t: `${shots} screenshot${shots > 1 ? 's' : ''} in the Projects window`, open: 'projects' }]);
    projects[title.replace(/\s+/g, '')] = { dir: true, win: 'projects', children: { 'README.md': { lines, win: 'projects' } } };
  });

  const skills = [];
  $$('#skills .groupbox').forEach((group, i) => {
    if (i) skills.push('');
    skills.push([hl(textOf($('.groupbox__legend', group)))]);
    skills.push('  ' + $$('.skill', group).map(textOf).join(' · '));
  });

  const contact = [textOf($('#contact .contact__intro')), ''];
  $$('#contact .contact-link').forEach(a => contact.push([
    hl(textOf($('.contact-link__label', a)).padEnd(10)),
    link(textOf($('.contact-link__value', a)), a.href)
  ]));

  const bashrc = [
    [dim('# ~/.bashrc')],
    "alias ll='ls -l'",
    "alias hire='contact'",
    "alias cv='open ~/cv.pdf'",
    "export PS1='\\u@\\h:\\w\\$ '"
  ];

  const homeDir = {
    dir: true,
    children: {
      '.bashrc': { lines: bashrc },
      'about.txt': { lines: about, win: 'about' },
      'catmayhem': { exec: true, binary: true, size: 31337 },
      'contact.txt': { lines: contact, win: 'contact' },
      'experience.txt': { lines: experience, win: 'about' },
      'projects': { dir: true, win: 'projects', children: projects },
      'skills.txt': { lines: skills, win: 'skills' }
    }
  };
  const cvHref = $('#welcome .btn--cv')?.getAttribute('href');
  if (cvHref) {
    const cv = { href: cvHref, binary: true, size: 0 };
    homeDir.children['cv.pdf'] = cv;
    fetch(cvHref, { method: 'HEAD' })
      .then(r => { cv.size = Number(r.headers.get('content-length')) || 0; })
      .catch(() => { /* size just stays 0 */ });
  }
  const root = { dir: true, children: { home: { dir: true, children: { aaron: homeDir } } } };
  const WINDOWS = $$('.window').map(w => w.id);

  // --- Paths ---
  let cwd = [...HOME];

  function resolve(path) {
    const parts = path.startsWith('/') ? [] : path.startsWith('~') ? [...HOME] : [...cwd];
    for (const seg of path.replace(/^~/, '').split('/')) {
      if (!seg || seg === '.') continue;
      if (seg === '..') parts.pop();
      else parts.push(seg);
    }
    return parts;
  }

  // Exact names first, then case-insensitive so "cat Projects/canban/readme.md" still works
  function lookup(parts) {
    let node = root;
    const real = [];
    for (const seg of parts) {
      if (!node.dir) return null;
      const key = Object.hasOwn(node.children, seg) ? seg
        : Object.keys(node.children).find(k => k.toLowerCase() === seg.toLowerCase());
      if (!key) return null;
      node = node.children[key];
      real.push(key);
    }
    return { node, path: real };
  }

  function display(parts) {
    const abs = '/' + parts.join('/');
    const home = '/' + HOME.join('/');
    if (abs === home) return '~';
    return abs.startsWith(home + '/') ? '~' + abs.slice(home.length) : abs;
  }

  // Sorted like ls in a normal locale: case doesn't matter, leading dots are ignored
  const byName = (a, b) => a.replace(/^\./, '').localeCompare(b.replace(/^\./, ''), 'en', { sensitivity: 'base' });

  const byteSize = (node) => node.dir ? 4096
    : node.binary ? node.size
      : new TextEncoder().encode(node.lines.map(lineText).join('\n') + '\n').length;

  // ls entry: directories list themselves when clicked, files print (or open) themselves
  const entry = (name, node, path) => node.dir
    ? { t: name + '/', cls: 'term__dir', run: 'ls ' + display(path) }
    : node.exec ? { t: name + '*', cls: 'term__exec', run: './' + name }
      : { t: name, cls: node.binary ? 'term__bin' : '', run: (node.binary ? 'open ' : 'cat ') + display(path) };

  // --- Output ---
  // Lines are queued and revealed one by one for a printing feel; any key press shows the rest at once
  const queue = [];
  let timer = null;

  function render(line) {
    const row = document.createElement('div');
    row.className = 'term__row';
    for (const p of [].concat(line)) {
      if (typeof p === 'string') {
        row.append(p);
        continue;
      }
      let el;
      if (p.href || p.open || p.run) {
        el = document.createElement('a');
        if (p.href) {
          el.href = p.href;
          if (!p.href.startsWith('mailto:')) {
            el.target = '_blank';
            el.rel = 'noopener noreferrer';
          }
        } else if (p.open) {
          el.href = '#' + p.open;
          el.dataset.open = p.open; // handled by the desktop's window manager
        } else {
          el.href = '#terminal';
          el.dataset.run = p.run;
          el.classList.add('term__run');
        }
      } else {
        el = document.createElement('span');
      }
      if (p.cls) el.classList.add(...p.cls.split(' '));
      el.textContent = p.t;
      row.append(el);
    }
    return row;
  }

  const scrollDown = () => { term.scrollTop = term.scrollHeight; };

  function flush() {
    clearTimeout(timer);
    timer = null;
    out.append(...queue.splice(0));
    scrollDown();
  }

  function print(...lines) {
    queue.push(...lines.map(render));
    if (reducedMotion) return flush();
    if (timer) return;
    const step = () => {
      const row = queue.shift();
      if (!row) {
        timer = null;
        return;
      }
      out.append(row);
      scrollDown();
      timer = setTimeout(step, 12);
    };
    step();
  }

  const err = (...msgs) => print(...msgs.map(m => [{ t: m, cls: 'term__err' }]));

  const promptParts = () => [{ t: `${USER}@${HOST}`, cls: 'term__user' }, ':', { t: display(cwd), cls: 'term__path' }, '$ '];

  function updatePrompt() {
    promptEl.replaceChildren(...render(promptParts()).childNodes);
  }

  function clearScreen() {
    queue.length = 0;
    flush();
    out.replaceChildren();
  }

  // Linux date style: "Fri Nov  6 14:02:11 2026", optionally with the time zone before the year
  function stamp(d, withZone) {
    const day = d.toLocaleString('en-US', { weekday: 'short' });
    const month = d.toLocaleString('en-US', { month: 'short' });
    const zone = withZone ? ' ' + d.toLocaleString('en-US', { timeZoneName: 'short' }).split(' ').pop() : '';
    return `${day} ${month} ${String(d.getDate()).padStart(2)} ` +
      `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}${zone} ${d.getFullYear()}`;
  }

  // --- Commands ---
  const HELP = [
    ['ls [dir]', 'list files (-l for details, -a for hidden ones)'],
    ['cd <dir>', 'change directory'],
    ['cat <file>', 'print a file'],
    ['tree', 'show every file'],
    ['open <name>', 'open a file or window (cv.pdf, projects, ...)'],
    ['./catmayhem', 'play Cat Mayhem, roguelike style'],
    ['neofetch', 'system info, except the system is me'],
    ['whoami', 'who you are talking to'],
    ['contact', 'how to reach me'],
    ['history', 'commands you have run'],
    ['clear', 'clear the screen (Ctrl+L)'],
    ['exit', 'close the terminal']
  ];

  const FORTUNES = [
    ['Talk is cheap. Show me the code.', 'Linus Torvalds'],
    ['Programs must be written for people to read, and only incidentally for machines to execute.', 'Harold Abelson'],
    ['Premature optimization is the root of all evil.', 'Donald Knuth'],
    ['There are only two hard things in Computer Science: cache invalidation and naming things.', 'Phil Karlton'],
    ['It works on my machine.', 'every developer, at least once']
  ];

  const TUX = ['    .--.', '   |o_o |', '   |:_/ |', '  //   \\ \\', ' (|     | )', "/'\\_   _/`\\", '\\___)=(___/'];

  const openWindow = (id) => document.dispatchEvent(new CustomEvent('desktop:open', { detail: id }));

  const editor = (name) => () => print(`${name}: there's no editor in this shell, so nobody gets stuck trying to quit it.`,
    [dim("Use 'cat' to read files.")]);

  const notArch = (name) => () => {
    err(`bash: ${name}: command not found`);
    print([dim('This is an Arch-based household. Try pacman.')]);
  };

  const COMMANDS = {
    help() {
      print('Commands:');
      HELP.forEach(([cmd, desc]) => print(['  ', { t: cmd.padEnd(14), run: cmd.split(' ')[0] }, desc]));
      print('', ['Try: ', { t: 'cat about.txt', run: 'cat about.txt' }, ' · ', { t: 'ls projects', run: 'ls projects' },
        ' · ', { t: 'open cv.pdf', run: 'open cv.pdf' }],
      [dim('Tab completes, Up/Down browse history. There may be a few hidden commands.')]);
    },

    ls(args) {
      const flags = args.filter(a => a.startsWith('-')).join('');
      const targets = args.filter(a => !a.startsWith('-'));
      const long = flags.includes('l'), all = flags.includes('a');
      const modified = new Date(document.lastModified);
      const mtime = `${modified.toLocaleString('en-US', { month: 'short' })} ${String(modified.getDate()).padStart(2)} ` +
        `${pad2(modified.getHours())}:${pad2(modified.getMinutes())}`;
      (targets.length ? targets : ['.']).forEach((target, i) => {
        const found = lookup(resolve(target));
        if (!found) return err(`ls: cannot access '${target}': No such file or directory`);
        if (targets.length > 1) print(...(i ? [''] : []), [hl(target + ':')]);
        const entries = found.node.dir
          ? Object.keys(found.node.children).filter(n => all || !n.startsWith('.')).sort(byName)
            .map(n => [n, found.node.children[n], [...found.path, n]])
          : [[found.path.at(-1), found.node, found.path]];
        if (long) {
          entries.forEach(([n, node, path]) => print([
            dim(`${node.dir ? 'drwxr-xr-x 2' : node.exec ? '-rwxr-xr-x 1' : '-rw-r--r-- 1'} ${USER} ${USER} ${String(byteSize(node)).padStart(6)} ${mtime} `),
            entry(n, node, path)
          ]));
        } else if (entries.length) {
          print(entries.flatMap(([n, node, path], j) => (j ? ['  '] : []).concat(entry(n, node, path))));
        }
      });
    },

    cd(args) {
      const target = args[0] ?? '~';
      const found = lookup(resolve(target));
      if (!found) return err(`bash: cd: ${target}: No such file or directory`);
      if (!found.node.dir) return err(`bash: cd: ${target}: Not a directory`);
      cwd = found.path;
    },

    pwd: () => print('/' + cwd.join('/')),

    cat(args) {
      if (!args.length) return print(['Usage: cat <file>. Try ', { t: 'cat about.txt', run: 'cat about.txt' }]);
      for (const a of args) {
        const found = lookup(resolve(a));
        if (!found) err(`cat: ${a}: No such file or directory`);
        else if (found.node.dir) err(`cat: ${a}: Is a directory`);
        else if (found.node.exec) print([`cat: ${a}: binary file, try running it: `, { t: './' + found.path.at(-1), run: './' + found.path.at(-1) }]);
        else if (found.node.binary) print([`cat: ${a}: binary file, try `, { t: 'open ' + a, run: 'open ' + a }]);
        else print(...found.node.lines);
      }
    },

    tree(args) {
      const top = lookup(resolve(args[0] ?? '.'));
      if (!top) return err(`${args[0]} [error opening dir]`);
      if (!top.node.dir) return print(args[0]);
      let dirs = 0, files = 0;
      print([{ t: args[0] ?? '.', cls: 'term__dir' }]);
      const walk = (node, path, indent) => {
        const names = Object.keys(node.children).filter(n => !n.startsWith('.')).sort(byName);
        names.forEach((n, i) => {
          const last = i === names.length - 1;
          const child = node.children[n];
          print([indent + (last ? '└── ' : '├── '), { ...entry(n, child, [...path, n]), t: n }]);
          if (child.dir) {
            dirs++;
            walk(child, [...path, n], indent + (last ? '    ' : '│   '));
          } else files++;
        });
      };
      walk(top.node, top.path, '');
      print('', `${dirs} director${dirs === 1 ? 'y' : 'ies'}, ${files} file${files === 1 ? '' : 's'}`);
    },

    open(args) {
      const target = args[0];
      if (!target) return print('Usage: open <file|window>', [dim('windows: ' + WINDOWS.join(', '))]);
      const found = lookup(resolve(target));
      if (found?.node.href) {
        window.open(found.node.href, '_blank', 'noopener');
        return print(`Opening ${found.path.at(-1)}...`);
      }
      const id = found?.node.win || WINDOWS.find(w => w === target.toLowerCase());
      if (!id) return err(`open: ${target}: No such file or window`);
      if (id === 'terminal') return print("You're already here.");
      openWindow(id);
    },

    catmayhem: () => playRogue(),

    neofetch() {
      const welcome = $('#welcome');
      const facts = $$('.welcome__facts li', welcome).map(textOf);
      const email = $('.welcome__facts a', welcome);
      const mins = Math.max(1, Math.round((Date.now() - pageLoaded) / 60000));
      const kv = (k, v) => [hl(k + ': '), v];
      const info = [
        [{ t: USER, cls: 'term__user' }, '@', { t: HOST, cls: 'term__user' }],
        '-'.repeat(USER.length + HOST.length + 1),
        kv('Name', textOf($('.welcome__name', welcome))),
        kv('Role', textOf($('.welcome__tagline', welcome))),
        kv('Stack', textOf($('.welcome__stack', welcome))),
        kv('Location', facts[0] ?? ''),
        kv('Languages', facts[1] ?? ''),
        kv('Status', textOf($('.welcome__status strong', welcome)) || 'Open to work'),
        email ? [hl('Email: '), link(textOf(email), email.href)] : '',
        kv('Shell', 'bash, sort of (vanilla JS)'),
        kv('Uptime', `${mins} min${mins === 1 ? '' : 's'}`),
        '',
        Array.from({ length: 8 }, (_, i) => ({ t: '   ', cls: `term__swatch term__bg${i}` }))
      ];
      for (let i = 0; i < Math.max(TUX.length, info.length); i++) {
        print([{ t: (TUX[i] ?? '').padEnd(14), cls: 'term__tux' }].concat(info[i] ?? ''));
      }
    },

    whoami: () => print(USER, [dim(`${textOf($('#welcome .welcome__tagline'))}. Try 'neofetch' for more.`)]),

    contact: () => print(...contact),

    history: () => cmdHistory.forEach((h, i) => print(`${String(i + 1).padStart(5)}  ${h}`)),

    clear: clearScreen,

    exit() {
      print('logout');
      setTimeout(() => {
        win.querySelector('.window__btn--close').click();
        clearScreen();
        cwd = [...HOME];
        started = false;
        updatePrompt();
      }, 300);
    },

    echo(args) {
      const env = { USER, HOME: '/' + HOME.join('/'), HOSTNAME: HOST, SHELL: '/bin/bash', PWD: '/' + cwd.join('/') };
      print(args.join(' ').replace(/\$(\w+)/g, (_, k) => env[k] ?? ''));
    },

    date: () => print(stamp(new Date(), true)),
    hostname: () => print(HOST),
    uname: (args) => print(args.includes('-a') ? `Linux ${HOST} 6.6.6-retro #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux` : 'Linux'),

    man(args) {
      if (!args.length) return print('What manual page do you want?', "For example, try 'man ls'.");
      const found = HELP.find(([cmd]) => cmd.split(' ')[0] === args[0]);
      if (!found) return print(`No manual entry for ${args[0]}`);
      print([{ t: found[0], cls: 'term__b' }], '    ' + found[1]);
    },

    sudo(args) {
      if (!args.length) return print('usage: sudo command');
      if (args[0] === 'hire') {
        print('[sudo] password for recruiter: ********', [{ t: 'Access granted. Good choice!', cls: 'term__ok' }]);
        setTimeout(() => openWindow('contact'), 700);
        return;
      }
      if (args[0] === 'rm' || args[0] === 'pacman') return COMMANDS[args[0]](args.slice(1), true);
      err(`${USER} is not in the sudoers file. This incident will be reported.`);
    },

    rm(args) {
      const target = args.find(a => !a.startsWith('-'));
      if (!target) return err('rm: missing operand');
      const recursive = args.some(a => /^-[a-z]*r/i.test(a));
      if (recursive && ['/', '/*', '~', '~/', '*'].includes(target)) {
        if (target.startsWith('/') && !args.includes('--no-preserve-root')) {
          return err(`rm: it is dangerous to operate recursively on '/'`, 'rm: use --no-preserve-root to override this failsafe');
        }
        return print(`removing ${target} ...`, '[##########          ]  50%', '[####################] 100%', '',
          [{ t: 'Nice try. Everything is still here: this portfolio is mounted read-only.', cls: 'term__ok' }]);
      }
      err(`rm: cannot remove '${target}': Read-only file system`);
    },

    pacman(args, asRoot) {
      const [op, ...pkgs] = args;
      if (!op?.startsWith('-')) return err('error: no operation specified (use -h for help)');
      if (!op.startsWith('-S')) return err(`error: invalid option '${op}'`);
      if (!asRoot) return err('error: you cannot perform this operation unless you are root.');
      if (!pkgs.length) {
        return print(':: Synchronizing package databases...', ' core is up to date', ' extra is up to date',
          ':: Starting full system upgrade...', ' there is nothing to do');
      }
      const pkg = pkgs.find(p => /aaron/i.test(p));
      if (!pkg) return err(`error: target not found: ${pkgs[0]}`);
      print('resolving dependencies...', 'looking for conflicting packages...', '',
        `Packages (1) ${pkg}-fullstack-dev-1.0-1`, '', 'Total Installed Size:  1 developer', '',
        ':: Proceed with installation? [Y/n] y', `(1/1) installing ${pkg}    [######################] 100%`,
        `Optional dependencies for ${pkg}`, '    your-team: somewhere to ship code [pending]',
        [':: Run ', { t: 'contact', run: 'contact' }, ' to finish the setup.']);
    },

    apt: notArch('apt'),
    'apt-get': notArch('apt-get'),
    dnf: notArch('dnf'),
    yum: notArch('yum'),
    vim: editor('vim'),
    nano: editor('nano'),
    emacs: editor('emacs'),

    cowsay(args) {
      const msg = args.join(' ') || 'Hire Aaron!';
      print(' ' + '_'.repeat(msg.length + 2), `< ${msg} >`, ' ' + '-'.repeat(msg.length + 2),
        '        \\   ^__^', '         \\  (oo)\\_______', '            (__)\\       )\\/\\',
        '                ||----w |', '                ||     ||');
    },

    fortune() {
      const [quote, who] = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
      print(quote, [dim('    -- ' + who)]);
    }
  };

  const ALIASES = { ll: 'ls -l', la: 'ls -a', hire: 'contact', cv: 'open ~/cv.pdf', 'xdg-open': 'open', vi: 'vim', nvim: 'vim', logout: 'exit' };

  const tokenize = (s) => [...s.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map(m => m[1] ?? m[2] ?? m[3]);

  function runOne(line) {
    let [name, ...args] = tokenize(line);
    if (Object.hasOwn(ALIASES, name)) [name, ...args] = [...tokenize(ALIASES[name]), ...args];
    if (Object.hasOwn(COMMANDS, name)) return COMMANDS[name](args);
    if (!name.includes('/')) return err(`bash: ${name}: command not found`);
    // A path: run it if it's executable
    const found = lookup(resolve(name));
    if (!found) err(`bash: ${name}: No such file or directory`);
    else if (found.node.dir) err(`bash: ${name}: Is a directory`);
    else if (!found.node.exec) err(`bash: ${name}: Permission denied`);
    else playRogue();
  }

  // --- Cat Mayhem, roguelike edition ---
  // Takes over the screen like a full-screen terminal app, then gives the scrollback back on exit
  let game = null;
  const quickBar = win.querySelector('.term__quick');

  function playRogue() {
    if (!window.CatMayhemRogue) return err('catmayhem: cannot execute binary file');
    if (game) return;
    flush();
    const scrollback = [...out.childNodes];
    const host = document.createElement('div');
    out.replaceChildren(host);
    form.hidden = true;
    quickBar.hidden = true;
    game = window.CatMayhemRogue.start(host, {
      reducedMotion,
      sound: (name) => document.dispatchEvent(new CustomEvent('desktop:sound', { detail: name })),
      onExit({ quit, kills, turns, best, newBest }) {
        game = null;
        out.replaceChildren(...scrollback);
        form.hidden = false;
        quickBar.hidden = false;
        const k = `${kills} kill${kills === 1 ? '' : 's'}`;
        if (quit) {
          print(`You quit after ${turns} turns with ${k}.`);
        } else {
          const center = (t) => '|' + t.padStart(Math.ceil((11 + t.length) / 2)).padEnd(11) + '|';
          print('        _______', '       /       \\', '      /  R.I.P  \\', '     ' + center(''), '     ' + center('the cat'),
            '     ' + center(k), '     ' + center(`turn ${turns}`), '   __|___________|__', '',
            `Eaten by mice on turn ${turns}, with ${k}.`);
        }
        print([dim(`Best: ${best} kills.`), ...(newBest ? [' ', { t: 'New best!', cls: 'term__ok' }] : [])],
          ['Play again: ', { t: './catmayhem', run: './catmayhem' }]);
        updatePrompt();
        focusInput();
      }
    });
    term.scrollTop = 0;
    game.focus();
  }

  const cmdHistory = [];
  let histPos = 0;

  function submit(cmdLine) {
    start();
    flush();
    out.append(render([...promptParts(), cmdLine]));
    if (cmdLine.trim()) cmdHistory.push(cmdLine);
    histPos = cmdHistory.length;
    cmdLine.split(/\s*(?:&&|;)\s*/).filter(c => c.trim()).forEach(runOne);
    updatePrompt();
    scrollDown();
  }

  // --- Tab completion: commands for the first word, paths after that ---
  function complete() {
    const words = input.value.split(' ');
    const last = words.at(-1);
    let base = '', prefix = last, options;
    if (words.length === 1 && !last.includes('/')) {
      options = Object.keys(COMMANDS).concat(Object.keys(ALIASES)).map(c => c + ' ');
    } else {
      const slash = last.lastIndexOf('/');
      base = last.slice(0, slash + 1);
      prefix = last.slice(slash + 1);
      const dir = lookup(resolve(base));
      if (!dir?.node.dir) return;
      options = Object.keys(dir.node.children)
        .filter(n => prefix.startsWith('.') || !n.startsWith('.'))
        .map(n => n + (dir.node.children[n].dir ? '/' : ' '));
    }
    const matches = options.filter(o => o.toLowerCase().startsWith(prefix.toLowerCase())).sort();
    if (!matches.length) return;
    let common = matches[0];
    for (const m of matches) {
      while (!m.toLowerCase().startsWith(common.toLowerCase())) common = common.slice(0, -1);
    }
    if (matches.length > 1 && common.length <= prefix.length) {
      flush();
      out.append(render([...promptParts(), input.value]));
      print(matches.map(m => m.trimEnd()).join('  '));
      return;
    }
    input.value = words.slice(0, -1).concat(base + common).join(' ');
  }

  // --- Session ---
  let started = false;

  function start() {
    if (started) return;
    started = true;
    const KEY = 'terminalLastLogin';
    let last = null;
    try {
      last = Number(localStorage.getItem(KEY)) || null;
      localStorage.setItem(KEY, String(Date.now()));
    } catch { /* storage unavailable */ }
    if (last) print(`Last login: ${stamp(new Date(last))} on tty1`);
    print(`Welcome to ${USER}@${HOST}. Everything on this site is also a file in here.`,
      ["Type 'help' or click one: ", { t: 'help', run: 'help' }, ' · ', { t: 'neofetch', run: 'neofetch' }, ' · ',
        { t: 'ls', run: 'ls' }, ' · ', { t: 'cat about.txt', run: 'cat about.txt' }], '');
    updatePrompt();
  }

  // Only grab the keyboard with a mouse; on phones the on-screen keyboard would cover the output
  function focusInput(force) {
    if (game) game.focus();
    else if (force || finePointer.matches) input.focus({ preventScroll: true });
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = input.value;
    input.value = '';
    submit(value);
  });

  input.addEventListener('keydown', (e) => {
    if (queue.length) flush();
    const key = e.key.toLowerCase();
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      histPos = Math.max(0, Math.min(cmdHistory.length, histPos + (e.key === 'ArrowUp' ? -1 : 1)));
      input.value = cmdHistory[histPos] ?? '';
      input.setSelectionRange(input.value.length, input.value.length);
    } else if (e.key === 'Tab' && input.value.trim()) {
      // An empty prompt lets Tab move focus on, so keyboard users can still leave the terminal
      e.preventDefault();
      complete();
    } else if (e.ctrlKey && key === 'l') {
      e.preventDefault();
      clearScreen();
    } else if (e.ctrlKey && key === 'c' && input.selectionStart === input.selectionEnd && !String(window.getSelection())) {
      e.preventDefault();
      flush();
      out.append(render([...promptParts(), input.value + '^C']));
      input.value = '';
      histPos = cmdHistory.length;
      scrollDown();
    }
  });

  // Clicking a command in the output runs it; clicking anywhere else empty puts the cursor in the prompt
  term.addEventListener('click', (e) => {
    const run = e.target.closest('[data-run]');
    if (run) {
      e.preventDefault();
      submit(run.dataset.run);
      focusInput();
    } else if (!e.target.closest('a, button') && !String(window.getSelection())) {
      focusInput(true);
    }
  });

  $$('[data-cmd]', win).forEach(btn => btn.addEventListener('click', () => {
    submit(btn.dataset.cmd);
    focusInput();
  }));

  // The window manager focuses the window itself when it opens
  win.addEventListener('focus', () => {
    start();
    focusInput();
  });

  updatePrompt();
});
