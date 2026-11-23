# teaching

Lecture material and teaching tools by Sambit Kumar Giri, published to
<https://sambit-giri.github.io/teaching/>.

Plain HTML, CSS and JavaScript with no site generator and no build step beyond copying the
files into `_site/`.

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
tools/cosmology-calculator/     teaching tool, not tied to a course
  index.html                   the calculator page; values go in the URL, e.g. ?H0=70&Om=0.3&flat=0&OL=0&z=2
  cosmocalc.js                 the engine (no imports); Lecture 6 of AS5003 uses it too
Cosmology_HT2026_AS5003/       one folder per course, served at /teaching/<folder>/
  index.html                   the lecture list (hand-written)
  notation.html                reference page: Ryden's notation and benchmark model
  figures/                     figures shared by the lectures; CREDITS.md lists sources and licences
  _shared/cosmo.js             cosmology functions shared by the lectures
  _shared/calculator.js        plots of the cosmology calculator on the Lecture 6 slide
  lectures/NN-topic/
    index.html                 the slides: one <section> per slide, in Keynote order
    *.js                       the slides' interactive widgets ("Try it" slides)
    *.bin                      data used by the widgets; make_*.py rebuilds a data file from its source
    slides.pdf                 the slides as a PDF, made by make_pdfs.py
build.sh                       builds the site into _site/
make_pdfs.py                   makes each deck's slides.pdf (see Slides)
```

Links for Canvas:

- course page: `https://sambit-giri.github.io/teaching/Cosmology_HT2026_AS5003/`
- a lecture: `.../Cosmology_HT2026_AS5003/lectures/01-observables/`

## Work locally

```sh
./build.sh --open    # build, serve _site/ at http://localhost:8000 and open it; Ctrl+C stops
```

The server started by `--open` tells the browser not to cache, so after a rebuild a plain reload
shows the new version.

Pages must be served over HTTP (not opened as files) because the lectures load modules and data.


## Deploy

Pushing to `main` builds and deploys the site with GitHub Actions
(`.github/workflows/publish.yml`). In the repository settings,
Pages → Source must be set to "GitHub Actions".

## Add a lecture or a course

- **Lecture:** create `lectures/NN-topic/index.html` by copying an existing deck, put its figures
  in the course's `figures/` (and add them to `CREDITS.md`). Then add a card to the course's `index.html`.
- **Course:** create a new top-level folder with its own `index.html` lecture list, and add a card
  to the landing page.

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

PDF: each deck has a `slides.pdf` (light theme, one page per slide, all clicks shown), linked from
the course's lecture list. After changing a deck, rebuild its PDF and commit it with the deck:

```sh
pip install playwright && python -m playwright install chromium   # once
python make_pdfs.py 07-parameters    # or no argument for every deck
```

The PDF button on the slides (or `?print-pdf` in the URL, then print) gives the same layout in the
browser.

## Data credits

- COBE/FIRAS CMB monopole spectrum: Fixsen et al. (1996), ApJ 473, 576, via NASA LAMBDA
- Hubble (1929), PNAS 15, 168, Table 1
- Pantheon+SH0ES: Scolnic et al. (2022), ApJ 938, 113; Brout et al. (2022), ApJ 938, 110
