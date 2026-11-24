// Lecture 8 widgets. Each slide with a widget has a figure box <div class="w-fig" data-widget="name">
// and inputs with a data-k="name" attribute; the widget redraws when an input changes and when the
// light/dark theme is switched. Charts use Observable Plot and d3 (from the CDN).
import { benchmark } from "../../_shared/cosmo.js";
import { singlePlot, fatePlot, fates } from "../../_shared/models.js";
import { withAxes } from "../../_shared/plot.js";

const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const colours = () => Object.fromEntries(["ink", "ink-soft", "accent", "hot", "cool", "good", "gold", "edge", "bg"].map((k) => [k.replace("-", "_"), css(`--${k}`)]));
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
