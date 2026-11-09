// Set-up shared by the lecture slide decks: renders $...$ and $$...$$ with KaTeX, starts
// reveal.js on a 1280×720 slide, sizes each slide's text to fill it, and runs answer walls.
// Keys: arrows / space / clicker to step, F full screen, Esc overview, S speaker view, T light/dark.
// The PDF button (or ?print-pdf in the URL, then print) saves a PDF: one page per slide, all clicks shown.

renderMathInElement(document.querySelector(".reveal .slides"), {
  delimiters: [
    { left: "$$", right: "$$", display: true },
    { left: "$", right: "$", display: false },
  ],
  throwOnError: false,
});

// Size a slide's text (titles keep their size) to the largest that fits: up to 1.5× on text-only
// slides, 1.25× next to figures, never larger on the cover or collages (placed images that are not
// click-in overlays); smaller if it overflows. <section data-text-size="1.2"> fixes the size instead.
function fit(section) {
  section.style.fontSize = "";
  if (!section.offsetHeight) return; // hidden slide
  if (section.dataset.textSize) {
    section.style.fontSize = `${section.dataset.textSize}em`;
    return;
  }
  const max = section.matches(".cover") || section.querySelector(".abs:not(.fragment)") ? 1
    : section.querySelector("img") ? 1.25 : 1.5;
  const fits = (k) => {
    section.style.fontSize = `${k}em`;
    // a column (.cols) centres its content, so it can overflow at the top as well as the bottom;
    // an <svg> column has no offsetHeight, so it is skipped rather than counted as overflowing
    return section.scrollHeight <= section.clientHeight + 1 &&
      [...section.querySelectorAll(".cols > *")].every((c) => (c.offsetHeight ?? 0) <= c.parentElement.clientHeight + 1);
  };
  if (fits(max)) return;
  let lo = 0.7, hi = max;
  for (let n = 0; n < 7; n++) {
    const m = (lo + hi) / 2;
    if (fits(m)) lo = m; else hi = m;
  }
  section.style.fontSize = `${lo}em`;
}

// Hidden answer (<p id="x" class="click-reveal">) shown or hidden again by a click on an element
// with data-reveals="x" (e.g. an image), so it never appears by stepping through the slides.
for (const el of document.querySelectorAll("[data-reveals]")) {
  el.style.cursor = "pointer";
  el.title = "Click to show or hide the answer";
  el.addEventListener("click", () => document.getElementById(el.dataset.reveals)?.classList.toggle("revealed"));
}

// Answer wall (<div class="wall" data-wall="name">): type a phrase, Enter adds it, a click on a
// phrase removes it. Kept in this browser's storage until "Clear". PageDown/PageUp (a clicker)
// still change slide while typing, and Esc leaves the text box.
function wall(box) {
  const key = `wall:${location.pathname}:${box.dataset.wall}`;
  const items = document.createElement("div");
  items.className = "wall-items";
  const input = Object.assign(document.createElement("input"), {
    type: "text", placeholder: "Type an answer and press Enter",
  });
  const clear = Object.assign(document.createElement("button"), { type: "button", textContent: "Clear" });
  const bar = document.createElement("div");
  bar.className = "wall-bar";
  bar.append(input, clear);
  box.append(items, bar);

  let list = [];
  try { list = JSON.parse(localStorage.getItem(key)) || []; } catch (e) {}
  const save = () => { try { localStorage.setItem(key, JSON.stringify(list)); } catch (e) {} };
  const draw = () => items.replaceChildren(...list.map((text, i) => {
    const b = Object.assign(document.createElement("button"), { type: "button", textContent: text, title: "Click to remove" });
    b.addEventListener("click", () => { list.splice(i, 1); save(); draw(); });
    return b;
  }));

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && input.value.trim()) {
      list.push(input.value.trim());
      input.value = "";
      save();
      draw();
    } else if (e.key === "Escape") {
      input.blur();
    } else if (e.key === "PageDown" || e.key === "PageUp") {
      input.blur();
      e.key === "PageDown" ? Reveal.next() : Reveal.prev();
    }
  });
  clear.addEventListener("click", () => {
    if (list.length && confirm("Remove all answers on this slide?")) { list = []; save(); draw(); }
  });
  draw();
}
document.querySelectorAll(".reveal .wall").forEach(wall);

// Clickable options (<details>): one open at a time per group, and after a click the keyboard
// goes back to the slides (Space, arrows).
document.querySelectorAll(".reveal details").forEach((d) => d.addEventListener("toggle", () => {
  d.querySelector("summary").blur();
  if (d.open) d.parentElement.querySelectorAll(":scope > details[open]").forEach((o) => o !== d && (o.open = false));
}));

Reveal.initialize({
  width: 1280,
  height: 720,
  margin: 0.03,
  minScale: 0.2,
  maxScale: 3,
  center: false,
  display: "flex",
  hash: true,
  slideNumber: "c/t",
  transition: "none",
  backgroundTransition: "none",
  controlsTutorial: false,
  pdfSeparateFragments: false,
  pdfMaxPagesPerSlide: 1,
  plugins: [RevealNotes],
}).then(() => {
  document.querySelectorAll(".reveal .slides > section").forEach(fit);
  Reveal.on("slidechanged", (e) => fit(e.currentSlide));
  document.fonts?.ready.then(() => fit(Reveal.getCurrentSlide()));
  // the PDF layout is made after the slides are sized: size them again in it
  Reveal.on("pdf-ready", () => document.querySelectorAll(".reveal .slides section").forEach(fit));
  // opened by the PDF button: print once the fonts, figures and widgets have drawn
  if (printing && /[?&]print=1/.test(location.search)) {
    Promise.all([document.fonts?.ready, new Promise((r) => (document.readyState === "complete" ? r() : addEventListener("load", r)))])
      .then(() => setTimeout(() => print(), 1500));
  }
});

// PDF button, bottom left next to the light/dark button: opens the deck in reveal's print layout
// in a new tab, which then opens the print dialog (choose "Save as PDF").
const printing = /print-pdf/.test(location.search);
if (!printing) {
  const b = Object.assign(document.createElement("button"), { id: "pdfButton", type: "button", title: "Save the slides as a PDF" });
  b.setAttribute("aria-label", "Save the slides as a PDF");
  b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/></svg>';
  b.addEventListener("click", () => open(`${location.pathname}?print-pdf&print=1`, "_blank"));
  document.body.appendChild(b);
}
