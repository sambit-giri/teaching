// Lecture 6 widgets. Each slide with a widget has a figure box <div class="w-fig" data-widget="name">
// and inputs with a data-k="name" attribute; the widget redraws when an input changes and when the
// light/dark theme is switched. Charts use Observable Plot and d3 (from the CDN).
import { hubbleTime, benchmark, E, simpson } from "../../_shared/cosmo.js";
import { singlePlot, evolve } from "../../_shared/models.js";
import { withAxes } from "../../_shared/plot.js";

const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const colours = () => Object.fromEntries(["ink", "ink-soft", "accent", "hot", "cool", "good", "gold", "edge", "bg"].map((k) => [k.replace("-", "_"), css(`--${k}`)]));
const style = (C, fontSize = "16px") => ({ background: "transparent", color: C.ink, fontSize, fontFamily: css("--f-ui") });
const tH = hubbleTime(benchmark.H0);                     // 1/H0 in Gyr

// Boundaries in the Ωm,0–ΩΛ,0 plane for matter + Λ + curvature (Carroll, Press & Turner 1992):
// above bounceLine there is no Big Bang; below crunchLine the universe recollapses.
const bounceLine = (m) => m <= 0.5 ? 4 * m * Math.cosh(Math.acosh((1 - m) / m) / 3) ** 3 : 4 * m * Math.cos(Math.acos((1 - m) / m) / 3) ** 3;
const crunchLine = (m) => m <= 1 ? 0 : 4 * m * Math.cos(Math.acos((1 - m) / m) / 3 + 4 * Math.PI / 3) ** 3;

// a(t) curves for matter + Λ + curvature, against H0(t − t0)
function fatePlot(C, curves, { width = 520, height = 380 } = {}) {
  const marks = [
    Plot.ruleX([0], { stroke: C.edge, strokeDasharray: "4 4" }),
    Plot.dot([{ s: 0, a: 1 }], { x: "s", y: "a", r: 5, fill: C.ink }),
    Plot.text([{ s: 0, a: 1 }], { x: "s", y: "a", text: () => "today", dx: -8, dy: -12, textAnchor: "end", fill: C.ink }),
  ];
  for (const c of curves) {
    marks.push(Plot.line(c.pts, { x: "s", y: "a", stroke: c.colour, strokeWidth: c.width ?? 3, strokeDasharray: c.dash, clip: true }));
    if (c.label) marks.push(Plot.text([c.at], { x: "s", y: "a", text: () => c.label, fill: c.colour, fontWeight: 700, textAnchor: c.anchor ?? "start", dx: c.dx ?? 0, dy: c.dy ?? 0, clip: true }));
  }
  return Plot.plot(withAxes({
    width, height, marginLeft: 50, marginBottom: 46, marginTop: 32, marginRight: 16, style: style(C),
    x: { domain: [-4, 4], label: "time H₀(t − t₀) →", labelAnchor: "right", labelArrow: "none" },
    y: { domain: [0, 3], ticks: 6, label: "↑ scale factor a", labelAnchor: "top", labelArrow: "none" },
    marks,
  }, C.ink));
}

// One line about a universe's history, from evolve()
function describe(Om, OL, u) {
  const O0 = Om + OL, k = Math.abs(O0 - 1) < 0.005 ? "flat, κ = 0" : O0 > 1 ? "κ = +1" : "κ = −1";
  const start = u.bang !== null ? `Big Bang ${(-u.bang).toFixed(2)}/H₀ = ${(-u.bang * tH).toFixed(1)} Gyr ago` : `no Big Bang: a bounce at a = ${u.bounce.toFixed(2)}`;
  const end = u.amax !== null ? `Big Crunch, after a maximum a = ${u.amax.toFixed(2)}` : "expands forever";
  return { O0: O0.toFixed(2), k, start, end, accel: OL > Om / 2 ? "speeding up" : "slowing down" };
}

const fill = (box, v) => { for (const el of box.closest("section").querySelectorAll("[data-v]")) el.textContent = v[el.dataset.v] ?? ""; };

