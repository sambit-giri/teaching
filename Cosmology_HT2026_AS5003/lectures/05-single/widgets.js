// Lecture 5 widgets. Each slide with a widget has a figure box <div class="w-fig" data-widget="name">
// and inputs with a data-k="name" attribute; the widget redraws when an input changes and when the
// light/dark theme is switched. Charts use Observable Plot and d3 (from the CDN).
import { hubbleTime, benchmark } from "../../_shared/cosmo.js";
import { single, aSingle, rSingle, sSingle, horSingle, singlePlot, singleColours, sRange, aMax } from "../../_shared/models.js";
import { withAxes } from "../../_shared/plot.js";

const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const colours = () => Object.fromEntries(["ink", "ink-soft", "accent", "hot", "cool", "good", "gold", "edge", "bg"].map((k) => [k.replace("-", "_"), css(`--${k}`)]));
const style = (C, fontSize = "16px") => ({ background: "transparent", color: C.ink, fontSize, fontFamily: css("--f-ui") });

const widgets = {
  // a(t) for the four single-component universes. data-show="milne,matter" picks the curves (all of
  // them if it is not set). The cover sets the height with data-h.
  single: (box) => {
    const C = colours();
    const show = box.dataset.show ? box.dataset.show.split(",") : Object.keys(single);
    box.replaceChildren(singlePlot(C, { show, height: +(box.dataset.h ?? 420), font: css("--f-ui") }));
  },

  // the four curves of the cover, plus a wide see-through curve for a flat universe with one
  // component of any w (slider data-k="w"). For w < −1 the exponent 2/(3 + 3w) is negative: no Big
  // Bang, and a Big Rip ahead.
  wslider: (box, s) => {
    const C = colours(), w = s.w, tH = hubbleTime(benchmark.H0);
    const lam = Math.abs(w + 1) < 0.005, n = lam ? null : 2 / (3 + 3 * w);
    const a = (t) => (lam ? Math.exp(t) : (1 + t / n) ** n);
    const s0 = n > 0 ? -n : sRange[0], s1 = n < 0 ? Math.min(sRange[1], -n - 1e-3) : sRange[1];
    const pts = d3.range(s0, s1, 0.005).concat(s1).map((t) => ({ s: t, a: a(t) })).filter((p) => p.a <= aMax + 0.2);
    const extra = [Plot.line(pts, { x: "s", y: "a", stroke: C.gold, strokeOpacity: 0.45, strokeWidth: 10, strokeLinecap: "round", clip: true })];
    box.replaceChildren(singlePlot(C, { extra, height: 440, font: css("--f-ui") }));
    const v = {
      w: w.toFixed(2),
      law: lam ? "a ∝ exp(H₀t)" : n > 0 ? `a ∝ t<sup>${n.toFixed(2)}</sup>` : `a ∝ (t<sub>rip</sub> − t)<sup>${n.toFixed(2)}</sup>`,
      age: n > 0 ? `${n.toFixed(2)} / H₀ = ${(n * tH).toFixed(1)} Gyr` : "no Big Bang",
      vs: n > 0 ? `, ${n < 0.995 ? "younger than" : n > 1.005 ? "older than" : "equal to"} the Hubble time` : "",
      acc: w < -1 / 3 - 0.005 ? "speeding up" : w > -1 / 3 + 0.005 ? "slowing down" : "coasting (constant speed)",
      end: n < 0 ? `a Big Rip ${(-n).toFixed(2)} / H₀ = ${(-n * tH).toFixed(1)} Gyr from now` : "expands forever",
    };
    for (const el of box.closest("section").querySelectorAll("[data-v]")) el.innerHTML = v[el.dataset.v];
  },

  // proper distance at observation and at emission against z, for the universes in data-show (as for
  // single), on log–log axes as in Ryden's Fig. 5.3, in the same colours and line styles as a(t)
  dist: (box) => {
    const C = colours(), col = singleColours(C), show = box.dataset.show.split(",");
    const zs = d3.range(-2, 2.0001, 0.01).map((x) => 10 ** x);
    const decades = [0.01, 0.1, 1, 10, 100], fmt = (d) => String(d).replace(/^0\./, ".");
    const panel = (emit) => {
      const marks = show.map((m) => Plot.line(zs.map((z) => ({ z, d: rSingle(m, 1 / (1 + z)) / (emit ? 1 + z : 1) })),
        { x: "z", y: "d", stroke: col[m], strokeWidth: 2.5, strokeDasharray: single[m].dash, clip: true }));
      marks.push(Plot.text([{ z: 0.014, d: 50 }], { x: "z", y: "d", text: () => (emit ? "Emission" : "Observation"), textAnchor: "start", fill: C.ink, fontWeight: 700 }));
      return Plot.plot(withAxes({
        width: 215, height: 218, marginLeft: 44, marginBottom: 34, marginTop: 20, marginRight: 10, style: style(C, "13px"),
        x: { type: "log", domain: [0.01, 100], ticks: decades, tickFormat: fmt, label: "z →", labelAnchor: "right", labelArrow: "none", labelOffset: 30 },
        y: { type: "log", domain: [0.01, 100], ticks: decades, tickFormat: fmt, label: emit ? "↑ dp(tₑ) (c/H₀)" : "↑ dp(t₀) (c/H₀)", labelAnchor: "top", labelArrow: "none" },
        marks,
      }, C.ink));
    };
    box.replaceChildren(panel(false), panel(true));
  },

  // energy density of radiation, matter and Λ against a, in units of today's critical density
  density: (box) => {
    const C = colours(), { Om, Or, OL } = benchmark;
    const as = d3.range(-6, 1.0001, 0.02).map((x) => 10 ** x);
    const lines = [
      { name: "radiation ∝ a⁻⁴", f: (a) => Or / a ** 4, c: C.hot, dash: "8 5" },
      { name: "matter ∝ a⁻³", f: (a) => Om / a ** 3, c: C.accent },
      { name: "Λ: constant", f: () => OL, c: C.good, dash: "2 4" },
    ];
    const marks = [Plot.ruleX([1], { stroke: C.edge, strokeDasharray: "4 4" }),
      Plot.text([{ a: 1, e: 1e19 }], { x: "a", y: "e", text: () => "today", dx: -6, textAnchor: "end", fill: C.ink_soft })];
    for (const l of lines) {
      marks.push(Plot.line(as.map((a) => ({ a, e: l.f(a) })), { x: "a", y: "e", stroke: l.c, strokeWidth: 3, strokeDasharray: l.dash, clip: true }));
    }
    marks.push(
      Plot.text([{ a: 2e-6, e: Or / 2e-6 ** 4 }], { x: "a", y: "e", text: () => lines[0].name, dx: 10, textAnchor: "start", fill: C.hot, fontWeight: 700 }),
      Plot.text([{ a: 3e-2, e: Om / 3e-2 ** 3 }], { x: "a", y: "e", text: () => lines[1].name, dy: 20, dx: 6, textAnchor: "start", fill: C.accent, fontWeight: 700 }),
      Plot.text([{ a: 2e-6, e: OL }], { x: "a", y: "e", text: () => lines[2].name, dy: -12, textAnchor: "start", fill: C.good, fontWeight: 700 }));
    box.replaceChildren(Plot.plot(withAxes({
      width: 560, height: 430, marginLeft: 70, marginBottom: 50, marginTop: 32, marginRight: 20, style: style(C),
      x: { type: "log", domain: [1e-6, 10], label: "scale factor a →", labelAnchor: "right", labelArrow: "none", tickFormat: (d) => (Number.isInteger(Math.log10(d)) ? `10${sup(Math.log10(d))}` : "") },
      y: { type: "log", domain: [1e-2, 1e22], label: "↑ ε / εc,0", labelAnchor: "top", labelArrow: "none", ticks: [1e-2, 1, 1e4, 1e8, 1e12, 1e16, 1e20], tickFormat: (d) => `10${sup(Math.log10(d))}` },
      marks,
    }, C.ink)));
  },

  // spacetime diagram of one single-component universe (data-model and data-z on the box): worldlines
  // of galaxies, our past light cone, and the galaxy at redshift z with its distances. Size from data-w
  // and data-h; data-xmax and data-smin fix the axes, so that several diagrams can be compared.
  spacetime: (box) => {
    const C = colours(), m = box.dataset.model, n = single[m].n, z = +box.dataset.z;
    const ae = 1 / (1 + z), se = sSingle(m, ae), r = rSingle(m, ae), hor = horSingle(m);
    const sMin = box.dataset.smin ? +box.dataset.smin : n === null ? -3 : -n;
    const ss = d3.range(Math.max(sMin, n === null ? -10 : -n), 0.0001, 0.005);
    const xmax = box.dataset.xmax ? +box.dataset.xmax : Math.min(Math.max(1.3, r, isFinite(hor) ? hor : 0) * 1.1, 6);
    const cone = ss.map((t) => { const a = aSingle(m, t); return { s: t, d: a > 0 ? a * rSingle(m, Math.max(a, 1e-9)) : 0 }; });
    const marks = [];
    for (let k = 0.5; k < xmax * 1.05; k += 0.5) {
      marks.push(Plot.line(ss.map((t) => ({ s: t, d: k * aSingle(m, t) })), { x: "d", y: "s", stroke: C.edge, strokeWidth: 1, clip: true }));
    }
    marks.push(Plot.ruleX([0], { stroke: C.ink, strokeWidth: 2.5 }),
      Plot.text([{ d: 0, s: 0.03 }], { x: "d", y: "s", text: () => "us", dx: 6, dy: -8, textAnchor: "start", fill: C.ink }));
    if (isFinite(hor)) marks.push(
      Plot.line(ss.map((t) => ({ s: t, d: hor * aSingle(m, t) })), { x: "d", y: "s", stroke: C.good, strokeWidth: 2, strokeDasharray: "6 5" }),
      Plot.text([{ d: hor, s: 0.03 }], { x: "d", y: "s", text: () => "horizon", dx: 4, dy: -8, textAnchor: "start", fill: C.good, fontWeight: 700 }));
    marks.push(
      Plot.line(cone, { x: "d", y: "s", stroke: C.gold, strokeWidth: 2.5 }),
      Plot.line(ss.map((t) => ({ s: t, d: r * aSingle(m, t) })), { x: "d", y: "s", stroke: C.ink_soft, strokeWidth: 2.5 }),
      Plot.text([{ d: r, s: 0.03 }], { x: "d", y: "s", text: () => "galaxy", dx: -4, dy: -8, textAnchor: "end", fill: C.ink_soft }),
      Plot.ruleY([0], { x1: 0, x2: r, stroke: C.accent, strokeWidth: 3 }),
      Plot.ruleY([se], { x1: 0, x2: r * ae, stroke: C.hot, strokeWidth: 3 }),
      Plot.dot([{ d: r * ae, s: se }], { x: "d", y: "s", r: 6, fill: C.gold }));
    box.replaceChildren(Plot.plot(withAxes({
      width: +(box.dataset.w ?? 580), height: +(box.dataset.h ?? 440), marginLeft: 64, marginBottom: 50, marginTop: 32, marginRight: 20, style: style(C),
      x: { domain: [0, xmax], label: "proper distance (c/H₀) →", labelAnchor: "right", labelArrow: "none" },
      y: { domain: [sMin, 0.06], ticks: 6, label: "↑ time H₀(t − t₀)", labelAnchor: "top", labelArrow: "none" },
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
  new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  redraw();
}
