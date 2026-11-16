// Lecture 5 widgets. Each slide with a widget has a figure box <div class="w-fig" data-widget="name">
// and inputs with a data-k="name" attribute; the widget redraws when an input changes and when the
// light/dark theme is switched. Charts use Observable Plot and d3 (from the CDN).
import { c_kms, hubbleTime, benchmark } from "../../_shared/cosmo.js";
import { single, aSingle, rSingle, sSingle, horSingle, singlePlot } from "../../_shared/models.js";

const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const colours = () => Object.fromEntries(["ink", "ink-soft", "accent", "hot", "cool", "good", "gold", "edge", "bg"].map((k) => [k.replace("-", "_"), css(`--${k}`)]));
const style = (C, fontSize = "16px") => ({ background: "transparent", color: C.ink, fontSize, fontFamily: css("--f-ui") });

const widgets = {
  // a(t) for the four single-component universes; checkboxes data-k="milne" etc. pick the curves
  // (all of them if the slide has none). The cover sets the size with data-w and data-h.
  single: (box, s) => {
    const C = colours();
    const show = Object.keys(single).filter((m) => s[m] ?? true);
    box.replaceChildren(singlePlot(C, { show, width: +(box.dataset.w ?? 600), height: +(box.dataset.h ?? 420), font: css("--f-ui") }));
  },

  // energy density of radiation, matter and Λ against a, in units of today's critical density
  density: (box) => {
    const C = colours(), { Om, Or, OL } = benchmark;
    const as = d3.range(-6, 1.0001, 0.02).map((x) => 10 ** x);
    const lines = [
      { name: "radiation ∝ a⁻⁴", f: (a) => Or / a ** 4, c: C.hot },
      { name: "matter ∝ a⁻³", f: (a) => Om / a ** 3, c: C.accent },
      { name: "Λ: constant", f: () => OL, c: C.good },
    ];
    const marks = [Plot.ruleX([1], { stroke: C.edge, strokeDasharray: "4 4" }),
      Plot.text([{ a: 1, e: 1e19 }], { x: "a", y: "e", text: () => "today", dx: -6, textAnchor: "end", fill: C.ink_soft })];
    for (const l of lines) {
      marks.push(Plot.line(as.map((a) => ({ a, e: l.f(a) })), { x: "a", y: "e", stroke: l.c, strokeWidth: 3, clip: true }));
    }
    marks.push(
      Plot.text([{ a: 2e-6, e: Or / 2e-6 ** 4 }], { x: "a", y: "e", text: () => lines[0].name, dx: 10, textAnchor: "start", fill: C.hot, fontWeight: 700 }),
      Plot.text([{ a: 3e-2, e: Om / 3e-2 ** 3 }], { x: "a", y: "e", text: () => lines[1].name, dy: 20, dx: 6, textAnchor: "start", fill: C.accent, fontWeight: 700 }),
      Plot.text([{ a: 2e-6, e: OL }], { x: "a", y: "e", text: () => lines[2].name, dy: -12, textAnchor: "start", fill: C.good, fontWeight: 700 }));
    box.replaceChildren(Plot.plot({
      width: 560, height: 430, marginLeft: 70, marginBottom: 50, marginTop: 32, marginRight: 20, style: style(C),
      x: { type: "log", domain: [1e-6, 10], label: "scale factor a →", labelAnchor: "right", labelArrow: "none", tickFormat: (d) => (Number.isInteger(Math.log10(d)) ? `10${sup(Math.log10(d))}` : "") },
      y: { type: "log", domain: [1e-2, 1e22], label: "↑ ε / εc,0", labelAnchor: "top", labelArrow: "none", ticks: [1e-2, 1, 1e4, 1e8, 1e12, 1e16, 1e20], tickFormat: (d) => `10${sup(Math.log10(d))}` },
      marks,
    }));
  },

  // spacetime diagram of one single-component universe (select data-k="model"): worldlines of
  // galaxies, our past light cone, and the galaxy at redshift z with its distances
  spacetime: (box, s) => {
    const C = colours(), m = s.model, n = single[m].n, z = s.z, H0 = benchmark.H0;
    const dH = c_kms / H0 / 1000;                                 // c/H0 in Gpc
    const ae = 1 / (1 + z), se = sSingle(m, ae), r = rSingle(m, ae), hor = horSingle(m);
    const sMin = n === null ? -3 : -n;
    const ss = d3.range(sMin, 0.0001, 0.005);
    const xmax = Math.min(Math.max(1.3, r, isFinite(hor) ? hor : 0) * 1.1, 6);
    const cone = ss.map((t) => { const a = aSingle(m, t); return { s: t, d: a > 0 ? a * rSingle(m, Math.max(a, 1e-9)) : 0 }; });
    const marks = [];
    for (let k = 0.5; k < xmax * 1.05; k += 0.5) {
      for (const sign of [-1, 1]) marks.push(Plot.line(ss.map((t) => ({ s: t, d: sign * k * aSingle(m, t) })), { x: "d", y: "s", stroke: C.edge, strokeWidth: 1 }));
    }
    marks.push(Plot.ruleX([0], { stroke: C.ink, strokeWidth: 2.5 }),
      Plot.text([{ d: 0, s: 0.03 }], { x: "d", y: "s", text: () => "us", dy: -8, fill: C.ink }));
    if (isFinite(hor)) marks.push(
      Plot.line(ss.map((t) => ({ s: t, d: hor * aSingle(m, t) })), { x: "d", y: "s", stroke: C.good, strokeWidth: 2, strokeDasharray: "6 5" }),
      Plot.text([{ d: hor, s: 0.03 }], { x: "d", y: "s", text: () => "horizon", dy: -8, fill: C.good, fontWeight: 700 }));
    marks.push(
      Plot.line(cone, { x: "d", y: "s", stroke: C.gold, strokeWidth: 2.5 }),
      Plot.line(cone.map((p) => ({ ...p, d: -p.d })), { x: "d", y: "s", stroke: C.gold, strokeWidth: 2.5 }),
      Plot.line(ss.map((t) => ({ s: t, d: r * aSingle(m, t) })), { x: "d", y: "s", stroke: C.ink_soft, strokeWidth: 2.5 }),
      Plot.text([{ d: r, s: 0.03 }], { x: "d", y: "s", text: () => "galaxy", dy: -8, fill: C.ink_soft }),
      Plot.ruleY([0], { x1: 0, x2: r, stroke: C.accent, strokeWidth: 3 }),
      Plot.ruleY([se], { x1: 0, x2: r * ae, stroke: C.hot, strokeWidth: 3 }),
      Plot.dot([{ d: r * ae, s: se }], { x: "d", y: "s", r: 6, fill: C.gold }));
    box.replaceChildren(Plot.plot({
      width: 580, height: 440, marginLeft: 64, marginBottom: 50, marginTop: 32, marginRight: 20, style: style(C),
      x: { domain: [-xmax, xmax], label: "proper distance (c/H₀) →", labelAnchor: "right", labelArrow: "none" },
      y: { domain: [sMin, 0.06], ticks: 6, label: "↑ time H₀(t − t₀)", labelAnchor: "top", labelArrow: "none" },
      marks,
    }));
    const v = {
      z: z.toFixed(1), name: single[m].name,
      look: `${(-se).toFixed(2)} / H₀ = ${(-se * hubbleTime(H0)).toFixed(1)} Gyr`,
      dp0: `${r.toFixed(2)} c/H₀ = ${(r * dH).toFixed(1)} Gpc`,
      dpe: `${(r * ae).toFixed(2)} c/H₀ = ${(r * ae * dH).toFixed(1)} Gpc`,
      hor: isFinite(hor) ? `${hor.toFixed(2)} c/H₀ = ${(hor * dH).toFixed(1)} Gpc` : "∞: no horizon",
    };
    for (const el of box.closest("section").querySelectorAll("[data-v]")) el.textContent = v[el.dataset.v];
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
