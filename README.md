# Aaron Hirsimäki — Portfolio

Personal portfolio of a full-stack software and game developer from Espoo, Finland.

**Live site:** https://aaronhirsimaki.github.io/portfolio/

![Portfolio screenshot](docs/screenshot.webp)

## Highlights

- **Bento grid that zooms open.** Each tile shows a live, scaled-down preview of its section. Clicking one
  animates it to fullscreen, and the content scales up with the card instead of cutting to a new page.
- **Playable mini-game.** A small canvas demo of my in-development roguelike *Cat Mayhem* runs right in the
  Featured tile (WASD to move, click to shoot).
- **Accessible.** Tiles are keyboard-operable buttons. An open tile behaves as a modal dialog, with focus
  moved to the Back button, the background made inert and focus restored on close. `prefers-reduced-motion`
  is respected throughout.
- **No build step, no framework.** Plain HTML, CSS and JavaScript, under 80 KB of hand-written code.

## Tech

| Area | Details |
| --- | --- |
| Markup | Semantic HTML, Open Graph / Twitter card meta |
| Styling | CSS custom properties (one-line re-theming via `--clr-accent`), BEM naming, CSS Grid |
| Behaviour | Vanilla JS: FLIP-style zoom animation, `inert` focus management, delta-time canvas game loop with HiDPI scaling |
| Icons / fonts | [Devicon](https://devicon.dev/) (pinned), Inter + Space Grotesk from Google Fonts |
| Hosting | GitHub Pages |

## Project structure

```
index.html        Page markup: header, bento cards, contact
css/style.css     Design tokens and section/component styles
css/bento.css     Bento grid, card zoom states, hero header
js/main.js        Card zoom + accessibility, Cat Mayhem mini-game
assets/           Favicons, social preview image, project screenshots
```

## Running locally

Any static file server works:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Contact

- Email: aaron.hirsimaki@proton.me
- LinkedIn: [Aaron Hirsimäki](https://www.linkedin.com/in/aaron-hirsim%C3%A4ki-848155268)
- GitHub: [AaronHirsimaki](https://github.com/AaronHirsimaki)
