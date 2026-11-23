// Model universes for the Lecture 5–8 widgets (Ryden ch. 5). Time is s = H0 (t − t0), distances
// are in units of the Hubble distance c/H0, and a(t0) = 1. Charts use Observable Plot (global Plot).
import { withAxes } from "./plot.js";

// Flat single-component universes and the empty (Milne) universe. For a power law a ∝ t^n the
// Big Bang is at s = −n; de Sitter (n = null) has no Big Bang. dash: the line style, so that the
// curves differ by more than colour.
export const single = {
  milne: { name: "Empty (Milne)", n: 1, label: "empty: a ∝ t", dash: "12 4 3 4" },
  matter: { name: "Matter only", n: 2 / 3, label: "matter: a ∝ t²ᐟ³", dash: null },
  radiation: { name: "Radiation only", n: 1 / 2, label: "radiation: a ∝ t¹ᐟ²", dash: "8 5" },
  lambda: { name: "Λ only (de Sitter)", n: null, label: "Λ: a ∝ exp(H₀t)", dash: "2 4" },
};

// a(s) for a single-component model (0 before a Big Bang)
export function aSingle(m, s) {
  const n = single[m].n;
  if (n === null) return Math.exp(s);
  return s <= -n ? 0 : (1 + s / n) ** n;
}

// Comoving distance r = ∫ ds/a from emission (scale factor ae) to today
export function rSingle(m, ae) {
  const n = single[m].n;
  if (n === null) return 1 / ae - 1;
  if (n === 1) return Math.log(1 / ae);
  return (n / (1 - n)) * (1 - ae ** ((1 - n) / n));
}

// Emission time s for scale factor ae
export function sSingle(m, ae) {
  const n = single[m].n;
  return n === null ? Math.log(ae) : n * (ae ** (1 / n) - 1);
}

// Horizon distance today (Infinity when the integral from the Big Bang diverges)
export function horSingle(m) {
  const n = single[m].n;
  return n !== null && n < 1 ? n / (1 - n) : Infinity;
}

// a(s) for matter + Λ + curvature (+ radiation), from today backwards and forwards, by RK4 on
// a'' = −Ωr/a³ − Ωm/(2a²) + ΩΛ a, starting at a = 1, a' = E(1) = 1 (the Friedmann equation fixes a').
// Returns the points and how the universe starts (bang or bounce) and ends (crunch or forever).
export function evolve({ Om, OL, Or = 0 }, smax = 4, amax = 4) {
  const acc = (a) => -Or / a ** 3 - 0.5 * Om / a ** 2 + OL * a;
  const run = (dir) => {
    let a = 1, v = 1, s = 0;
    const pts = [{ s, a }];
    for (let i = 0; i < 40000; i++) {
      const h = dir * 0.002 * Math.min(1, a / Math.max(Math.abs(v), 1e-3));
      const k1a = v, k1v = acc(a);
      const k2a = v + h / 2 * k1v, k2v = acc(a + h / 2 * k1a);
      const k3a = v + h / 2 * k2v, k3v = acc(a + h / 2 * k2a);
      const k4a = v + h * k3v, k4v = acc(a + h * k3a);
      const na = a + h / 6 * (k1a + 2 * k2a + 2 * k3a + k4a), nv = v + h / 6 * (k1v + 2 * k2v + 2 * k3v + k4v);
      s += h;
      if (na < 0.002) { pts.push({ s, a: 0 }); return { pts, end: "zero", s }; }
      if (Math.sign(nv) !== Math.sign(v)) return { pts, end: "turn", s, a: na };
      a = na; v = nv;
      if (i % 4 === 0) pts.push({ s, a });
      if (Math.abs(s) > smax || a > amax) { pts.push({ s, a }); return { pts, end: "open", s }; }
    }
    return { pts, end: "open", s };
  };
  const past = run(-1), future = run(1);
  let pts = [...past.pts.slice().reverse(), ...future.pts.slice(1)];  // in order of time
  // a turning point (bounce or maximum) is a mirror: the history on the far side is the reflection
  const reflect = (sc) => pts.map((p) => ({ s: 2 * sc - p.s, a: p.a }));
  if (past.end === "turn") pts = [...reflect(past.s).filter((p) => p.s < past.s && p.s >= -smax).reverse(), ...pts];
  if (future.end === "turn") pts = [...pts, ...reflect(future.s).filter((p) => p.s > future.s && p.s <= smax).reverse()];
  const bang = past.end === "zero" ? past.s : null;
  return {
    pts,
    bang,
    bounce: past.end === "turn" ? past.a : null,
    amax: future.end === "turn" ? future.a : null,
    crunch: future.end === "turn" && bang !== null ? 2 * future.s - bang : null,
  };
}

// time range of the a(t) plots, in units of the Hubble time, and the largest a shown. The plot
// keeps equal units on both axes: a step of 1 is as long in t as in a.
export const sRange = [-2.2, 4.2], aMax = 5.6;

