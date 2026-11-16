// Model universes for the Lecture 5 and 6 widgets (Ryden ch. 5). Time is s = H0 (t − t0), distances
// are in units of the Hubble distance c/H0, and a(t0) = 1. Charts use Observable Plot (global Plot).

// Flat single-component universes and the empty (Milne) universe. For a power law a ∝ t^n the
// Big Bang is at s = −n; de Sitter (n = null) has no Big Bang.
export const single = {
  milne: { name: "Empty (Milne)", n: 1, label: "empty: a ∝ t" },
  matter: { name: "Matter only", n: 2 / 3, label: "matter: a ∝ t²ᐟ³" },
  radiation: { name: "Radiation only", n: 1 / 2, label: "radiation: a ∝ t¹ᐟ²" },
  lambda: { name: "Λ only (de Sitter)", n: null, label: "Λ: a ∝ exp(H₀t)" },
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

// The four curves of Lecture 5: a(s) for the empty, matter-only, radiation-only and Λ-only universes.
// show: which models to draw (default all). C: theme colours. Returns the Plot figure.
export const singleColours = (C) => ({ milne: C.ink_soft, matter: C.accent, radiation: C.hot, lambda: C.good });

export function singlePlot(C, { show = Object.keys(single), width = 600, height = 400, fontSize = "16px", font } = {}) {
  const col = singleColours(C);
  const marks = [
    Plot.ruleX([0], { stroke: C.edge, strokeDasharray: "4 4" }),
    Plot.text([{ s: -0.05, a: 2.85 }], { x: "s", y: "a", text: () => "← past", textAnchor: "end", fill: C.ink_soft }),
    Plot.text([{ s: 0.05, a: 2.85 }], { x: "s", y: "a", text: () => "future →", textAnchor: "start", fill: C.ink_soft }),
    Plot.dot([{ s: 0, a: 1 }], { x: "s", y: "a", r: 5, fill: C.ink }),
    Plot.text([{ s: 0, a: 1 }], { x: "s", y: "a", text: () => "today", dx: 30, dy: 14, fill: C.ink }),
  ];
  for (const m of show) {
    const n = single[m].n, s0 = n === null ? -2.2 : -n;
    const pts = d3.range(s0, 2.2001, 0.01).map((s) => ({ s, a: aSingle(m, s) })).filter((p) => p.a <= 3);
    marks.push(Plot.line(pts, { x: "s", y: "a", stroke: col[m], strokeWidth: 3 }));
    if (n !== null) marks.push(Plot.dot([{ s: s0, a: 0 }], { x: "s", y: "a", r: 5, fill: col[m] }));
  }
  // labels as a key in the empty top left
  marks.push(Plot.text(show.map((m, i) => ({ s: -2.1, a: 2.8 - 0.3 * i, m })), { x: "s", y: "a", text: (d) => single[d.m].label, textAnchor: "start", fill: (d) => col[d.m], fontWeight: 700 }));
  return Plot.plot({
    width, height, marginLeft: 50, marginBottom: 46, marginTop: 32, marginRight: 16,
    style: { background: "transparent", color: C.ink, fontSize, fontFamily: font },
    x: { domain: [-2.2, 2.2], label: "time H₀(t − t₀) →", labelAnchor: "right", labelArrow: "none" },
    y: { domain: [0, 3], ticks: 6, label: "↑ scale factor a", labelAnchor: "top", labelArrow: "none" },
    marks,
  });
}
