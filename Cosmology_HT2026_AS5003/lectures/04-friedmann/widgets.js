// Lecture 4 widgets. Each slide with a widget has a figure box <div class="w-fig" data-widget="name">
// and inputs with a data-k="name" attribute; the widget redraws when an input changes and when the
// light/dark theme is switched. Charts use Observable Plot and d3 (from the CDN).
import { c_kms, hubbleTime } from "../../_shared/cosmo.js";

const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const colours = () => Object.fromEntries(["ink", "ink-soft", "accent", "hot", "cool", "good", "gold", "edge", "bg"].map((k) => [k.replace("-", "_"), css(`--${k}`)]));

const widgets = {
  // a(t) = (t/t0)^n: our worldline, the galaxy's, and the light ray between them, against proper distance.
  // n is 1 unless the slide has an input data-k="n"; the values go into the slide's [data-v] spans.
  distances: (box, s, out) => {
    const C = colours(), H0 = 68, n = s.n ?? 1;
    const ct0 = n * c_kms / H0 / 1000;                       // c t0 in Gpc, with t0 = n/H0
    const t0 = n * hubbleTime(H0);                           // Gyr
    const comoving = (tau) => n === 1 ? ct0 * Math.log(1 / tau) : ct0 * (1 - tau ** (1 - n)) / (1 - n);  // c∫ dt/a from tau t0 to t0
    const z = s.z, te = (1 + z) ** (-1 / n);
    const dp0 = comoving(te), dpe = te ** n * dp0, travel = ct0 * (1 - te);
    const hor = n < 1 ? ct0 / (1 - n) : Infinity;
    const ts = d3.range(0, 1.0001, 0.0025);
    const ray = (t1) => ts.filter((t) => t >= t1).map((t) => ({ d: t ** n * comoving(Math.max(t, 1e-9)), t }));
    const hasHor = box.closest("section").querySelector('[data-v="hor"]') && isFinite(hor);
    const xmax = Math.max(2, (hasHor ? Math.max(dp0, hor) : dp0) * 1.12);
    const marks = [
      Plot.ruleX([0], { stroke: C.ink, strokeWidth: 2.5 }),
      Plot.text([{ d: 0, t: 1.03 }], { x: "d", y: "t", text: () => "us", dx: 14, fill: C.ink }),
      Plot.line(ts.map((t) => ({ d: dp0 * t ** n, t })), { x: "d", y: "t", stroke: C.ink_soft, strokeWidth: 2.5 }),
      Plot.text([{ d: dp0, t: 1.03 }], { x: "d", y: "t", text: () => "galaxy", fill: C.ink_soft }),
    ];
    if (hasHor) marks.push(
      Plot.line(ts.map((t) => ({ d: hor * t ** n, t })), { x: "d", y: "t", stroke: C.good, strokeWidth: 2, strokeDasharray: "6 5" }),
      Plot.line(ray(0), { x: "d", y: "t", stroke: C.good, strokeWidth: 2.5 }),
      Plot.text([{ d: hor, t: 1.03 }], { x: "d", y: "t", text: () => "horizon", fill: C.good, fontWeight: 700 }),
      Plot.ruleY([1], { x1: 0, x2: hor, stroke: C.good, strokeWidth: 3 }));
    marks.push(
      Plot.line(ray(te), { x: "d", y: "t", stroke: C.gold, strokeWidth: 3 }),
      Plot.ruleY([1], { x1: 0, x2: dp0, stroke: C.accent, strokeWidth: 3 }),
      Plot.ruleY([te], { x1: 0, x2: dpe, stroke: C.hot, strokeWidth: 3 }),
      Plot.dot([{ d: dpe, t: te }, { d: 0, t: 1 }], { x: "d", y: "t", r: 6, fill: C.gold }));
    box.replaceChildren(Plot.plot({
      width: 560, height: 400, marginLeft: 60, marginBottom: 50, marginTop: 20, marginRight: 20,
      style: { background: "transparent", color: C.ink, fontSize: "16px", fontFamily: css("--f-ui") },
      x: { domain: [-0.05 * xmax, xmax], label: "proper distance (Gpc) →", labelAnchor: "right", labelArrow: "none" },
      y: { domain: [0, 1.06], label: "↑ time t / t₀", labelAnchor: "top", labelArrow: "none" },
      marks,
    }));
    const v = { n: n.toFixed(2), z: z.toFixed(1), te: te.toFixed(2), t0: t0.toFixed(1), dp0: dp0.toFixed(2), dpe: dpe.toFixed(2), travel: travel.toFixed(2),
      hor: isFinite(hor) ? hor.toFixed(2) + " Gpc" : "∞: no horizon" };
    for (const el of box.closest("section").querySelectorAll("[data-v]")) el.textContent = v[el.dataset.v];
  },
};

for (const box of document.querySelectorAll(".w-fig[data-widget]")) {
  const section = box.closest("section");
  const inputs = [...section.querySelectorAll("[data-k]")];
  const out = section.querySelector(".w-out") ?? document.createElement("p");
  const s = {};
  const read = () => inputs.forEach((el) => { s[el.dataset.k] = el.type === "checkbox" ? el.checked : Number(el.value); });
  // a widget that fails shows a note instead of stopping the others
  const redraw = () => {
    read();
    Promise.resolve().then(() => widgets[box.dataset.widget](box, s, out, redraw))
      .catch((e) => { box.textContent = `(widget failed to load: ${e.message})`; console.error(e); });
  };
  for (const el of inputs) {
    el.addEventListener("input", redraw);
    el.addEventListener("change", () => el.blur()); // arrow keys go back to changing slides
  }
  new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  redraw();
}
