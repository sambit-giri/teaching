// Plots of the cosmology calculator on the Lecture 6 "calc-try" slide. The numbers come from the
// calculator engine, tools/cosmology-calculator/cosmocalc.js at the root of the site (also behind the
// standalone calculator page). Plots use Observable Plot and d3 (globals from the CDN).
import { fatePlot, history, fates } from "./models.js";
import { withAxes } from "./plot.js";

// Three small plots: a(t) with the four universes of Ryden Fig. 5.7, and the proper distance today and
// at emission against z. C: the colours, as in the lecture widgets; res: the result of calc() of the
// engine. Returns the three plot elements.
export function calcPlots(C, res, { width = 380, fontSize = "13px", font } = {}) {
  const { Om, OL, Ez, dH, amin, reached, r, z, ae } = res;
  const W = width, fs = fontSize, style = { background: "transparent", color: C.ink, fontSize: fs, fontFamily: font };
  // 1. a(t): the four universes of the Ωm–ΩΛ slides, and this one as the wide gold curve
  const aplot = fatePlot(C, [{ pts: history(Om, OL).pts, colour: C.gold, width: 10, opacity: 0.45 }, ...fates(C).map((f) => ({ ...f, step: undefined, ...(f.name === "Loitering" ? { at: { s: -3.1, a: 0.5 }, dy: -10 } : {}) }))],
    { height: 210, width: W, fontSize: fs, today: false });
  // 2, 3. proper distance today and at emission against z, from r(z) built up in ln a, in Gpc;
  // the dot is the chosen z. High z on the left, so that time runs left to right as in a(t)
  const zs = [], rs = [];
  let rr = 0, x = 0;
  const lo = Math.log(1 / 1001), dx = (lo - 0) / 3000;
  for (let i = 0; i <= 3000; i++, x += dx) {
    const a = Math.exp(x);
    if (amin !== null && a <= amin * 1.0001) break;
    if (i) { const a0 = Math.exp(x - dx); rr += -0.5 * (1 / (a0 * Ez(a0)) + 1 / (a * Ez(a))) * dx; }
    zs.push(1 / a - 1); rs.push(rr);
  }
  const pts = zs.map((zz, i) => ({ z: zz, d0: rs[i] * dH / 1000, de: rs[i] * dH / 1000 / (1 + zz) })).filter((q) => q.z >= 0.01);
  const dPlot = (key, label, here) => {
    const ymax = Math.max(1e-3, d3.max(pts, (q) => q[key]) ?? 1) * 1.08;
    return Plot.plot(withAxes({
      width: W, height: 150, marginLeft: 50, marginBottom: 38, marginTop: 24, marginRight: 16, style,
      x: { type: "log", domain: [0.01, 1000], reverse: true, tickFormat: (d) => (Number.isInteger(Math.log10(d)) ? String(d) : ""), label: "← redshift z", labelAnchor: "left", labelArrow: "none" },
      y: { domain: [0, ymax], ticks: 4, label, labelAnchor: "top", labelArrow: "none" },
      marks: [
        Plot.line(pts, { x: "z", y: key, stroke: C.gold, strokeWidth: 8, strokeOpacity: 0.45 }),
        ...(reached && z >= 0.01 && z <= 1000 ? [Plot.dot([{ z, d: here }], { x: "z", y: "d", r: 5, fill: C.ink })] : []),
      ],
    }, C.ink));
  };
  return [aplot, dPlot("d0", "↑ dp(t₀), today (Gpc)", r * dH / 1000), dPlot("de", "↑ dp(tₑ), at emission (Gpc)", r * ae * dH / 1000)];
}
