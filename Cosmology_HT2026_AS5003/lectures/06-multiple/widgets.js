// Lecture 6 widgets. Each slide with a widget has a figure box <div class="w-fig" data-widget="name">
// and inputs with a data-k="name" attribute; the widget redraws when an input changes and when the
// light/dark theme is switched. Charts use Observable Plot and d3 (from the CDN).
import { hubbleTime, benchmark, E, simpson, c_kms } from "../../_shared/cosmo.js";
import { single, singlePlot, aMax, fateRange, history, fatePlot, fates, showSteps, turning, bounceLine, crunchLine } from "../../_shared/models.js";
import { withAxes } from "../../_shared/plot.js";

const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const colours = () => Object.fromEntries(["ink", "ink-soft", "accent", "hot", "cool", "good", "gold", "edge", "bg"].map((k) => [k.replace("-", "_"), css(`--${k}`)]));
const style = (C, fontSize = "16px") => ({ background: "transparent", color: C.ink, fontSize, fontFamily: css("--f-ui") });
const tH = hubbleTime(benchmark.H0);                     // 1/H0 in Gyr

// One line about a universe's history (matter + Λ + curvature)
function describe(Om, OL) {
  const O0 = Om + OL, k = Math.abs(O0 - 1) < 0.005 ? "flat, κ = 0" : O0 > 1 ? "κ = +1" : "κ = −1";
  const amax = turning(Om, OL, 1, 1e8), amin = turning(Om, OL, 1, 1e-8);
  // age t0 = ∫ da / (a H), in ln a from a ≈ 0 to today
  const age = amin === null ? simpson((x) => 1 / Math.sqrt(Om / Math.exp(3 * x) + OL + (1 - Om - OL) / Math.exp(2 * x)), Math.log(1e-8), 0, 2000) : null;
  const start = amin === null ? `Big Bang ${age.toFixed(2)}/H₀ = ${(age * tH).toFixed(1)} Gyr ago` : `no Big Bang: a bounce at a = ${amin.toFixed(2)}`;
  const end = amax !== null ? `Big Crunch, with aₘₐₓ = ${amax.toPrecision(3)}` : "expands forever";
  return { O0: O0.toFixed(2), k, start, end, accel: OL > Om / 2 ? "speeding up" : "slowing down" };
}

const fill = (box, v) => { for (const el of box.closest("section").querySelectorAll("[data-v]")) el.textContent = v[el.dataset.v] ?? ""; };

