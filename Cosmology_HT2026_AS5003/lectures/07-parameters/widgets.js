// Lecture 7 widgets. Each slide with a widget has a figure box <div class="w-fig" data-widget="name">
// and inputs with a data-k="name" attribute; the widget redraws when an input changes and when the
// light/dark theme is switched. Charts use Observable Plot and d3 (from the CDN).
import { benchmark, E, simpson, c_kms } from "../../_shared/cosmo.js";
import { single, aMax, fateRange, evolve, history, fatePlot, fates, showSteps, bounceLine, crunchLine, turning } from "../../_shared/models.js";
import { withAxes } from "../../_shared/plot.js";
import { union21 } from "./union21.js";

const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const colours = () => Object.fromEntries(["ink", "ink-soft", "accent", "hot", "cool", "good", "gold", "edge", "bg"].map((k) => [k.replace("-", "_"), css(`--${k}`)]));
const style = (C, fontSize = "16px") => ({ background: "transparent", color: C.ink, fontSize, fontFamily: css("--f-ui") });
const fill = (box, v) => { for (const el of box.closest("section").querySelectorAll("[data-v]")) el.textContent = v[el.dataset.v] ?? ""; };
const minus = (s) => s.replace("-", "−");

// Comoving distance r(z) and Sκ(r), in units of c/H0, for matter + Λ + curvature, on a grid of
// redshifts up to zmax (trapezoid rule in ln a). Returns null when light from zmax would have left
// before a Big Bounce (no such redshift exists in that universe).
function distances(Om, OL, zmax, n = 400) {
  const Ok = 1 - Om - OL, Ez = (a) => Math.sqrt(Om / a ** 3 + OL + Ok / a ** 2);
  const amin = turning(Om, OL, 1, 1e-3);
  if (amin !== null && amin > 1 / (1 + zmax)) return null;
  const lo = -Math.log(1 + zmax), dx = lo / n, out = [{ z: 0, r: 0, S: 0 }];
  let r = 0;
  for (let i = 1; i <= n; i++) {
    const a0 = Math.exp((i - 1) * dx), a1 = Math.exp(i * dx);
    r += -0.5 * (1 / (a0 * Ez(a0)) + 1 / (a1 * Ez(a1))) * dx;
    const S = Ok > 1e-6 ? Math.sinh(Math.sqrt(Ok) * r) / Math.sqrt(Ok) : Ok < -1e-6 ? Math.sin(Math.sqrt(-Ok) * r) / Math.sqrt(-Ok) : r;
    out.push({ z: 1 / a1 - 1, r, S });
  }
  return out;
}
// linear interpolation of a distance table at redshift z
const at = (tab, z, key = "S") => {
  const i = d3.bisector((d) => d.z).left(tab, z);
  if (i <= 0) return tab[0][key];
  const p = tab[i - 1], q = tab[i];
  return p[key] + (q[key] - p[key]) * (z - p.z) / (q.z - p.z);
};

// The four flat or empty universes of Lectures 5 and 6, as Sκ(r) in units of c/H0, styled as before
const models = (C) => [
  { key: "Benchmark Model", S: (z) => simpson((x) => 1 / (Math.exp(x) * E(Math.exp(x))), -Math.log(1 + z), 0, 200), c: C.ink, width: 6 },
  { key: single.milne.label, S: (z) => Math.sinh(Math.log(1 + z)), c: C.ink_soft, dash: single.milne.dash },
  { key: single.matter.label, S: (z) => 2 * (1 - 1 / Math.sqrt(1 + z)), c: C.accent },
  { key: single.lambda.label, S: (z) => z, c: C.good, dash: single.lambda.dash },
];

// distance modulus m − M = 5 log10(dL / 1 Mpc) + 25, with dL = Sκ(r)(1 + z) c/H0; H0 = 70 as in Union2.1
const H0sn = 70;
const mu = (S, z) => 5 * Math.log10(S * (1 + z) * c_kms / H0sn) + 25;