export const singleColours = (C) => ({ milne: C.ink_soft, matter: C.accent, radiation: C.hot, lambda: C.good });

// The four curves of Lecture 5: a(s) for the empty, matter-only, radiation-only and Λ-only universes.
// show: which models to draw (default all). extra: more marks, drawn under the curves. C: theme
// colours. height sets the size (see aPlot). Returns the Plot figure.
export function singlePlot(C, { show = Object.keys(single), extra = [], height = 420, fontSize = "16px", font } = {}) {
  const col = singleColours(C);
  const marks = [
    Plot.ruleX([0], { stroke: C.edge, strokeDasharray: "4 4" }),
    ...extra,
    Plot.text([{ s: -0.05, a: 0.95 * aMax }], { x: "s", y: "a", text: () => "← past", textAnchor: "end", fill: C.ink_soft }),
    Plot.text([{ s: 0.05, a: 0.95 * aMax }], { x: "s", y: "a", text: () => "future →", textAnchor: "start", fill: C.ink_soft }),
    Plot.dot([{ s: 0, a: 1 }], { x: "s", y: "a", r: 5, fill: C.ink }),
    Plot.text([{ s: 0, a: 1 }], { x: "s", y: "a", text: () => "today", dx: 30, dy: 14, fill: C.ink }),
  ];
  for (const m of show) {
    const n = single[m].n, s0 = n === null ? sRange[0] : -n;
    const pts = d3.range(s0, sRange[1] + 1e-4, 0.01).map((s) => ({ s, a: aSingle(m, s) })).filter((p) => p.a <= aMax);
    marks.push(Plot.line(pts, { x: "s", y: "a", stroke: col[m], strokeWidth: 3, strokeDasharray: single[m].dash }));
    if (n !== null) marks.push(Plot.dot([{ s: s0, a: 0 }], { x: "s", y: "a", r: 5, fill: col[m] }));
  }
  // a key in the empty top left: a sample of each line style, then its label
  show.forEach((m, i) => {
    const a = (0.82 - 0.09 * i) * aMax;
    marks.push(Plot.line([{ s: -2.1, a }, { s: -1.6, a }], { x: "s", y: "a", stroke: col[m], strokeWidth: 3, strokeDasharray: single[m].dash }),
      Plot.text([{ s: -1.5, a }], { x: "s", y: "a", text: () => single[m].label, textAnchor: "start", fill: col[m], fontWeight: 700 }));
  });
  return aPlot(C, marks, { height, fontSize, font });
}

// a(t) axes shared by Lectures 5 and 6: time H0(t − t0) over range (default sRange) and a over [0, aMax],
// with equal units on both axes. height sets the size; the width follows, unless width is given (a
// small plot that cannot keep equal units). Returns the Plot figure.
export function aPlot(C, marks, { height = 420, width, fontSize = "16px", font, range = sRange } = {}) {
  const margin = { marginLeft: 50, marginBottom: 46, marginTop: 32, marginRight: 16 };
  width ??= Math.round((height - margin.marginTop - margin.marginBottom) * (range[1] - range[0]) / aMax + margin.marginLeft + margin.marginRight);
  return Plot.plot(withAxes({
    width, height, ...margin,
    style: { background: "transparent", color: C.ink, fontSize, fontFamily: font },
    x: { domain: range, ticks: d3.range(Math.ceil(range[0]), range[1] + 1e-9), tickFormat: "d", label: "time H₀(t − t₀) →", labelAnchor: "right", labelArrow: "none" },
    y: { domain: [0, aMax], ticks: d3.range(0, aMax + 1e-9), tickFormat: "d", label: "↑ scale factor a", labelAnchor: "top", labelArrow: "none" },
    marks,
  }, C.ink));
}

// Boundaries in the Ωm,0–ΩΛ,0 plane for matter + Λ + curvature (Carroll, Press & Turner 1992):
// above bounceLine there is no Big Bang; below crunchLine the universe recollapses.
export const bounceLine = (m) => m <= 0.5 ? 4 * m * Math.cosh(Math.acosh((1 - m) / m) / 3) ** 3 : 4 * m * Math.cos(Math.acos((1 - m) / m) / 3) ** 3;
export const crunchLine = (m) => m <= 1 ? 0 : 4 * m * Math.cos(Math.acos((1 - m) / m) / 3 + 4 * Math.PI / 3) ** 3;

// a(t) curves for matter + Λ + curvature from Lecture 6 on, against H0(t − t0): the axes of Lecture 5,
// centred on today
export const fateRange = [-3.2, 3.2];
export const history = (Om, OL) => evolve({ Om, OL }, fateRange[1] + 0.2, aMax + 0.5);

