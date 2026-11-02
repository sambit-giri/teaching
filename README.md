# teaching

Lecture material and teaching tools by Sambit Kumar Giri, published to
<https://sambit-giri.github.io/teaching/>.

Plain HTML, CSS and JavaScript with no site generator. The only build step exports the
Python playgrounds ([marimo](https://marimo.io) notebooks) so that they run in the browser.

Lectures are slide decks rebuilt from the Keynote lectures: [reveal.js](https://revealjs.com) loaded
from a CDN, one hand-written `index.html` per lecture, so text can be edited directly.

## Layout

```
index.html                     landing page: Lectures, Teaching tools (hand-written)
assets/
  tokens.css                   colours and fonts shared by every page (light and dark)
  site.css                     style of the hand-written pages (landing, lecture lists, notation)
  theme.js                     light/dark switch (button, or press T)
  slides.css, slides.js        look and set-up of the slide decks (reveal.js, KaTeX, text fitting)
  story.css, story.js          engine for the interactive lectures ("story apps")
Cosmology_HT2026_AS5003/       one folder per course, served at /teaching/<folder>/
  index.html                   the lecture list (hand-written)
  notation.html                reference page: Ryden's notation and benchmark model
  figures/                     figures shared by the lectures; CREDITS.md lists sources and licences
  _shared/cosmo.js             cosmology functions shared by the lectures
  lectures/NN-topic/
    index.html                 the slides: one <section> per slide, in Keynote order
    interactive.html, lecture.js  the interactive lecture (chapters, figures, controls), if any
    public/                    data used by the lecture and its playground (CSV)
    playground.py              marimo notebook, exported to playground/ at build time
build.sh                       builds the site into _site/
```

Links for Canvas:

- course page: `https://sambit-giri.github.io/teaching/Cosmology_HT2026_AS5003/`
- a lecture: `.../Cosmology_HT2026_AS5003/lectures/01-observables/`
- its playground: `.../Cosmology_HT2026_AS5003/lectures/01-observables/playground/`

## Work locally

Install marimo once (`uv tool install marimo==0.25.2` or `pip install marimo==0.25.2`), then:

```sh
./build.sh --open    # build, serve _site/ at http://localhost:8000 and open it; Ctrl+C stops
```

The server started by `--open` tells the browser not to cache, so after a rebuild a plain reload
shows the new version.

Pages must be served over HTTP (not opened as files) because the lectures load modules and data.

To edit a playground with live Python, run `marimo edit playground.py` inside the lecture folder.
The exported playground loads Python (Pyodide) in the browser, which takes 10–30 s the first time.
`build.sh` switches the exported notebooks to run all cells as soon as they load.

## Deploy

Pushing to `main` builds and deploys the site with GitHub Actions
(`.github/workflows/publish.yml`). In the repository settings,
Pages → Source must be set to "GitHub Actions".

## Add a lecture or a course

- **Lecture:** create `lectures/NN-topic/index.html` by copying an existing deck, put its figures
  in the course's `figures/` (and add them to `CREDITS.md`), optionally add an interactive page
  (`interactive.html`, `lecture.js`, `public/`) and a `playground.py`. Then add a card to the course's `index.html`.
- **Course:** create a new top-level folder with its own `index.html` lecture list, and add a card
  to the landing page. `build.sh` finds `*/lectures/*/playground.py` automatically.

## Slides

Keys: arrows, space or a clicker to step; F full screen; Esc overview; S speaker view; T light/dark.

To edit, run `./build.sh --edit` (serves the working files, no build), change the lecture's
`index.html` and reload. Each `<section>` is one slide; the comment at the top of the deck lists
the options:

- `class="fragment"` makes an element appear on the next click (like a Keynote build).
- Text on each slide is sized automatically to fill the space (`assets/slides.js`);
  `<section data-text-size="1.2">` fixes it instead (1 = 30px), and `style="font-size: 0.8em"`
  on a paragraph or list resizes just that part.
- `<div class="wall" data-wall="name"></div>` is an answer wall: type a phrase in class and press
  Enter. Phrases stay in that browser until "Clear".

PDF: open a deck with `?print-pdf` added to the URL (e.g. `.../01-observables/?print-pdf`) and
print to PDF from Chrome.

## Data credits

- COBE/FIRAS CMB monopole spectrum: Fixsen et al. (1996), ApJ 473, 576, via NASA LAMBDA
- Hubble (1929), PNAS 15, 168, Table 1
- Pantheon+SH0ES: Scolnic et al. (2022), ApJ 938, 113; Brout et al. (2022), ApJ 938, 110