// χ² of the supernovae for each (Ωm,0, ΩΛ,0) on a grid, with the zero point of the magnitudes (H0 and
// the supernova luminosity together) fitted for each universe; computed once
const grid = { m: [0, 1.5], l: [-0.5, 2], n: 76 };
let chi2Grid = null;
function chi2() {
  if (chi2Grid) return chi2Grid;
  const zmax = union21[union21.length - 1][0], w = union21.map((d) => 1 / d[2] ** 2), W = d3.sum(w);
  const vals = new Float64Array(grid.n * grid.n);
  for (let j = 0; j < grid.n; j++) for (let i = 0; i < grid.n; i++) {
    const Om = grid.m[0] + (grid.m[1] - grid.m[0]) * i / (grid.n - 1), OL = grid.l[0] + (grid.l[1] - grid.l[0]) * j / (grid.n - 1);
    const tab = distances(Om, OL, zmax, 200);
    if (!tab || tab.some((d) => !(d.S > 0) && d.z > 0)) { vals[j * grid.n + i] = Infinity; continue; }
    const res = union21.map((d) => d[1] - mu(at(tab, d[0]), d[0]));
    const off = d3.sum(res, (r, k) => r * w[k]) / W;
    vals[j * grid.n + i] = d3.sum(res, (r, k) => (r - off) ** 2 * w[k]);
  }
  const min = d3.min(vals);
  chi2Grid = Array.from(vals, (v) => Math.min(v - min, 50));
  return chi2Grid;
}

// the supernovae in bins of log z: weighted means of z and of resid(d), and the error of the mean
const binned = (resid) => {
  const edges = d3.range(Math.log10(0.015), Math.log10(1.5) + 1e-9, 0.15);
  return edges.slice(0, -1).map((e, i) => {
    const sel = union21.filter((d) => Math.log10(d[0]) >= e && Math.log10(d[0]) < edges[i + 1]);
    const w = sel.map((d) => 1 / d[2] ** 2), W = d3.sum(w);
    return sel.length < 3 ? null : { z: d3.sum(sel, (d, k) => d[0] * w[k]) / W, d: d3.sum(sel, (d, k) => resid(d) * w[k]) / W, e: 1 / Math.sqrt(W) };
  }).filter(Boolean);
};