// The a(t) plot of Lecture 6 and later. curves: { pts, colour, width, opacity, dash, label, at, anchor,
// dx, dy, key, step }; a curve with a key gets a row in the key at the top left, and step puts the
// class step-k on its marks (shown by a later click). today: mark today. extra: more marks, on top.
export function fatePlot(C, curves, { height = 400, width, fontSize, extra = [], today = true } = {}) {
  const marks = [
    Plot.ruleX([0], { stroke: C.edge, strokeDasharray: "4 4" }),
    ...(today ? [Plot.dot([{ s: 0, a: 1 }], { x: "s", y: "a", r: 5, fill: C.ink }),
      Plot.text([{ s: 0, a: 1 }], { x: "s", y: "a", text: () => "today", dx: -8, dy: -12, textAnchor: "end", fill: C.ink })] : []),
  ];
  for (const c of curves) {
    const className = c.step ? `step-${c.step}` : undefined;
    marks.push(Plot.line(c.pts, { x: "s", y: "a", stroke: c.colour, strokeWidth: c.width ?? 3, strokeOpacity: c.opacity, strokeDasharray: c.dash, clip: true, className }));
    if (c.label) marks.push(Plot.text([c.at], { x: "s", y: "a", text: () => c.label, fill: c.colour, fontWeight: 700, textAnchor: c.anchor ?? "start", dx: c.dx ?? 0, dy: c.dy ?? 0, clip: true, className }));
  }
  // a key in the empty top left, as in Lecture 5, for the curves with a key
  curves.filter((c) => c.key).forEach((c, i) => {
    const a = (0.82 - 0.09 * i) * aMax, s0 = fateRange[0] + 0.1, className = c.step ? `step-${c.step}` : undefined;
    marks.push(Plot.line([{ s: s0, a }, { s: s0 + 0.5, a }], { x: "s", y: "a", stroke: c.colour, strokeWidth: c.width ?? 3, strokeDasharray: c.dash, className }),
      Plot.text([{ s: s0 + 0.6, a }], { x: "s", y: "a", text: () => c.key, textAnchor: "start", fill: c.colour, fontWeight: 700, className }));
  });
  const font = getComputedStyle(document.documentElement).getPropertyValue("--f-ui").trim();
  return aPlot(C, [...marks, ...extra], { height, width, fontSize, font, range: fateRange });
}

// With data-steps on the box, the curves of step k show once k groups of clicks on the slide are shown
// (all of them in the PDF layout, which shows every click)
export function showSteps(box) {
  const sec = box.closest("section");
  const update = () => {
    const shown = /print-pdf/.test(location.search) ? Infinity
      : new Set([...sec.querySelectorAll(".fragment.visible")].map((f) => f.dataset.fragmentIndex)).size;
    for (const g of box.querySelectorAll("[class*='step-']")) {
      const k = +[...g.classList].find((c) => c.startsWith("step-")).slice(5);
      g.style.opacity = k <= shown ? 1 : 0;
    }
  };
  update();
  if (!box.dataset.bound) {
    box.dataset.bound = "1";
    for (const ev of ["fragmentshown", "fragmenthidden", "slidechanged"]) Reveal.on(ev, update);
  }
}

// The scale factor where the expansion stops (H = 0) between a1 and a2, or null: the first sign change
// of E² = Ωr/a⁴ + Ωm/a³ + ΩΛ + (1 − Ωr − Ωm − ΩΛ)/a², found on a log grid and refined by bisection. The
// fate does not depend on how far the a(t) curves are drawn, so a Big Crunch at a = 100 is still found.
export function turning(Om, OL, a1, a2, Or = 0) {
  const E2 = (a) => Or / a ** 4 + Om / a ** 3 + OL + (1 - Or - Om - OL) / a ** 2;
  const n = 3000, r = (a2 / a1) ** (1 / n);
  for (let i = 1, lo = a1; i <= n; i++, lo *= r) {
    let hi = lo * r;
    if (E2(hi) > 0) continue;
    for (let j = 0; j < 50; j++) { const mid = Math.sqrt(lo * hi); if (E2(mid) > 0) lo = mid; else hi = mid; }
    return lo;
  }
  return null;
}

// Ryden's Figure 5.7: four universes with Ωm,0 = 0.31, told apart by line style as well as colour
// (not gold, which is the chosen universe on the slider slides). step: the click that shows the curve.
export const fates = (C) => [
  { name: "Big Chill", OL: 0.69, colour: C.good, at: { s: 1.1, a: 2.3 }, dx: 10, step: 1 },
  { name: "Big Crunch", OL: -0.31, colour: C.hot, dash: "8 5", at: { s: 1.3, a: 0.55 }, step: 1 },
  { name: "Loitering", OL: 1.7289, colour: C.cool, dash: "2 4", at: { s: -3.1, a: 0.2 }, step: 2 },
  { name: "Big Bounce", OL: 1.8, colour: C.accent, dash: "12 4 3 4", at: { s: 0.6, a: 3.6 }, anchor: "end", step: 2 },
].map((f) => ({ ...f, pts: history(0.31, f.OL).pts, label: f.name }));
