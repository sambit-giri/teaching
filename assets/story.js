// Engine for interactive lectures. A lecture is a list of chapters, laid out like slides: a big
// title across the top, text below it (left) and, optionally, a live figure with controls (right).
// Text grows to fill the space it has. Arrow keys, PageUp/PageDown (presentation clickers) and the
// Back/Next buttons step through the text and the chapters; the URL hash names the chapter, so a
// link like lecture/#cmb opens it directly, and the browser's back/forward buttons move between
// chapters.
//
// Chapter fields (all optional except title):
//   id        URL name of the chapter (defaults to its number)
//   part      section name shown in the chapter track
//   title     heading
//   text      HTML; $…$ and $$…$$ are typeset with KaTeX; elements with class "step"
//             appear one at a time when moving forward
//   layout    "text" for chapters without a figure (default when there is no draw)
//   controls  [{id, type: "range"|"select"|"toggle"|"choice"|"button", label, …}]
//   readout   (s) => [[label, value], …] or [[html]]; shown under the text, recomputed on change
//   draw      (s) => DOM node for the figure; s holds control values plus W, H (figure size),
//             C (theme colours), fs (font size), step and redraw() (for figures that change on click)
//   note      small print under the figure (credits)
//
// Requires d3 and Observable Plot (UMD globals) for plot(), and KaTeX auto-render for math.

const $ = (sel, root = document) => root.querySelector(sel);

export function h(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  node.append(...kids.flat().filter((x) => x != null));
  return node;
}

export function colors() {
  const cs = getComputedStyle(document.documentElement);
  const get = (name) => cs.getPropertyValue(name).trim();
  return {
    bg: get("--bg"), ink: get("--ink"), soft: get("--ink-soft"), grid: get("--grid"), line: get("--line"),
    accent: get("--accent"), hot: get("--hot"), cool: get("--cool"), good: get("--good"),
    gold: get("--gold"), violet: get("--violet"), pink: get("--pink"),
    light: document.documentElement.dataset.theme === "light",
  };
}

// Observable Plot with the figure's size, theme colours and font; options override.
export function plot(s, opts) {
  // fewer ticks than Plot's default, which crowds at projector font sizes
  const axis = (a, n) => (a && a.type !== "log" && a.ticks === undefined && a.axis !== null ? { ticks: n, ...a } : a);
  opts = { ...opts, x: axis(opts.x, Math.max(3, Math.round(s.W / (6 * s.fs)))), y: axis(opts.y, Math.max(3, Math.round(s.H / (4 * s.fs)))) };
  return Plot.plot({
    width: s.W,
    height: s.H,
    marginLeft: 3.6 * s.fs,
    marginBottom: 2.8 * s.fs,
    marginTop: 2.2 * s.fs,
    marginRight: 1.2 * s.fs,
    ...opts,
    style: { background: "transparent", color: s.C.ink, fontSize: `${s.fs}px`, fontFamily: "inherit", ...(opts.style || {}) },
  });
}

// A canvas the size of the figure, scaled for sharp lines on high-DPI screens.
export function canvas(s, W = s.W, H = s.H) {
  const cv = document.createElement("canvas");
  const dpr = window.devicePixelRatio || 1;
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  cv.style.width = `${W}px`;
  cv.style.height = `${H}px`;
  const g = cv.getContext("2d");
  g.scale(dpr, dpr);
  return { cv, g };
}

export const csv = (url) => d3.csv(url, d3.autoType);