const widgets = {
  single: (box) => box.replaceChildren(singlePlot(colours(), { height: +(box.dataset.h ?? 400), font: css("--f-ui") })),

  // matter + Λ + curvature. data-mode: "fates" (the four curves of Ryden Fig. 5.7, no inputs),
  // "mk" (slider Om, no Λ), "flat" (slider Om, ΩΛ = 1 − Ωm), "plane" (sliders Om and OL, presets,
  // and the Ωm–ΩΛ plane, which can be clicked)
  fate: (box, s) => {
    const C = colours(), mode = box.dataset.mode;
    if (mode === "fates") {
      box.replaceChildren(fatePlot(C, fates(C), { height: +(box.dataset.h ?? 400) }));
      if ("steps" in box.dataset) showSteps(box);
      return;
    }
    const Om = s.Om, OL = mode === "mk" ? 0 : mode === "flat" ? 1 - s.Om : s.OL;
    const u = history(Om, OL);
    // the single-component universes of Lecture 5, in their colours and line styles
    const milne = { pts: history(0, 0).pts, colour: C.ink_soft, dash: single.milne.dash, key: single.milne.label };
    const eds = { pts: history(1, 0).pts, colour: C.accent, key: single.matter.label };
    // the chosen universe: a wide, faint gold curve, as on the slider slide of Lecture 5
    // plane: the four universes of the previous slide; otherwise the empty and Einstein–de Sitter ones
    const others = mode === "plane" ? fates(C).map((f) => ({ ...f, step: undefined })) : [milne, eds];
    const curves = [{ pts: u.pts, colour: C.gold, width: 10, opacity: 0.45 }, ...others];
    const aplot = fatePlot(C, curves, { height: 360 });
    fill(box, { Om: Om.toFixed(2), OL: OL.toFixed(2), ...describe(Om, OL) });
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
    // the controls (.w-mid in the box) stay between the plane and the a(t) plot; only the plots are
    // replaced, so that a slider being dragged is not taken out of the page
    const mid = box.querySelector(":scope > .w-mid");
    if (!mid) { box.replaceChildren(plane, aplot); return; }
    for (const el of [...box.children]) if (el !== mid) el.remove();
    mid.before(plane);
    mid.after(aplot);
  },

  // a cosmology calculator, after Ned Wright's: number fields H0, Om, OL (OL = 1 − Ωm − Ωr when "flat"
  // is ticked), a checkbox for radiation and a redshift z. The integrals are done in ln a; distances as
  // in Ryden ch. 7, with Sκ(r) for curved space. Three small plots go in the box: a(t) with the four
  // universes of Ryden Fig. 5.7, and the proper distance today and at emission against z.
  calc: (box, s) => {
    const C = colours(), sec = box.closest("section");
    const H0 = s.H0 > 0 ? s.H0 : 67.4, h = H0 / 100, Or = s.rad ? 4.16e-5 / h ** 2 : 0, Om = s.Om;
    const olIn = sec.querySelector('[data-k="OL"]');
    olIn.disabled = s.flat;
    if (s.flat) olIn.value = +(1 - Om - Or).toFixed(5);
    const OL = s.flat ? 1 - Om - Or : s.OL, Ok = 1 - Or - Om - OL, z = Math.max(0, s.z || 0), ae = 1 / (1 + z);
    const Ez = (a) => Math.sqrt(Or / a ** 4 + Om / a ** 3 + OL + Ok / a ** 2);
    const tH = hubbleTime(H0), dH = c_kms / H0;           // Gyr and Mpc
    const amin = turning(Om, OL, 1, 1e-10, Or), amax = turning(Om, OL, 1, 1e8, Or);
    const reached = amin === null || amin < ae;           // light from z left after the bounce
    const tOf = (a) => simpson((x) => 1 / Ez(Math.exp(x)), Math.log(1e-10), Math.log(a), 4000);
    const r = reached ? simpson((x) => 1 / (Math.exp(x) * Ez(Math.exp(x))), Math.log(ae), 0, 2000) : NaN;
    const Sk = Ok > 1e-6 ? Math.sinh(Math.sqrt(Ok) * r) / Math.sqrt(Ok) : Ok < -1e-6 ? Math.sin(Math.sqrt(-Ok) * r) / Math.sqrt(-Ok) : r;
    const t0 = amin === null ? tOf(1) : Infinity, te = amin === null ? tOf(ae) : Infinity, look = reached ? simpson((x) => 1 / Ez(Math.exp(x)), Math.log(ae), 0, 2000) : NaN;
    const gyr = (x) => (isFinite(x) ? `${(x * tH).toFixed(2)} Gyr` : "∞ (no Big Bang)");
    const mpc = (x) => (isFinite(x) ? `${(x * dH).toFixed(x * dH < 100 ? 1 : 0)} Mpc (${(x * dH * 3.2616e-3).toFixed(1)} Gly)` : "—");
    const fmt = (x, n = 3) => (Math.abs(x) < 0.5 * 10 ** -n ? (0).toFixed(n) : x.toFixed(n)).replace("-", "−");
    fill(box, {
      Orv: s.rad ? `${(Or * 1e5).toFixed(1)}×10⁻⁵` : "0",
      Ok: `${fmt(Ok)} (${Math.abs(Ok) < 5e-4 ? "flat" : Ok > 0 ? "κ = −1" : "κ = +1"})`,
      t0: gyr(t0), te: reached ? gyr(te) : "— (before the bounce)", look: reached ? `${(look * tH).toFixed(2)} Gyr` : "—",
      dp0: mpc(r), dpe: mpc(r * ae), dL: mpc(Sk * (1 + z)), dA: mpc(Sk * ae),
      scale: reached && z > 0 ? `${(Sk * ae * dH * 1000 * Math.PI / 648000).toFixed(2)} kpc` : "—",
      fate: amax !== null ? `Big Crunch, aₘₐₓ = ${amax.toPrecision(3)}` : "expands forever",
    });

    // 1. a(t): the four universes of the Ωm–ΩΛ slides, and this one as the wide gold curve
    const W = 380, fs = "13px";
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
        width: W, height: 150, marginLeft: 50, marginBottom: 38, marginTop: 24, marginRight: 16, style: style(C, fs),
        x: { type: "log", domain: [0.01, 1000], reverse: true, tickFormat: (d) => (Number.isInteger(Math.log10(d)) ? String(d) : ""), label: "← redshift z", labelAnchor: "left", labelArrow: "none" },
        y: { domain: [0, ymax], ticks: 4, label, labelAnchor: "top", labelArrow: "none" },
        marks: [
          Plot.line(pts, { x: "z", y: key, stroke: C.gold, strokeWidth: 8, strokeOpacity: 0.45 }),
          ...(reached && z >= 0.01 && z <= 1000 ? [Plot.dot([{ z, d: here }], { x: "z", y: "d", r: 5, fill: C.ink })] : []),
        ],
      }, C.ink));
    };
    box.replaceChildren(aplot, dPlot("d0", "↑ dp(t₀), today (Gpc)", r * dH / 1000), dPlot("de", "↑ dp(tₑ), at emission (Gpc)", r * ae * dH / 1000));
  },

  // radiation + matter, flat (Ryden eq. 5.110): a(t) on log axes, with the radiation-only and
  // matter-only power laws it follows before and after radiation–matter equality
  rm: (box) => {
    const C = colours(), { Om, Or } = benchmark, arm = Or / Om;
    const tExact = (a) => 4 * arm ** 2 / (3 * Math.sqrt(Or)) * (1 - (1 - a / (2 * arm)) * Math.sqrt(1 + a / arm));
    const as = d3.range(-6, -1.999, 0.02).map((x) => 10 ** x);
    const ts = d3.range(-11, -2.999, 0.05).map((x) => 10 ** x);
    const lines = [
      { key: single.radiation.label, colour: C.hot, dash: single.radiation.dash, width: 2.5, pts: ts.map((t) => ({ t, a: Math.sqrt(2 * Math.sqrt(Or) * t) })) },
      { key: single.matter.label, colour: C.accent, width: 2.5, pts: ts.map((t) => ({ t, a: (1.5 * Math.sqrt(Om) * t) ** (2 / 3) })) },
      { key: "radiation + matter", colour: C.ink, width: 6, pts: as.map((a) => ({ t: tExact(a), a })) },
    ];
    const marks = [Plot.ruleY([arm], { stroke: C.edge, strokeDasharray: "4 4" })];
    // the exact curve first, underneath the two power laws
    for (const l of [lines[2], lines[0], lines[1]]) marks.push(Plot.line(l.pts, { x: "t", y: "a", stroke: l.colour, strokeWidth: l.width, strokeDasharray: l.dash, clip: true }));
    // a key in the empty top left; the key rows are evenly spaced in log a
    lines.forEach((l, i) => {
      const a = 10 ** (-2.25 - 0.3 * i);
      marks.push(Plot.line([{ t: 2e-11, a }, { t: 1.5e-10, a }], { x: "t", y: "a", stroke: l.colour, strokeWidth: l.width, strokeDasharray: l.dash }),
        Plot.text([{ t: 2.2e-10, a }], { x: "t", y: "a", text: () => l.key, textAnchor: "start", fill: l.colour, fontWeight: 700 }));
    });
    marks.push(Plot.dot([{ t: tExact(arm), a: arm }], { x: "t", y: "a", r: 6, fill: C.gold }),
      Plot.text([{ t: tExact(arm), a: arm }], { x: "t", y: "a", text: () => "equality, a = aᵣₘ", dx: 10, dy: 14, textAnchor: "start", fill: C.gold, fontWeight: 700 }));
    const pow = (d) => (Number.isInteger(Math.log10(d)) ? `10${sup(Math.round(Math.log10(d)))}` : "");
    box.replaceChildren(Plot.plot(withAxes({
      width: 460, height: 400, marginLeft: 60, marginBottom: 46, marginTop: 32, marginRight: 16, style: style(C),
      x: { type: "log", domain: [1e-11, 1e-3], ticks: [1e-11, 1e-9, 1e-7, 1e-5, 1e-3], tickFormat: pow, label: "time H₀t →", labelAnchor: "right", labelArrow: "none" },
      y: { type: "log", domain: [1e-6, 1e-2], ticks: [1e-6, 1e-5, 1e-4, 1e-3, 1e-2], tickFormat: pow, label: "↑ scale factor a", labelAnchor: "top", labelArrow: "none" },
      marks,
    }, C.ink)));
  },

  // the Benchmark Model (thick, in the ink colour, like the exact solution of the radiation + matter
  // slide). Linear axes: the axes of the other a(t) plots, with the empty, matter-only and Λ-only
  // universes of Lecture 5. Log axes (data-log on the box): H0 t against a, with the three power laws.
  benchmark: (box) => {
    const C = colours(), p = benchmark, log = "log" in box.dataset;
    const lna = d3.range(Math.log(1e-7), Math.log(30), 0.005);
    let tau = (1e-7) ** 2 / (2 * Math.sqrt(p.Or));     // H0 t; radiation era: a = (2 √Ωr H0 t)^(1/2)
    const pts = lna.map((x, i) => {
      if (i) { const a0 = Math.exp(lna[i - 1]), a1 = Math.exp(x); tau += 0.5 * (1 / E(a0) + 1 / E(a1)) * (x - lna[i - 1]); }
      return { tau, a: Math.exp(x) };
    });
    const tauAt = (a) => {                              // interpolated in ln a
      const i = pts.findIndex((q) => q.a >= a), q0 = pts[i - 1], q1 = pts[i];
      return q0.tau + (q1.tau - q0.tau) * Math.log(a / q0.a) / Math.log(q1.a / q0.a);
    };
    const tau0 = tauAt(1), arm = p.Or / p.Om, amL = (p.Om / p.OL) ** (1 / 3);
    const bench = { colour: C.ink, width: 6, key: "Benchmark Model" };
    const dot = (d) => Plot.dot([d], { x: "x", y: "a", r: 6, fill: C.gold });
    const label = (d, text, textAnchor, dx, dy) => Plot.text([d], { x: "x", y: "a", text: () => text, textAnchor, dx, dy, fill: C.gold, fontWeight: 700 });
    const note = `t₀ = ${(tau0 * tH).toFixed(1)} Gyr`;
    if (!log) {
      const mL = { x: tauAt(amL) - tau0, a: amL };
      const lambda = d3.range(fateRange[0], fateRange[1] + 1e-4, 0.01).map((x) => ({ s: x, a: Math.exp(x) })).filter((q) => q.a <= aMax + 0.5);
      const curves = [
        { ...bench, pts: pts.map((q) => ({ s: q.tau - tau0, a: q.a })) },
        { pts: history(0, 0).pts, colour: C.ink_soft, dash: single.milne.dash, key: single.milne.label },
        { pts: history(1, 0).pts, colour: C.accent, key: single.matter.label },
        { pts: lambda, colour: C.good, dash: single.lambda.dash, key: single.lambda.label },
      ];
      box.replaceChildren(fatePlot(C, curves, { height: 400, extra: [
        Plot.dot([{ s: -tau0, a: 0 }], { x: "s", y: "a", r: 6, fill: C.ink }),
        dot(mL), label(mL, "matter–Λ equality", "start", 10, 18),
      ] }));
      return;
    }
    // log axes: the three power laws, and the exponential matched to the model at late times
    const ts = d3.range(-11, 1.0001, 0.05).map((x) => 10 ** x), last = pts[pts.length - 1];
    const laws = [
      { colour: C.hot, dash: single.radiation.dash, key: single.radiation.label, pts: ts.map((x) => ({ x, a: Math.sqrt(2 * Math.sqrt(p.Or) * x) })) },
      { colour: C.accent, key: single.matter.label, pts: ts.map((x) => ({ x, a: (1.5 * Math.sqrt(p.Om) * x) ** (2 / 3) })) },
      { colour: C.good, dash: single.lambda.dash, key: single.lambda.label, pts: ts.filter((x) => x > 0.05).map((x) => ({ x, a: last.a * Math.exp(Math.sqrt(p.OL) * (x - last.tau)) })) },
    ];
    const lines = [{ ...bench, pts: pts.map((q) => ({ x: q.tau, a: q.a })) }, ...laws];
    const marks = lines.map((l) => Plot.line(l.pts, { x: "x", y: "a", stroke: l.colour, strokeWidth: l.width ?? 2.5, strokeDasharray: l.dash, clip: true }));
    // a key in the empty bottom right
    lines.forEach((l, i) => {
      const a = 10 ** (-4.3 - 0.45 * i);
      marks.push(Plot.line([{ x: 2e-5, a }, { x: 2e-4, a }], { x: "x", y: "a", stroke: l.colour, strokeWidth: l.width ?? 2.5, strokeDasharray: l.dash }),
        Plot.text([{ x: 3e-4, a }], { x: "x", y: "a", text: () => l.key, textAnchor: "start", fill: l.colour, fontWeight: 700 }));
    });
    const rm = { x: tauAt(arm), a: arm }, mL = { x: tauAt(amL), a: amL }, now = { x: tau0, a: 1 };
    marks.push(dot(rm), label(rm, "radiation–matter equality", "end", -10, -12),
      dot(mL), label(mL, "matter–Λ equality", "end", -12, 6),
      Plot.dot([now], { x: "x", y: "a", r: 5, fill: C.ink }),
      Plot.text([now], { x: "x", y: "a", text: () => `today, ${note}`, textAnchor: "end", dx: -10, dy: -10, fill: C.ink }));
    const pow = (d) => (Number.isInteger(Math.log10(d)) ? `10${sup(Math.round(Math.log10(d)))}` : "");
    box.replaceChildren(Plot.plot(withAxes({
      width: 434, height: 400, marginLeft: 50, marginBottom: 46, marginTop: 32, marginRight: 16, style: style(C),
      x: { type: "log", domain: [1e-11, 10], ticks: [1e-11, 1e-9, 1e-7, 1e-5, 1e-3, 1e-1, 10], tickFormat: pow, label: "time H₀t →", labelAnchor: "right", labelArrow: "none" },
      y: { type: "log", domain: [1e-6, 10], ticks: [1e-6, 1e-4, 1e-2, 1], tickFormat: pow, label: "↑ scale factor a", labelAnchor: "top", labelArrow: "none" },
      marks,
    }, C.ink)));
  },

  // proper distance against redshift (after Ryden Fig. 5.9), today or at emission (data-when="emission"),
  // for the Benchmark Model and the empty, matter-only and Λ-only universes, styled as in the a(t) plot.
  // data-key on the box draws the key. A checkbox data-k="flip" puts high z on the left (time left to right).
  dz: (box, s) => {
    const C = colours(), emit = box.dataset.when === "emission";
    const zs = d3.range(-2, 3.0001, 0.02).map((x) => 10 ** x);
    const bench = (z) => simpson((x) => 1 / (Math.exp(x) * E(Math.exp(x))), -Math.log(1 + z), 0, 200);
    const models = [   // comoving distance today, in c/H0
      { key: "Benchmark Model", f: bench, c: C.ink, width: 6 },
      { key: single.milne.label, f: (z) => Math.log(1 + z), c: C.ink_soft, dash: single.milne.dash },
      { key: single.matter.label, f: (z) => 2 * (1 - 1 / Math.sqrt(1 + z)), c: C.accent },
      { key: single.lambda.label, f: (z) => z, c: C.good, dash: single.lambda.dash },
    ];
    const ymax = emit ? 1.05 : 3.6;
    const marks = models.map((m) => Plot.line(zs.map((z) => ({ z, d: m.f(z) / (emit ? 1 + z : 1) })),
      { x: "z", y: "d", stroke: m.c, strokeWidth: m.width ?? 3, strokeDasharray: m.dash, clip: true }));
    if ("key" in box.dataset) models.forEach((m, i) => {
      const d = (0.9 - 0.08 * i) * ymax;
      // in the empty top left, or the top right when the axis is flipped
      const [z1, z2, zt] = s.flip ? [1.0, 0.4, 0.33] : [0.013, 0.04, 0.05];
      marks.push(Plot.line([{ z: z1, d }, { z: z2, d }], { x: "z", y: "d", stroke: m.c, strokeWidth: m.width ?? 3, strokeDasharray: m.dash }),
        Plot.text([{ z: zt, d }], { x: "z", y: "d", text: () => m.key, textAnchor: "start", fill: m.c, fontWeight: 700 }));
    });
    box.replaceChildren(Plot.plot(withAxes({
      width: 520, height: 380, marginLeft: 56, marginBottom: 46, marginTop: 32, marginRight: 20, style: style(C),
      x: { type: "log", domain: [0.01, 1000], reverse: !!s.flip, tickFormat: (d) => (Number.isInteger(Math.log10(d)) ? String(d) : ""),
        label: s.flip ? "← redshift z" : "redshift z →", labelAnchor: s.flip ? "left" : "right", labelArrow: "none" },
      y: { domain: [0, ymax], label: emit ? "↑ dp(tₑ), at emission (c/H₀)" : "↑ dp(t₀), today (c/H₀)", labelAnchor: "top", labelArrow: "none" },
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