const widgets = {
  // the four universes of Ryden Fig. 5.7 (Lecture 6); with data-steps, the first click adds the
  // Benchmark Model (thick, in the ink colour, under the Big Chill curve it almost follows)
  fates: (box) => {
    const C = colours(), steps = "steps" in box.dataset;
    const bench = { pts: evolve(benchmark, fateRange[1] + 0.2, aMax + 0.5).pts, colour: C.ink, width: 6, key: "Benchmark Model", step: 1 };
    box.replaceChildren(fatePlot(C, [...(steps ? [bench] : []), ...fates(C).map((f) => ({ ...f, step: undefined }))], { height: +(box.dataset.h ?? 400) }));
    if (steps) showSteps(box);
  },

  // a(t) near today and its Taylor expansion, for a flat universe with matter and Λ (slider Om):
  // the first order is the empty universe, a = 1 + H0(t − t0); the second adds −q0 H0²(t − t0)²/2
  taylor: (box, s) => {
    const C = colours(), Om = s.Om, OL = 1 - Om, q0 = Om / 2 - OL;
    const ss = d3.range(fateRange[0], fateRange[1] + 1e-4, 0.01);
    const curves = [
      { pts: history(Om, OL).pts, colour: C.gold, width: 10, opacity: 0.45, key: "exact a(t)" },
      { pts: ss.map((x) => ({ s: x, a: 1 + x })).filter((p) => p.a >= 0), colour: C.ink_soft, dash: single.milne.dash, key: "1st order: H₀ only" },
      { pts: ss.map((x) => ({ s: x, a: 1 + x - q0 * x * x / 2 })).filter((p) => p.a >= 0), colour: C.ink, width: 2.5, dash: "6 4", key: "2nd order: H₀ and q₀" },
    ];
    box.replaceChildren(fatePlot(C, curves, { height: +(box.dataset.h ?? 400) }));
    fill(box, { Om: Om.toFixed(2), OL: OL.toFixed(2), q0: minus(q0.toFixed(2)), accel: q0 < 0 ? "speeding up" : q0 > 0 ? "slowing down" : "coasting" });
  },

  // luminosity distance (data-q="dL", after Ryden Fig. 6.2) or angular-diameter distance (data-q="dA",
  // Fig. 6.4) against redshift, for the Benchmark Model and the universes of Lecture 5, in c/H0
  dz: (box) => {
    const C = colours(), q = box.dataset.q ?? "dL", zs = d3.range(0, 10.0001, 0.05);
    const f = q === "dL" ? (S, z) => S * (1 + z) : (S, z) => S / (1 + z);
    const ymax = q === "dL" ? 25 : 1.05, ms = models(C);
    const marks = ms.map((m) => Plot.line(zs.map((z) => ({ z, d: f(m.S(z), z) })), { x: "z", y: "d", stroke: m.c, strokeWidth: m.width ?? 3, strokeDasharray: m.dash, clip: true }));
    // the maximum of dA in the Benchmark Model, as a gold dot with its own row in the key
    const top = q === "dA" ? d3.greatest(d3.range(0.5, 4, 0.01).map((z) => ({ z, d: ms[0].S(z) / (1 + z) })), (p) => p.d) : null;
    if (top) marks.push(Plot.dot([top], { x: "z", y: "d", r: 6, fill: C.gold }));
    // the key, in the empty space on the right, under the Λ-only curve
    const rows = ms.map((m) => ({ key: m.key, c: m.c, width: m.width, dash: m.dash }));
    if (top) rows.push({ key: `maximum, z = ${top.z.toFixed(1)}`, c: C.gold, dot: true });
    rows.forEach((m, i) => {
      const d = ((q === "dL" ? 0.27 : 0.78) - (q === "dL" ? 0.07 : 0.065) * i) * ymax, z0 = 5.4;
      marks.push(m.dot ? Plot.dot([{ z: z0 + 0.4, d }], { x: "z", y: "d", r: 6, fill: m.c })
        : Plot.line([{ z: z0, d }, { z: z0 + 0.8, d }], { x: "z", y: "d", stroke: m.c, strokeWidth: m.width ?? 3, strokeDasharray: m.dash }),
        Plot.text([{ z: z0 + 1, d }], { x: "z", y: "d", text: () => m.key, textAnchor: "start", fill: m.c, fontWeight: 700 }));
    });
    box.replaceChildren(Plot.plot(withAxes({
      width: +(box.dataset.w ?? 520), height: +(box.dataset.h ?? 400), marginLeft: 56, marginBottom: 46, marginTop: 32, marginRight: 20, style: style(C),
      x: { domain: [0, 10], label: "redshift z →", labelAnchor: "right", labelArrow: "none" },
      y: { domain: [0, ymax], label: q === "dL" ? "↑ luminosity distance dL (c/H₀)" : "↑ angular-diameter distance dA (c/H₀)", labelAnchor: "top", labelArrow: "none" },
      marks,
    }, C.ink)));
  },

  // toy type Ia supernova light curves: broader light curves are brighter at peak. With the checkbox
  // data-k="std", time is divided by the stretch s and the brightness by the peak luminosity it implies.
  snlc: (box, s) => {
    const C = colours(), stretch = [0.8, 0.9, 1.0, 1.1, 1.2], cols = [C.hot, C.accent, C.ink_soft, C.good, C.cool];
    const peak = (k) => 4 * (1 + 1.25 * (k - 1));            // 10⁹ L☉: 3 to 5, from narrow to broad
    const shape = (x) => (x < 0 ? Math.exp(-0.5 * (x / 7) ** 2) : 0.55 * Math.exp(-x / 25) + 0.45 * Math.exp(-0.5 * (x / 11) ** 2));
    const ts = d3.range(-20, 60.001, 0.5);
    const marks = stretch.map((k, i) => Plot.line(ts.map((t) => s.std ? { t, L: 4 * shape(t) } : { t, L: peak(k) * shape(t / k) }),
      { x: "t", y: "L", stroke: cols[i], strokeWidth: 3, strokeDasharray: s.std && i ? "6 6" : null, strokeDashoffset: i * 2 }));
    box.replaceChildren(Plot.plot(withAxes({
      width: +(box.dataset.w ?? 500), height: +(box.dataset.h ?? 380), marginLeft: 56, marginBottom: 46, marginTop: 32, marginRight: 20, style: style(C),
      x: { domain: [-20, 60], label: s.std ? "time since peak ÷ stretch (days) →" : "time since peak (days) →", labelAnchor: "right", labelArrow: "none" },
      y: { domain: [0, 5.5], label: s.std ? "↑ luminosity, corrected (10⁹ L☉)" : "↑ luminosity (10⁹ L☉)", labelAnchor: "top", labelArrow: "none" },
      marks,
    }, C.ink)));
  },

  // Hubble diagram of the Union2.1 supernovae, with the universes of Lecture 5 and the Benchmark Model.
  // data-mode: "cover" (m − M only), "both" (m − M and the difference from the empty universe),
  // "resid" (the difference only, with the universe chosen on the plane as a gold curve)
  hubble: (box, s) => {
    const C = colours(), mode = box.dataset.mode ?? "both", W = +(box.dataset.w ?? 520);
    const zs = d3.range(Math.log10(0.01), Math.log10(2) + 1e-9, 0.01).map((x) => 10 ** x);
    const empty = (z) => mu(Math.sinh(Math.log(1 + z)), z);
    const ms = models(C).map((m) => ({ ...m, pts: zs.map((z) => ({ z, mu: mu(m.S(z), z), d: mu(m.S(z), z) - empty(z) })) }));
    const xAxis = { type: "log", domain: [0.01, 2], ticks: [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2], tickFormat: (d) => String(d), label: "redshift z →", labelAnchor: "right", labelArrow: "none" };
    const key = (y0, dy, ymax) => ms.flatMap((m, i) => {
      const y = y0 - dy * i;
      return [Plot.line([{ z: 0.012, y }, { z: 0.02, y }], { x: "z", y: "y", stroke: m.c, strokeWidth: m.width ?? 3, strokeDasharray: m.dash }),
        Plot.text([{ z: 0.022, y }], { x: "z", y: "y", text: () => m.key, textAnchor: "start", fill: m.c, fontWeight: 700 })];
    });
    const plots = [];
    if (mode !== "resid") {
      const marks = [
        Plot.dot(union21, { x: (d) => d[0], y: (d) => d[1], r: 2, fill: C.ink_soft, fillOpacity: 0.6 }),
        ...ms.map((m) => Plot.line(m.pts, { x: "z", y: "mu", stroke: m.c, strokeWidth: m.width ?? 2.5, strokeDasharray: m.dash, strokeOpacity: m.width ? 0.85 : 1 })),
      ];
      if (mode === "both") marks.push(...key(45, 1.1));
      plots.push(Plot.plot(withAxes({
        width: W, height: +(box.dataset.h ?? (mode === "cover" ? 395 : 300)), marginLeft: 56, marginBottom: mode === "cover" ? 46 : 30, marginTop: 32, marginRight: 20, style: style(C),
        x: mode === "cover" ? xAxis : { ...xAxis, label: null },
        y: { domain: [33, 46], label: "↑ distance modulus m − M", labelAnchor: "top", labelArrow: "none" },
        marks,
      }, C.ink)));
    }
    if (mode !== "cover") {
      const marks = [Plot.ruleY([0], { stroke: C.edge, strokeDasharray: "4 4" })];
      const bins = binned((d) => d[1] - empty(d[0]));
      if (s.Om !== undefined) {
        const tab = distances(s.Om, s.OL, 2.05);
        if (tab) marks.push(Plot.line(zs.map((z) => ({ z, d: mu(at(tab, z), z) - empty(z) })).filter((p) => isFinite(p.d)), { x: "z", y: "d", stroke: C.gold, strokeWidth: 10, strokeOpacity: 0.45 }));
      }
      marks.push(...ms.map((m) => Plot.line(m.pts, { x: "z", y: "d", stroke: m.c, strokeWidth: m.width ?? 2.5, strokeDasharray: m.dash })),
        Plot.ruleX(bins, { x: "z", y1: (b) => b.d - b.e, y2: (b) => b.d + b.e, stroke: C.ink, strokeWidth: 2 }),
        Plot.dot(bins, { x: "z", y: "d", r: 5, fill: C.ink, stroke: C.bg, strokeWidth: 1.5 }),
        Plot.text([{ z: 0.011, y: 0.33 }], { x: "z", y: "y", text: () => "↑ fainter: farther away", textAnchor: "start", fill: C.ink_soft }),
        Plot.text([{ z: 0.011, y: -0.2 }], { x: "z", y: "y", text: () => "↓ brighter: closer", textAnchor: "start", fill: C.ink_soft }));
      if (mode === "resid") marks.push(...key(-0.5, 0.12));
      plots.push(Plot.plot(withAxes({
        width: W, height: +(box.dataset.h2 ?? 200), marginLeft: 56, marginBottom: 46, marginTop: 24, marginRight: 20, style: style(C),
        x: xAxis,
        y: { domain: [-1, 0.5], ticks: [-1, -0.5, 0, 0.5], tickFormat: (d) => minus(String(d)), label: "↑ m − M, minus empty universe", labelAnchor: "top", labelArrow: "none" },
        marks,
      }, C.ink)));
    }
    box.replaceChildren(...plots);
  },

  // the Ωm,0–ΩΛ,0 plane with the 68, 95 and 99.7% regions allowed by the Union2.1 supernovae (after
  // Ryden Fig. 6.6), the flat and coasting (q0 = 0) lines, and the regions of Lecture 6. A click picks
  // a universe: it sets the inputs Om and OL, drawn as the gold curve of the hubble widget.
  snplane: (box, s) => {
    const C = colours(), ms = d3.range(0.002, grid.m[1] + 1e-4, 0.01);
    const plane = Plot.plot(withAxes({
      width: 400, height: 440, marginLeft: 56, marginBottom: 46, marginTop: 32, marginRight: 12, style: style(C, "15px"),
      x: { domain: grid.m, label: "Ωm,0 →", labelAnchor: "right", labelArrow: "none" },
      y: { domain: grid.l, label: "↑ ΩΛ,0", labelAnchor: "top", labelArrow: "none" },
      marks: [
        Plot.areaY(ms, { x: (m) => m, y1: (m) => Math.min(bounceLine(m), grid.l[1]), y2: grid.l[1], fill: C.accent, fillOpacity: 0.12 }),
        Plot.areaY(ms, { x: (m) => m, y1: grid.l[0], y2: (m) => Math.max(grid.l[0], crunchLine(m)), fill: C.hot, fillOpacity: 0.12 }),
        // filled inside Δχ² = 11.83, 6.18, 2.30: the 99.7, 95 and 68% regions for two parameters
        Plot.contour(chi2(), { width: grid.n, height: grid.n, x1: grid.m[0], x2: grid.m[1], y1: grid.l[0], y2: grid.l[1], value: (v) => -v, thresholds: [-11.83], fill: C.cool, fillOpacity: 0.25, stroke: C.cool }),
        Plot.contour(chi2(), { width: grid.n, height: grid.n, x1: grid.m[0], x2: grid.m[1], y1: grid.l[0], y2: grid.l[1], value: (v) => -v, thresholds: [-6.18], fill: C.cool, fillOpacity: 0.3, stroke: C.cool }),
        Plot.contour(chi2(), { width: grid.n, height: grid.n, x1: grid.m[0], x2: grid.m[1], y1: grid.l[0], y2: grid.l[1], value: (v) => -v, thresholds: [-2.3], fill: C.cool, fillOpacity: 0.4, stroke: C.cool, strokeWidth: 2 }),
        Plot.line([[0, 1], [1.5, -0.5]], { stroke: C.ink_soft, strokeWidth: 1.5, strokeDasharray: "6 5" }),
        Plot.text([[1.32, -0.32]], { text: () => "flat", rotate: 38, fill: C.ink_soft, dy: -8 }),
        Plot.line([[0, 0], [1.5, 0.75]], { stroke: C.ink_soft, strokeWidth: 1.5, strokeDasharray: "2 4" }),
        Plot.text([[1.48, 0.74]], { text: () => "q₀ < 0: speeding up ↑", textAnchor: "end", fill: C.ink_soft, dy: -12 }),
        Plot.text([[1.48, 0.74]], { text: () => "q₀ > 0: slowing down ↓", textAnchor: "end", fill: C.ink_soft, dy: 12 }),
        Plot.text([[0.05, 1.85]], { text: () => "no Big Bang (bounce)", textAnchor: "start", fill: C.accent, fontWeight: 700 }),
        Plot.text([[1.45, -0.42]], { text: () => "Big Crunch", textAnchor: "end", fill: C.hot, fontWeight: 700 }),
        Plot.text([[0.05, -0.4]], { text: () => "supernovae: 68, 95, 99.7%", textAnchor: "start", fill: C.cool, fontWeight: 700 }),
        Plot.dot([[benchmark.Om, benchmark.OL]], { symbol: "star", r: 7, fill: C.gold }),
        Plot.dot([[s.Om, s.OL]], { r: 7, fill: C.ink, stroke: C.bg, strokeWidth: 2 }),
      ],
    }, C.ink));
    plane.style.cursor = "crosshair";
    plane.addEventListener("click", (e) => {
      const r = plane.getBoundingClientRect(), k = 400 / r.width, sec = box.closest("section");
      const m = plane.scale("x").invert((e.clientX - r.left) * k), l = plane.scale("y").invert((e.clientY - r.top) * k);
      sec.querySelector('[data-k="Om"]').value = Math.min(grid.m[1], Math.max(0, m)).toFixed(2);
      sec.querySelector('[data-k="OL"]').value = Math.min(grid.l[1], Math.max(grid.l[0], l)).toFixed(2);
      sec.querySelector('[data-k="Om"]').dispatchEvent(new Event("input"));
    });
    box.replaceChildren(plane);
    fill(box, { Om: s.Om.toFixed(2), OL: minus(s.OL.toFixed(2)), q0: minus((s.Om / 2 - s.OL).toFixed(2)) });
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
