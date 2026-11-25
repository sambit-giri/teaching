// Lecture 8 widgets. Each slide with a widget has a figure box <div class="w-fig" data-widget="name">
// and inputs with a data-k="name" attribute; the widget redraws when an input changes and when the
// light/dark theme is switched. Charts use Observable Plot and d3 (from the CDN).
import { benchmark } from "../../_shared/cosmo.js";
import { single, singleColours, singlePlot, fatePlot, fates, showSteps } from "../../_shared/models.js";
import { union21 } from "../../_shared/union21.js";
import { snPlane } from "../../_shared/supernovae.js";
import { withAxes } from "../../_shared/plot.js";

const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const colours = () => Object.fromEntries(["ink", "ink-soft", "accent", "hot", "cool", "good", "gold", "violet", "edge", "bg"].map((k) => [k.replace("-", "_"), css(`--${k}`)]));
const style = (C, fontSize = "16px") => ({ background: "transparent", color: C.ink, fontSize, fontFamily: css("--f-ui") });
const fill = (box, v) => { for (const el of box.closest("section").querySelectorAll("[data-v]")) el.textContent = v[el.dataset.v] ?? ""; };
const sup = (x) => String(x).replace(/-/g, "⁻").replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[d]);
const pow = (d) => (Number.isInteger(Math.log10(d)) ? `10${sup(Math.round(Math.log10(d)))}` : "");

// the universes of Lectures 5 and 6, for the select data-k="model"
const universes = {
  benchmark: { Or: benchmark.Or, Om: benchmark.Om, OL: benchmark.OL },
  matter: { Or: 0, Om: 1, OL: 0 },
  milne: { Or: 0, Om: 0, OL: 0 },
  lambda: { Or: 0, Om: 0, OL: 1 },
  radiation: { Or: 1, Om: 0, OL: 0 },
};

// For a universe { Or, Om, OL }: on a grid of redshifts, the comoving distance r, Sκ(r) and the lookback
// time H0(t0 − te), all integrated in ln a from today back to z = 10⁴; in units of c/H0 and 1/H0.
// hor: the horizon distance today (r for z → ∞), or Infinity.
function table({ Or, Om, OL }) {
  const Ok = 1 - Or - Om - OL, E = (a) => Math.sqrt(Or / a ** 4 + Om / a ** 3 + OL + Ok / a ** 2);
  const n = 4000, lo = -Math.log(1e4 + 1), dx = lo / n, out = [];
  let r = 0, look = 0;
  for (let i = 1; i <= n; i++) {
    const a0 = Math.exp((i - 1) * dx), a1 = Math.exp(i * dx);
    r += -0.5 * (1 / (a0 * E(a0)) + 1 / (a1 * E(a1))) * dx;
    look += -0.5 * (1 / E(a0) + 1 / E(a1)) * dx;
    const S = Ok > 1e-6 ? Math.sinh(Math.sqrt(Ok) * r) / Math.sqrt(Ok) : Ok < -1e-6 ? Math.sin(Math.sqrt(-Ok) * r) / Math.sqrt(-Ok) : r;
    out.push({ z: 1 / a1 - 1, r, S, look });
  }
  // the integral for the horizon converges when a²E(a) → 0 as a → 0, that is with matter or radiation
  const hor = Or > 0 || Om > 0 ? r + (Or > 0 ? Math.exp(lo) / Math.sqrt(Or) : 2 * Math.exp(lo / 2) / Math.sqrt(Om)) : Infinity;
  return { pts: out, hor };
}

// raisins in an unrisen dough, as in Lecture 2 (cm from its centre; dough 12 × 7.6 cm)
const raisinBread = [
  [-4.2, -0.6], [-3.0, 1.6], [-2.6, -1.9], [-1.4, 0.2], [-0.8, 2.3], [-0.2, -2.4], [0.5, 0.9],
  [1.3, -0.9], [2.0, 2.0], [2.6, -2.2], [3.3, 0.4], [4.4, -0.8], [-1.9, 2.9], [1.0, -2.9],
].map(([x, y]) => ({ x, y }));