export function story(cfg) {
  const cover = {
    id: "start",
    layout: "cover",
    title: cfg.title,
    part: "",
    text: `<p class="sub">${cfg.subtitle || ""}</p><p class="meta">${cfg.meta || ""}</p>`,
    draw: cfg.cover,
  };
  const chapters = [cover, ...cfg.chapters];
  chapters.forEach((ch, i) => {
    ch.id ??= String(i);
    ch.layout ??= ch.draw ? "figure" : "text";
    ch.s = {};
    for (const c of ch.controls || []) if ("value" in c) ch.s[c.id] = c.value;
  });

  // theme.js adds its light/dark button to <body> once the page has loaded; keep it, in the bar
  const toggle = $("#themeToggle");
  document.body.classList.add("story-app");
  document.body.replaceChildren(
    h("div", { id: "app" },
      h("header", { id: "head" },
        h("p", { class: "kicker", id: "part" }),
        h("h1", { id: "title" })),
      h("section", { id: "story", "aria-live": "polite" },
        h("div", { id: "txt" }),
        h("dl", { id: "readout" })),
      h("section", { id: "stage" },
        h("div", { id: "controls", class: "panel" }),
        h("div", { id: "fig", class: "panel" }),
        h("p", { id: "note" })),
      h("div", { id: "bar" },
        h("span", { class: "links" }),
        h("nav", { id: "track", "aria-label": "Chapters" }),
        h("div", { class: "nav" },
          h("span", { id: "count" }),
          h("button", { id: "prev", class: "btn", type: "button" }, "Back"),
          h("button", { id: "next", class: "btn primary", type: "button" }, "Next")))));

  const app = $("#app"), storyBox = $("#story"), txt = $("#txt"), fig = $("#fig"), ctl = $("#controls"), readout = $("#readout");
  const footer = cfg.footer ||
    "<kbd>←</kbd> <kbd>→</kbd> move · <kbd>F</kbd> full screen · <kbd>H</kbd> hide text · <kbd>T</kbd> light/dark";
  // the footer's links (all lectures, slides) stay reachable from the bar on every chapter
  const links = $("#bar .links");
  links.innerHTML = footer;
  links.replaceChildren(...[...links.querySelectorAll("a")].flatMap((a, k) => (k ? [" · ", a] : [a])));
  const dockToggle = () => { const b = $("#themeToggle"); if (b) $("#bar").append(b); };
  if (toggle) $("#bar").append(toggle);
  else document.addEventListener("DOMContentLoaded", dockToggle);

  let cur = 0, step = 0, steps = [];

  // chapter track, grouped by part
  const track = $("#track"), dots = [];
  let lastPart = null;
  chapters.forEach((ch, i) => {
    if (ch.part && ch.part !== lastPart) track.append(h("span", { class: "part" }, ch.part));
    lastPart = ch.part;
    const b = h("button", { type: "button", title: ch.title, "aria-label": `${i}. ${ch.title}`, onclick: () => go(i, Infinity) });
    dots.push(b);
    track.append(b);
  });

  function buildControls(ch) {
    const s = ch.s;
    ctl.replaceChildren();
    for (const c of ch.controls || []) {
      if (c.type === "range") {
        const out = h("output");
        const show = () => { out.textContent = c.fmt ? c.fmt(s[c.id]) : s[c.id]; };
        const input = h("input", { type: "range", min: c.min, max: c.max, step: c.step ?? "any", value: s[c.id], "aria-label": c.label });
        input.addEventListener("input", () => { s[c.id] = +input.value; show(); schedule(); });
        show();
        ctl.append(h("label", { class: "ctl ctl-range" }, h("span", { class: "row" }, h("span", { class: "lab" }, c.label), out), input));
      } else if (c.type === "select") {
        const sel = h("select", { "aria-label": c.label },
          c.options.map((o) => h("option", { value: o, selected: o === s[c.id] }, c.fmt ? c.fmt(o) : o)));
        sel.addEventListener("change", () => { s[c.id] = c.options.find((o) => String(o) === sel.value); schedule(); });
        ctl.append(h("label", { class: "ctl ctl-select" }, h("span", { class: "lab" }, c.label), sel));
      } else if (c.type === "toggle") {
        const box = h("input", { type: "checkbox", checked: !!s[c.id] });
        box.addEventListener("change", () => { s[c.id] = box.checked; schedule(); });
        ctl.append(h("label", { class: "ctl ctl-toggle" }, box, h("span", {}, c.label)));
      } else if (c.type === "choice") {
        const opts = h("span", { class: "opts" });
        const sync = () => opts.querySelectorAll("button").forEach((b, k) => b.setAttribute("aria-pressed", c.options[k].value === s[c.id]));
        for (const o of c.options) {
          opts.append(h("button", { type: "button", onclick: () => { s[c.id] = o.value; sync(); schedule(); } }, o.label));
        }
        sync();
        ctl.append(h("div", { class: "ctl ctl-choice" }, h("span", { class: "lab" }, c.label), opts));
      } else if (c.type === "button") {
        ctl.append(h("div", { class: "ctl ctl-button" },
          h("button", { type: "button", class: "btn", onclick: () => { c.onclick(s); buildControls(ch); schedule(); } }, c.label)));
      }
    }
    ctl.hidden = !(ch.controls && ch.controls.length);
  }
  // once a slider, menu or tick box has been set, hand the arrow keys back to the lecture
  ctl.addEventListener("change", (e) => e.target.blur());

  function typeset(node) {
    if (window.renderMathInElement) {
      renderMathInElement(node, {
        delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }],
        throwOnError: false,
      });
    }
  }

  function go(i, atStep = 0) {
    i = Math.max(0, Math.min(chapters.length - 1, i));
    const ch = chapters[i];
    const changed = i !== cur || !txt.hasChildNodes();
    cur = i;
    if (changed) {
      app.className = `layout-${ch.layout}` + (app.classList.contains("hide-story") ? " hide-story" : "");
      $("#part").textContent = ch.part || cfg.kicker || "";
      $("#count").textContent = i ? `${i} / ${chapters.length - 1}` : "";
      $("#title").textContent = ch.title;
      txt.innerHTML = ch.text || "";
      if (ch.layout === "cover") txt.append(coverJump(), Object.assign(h("p", { class: "foot" }), { innerHTML: footer }));
      typeset(txt);
      steps = [...txt.querySelectorAll(".step")];
      $("#note").innerHTML = ch.note || "";
      buildControls(ch);
      fig.replaceChildren();
      dots.forEach((d, k) => { d.toggleAttribute("aria-current", k === i); if (k === i) d.setAttribute("aria-current", "true"); });
      dots[i].classList.add("seen");
      dots[i].scrollIntoView({ block: "nearest", inline: "nearest" });
      // a history entry per chapter, so the browser's back/forward buttons move between chapters
      if (location.hash.slice(1) !== (i ? ch.id : "")) history.pushState(null, "", i ? `#${ch.id}` : location.pathname + location.search);
      storyBox.scrollTop = 0;
    }
    step = Math.max(0, Math.min(steps.length, atStep));
    steps.forEach((el, k) => el.classList.toggle("hidden", k >= step));
    $("#prev").disabled = i === 0 && step === 0;
    $("#next").textContent = i === 0 ? "Start" : "Next";
    $("#next").disabled = i === chapters.length - 1 && step === steps.length;
    render();
    if (changed) fit();
  }

  // Like a slide: the less text a chapter has, the larger it is set. Hidden steps keep their
  // space, so the size does not change while stepping through a chapter.
  const narrow = matchMedia("(max-width: 860px), (max-height: 520px) and (max-width: 1100px)");
  function fit() {
    const max = narrow.matches ? 1 : { text: 1.9, figure: 1.45 }[chapters[cur].layout] || 1;
    storyBox.style.fontSize = "";
    if (max <= 1) return;
    // measure without a scrollbar, which would narrow the text while it is being measured
    storyBox.style.overflowY = "hidden";
    const fits = (k) => { storyBox.style.fontSize = `${k}em`; return storyBox.scrollHeight <= storyBox.clientHeight; };
    let lo = 1, hi = max;
    if (!fits(hi)) {
      for (let n = 0; n < 8; n++) { const m = (lo + hi) / 2; if (fits(m)) lo = m; else hi = m; }
      storyBox.style.fontSize = `${lo * 0.98}em`; // a little slack for rounding
    }
    storyBox.style.overflowY = "";
  }

  function coverJump() {
    const parts = [];
    chapters.forEach((ch, i) => { if (i && ch.part && !parts.some((p) => p.part === ch.part)) parts.push({ part: ch.part, i }); });
    return h("div", {},
      h("button", { type: "button", class: "btn primary start", onclick: () => go(1, 0) }, "Start"),
      h("div", { class: "jump" }, h("span", {}, "or go to"),
        parts.map((p) => h("button", { type: "button", class: "btn", onclick: () => go(p.i, Infinity) }, p.part))));
  }

  const next = () => (step < steps.length ? go(cur, step + 1) : go(cur + 1, 0));
  const prev = () => (step > 0 ? go(cur, step - 1) : go(cur - 1, Infinity));
  $("#next").onclick = next;
  $("#prev").onclick = prev;

  let pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; render(); });
  }

  function render() {
    const ch = chapters[cur], s = ch.s;
    const r = fig.getBoundingClientRect(), cs = getComputedStyle(fig);
    s.W = Math.max(200, Math.floor(r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)));
    s.H = Math.max(160, Math.floor(r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)));
    s.C = colors();
    s.fs = Math.round(Math.max(12, Math.min(19, s.W / 52)));
    s.step = step;
    s.redraw = schedule;
    try {
      readout.replaceChildren(...(ch.readout ? ch.readout(s) : []).flatMap((row) =>
        row.length === 1
          ? [Object.assign(h("dd", { class: "wide" }), { innerHTML: row[0] })]
          : [Object.assign(h("dt"), { innerHTML: row[0] }), Object.assign(h("dd"), { innerHTML: row[1] })]));
      if (ch.draw && (ch.layout !== "text")) {
        const node = ch.draw(s);
        if (node) fig.replaceChildren(node);
      }
    } catch (err) {
      console.error(err);
      fig.replaceChildren(h("p", { class: "error" }, `Figure error: ${err.message}`));
    }
  }

  new ResizeObserver(schedule).observe(fig);
  new ResizeObserver(() => fit()).observe(storyBox);
  // KaTeX loads its fonts only once math is on screen, which changes the text height
  document.fonts?.addEventListener("loadingdone", () => fit());
  new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // arrow keys belong to a focused slider or menu; on buttons, Space and Enter press the button
    const inForm = e.target.closest?.("input, select, textarea");
    const onButton = e.target.closest?.("button, a");
    const k = e.key;
    if (k === "PageDown" || (!inForm && (k === "ArrowRight" || k === "ArrowDown" || (k === " " && !onButton)))) { e.preventDefault(); next(); }
    else if (k === "PageUp" || (!inForm && (k === "ArrowLeft" || k === "ArrowUp"))) { e.preventDefault(); prev(); }
    else if (inForm) return;
    else if (k === "Home") go(0);
    else if (k === "End") go(chapters.length - 1, Infinity);
    else if (k === "f" || k === "F") {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen?.();
    } else if (k === "h" || k === "H") { app.classList.toggle("hide-story"); schedule(); }
  });

  function fromHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    const i = chapters.findIndex((ch) => ch.id === id);
    return i < 0 ? 0 : i;
  }
  window.addEventListener("popstate", () => go(fromHash(), Infinity));
  cur = -1;
  go(fromHash(), Infinity);
}