// Ryden's Figure 5.7: four universes with Ωm,0 = 0.31, told apart by line style as well as colour
const fates = (C) => [
  { name: "Big Chill", OL: 0.69, colour: C.good, at: { s: 1.1, a: 2.3 }, dx: 10 },
  { name: "Big Crunch", OL: -0.31, colour: C.hot, dash: "8 5", at: { s: 2.3, a: 0.55 } },
  { name: "Loitering", OL: 1.7289, colour: C.gold, dash: "2 4", at: { s: -3.9, a: 0.62 } },
  { name: "Big Bounce", OL: 1.8, colour: C.accent, dash: "12 4 3 4", at: { s: -3.0, a: 2.6 }, anchor: "start" },
].map((f) => ({ ...f, pts: evolve({ Om: 0.31, OL: f.OL }).pts, label: f.name }));

const widgets = {
  single: (box) => box.replaceChildren(singlePlot(colours(), { height: +(box.dataset.h ?? 400), font: css("--f-ui") })),

  // matter + Λ + curvature. data-mode: "fates" (the four curves of Ryden Fig. 5.7, no inputs),
  // "mk" (slider Om, no Λ), "flat" (slider Om, ΩΛ = 1 − Ωm), "plane" (sliders Om and OL, presets,
  // and the Ωm–ΩΛ plane, which can be clicked)
  fate: (box, s) => {
    const C = colours(), mode = box.dataset.mode;
    if (mode === "fates") {
      box.replaceChildren(fatePlot(C, fates(C), { width: +(box.dataset.w ?? 520), height: +(box.dataset.h ?? 340) }));
      return;
    }
    const Om = s.Om, OL = mode === "mk" ? 0 : mode === "flat" ? 1 - s.Om : s.OL;
    const u = evolve({ Om, OL });
    const eds = { pts: evolve({ Om: 1, OL: 0 }).pts, colour: C.ink_soft, width: 2, dash: "6 5", label: "Einstein–de Sitter", at: { s: 3.9, a: 2.65 }, anchor: "end" };
    const curves = [...(mode === "plane" ? [] : [eds]), { pts: u.pts, colour: C.accent }];
    const aplot = fatePlot(C, curves, mode === "plane" ? { width: 470, height: 360 } : { width: 540, height: 400 });
    fill(box, { Om: Om.toFixed(2), OL: OL.toFixed(2), ...describe(Om, OL, u) });
    if (mode !== "plane") { box.replaceChildren(aplot); return; }

    const ms = d3.range(0.002, 3.0001, 0.01);
    const plane = Plot.plot(withAxes({
      width: 400, height: 360, marginLeft: 56, marginBottom: 46, marginTop: 32, marginRight: 12, style: style(C, "15px"),
      x: { domain: [0, 3], label: "Ωm,0 →", labelAnchor: "right", labelArrow: "none" },
      y: { domain: [-1, 3], label: "↑ ΩΛ,0", labelAnchor: "top", labelArrow: "none" },
      marks: [
        Plot.areaY(ms, { x: (m) => m, y1: (m) => Math.min(bounceLine(m), 3), y2: 3, fill: C.accent, fillOpacity: 0.12 }),
        Plot.areaY(ms, { x: (m) => m, y1: -1, y2: (m) => crunchLine(m), fill: C.hot, fillOpacity: 0.12 }),
        Plot.line(ms, { x: (m) => m, y: (m) => bounceLine(m), stroke: C.accent, strokeWidth: 2, clip: true }),
        Plot.line(ms, { x: (m) => m, y: (m) => crunchLine(m), stroke: C.hot, strokeWidth: 2 }),
        Plot.line([[0, 1], [2, -1]], { stroke: C.ink_soft, strokeWidth: 1.5, strokeDasharray: "6 5" }),
        Plot.text([[1.75, -0.6]], { text: () => "flat", rotate: 33, fill: C.ink_soft, dy: -8 }),
        Plot.text([[0.15, 2.7]], { text: () => "no Big Bang (bounce)", textAnchor: "start", fill: C.accent, fontWeight: 700 }),
        Plot.text([[2.9, -0.75]], { text: () => "Big Crunch", textAnchor: "end", fill: C.hot, fontWeight: 700 }),
        Plot.text([[2.1, 1.4]], { text: () => "expands forever", fill: C.ink_soft, fontWeight: 700 }),
        Plot.dot([[benchmark.Om, benchmark.OL]], { symbol: "star", r: 7, fill: C.gold }),
        Plot.dot([[Om, OL]], { r: 7, fill: C.ink, stroke: C.bg, strokeWidth: 2 }),
      ],
    }, C.ink));
    // a click on the plane picks (Ωm,0, ΩΛ,0)
    plane.style.cursor = "crosshair";
    plane.addEventListener("click", (e) => {
      const r = plane.getBoundingClientRect(), k = 400 / r.width;
      const m = plane.scale("x").invert((e.clientX - r.left) * k), l = plane.scale("y").invert((e.clientY - r.top) * k);
      const sec = box.closest("section");
      sec.querySelector('[data-k="Om"]').value = Math.min(3, Math.max(0, m)).toFixed(2);
      sec.querySelector('[data-k="OL"]').value = Math.min(3, Math.max(-1, l)).toFixed(2);
      sec.querySelector('[data-k="Om"]').dispatchEvent(new Event("input"));
    });
    box.replaceChildren(plane, aplot);
  },

  // the Benchmark Model: a(t) on linear or log axes (checkbox data-k="log")
  benchmark: (box, s) => {
    const C = colours(), p = benchmark, log = s.log;
    const lna = d3.range(Math.log(1e-7), Math.log(30), 0.005);
    let t = (1e-7) ** 2 / (2 * Math.sqrt(p.Or)) * tH;   // radiation era: a = (2 √Ωr H0 t)^(1/2)
    const pts = lna.map((x, i) => {
      if (i) { const a0 = Math.exp(lna[i - 1]), a1 = Math.exp(x); t += 0.5 * (1 / E(a0) + 1 / E(a1)) * (x - lna[i - 1]) * tH; }
      return { t, a: Math.exp(x) };
    });
    const tAt = (a) => {                                 // interpolated in ln a
      const i = pts.findIndex((q) => q.a >= a), q0 = pts[i - 1], q1 = pts[i];
      return q0.t + (q1.t - q0.t) * Math.log(a / q0.a) / Math.log(q1.a / q0.a);
    };
    const arm = p.Or / p.Om, amL = (p.Om / p.OL) ** (1 / 3);
    const ep = [
      // label placement on linear axes, then on log axes: [text anchor, dx, dy]
      { t: tAt(arm), a: arm, label: "radiation–matter equality", lin: null, log: ["start", 12, 10] },
      { t: tAt(amL), a: amL, label: "matter–Λ equality", lin: ["start", 12, 14], log: ["end", -12, 6] },
      { t: tAt(1), a: 1, label: `today, t₀ = ${tAt(1).toFixed(1)} Gyr`, lin: ["end", -10, -12], log: ["end", -12, -14] },
    ];
    const marks = [Plot.line(pts, { x: "t", y: "a", stroke: C.accent, strokeWidth: 3, clip: true }),
      Plot.dot(ep, { x: "t", y: "a", r: 6, fill: C.ink }),
      ...ep.filter((d) => d[log ? "log" : "lin"]).map((d) => { const [textAnchor, dx, dy] = d[log ? "log" : "lin"];
        return Plot.text([d], { x: "t", y: "a", text: "label", textAnchor, dx, dy, fill: C.ink }); })];
    if (log) marks.push(
      Plot.text([{ t: 1e-5, a: 1.15e-4 }], { x: "t", y: "a", text: () => "a ∝ t¹ᐟ²", fill: C.hot, fontWeight: 700, dx: -8, dy: -14, textAnchor: "end" }),
      Plot.text([{ t: 0.5, a: 0.1 }], { x: "t", y: "a", text: () => "a ∝ t²ᐟ³", fill: C.accent, fontWeight: 700, dy: -14, textAnchor: "end" }),
      Plot.text([{ t: 60, a: 8 }], { x: "t", y: "a", text: () => "a ∝ eᴴᵗ", fill: C.good, fontWeight: 700, textAnchor: "end", dx: -6 }));
    const fmt = (d) => (Number.isInteger(Math.log10(d)) ? `10${sup(Math.log10(d))}` : "");
    box.replaceChildren(Plot.plot(withAxes({
      width: 620, height: 430, marginLeft: 64, marginBottom: 50, marginTop: 32, marginRight: 20, style: style(C),
      x: log ? { type: "log", domain: [1e-6, 100], tickFormat: fmt, label: "time t (Gyr) →", labelAnchor: "right", labelArrow: "none" }
        : { domain: [0, 40], label: "time t (Gyr) →", labelAnchor: "right", labelArrow: "none" },
      y: log ? { type: "log", domain: [1e-5, 10], tickFormat: fmt, label: "↑ scale factor a", labelAnchor: "top", labelArrow: "none" }
        : { domain: [0, 4], label: "↑ scale factor a", labelAnchor: "top", labelArrow: "none" },
      marks,
    }, C.ink)));
  },

  // proper distance today or at emission against z, for the Benchmark Model, matter only and Λ only
  dz: (box, s) => {
    const C = colours(), emit = s.when === "emission";
    const zs = d3.range(-2, 3.0001, 0.02).map((x) => 10 ** x);
    const bench = (z) => simpson((x) => 1 / (Math.exp(x) * E(Math.exp(x))), -Math.log(1 + z), 0, 200);
    const models = [
      // where each label goes: [z, dy] today and at emission
      { name: "Benchmark", f: bench, c: C.accent, today: [8, -14], emission: [1.6, -14] },
      { name: "matter only", f: (z) => 2 * (1 - 1 / Math.sqrt(1 + z)), c: C.ink_soft, dash: "6 5", today: [100, 18], emission: [20, 16] },
      { name: "Λ only", f: (z) => z, c: C.good, dash: "2 4", today: [1.2, 0], emission: [100, -14] },
    ];
    const marks = [];
    for (const m of models) {
      const pts = zs.map((z) => ({ z, d: m.f(z) / (emit ? 1 + z : 1) }));
      marks.push(Plot.line(pts, { x: "z", y: "d", stroke: m.c, strokeWidth: 3, strokeDasharray: m.dash, clip: true }));
      const [z, dy] = m[emit ? "emission" : "today"];
      marks.push(Plot.text([{ z, d: m.f(z) / (emit ? 1 + z : 1) }], { x: "z", y: "d", text: () => m.name, fill: m.c, fontWeight: 700, dy,
        textAnchor: m.name === "Λ only" && !emit ? "end" : "middle", dx: m.name === "Λ only" && !emit ? -10 : 0 }));
    }
    box.replaceChildren(Plot.plot(withAxes({
      width: 600, height: 420, marginLeft: 64, marginBottom: 50, marginTop: 32, marginRight: 20, style: style(C),
      x: { type: "log", domain: [0.01, 1000], tickFormat: (d) => (Number.isInteger(Math.log10(d)) ? String(d) : ""), label: "redshift z →", labelAnchor: "right", labelArrow: "none" },
      y: { domain: [0, emit ? 1.05 : 3.6], label: emit ? "↑ dp(te) (c/H₀)" : "↑ dp(t₀) (c/H₀)", labelAnchor: "top", labelArrow: "none" },
      marks,
    }, C.ink)));
  },
};

const sup = (x) => String(x).replace(/-/g, "⁻").replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[d]);

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
  // a preset (select data-preset) sets the sliders
  for (const sel of section.querySelectorAll("select[data-preset]")) sel.addEventListener("change", () => {
    const [m, l] = sel.value.split(",");
    section.querySelector('[data-k="Om"]').value = m;
    section.querySelector('[data-k="OL"]').value = l;
    redraw();
  });
  new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  redraw();
}