const widgets = {
  single: (box) => box.replaceChildren(singlePlot(colours(), { height: +(box.dataset.h ?? 400), font: css("--f-ui") })),

  // the four universes of Ryden Fig. 5.7 (Lecture 6)
  fates: (box) => box.replaceChildren(fatePlot(colours(), fates(colours()).map((f) => ({ ...f, step: undefined })), { height: +(box.dataset.h ?? 400) })),

  // all the distances to a source at redshift z, for one universe (select data-k="model", or data-model
  // on the box), on log axes: the colours here mark the kind of distance, not a component. A checkbox
  // data-k="flip" puts high z on the left; the key and labels stay at low z
  zoo: (box, s) => {
    const C = colours(), name = s.model ?? box.dataset.model ?? "benchmark", u = universes[name], anchor = s.flip ? "end" : "start";
    const { pts, hor } = table(u);
    const sel = pts.filter((p, i) => p.z >= 0.01 && p.z <= 1000 && i % 4 === 0);
    const lines = [
      { key: "proper distance today, dp(t₀)", f: (p) => p.r, c: C.ink, width: 4 },
      { key: "luminosity distance, dL", f: (p) => p.S * (1 + p.z), c: C.hot, dash: "8 5" },
      { key: "light-travel distance, c(t₀ − tₑ)", f: (p) => p.look, c: C.cool, dash: "12 4 3 4" },
      { key: "proper distance at emission, dp(tₑ)", f: (p) => p.r / (1 + p.z), c: C.accent },
      { key: "angular-diameter distance, dA", f: (p) => p.S / (1 + p.z), c: C.good, dash: "2 4" },
      { key: "Hubble's law, cz/H₀", f: (p) => p.z, c: C.ink_soft, width: 1.5, dash: "4 4" },
    ];
    const marks = [];
    if (isFinite(hor)) marks.push(Plot.ruleY([hor], { stroke: C.edge, strokeWidth: 1.5, strokeDasharray: "4 4" }),
      Plot.text([{ z: 0.012, d: hor }], { x: "z", y: "d", text: () => `horizon today, ${hor.toFixed(2)} c/H₀`, textAnchor: anchor, dy: -10, fill: C.ink_soft }));
    for (const l of lines) marks.push(Plot.line(sel.map((p) => ({ z: p.z, d: l.f(p) })), { x: "z", y: "d", stroke: l.c, strokeWidth: l.width ?? 3, strokeDasharray: l.dash, clip: true }));
    // the key in the empty top left; the rows are evenly spaced in log d
    if ("key" in box.dataset) lines.forEach((l, i) => {
      const d = 10 ** (3.6 - 0.36 * i);
      marks.push(Plot.line([{ z: 0.012, d }, { z: 0.03, d }], { x: "z", y: "d", stroke: l.c, strokeWidth: l.width ?? 3, strokeDasharray: l.dash }),
        Plot.text([{ z: 0.035, d }], { x: "z", y: "d", text: () => l.key, textAnchor: anchor, fill: l.c, fontWeight: 700 }));
    });
    box.replaceChildren(Plot.plot(withAxes({
      width: +(box.dataset.w ?? 640), height: +(box.dataset.h ?? 440), marginLeft: 56, marginBottom: 46, marginTop: 32, marginRight: 20, style: style(C),
      x: { type: "log", domain: [0.01, 1000], reverse: !!s.flip, tickFormat: (d) => (Number.isInteger(Math.log10(d)) ? String(d) : ""),
        label: s.flip ? "← redshift z" : "redshift z →", labelAnchor: s.flip ? "left" : "right", labelArrow: "none" },
      y: { type: "log", domain: [1e-3, 1e4], ticks: [1e-3, 1e-2, 1e-1, 1, 10, 100, 1e3, 1e4], tickFormat: pow, label: "↑ distance (c/H₀)", labelAnchor: "top", labelArrow: "none" },
      marks,
    }, C.ink)));
    // where the recession speed today, H0 dp(t0), equals c
    const fast = pts.find((p) => p.r >= 1);
    fill(box, { hor: isFinite(hor) ? `${hor.toFixed(2)} c/H₀` : "infinite", zc: fast ? fast.z.toFixed(2) : "never" });
  },

  // what each model universe predicts: one distance (select data-k="dist") against z, for the four
  // universes of Lecture 5 (their colours and dashes) and the Benchmark Model (thick, ink). The predicted
  // distances (comoving, at emission, light travel, horizon at that time) or, with data-set="observed",
  // the observable ones (dL, m − M for H0 = 68, dA). A checkbox data-k="flip" puts high z on the left.
  // With data-steps, the Union2.1 supernovae (Lecture 7) appear on dL and m − M with the first click.
  predict: (box, s) => {
    const C = colours(), col = singleColours(C), anchor = s.flip ? "end" : "start", cH = 299792.458 / benchmark.H0;
    const kinds = {
      dp0: { y: "↑ comoving distance dp(t₀) (c/H₀)", f: (p) => p.r },
      dpe: { y: "↑ proper distance at emission dp(tₑ) (c/H₀)", f: (p) => p.r / (1 + p.z) },
      lt: { y: "↑ light-travel distance c(t₀ − tₑ) (c/H₀)", f: (p) => p.look },
      hor: { y: "↑ horizon distance at tₑ (c/H₀)", f: (p, hor) => (hor - p.r) / (1 + p.z) },
      dL: { y: "↑ luminosity distance dL (c/H₀)", f: (p) => p.S * (1 + p.z) },
      mu: { y: "↑ distance modulus m − M", f: (p) => 5 * Math.log10(p.S * (1 + p.z) * cH) + 25, lin: true },
      dA: { y: "↑ angular-diameter distance dA (c/H₀)", f: (p) => p.S / (1 + p.z) },
    };
    const k = kinds[s.dist] ?? kinds.dp0;
    const models = [
      ...["milne", "matter", "radiation", "lambda"].map((m) => ({ u: universes[m], c: col[m], dash: single[m].dash, width: 3, key: single[m].label })),
      { u: universes.benchmark, c: C.ink, width: 6, opacity: 0.85, key: "Benchmark Model" },
    ];
    const marks = [], missing = [];
    let data;
    // the supernovae: their m − M assume H0 = 70, so dL H0/c = 10^((m − M − 25)/5) / (c/70 Mpc) whatever H0 is
    if ("steps" in box.dataset && (s.dist === "dL" || s.dist === "mu")) {
      const pts = union21.map(([z, m]) => { const x = 10 ** ((m - 25) / 5) / (299792.458 / 70); return { z, d: s.dist === "dL" ? x : 5 * Math.log10(x * cH) + 25 }; });
      data = Plot.dot(pts, { x: "z", y: "d", r: 2.5, fill: C.violet, fillOpacity: 0.7, className: "step-1" });
    }
    for (const m of models) {
      const { pts, hor } = table(m.u);
      if (s.dist === "hor" && !isFinite(hor)) { missing.push(m.key.split(":")[0]); continue; }
      const line = pts.filter((p, i) => p.z >= 0.01 && p.z <= 1000 && i % 4 === 0).map((p) => ({ z: p.z, d: k.f(p, hor) })).filter((p) => p.d > 0 && isFinite(p.d));
      marks.push(Plot.line(line, { x: "z", y: "d", stroke: m.c, strokeWidth: m.width, strokeDasharray: m.dash, strokeOpacity: m.opacity ?? 1, clip: true }));
    }
    const [y0, y1] = k.lin ? [30, 60] : [1e-3, 1e4], yAt = (i) => (k.lin ? y1 - (y1 - y0) * (0.07 + 0.075 * i) : 10 ** (3.6 - 0.4 * i));
    models.forEach((m, i) => {
      const y = yAt(i);
      marks.push(Plot.line([{ z: 0.012, d: y }, { z: 0.03, d: y }], { x: "z", y: "d", stroke: m.c, strokeWidth: m.width, strokeDasharray: m.dash }),
        Plot.text([{ z: 0.035, d: y }], { x: "z", y: "d", text: () => m.key, textAnchor: anchor, fill: m.c, fontWeight: 700 }));
    });
    if (data) marks.push(data, Plot.text([{ z: 0.012, d: yAt(models.length) }], { x: "z", y: "d", text: () => "● supernovae (Union2.1)", textAnchor: anchor, fill: C.violet, fontWeight: 700, className: "step-1" }));
    if (missing.length) marks.push(Plot.text([{ z: 0.012, d: yAt(models.length) }], { x: "z", y: "d", text: () => `no horizon (infinite): ${missing.join(", ")}`, textAnchor: anchor, fill: C.ink_soft }));
    box.replaceChildren(Plot.plot(withAxes({
      width: +(box.dataset.w ?? 640), height: +(box.dataset.h ?? 460), marginLeft: 56, marginBottom: 46, marginTop: 32, marginRight: 20, style: style(C),
      x: { type: "log", domain: [0.01, 1000], reverse: !!s.flip, tickFormat: (d) => (Number.isInteger(Math.log10(d)) ? String(d) : ""),
        label: s.flip ? "← redshift z" : "redshift z →", labelAnchor: s.flip ? "left" : "right", labelArrow: "none" },
      y: k.lin ? { domain: [y0, y1], label: k.y, labelAnchor: "top", labelArrow: "none" }
        : { type: "log", domain: [y0, y1], ticks: [1e-3, 1e-2, 1e-1, 1, 10, 100, 1e3, 1e4], tickFormat: pow, label: k.y, labelAnchor: "top", labelArrow: "none" },
      marks,
    }, C.ink)));
    if ("steps" in box.dataset) showSteps(box);
  },

  // the (Ωm,0, ΩΛ,0) plane of Lecture 7 with the region the supernovae allow, and the Benchmark Model (★)
  plane: (box) => {
    const C = colours();
    box.replaceChildren(snPlane(C, { font: css("--f-ui"), width: +(box.dataset.w ?? 420), height: +(box.dataset.h ?? 460), extra: [
      Plot.dot([[benchmark.Om, benchmark.OL]], { symbol: "star", r: 6.5, fill: C.gold, stroke: C.bg, strokeWidth: 1 }),
    ] }));
  },

  // raisin bread rising on its own, like a loop of Lecture 2's (there a raisin is clicked): the dough grows
  // from a = 1 to 2 in 4 s, holds for 2 s and starts again, with the distances from our raisin (orange) to
  // three others growing by the same factor. Draws only while its slide is shown (the PDF: at a = 2).
  raisins: (box) => {
    box._stop?.();
    const C = colours(), W = 520, H = 380, cm = 20, me = 6, pdf = /print-pdf/.test(location.search);
    const cv = Object.assign(document.createElement("canvas"), { width: W * 2, height: H * 2 });
    cv.style.width = `${W}px`;
    const g = cv.getContext("2d");
    g.scale(2, 2);
    const near = raisinBread.map((r, k) => [k, Math.hypot(r.x - raisinBread[me].x, r.y - raisinBread[me].y)]).filter(([k]) => k !== me).sort((p, q) => p[1] - q[1]);
    const others = [near[0], near[Math.floor(near.length / 2)], near[near.length - 1]];
    const draw = (a) => {
      const pos = (r) => [W / 2 + r.x * cm * a, H / 2 + r.y * cm * a];
      g.clearRect(0, 0, W, H);
      g.fillStyle = "#f3d9a4"; g.strokeStyle = "#c9a15b"; g.lineWidth = 2;
      g.beginPath(); g.ellipse(W / 2, H / 2, 6 * cm * a, 3.8 * cm * a, 0, 0, 2 * Math.PI); g.fill(); g.stroke();
      g.font = `600 14px ${css("--f-ui")}`; g.textAlign = "center"; g.textBaseline = "middle";
      const [mx, my] = pos(raisinBread[me]);
      for (const [k, d] of others) {
        const [x, y] = pos(raisinBread[k]), L = Math.hypot(x - mx, y - my);
        g.strokeStyle = C.cool; g.lineWidth = 2.5; g.setLineDash([6, 4]);
        g.beginPath(); g.moveTo(mx, my); g.lineTo(x, y); g.stroke(); g.setLineDash([]);
        const lx = (mx + x) / 2 - 16 * (y - my) / L, ly = (my + y) / 2 + 16 * (x - mx) / L;
        g.fillStyle = "rgba(255,255,255,0.85)"; g.fillRect(lx - 30, ly - 11, 60, 22);
        g.fillStyle = "#0e7490"; g.fillText(`${(d * a).toFixed(1)} cm`, lx, ly);
      }
      raisinBread.forEach((r, k) => {
        const [x, y] = pos(r);
        g.fillStyle = k === me ? C.hot : "#4a2c1a";
        g.beginPath(); g.ellipse(x, y, k === me ? 9 : 7, k === me ? 7 : 5, 0.5, 0, 2 * Math.PI); g.fill();
      });
      g.fillStyle = C.ink; g.textAlign = "left"; g.font = `600 17px ${css("--f-ui")}`;
      g.fillText(`a = ${a.toFixed(2)}`, 10, 18);
    };
    let raf;
    const frame = (ms) => {
      raf = requestAnimationFrame(frame);
      if (pdf) return draw(2);
      if (!box.closest("section").classList.contains("present")) return;
      draw(1 + Math.min((ms % 6000) / 4000, 1));
    };
    box._stop = () => cancelAnimationFrame(raf);
    box.replaceChildren(cv);
    raf = requestAnimationFrame(frame);
  },

  // a light wave stretched by the expansion, in a loop: emitted at a = 0.5 (blue, kept for comparison),
  // its wavelength grows with a(t) until a = 1 today (orange), then holds for 2 s. Draws only while its
  // slide is shown (the PDF: today).
  stretch: (box) => {
    box._stop?.();
    const C = colours(), W = 500, H = 300, ae = 0.5, pdf = /print-pdf/.test(location.search), xs = d3.range(0, 6.001, 0.02);
    const draw = (a) => box.replaceChildren(Plot.plot({
      width: W, height: H, marginLeft: 10, marginRight: 10, marginTop: 30, marginBottom: 40, style: style(C, "17px"),
      x: { domain: [0, 6], axis: null }, y: { domain: [-1.1, 2.6], axis: null },
      marks: [
        Plot.line(xs.map((x) => [x, 1.5 + 0.5 * Math.sin(2 * Math.PI * x)]), { stroke: C.cool, strokeWidth: 3 }),
        Plot.line(xs.map((x) => [x, -0.1 + 0.5 * Math.sin(2 * Math.PI * x * ae / a)]), { stroke: C.hot, strokeWidth: 3 }),
        Plot.text([[0, 2.35]], { text: () => `emitted, a = ${ae}`, textAnchor: "start", fill: C.cool, fontWeight: 700 }),
        Plot.text([[0, 0.75]], { text: () => `now: a = ${a.toFixed(2)}, wavelength × ${(a / ae).toFixed(2)}`, textAnchor: "start", fill: C.hot, fontWeight: 700 }),
        Plot.text([[6, -0.95]], { text: () => `1 + z = ${(a / ae).toFixed(2)}`, textAnchor: "end", fill: C.ink, fontWeight: 700 }),
      ],
    }));
    let raf, last;
    const frame = (ms) => {
      raf = requestAnimationFrame(frame);
      if (pdf) { if (last !== 1) draw(last = 1); return; }
      if (!box.closest("section").classList.contains("present")) return;
      const a = Math.round(100 * (ae + (1 - ae) * Math.min((ms % 6000) / 4000, 1))) / 100;
      if (a !== last) draw(last = a);
    };
    box._stop = () => cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  },

  // the density parameters Ωi(z) = Ωi,0 (1+z)^(3(1+wi)) / E(z)² of the Benchmark Model against 1 + z,
  // in the colours of Lectures 5 and 6, with dots at data-z (default 999). A checkbox data-k="flip"
  // puts high z on the left
  omz: (box, s) => {
    const C = colours(), z1 = +(box.dataset.z ?? 999), { Or, Om, OL } = benchmark;
    const parts = (x) => ({ r: Or * x ** 4, m: Om * x ** 3, L: OL });
    const omega = (x) => { const p = parts(x), E2 = p.r + p.m + p.L; return { r: p.r / E2, m: p.m / E2, L: p.L / E2 }; };
    const xs = d3.range(0, 5.0001, 0.01).map((e) => 10 ** e);
    const comps = [
      { k: "m", key: "matter, Ωm", c: C.accent, at: 30 },
      { k: "r", key: "radiation, Ωr", c: C.hot, at: 1e5, y: 0.6, anchor: "end" },
      { k: "L", key: "Λ, ΩΛ", c: C.good, at: 3, anchor: "start" },
    ];
    const at = omega(1 + z1), marks = [Plot.ruleX([1 + z1], { stroke: C.edge, strokeWidth: 1.5, strokeDasharray: "4 4" })];
    for (const q of comps) {
      marks.push(Plot.line(xs.map((x) => ({ x, y: omega(x)[q.k] })), { x: "x", y: "y", stroke: q.c, strokeWidth: 3.5 }),
        Plot.text([{ x: q.at, y: q.y ?? omega(q.at)[q.k] }], { x: "x", y: "y", text: () => q.key, fill: q.c, fontWeight: 700, dy: q.y ? 0 : -12, textAnchor: q.anchor ?? "middle" }),
        Plot.dot([{ x: 1 + z1, y: at[q.k] }], { x: "x", y: "y", r: 6, fill: q.c, stroke: C.bg, strokeWidth: 1.5 }));
    }
    marks.push(Plot.text([{ x: 1 + z1, y: 1.04 }], { x: "x", y: "y", text: () => `z = ${z1}`, fill: C.ink_soft }));
    box.replaceChildren(Plot.plot(withAxes({
      width: +(box.dataset.w ?? 520), height: +(box.dataset.h ?? 380), marginLeft: 50, marginBottom: 46, marginTop: 30, marginRight: 24, style: style(C),
      x: { type: "log", domain: [1, 1e5], reverse: !!s.flip, tickFormat: (d) => (Number.isInteger(Math.log10(d)) ? pow(d) : ""),
        label: s.flip ? "← 1 + z" : "1 + z →", labelAnchor: s.flip ? "left" : "right", labelArrow: "none" },
      y: { domain: [0, 1.08], ticks: [0, 0.2, 0.4, 0.6, 0.8, 1], label: "↑ Ωi(z)", labelAnchor: "top", labelArrow: "none" },
      marks,
    }, C.ink)));
  },
};

for (const box of document.querySelectorAll(".w-fig[data-widget]")) {
  const section = box.closest("section");
  const inputs = [...section.querySelectorAll("[data-k]")];
  const s = {};
  const read = () => inputs.forEach((el) => {
    s[el.dataset.k] = el.type === "checkbox" ? el.checked : el.tagName === "SELECT" ? el.value : Number(el.value);
  });
  // a widget that fails shows a note instead of stopping the others
  const redraw = () => {
    read();
    Promise.resolve().then(() => widgets[box.dataset.widget](box, s))
      .catch((e) => { box.textContent = `(widget failed to load: ${e.message})`; console.error(e); });
  };
  for (const el of inputs) {
    el.addEventListener("input", redraw);
    el.addEventListener("change", () => el.blur()); // arrow keys go back to changing slides
  }
  new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  redraw();
}
