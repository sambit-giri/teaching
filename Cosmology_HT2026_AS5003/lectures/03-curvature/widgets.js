// Lecture 3 widgets. Each slide with a widget has a figure box <div class="w-fig" data-widget="name">
// and inputs with a data-k="name" attribute; the widget redraws when an input changes and when the
// light/dark theme is switched. Charts use Observable Plot and d3 (from the CDN).
import { c_kms, hubbleTime } from "../../_shared/cosmo.js";

const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const colours = () => Object.fromEntries(["ink", "ink-soft", "accent", "hot", "cool", "good", "gold", "edge", "bg"].map((k) => [k.replace("-", "_"), css(`--${k}`)]));

// an animation draws only on the slide being shown, or on every slide in the PDF layout (?print-pdf)
const shown = (box) => box.closest("section")?.classList.contains("present") || document.documentElement.classList.contains("print-pdf");

// ---------- complex numbers for the Poincaré disk ----------
const cx = (re, im = 0) => ({ re, im });
const add = (a, b) => cx(a.re + b.re, a.im + b.im);
const sub = (a, b) => cx(a.re - b.re, a.im - b.im);
const mul = (a, b) => cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const div = (a, b) => { const d = b.re ** 2 + b.im ** 2; return cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
const conj = (a) => cx(a.re, -a.im);
const abs = (a) => Math.hypot(a.re, a.im);
// Möbius map sending p to the origin; its inverse sends the origin back to p
const toOrigin = (p, z) => div(sub(z, p), sub(cx(1), mul(conj(p), z)));
const fromOrigin = (p, w) => div(add(w, p), add(cx(1), mul(conj(p), w)));
// points along the hyperbolic geodesic from p to q (a circular arc meeting the rim at right angles)
const geodesic = (p, q, n = 40) => { const w = toOrigin(p, q); return d3.range(n + 1).map((i) => fromOrigin(p, cx(w.re * i / n, w.im * i / n))); };
const hypDist = (p, q) => 2 * Math.atanh(abs(toOrigin(p, q)));

// a point at angular distance rho (radians) from (lon0, lat0) in direction bearing b (degrees on the sphere)
function destination([lon0, lat0], rho, b) {
  const r = Math.PI / 180, f0 = lat0 * r, br = b * r;
  const f = Math.asin(Math.sin(f0) * Math.cos(rho) + Math.cos(f0) * Math.sin(rho) * Math.cos(br));
  const l = lon0 * r + Math.atan2(Math.sin(br) * Math.sin(rho) * Math.cos(f0), Math.cos(rho) - Math.sin(f0) * Math.sin(f));
  return [l / r, f / r];
}

const widgets = {
  // equilateral triangles on a sphere, a plane and a hyperbolic (Poincaré) disk, with their angle sums
  curvature: (box, s) => {
    const C = colours(), R = 120, PW = 340, H = 330, deg = 180 / Math.PI;
    const svg = d3.create("svg").attr("width", 3 * PW).attr("height", H).attr("viewBox", `0 0 ${3 * PW} ${H}`);
    const font = `600 17px ${css("--f-ui")}`;
    const label = (x, title, sum, colour) => {
      svg.append("text").attr("x", x).attr("y", 22).attr("text-anchor", "middle").attr("fill", C.ink).style("font", font).text(title);
      svg.append("text").attr("x", x).attr("y", H - 8).attr("text-anchor", "middle").attr("fill", colour).style("font", font)
        .text(`α + β + γ = ${sum.toFixed(1)}°`);
    };
    const tri = { fill: C.accent, "fill-opacity": 0.25, stroke: C.accent, "stroke-width": 3 };
    const attrs = (sel, a) => { for (const [k, v] of Object.entries(a)) sel.attr(k, v); return sel; };

    // sphere (kappa = +1): circumradius up to ~70°
    const rho = s.size * 1.25, centre = [15, 25];
    const proj = d3.geoOrthographic().scale(R).translate([PW / 2, H / 2 + 4]).rotate([-centre[0], -centre[1]]);
    const path = d3.geoPath(proj);
    svg.append("path").attr("d", path({ type: "Sphere" })).attr("fill", C.edge).attr("fill-opacity", 0.35).attr("stroke", C.ink_soft);
    svg.append("path").attr("d", path(d3.geoGraticule10())).attr("fill", "none").attr("stroke", C.ink_soft).attr("stroke-opacity", 0.3);
    let ring = [0, 120, 240].map((b) => destination(centre, rho, b));
    let poly = { type: "Polygon", coordinates: [[...ring, ring[0]]] };
    if (d3.geoArea(poly) > 2 * Math.PI) poly = { type: "Polygon", coordinates: [[...ring.reverse(), ring[0]]] };
    attrs(svg.append("path").attr("d", path(poly)), tri);
    const a = d3.geoDistance(ring[0], ring[1]), Asph = Math.acos(Math.cos(a) / (1 + Math.cos(a)));
    label(PW / 2, "Positive curvature (sphere)", 3 * Asph * deg, C.hot);

    // plane (kappa = 0)
    const g2 = svg.append("g").attr("transform", `translate(${1.5 * PW},${H / 2 + 14})`);
    g2.append("rect").attr("x", -R).attr("y", -R).attr("width", 2 * R).attr("height", 2 * R).attr("fill", C.edge).attr("fill-opacity", 0.35).attr("stroke", C.ink_soft);
    const rp = 15 + s.size * 95;
    attrs(g2.append("path").attr("d", d3.line()([0, 120, 240].map((b) => [rp * Math.sin(b / deg), -rp * Math.cos(b / deg)])) + "Z"), tri);
    label(1.5 * PW, "Flat (plane)", 180, C.ink);

    // hyperbolic disk (kappa = -1): Poincaré disk, geodesics are arcs meeting the rim at right angles
    const g3 = svg.append("g").attr("transform", `translate(${2.5 * PW},${H / 2 + 4})`);
    g3.append("circle").attr("r", R).attr("fill", C.edge).attr("fill-opacity", 0.35).attr("stroke", C.ink_soft);
    for (let i = 0; i < 6; i++) {   // a few background geodesics
      const p = cx(0.985 * Math.cos(i * Math.PI / 3 + 0.3), 0.985 * Math.sin(i * Math.PI / 3 + 0.3));
      const q = cx(0.985 * Math.cos(i * Math.PI / 3 + 2.0), 0.985 * Math.sin(i * Math.PI / 3 + 2.0));
      g3.append("path").attr("d", d3.line()(geodesic(p, q, 60).map((z) => [R * z.re, -R * z.im]))).attr("fill", "none").attr("stroke", C.ink_soft).attr("stroke-opacity", 0.35);
    }
    const rh = Math.tanh((0.1 + s.size * 2.6) / 2);
    const V = [90, 210, 330].map((b) => cx(rh * Math.cos(b / deg), rh * Math.sin(b / deg)));
    const pts = [...geodesic(V[0], V[1]), ...geodesic(V[1], V[2]), ...geodesic(V[2], V[0])].map((z) => [R * z.re, -R * z.im]);
    attrs(g3.append("path").attr("d", d3.line()(pts) + "Z"), tri);
    const ah = hypDist(V[0], V[1]), Ahyp = Math.acos(Math.cosh(ah) / (1 + Math.cosh(ah)));
    label(2.5 * PW, "Negative curvature (saddle)", 3 * Ahyp * deg, C.cool);

    box.replaceChildren(svg.node());
  },

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
    const v = { z: z.toFixed(1), te: te.toFixed(2), t0: t0.toFixed(1), dp0: dp0.toFixed(2), dpe: dpe.toFixed(2), travel: travel.toFixed(2),
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
