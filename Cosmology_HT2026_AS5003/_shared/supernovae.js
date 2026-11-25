// The Union2.1 supernovae against model universes (Lectures 7 and 8): distance tables for matter + Λ +
// curvature, the χ² of the supernovae on a grid of (Ωm,0, ΩΛ,0), and the plane with the allowed region.
import { c_kms } from "./cosmo.js";
import { bounceLine, crunchLine, turning } from "./models.js";
import { withAxes } from "./plot.js";
import { union21 } from "./union21.js";

// Comoving distance r(z) and Sκ(r), in units of c/H0, for matter + Λ + curvature, on a grid of
// redshifts up to zmax (trapezoid rule in ln a). Returns null when light from zmax would have left
// before a Big Bounce (no such redshift exists in that universe).
export function distances(Om, OL, zmax, n = 400) {
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
export const at = (tab, z, key = "S") => {
  const i = d3.bisector((d) => d.z).left(tab, z);
  if (i <= 0) return tab[0][key];
  const p = tab[i - 1], q = tab[i];
  return p[key] + (q[key] - p[key]) * (z - p.z) / (q.z - p.z);
};

// distance modulus m − M = 5 log10(dL / 1 Mpc) + 25, with dL = Sκ(r)(1 + z) c/H0; H0 = 70 as in Union2.1
export const H0sn = 70;
export const mu = (S, z) => 5 * Math.log10(S * (1 + z) * c_kms / H0sn) + 25;

// χ² of the supernovae for each (Ωm,0, ΩΛ,0) on a grid, with the zero point of the magnitudes (H0 and
// the supernova luminosity together) fitted for each universe; computed once
export const grid = { m: [0, 1.5], l: [-0.5, 2], n: 76 };
let chi2Grid = null;
export function chi2() {
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

// The (Ωm,0, ΩΛ,0) plane: no-Big-Bang and Big-Crunch regions, the region the supernovae allow at 99.7%,
// the flat and q0 = 0 lines. extra: more marks, drawn on top. C: theme colours.
export function snPlane(C, { extra = [], width = 400, height = 440, fontSize = "15px", font } = {}) {
  const ms = d3.range(0.002, grid.m[1] + 1e-4, 0.01);
  return Plot.plot(withAxes({
    width, height, marginLeft: 56, marginBottom: 46, marginTop: 32, marginRight: 12,
    style: { background: "transparent", color: C.ink, fontSize, fontFamily: font },
    x: { domain: grid.m, label: "Ωm,0 →", labelAnchor: "right", labelArrow: "none" },
    y: { domain: grid.l, label: "↑ ΩΛ,0", labelAnchor: "top", labelArrow: "none" },
    marks: [
      Plot.areaY(ms, { x: (m) => m, y1: (m) => Math.min(bounceLine(m), grid.l[1]), y2: grid.l[1], fill: C.accent, fillOpacity: 0.12 }),
      Plot.areaY(ms, { x: (m) => m, y1: grid.l[0], y2: (m) => Math.max(grid.l[0], crunchLine(m)), fill: C.hot, fillOpacity: 0.12 }),
      // filled inside Δχ² = 11.83: the 99.7% region for two parameters
      Plot.contour(chi2(), { width: grid.n, height: grid.n, x1: grid.m[0], x2: grid.m[1], y1: grid.l[0], y2: grid.l[1], value: (v) => -v, thresholds: [-11.83], fill: C.cool, fillOpacity: 0.35, stroke: C.cool, strokeWidth: 2 }),
      Plot.line([[0, 1], [1.5, -0.5]], { stroke: C.ink_soft, strokeWidth: 1.5, strokeDasharray: "6 5" }),
      Plot.text([[1.32, -0.32]], { text: () => "flat", rotate: 38, fill: C.ink_soft, dy: -8 }),
      Plot.line([[0, 0], [1.5, 0.75]], { stroke: C.ink_soft, strokeWidth: 1.5, strokeDasharray: "2 4" }),
      // along the q0 = 0 line (18° on these axes), one label above it and one below
      Plot.text([[1.46, 0.73]], { text: () => "q₀ < 0: speeding up ↑", textAnchor: "end", rotate: -18, fill: C.ink_soft, dy: -15 }),
      Plot.text([[1.46, 0.73]], { text: () => "q₀ > 0: slowing down ↓", textAnchor: "end", rotate: -18, fill: C.ink_soft, dy: 16 }),
      Plot.text([[0.05, 1.85]], { text: () => "no Big Bang (bounce)", textAnchor: "start", fill: C.accent, fontWeight: 700 }),
      Plot.text([[1.45, -0.42]], { text: () => "Big Crunch", textAnchor: "end", fill: C.hot, fontWeight: 700 }),
      Plot.text([[0.05, -0.4]], { text: () => "supernovae (99.7%)", textAnchor: "start", fill: C.cool, fontWeight: 700 }),
      ...extra,
    ],
  }, C.ink));
}
