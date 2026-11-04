// Lecture 2: measuring distances and velocities; cosmic expansion.
import { story, plot, canvas, csv, h } from "../../../assets/story.js";
import { c_kms, hubbleTime, sci, rng, wavelengthToRGB } from "../../_shared/cosmo.js";

const [pantheon, hubble29] = await Promise.all([csv("public/pantheon_lowz.csv"), csv("public/hubble1929.csv")]);

// ---------- schematic quasar-like spectrum ----------
const lines = [
  { name: "Lyα", lam: 1216, amp: 6, w: 0.012 },
  { name: "C IV", lam: 1549, amp: 2.2, w: 0.01 },
  { name: "C III]", lam: 1909, amp: 1.2, w: 0.01 },
  { name: "Mg II", lam: 2798, amp: 1.4, w: 0.01 },
  { name: "Hβ", lam: 4861, amp: 1.0, w: 0.008, dx: -14 },
  { name: "[O III]", lam: 5007, amp: 1.3, w: 0.002, dx: 22 },
  { name: "Hα", lam: 6563, amp: 3.0, w: 0.008 },
];
// observed frame at redshift z (arbitrary units), with a simple Lyα-forest suppression
// blueward of Lyα and nothing below the Lyman limit
const spectrum = (z, lo = 1000, hi = 11000, n = 1500) => d3.range(n).map((i) => {
  const lobs = lo + ((hi - lo) * i) / (n - 1), lr = lobs / (1 + z);
  let f = 1.2 * (lr / 3000) ** -0.5;
  for (const L of lines) f += L.amp * Math.exp(-0.5 * ((lr - L.lam) / (L.w * L.lam)) ** 2);
  if (lr < 1216) f *= Math.exp(-0.0036 * (lobs / 1216) ** 3.7);
  if (lr < 912) f = 0;
  return { lam: lobs, f };
});
const rainbow = d3.range(3800, 7500, 25).map((l) => ({ x1: l, x2: l + 25, c: wavelengthToRGB(l / 10) }));
const qsos = [{ id: "A", z: 4.4 }, { id: "B", z: 2.8 }, { id: "C", z: 6.3 }];

// ---------- Hubble diagram from Pantheon+ ----------
function supernovae(s) {
  const shrink = s.shrink ? 7 : 1;
  return pantheon
    .filter((d) => d.calibrator === 0 && d.zHD < 0.1)
    .map((d) => ({ name: d.name, rTrue: 10 ** ((d.mu - 25) / 5), r: 10 ** ((d.mu - 25) / 5) / shrink, v: c_kms * (s.helio ? d.zHEL : d.zHD) }))
    .filter((d) => s.range === "all" || d.rTrue < 60);
}
function hubbleFit(s, sn) {
  return {
    best: d3.sum(sn, (d) => d.v * d.r) / d3.sum(sn, (d) => d.r * d.r),
    rms: Math.sqrt(d3.mean(sn, (d) => (d.v - s.H0 * d.r) ** 2)),
  };
}

// ---------- H0 through the years ----------
const h0hist = [
  { year: 1929, H0: 500, err: 0, who: "Hubble 1929" },
  { year: 2001, H0: 72, err: 8, who: "HST Key Project (Freedman+ 2001)" },
  { year: 2013, H0: 69.32, err: 0.8, who: "WMAP 9-yr (Hinshaw+ 2013)" },
  { year: 2018, H0: 67.4, err: 0.5, who: "Planck 2018 (CMB)" },
  { year: 2019, H0: 69.8, err: 1.9, who: "CCHP tip of the red giant branch (Freedman+ 2019)" },
  { year: 2022, H0: 73.04, err: 1.04, who: "SH0ES Cepheids + SNe Ia (Riess+ 2022)" },
];

// ---------- expanding grid of galaxies ----------
const gridGals = (() => {
  const r = rng(11), g = [];
  for (let i = -5; i <= 5; i++) for (let j = -5; j <= 5; j++) g.push({ x: i + 0.15 * r.normal(), y: j + 0.15 * r.normal() });
  return g;
})();

// side-by-side figures that stack when the figure is tall and narrow
function pair(s, left, right) {
  const wide = s.W > 1.2 * s.H;
  const a = { ...s, W: wide ? Math.floor(s.W * 0.5) - 8 : s.W, H: wide ? s.H : Math.floor(s.H / 2) - 8 };
  return h("div", { style: `display:flex;flex-direction:${wide ? "row" : "column"};gap:16px` }, left(a), right(a));
}

// the expanding grid as seen from galaxy s.obs; clicking a galaxy moves the observer there
function expansionFigure(s) {
  const box = h("div");
  const render = () => box.replaceChildren(pair(s, (a) => {
    const W = Math.min(a.W, a.H), half = 6.5, sc = W / 2 / half, o = gridGals[s.obs];
    const { cv, g } = canvas(a, W, W);
    cv.style.cursor = "pointer";
    g.translate(W / 2, W / 2);
    for (const [k, gal] of gridGals.entries()) {
      const x1 = (gal.x - o.x) * sc, y1 = (gal.y - o.y) * sc, x2 = s.grow * x1, y2 = s.grow * y1;
      g.globalAlpha = 0.45; g.fillStyle = s.C.soft;
      g.beginPath(); g.arc(x1, y1, 4, 0, 2 * Math.PI); g.fill();
      g.globalAlpha = 0.85; g.strokeStyle = s.C.gold; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      g.globalAlpha = 1; g.fillStyle = k === s.obs ? s.C.hot : s.C.ink;
      g.beginPath(); g.arc(x2, y2, k === s.obs ? 8 : 5, 0, 2 * Math.PI); g.fill();
    }
    cv.addEventListener("click", (e) => {
      const b = cv.getBoundingClientRect();
      const px = e.clientX - b.left - W / 2, py = e.clientY - b.top - W / 2;
      let best = s.obs, dmin = Infinity;
      gridGals.forEach((gal, k) => {
        const d = Math.hypot(s.grow * (gal.x - o.x) * sc - px, s.grow * (gal.y - o.y) * sc - py);
        if (d < dmin) { dmin = d; best = k; }
      });
      s.obs = best;
      render();
    });
    return cv;
  }, (a) => {
    const o = gridGals[s.obs];
    const pts = gridGals.map((gal) => { const r1 = Math.hypot(gal.x - o.x, gal.y - o.y); return { r1, dr: (s.grow - 1) * r1 }; });
    return plot(a, {
      grid: true,
      x: { label: "distance at t₁ →", domain: [0, 11] }, y: { label: "↑ distance moved", domain: [0, 11] },
      marks: [Plot.dot(pts, { x: "r1", y: "dr", r: 4, fill: s.C.cool })],
    });
  }));
  render();
  return box;
}

story({
  kicker: "AS5003 Cosmology · Lecture 2",
  title: "Measuring distances and velocities; cosmic expansion",
  subtitle: "How we measure how far away galaxies are and how fast they recede, why their speed grows with distance, and what redshift tells us about the size of the Universe.",
  meta: "Sambit Kumar Giri · Thu 5 November 2026",
  footer: `<a href="../../">All lectures</a> · <a href="./">Slides</a> ·
    <kbd>←</kbd> <kbd>→</kbd> move · <kbd>F</kbd> full screen · <kbd>H</kbd> hide text · <kbd>T</kbd> light/dark`,
  // faint Hubble diagram of the Pantheon+ supernovae
  cover: (s) => {
    const sn = supernovae({ range: "all" });
    return plot(s, {
      margin: 0, x: { axis: null, domain: [-60, 480] }, y: { axis: null, domain: [-6000, 36000] },
      marks: [
        Plot.dot(sn, { x: "r", y: "v", r: 2.5, fill: s.C.accent, fillOpacity: 0.25 }),
        Plot.line([[0, 0], [480, 480 * 69.3]], { stroke: s.C.accent, strokeOpacity: 0.35, strokeWidth: 2 }),
      ],
    });
  },
  chapters: [
    {
      id: "recap", part: "Recap", title: "Recap: five fundamental observations",
      text: `<ul><li>The night sky is dark</li>
        <li>The Universe is homogeneous and isotropic on large scales (the <b>cosmological principle</b>)</li>
        <li>The cosmic microwave background</li>
        <li>The abundances of the light elements (H, D, He, Li)</li>
        <li><b>Galaxies are moving away from each other, with velocity proportional to distance</b></li></ul>
        <div class="step"><p>Today we look at the last one. That raises two questions:</p>
        <p class="key">How do we measure a galaxy's <b>velocity</b>? How do we measure its <b>distance</b>?</p></div>`,
    },
    {
      id: "debate", part: "Measuring distances", title: "Recall: the Shapley–Curtis \"Great Debate\" (1920)",
      text: `<p>The central question was the <b>scale of the Universe</b>.</p>
        <div class="cols"><p><b>Shapley</b>: the Milky Way is the whole Universe. The "spiral nebulae" are clouds inside it.</p>
        <p><b>Curtis</b>: the spiral nebulae are separate galaxies, like our own, far outside the Milky Way.</p></div>
        <p class="step">The debate could not be settled in 1920 because nobody could measure the <b>distance</b> to a nebula.
        The tool that solved it was a special kind of star.</p>`,
    },
    {
      id: "cepheids", part: "Measuring distances", title: "Cepheid variables: the first \"standard candle\"",
      text: `<ul><li><b>Henrietta Leavitt (1912)</b> studied variable stars in the Small Magellanic Cloud. All of them are at about the same distance from us.</li>
        <li>She found that brighter Cepheids pulsate <b>more slowly</b>: there is a <b>period–luminosity relation</b>.</li>
        <li class="step">Measure the period ⇒ know the luminosity $L$. Measure the flux $f$ ⇒ get the distance:
        $$f = \\frac{L}{4\\pi r^2} \\quad\\Rightarrow\\quad r = \\sqrt{\\frac{L}{4\\pi f}}$$</li>
        <li class="step"><b>Hubble (1925)</b> found Cepheids in the Andromeda nebula (M31). They were so faint that M31 had to be far
        outside the Milky Way. <b>Curtis was right.</b></li></ul>`,
    },
    {
      id: "doppler", part: "Measuring velocities", title: "The Doppler effect",
      text: `<p>A source moving away from us (or towards us) at speed $v \\ll c$ shifts the wavelength:</p>
        $$\\lambda_\\text{obs} = \\lambda_\\text{em}\\left(1 + \\frac{v}{c}\\right)
        \\qquad\\Longleftrightarrow\\qquad
        \\frac{\\lambda_\\text{obs} - \\lambda_\\text{em}}{\\lambda_\\text{em}} = \\frac{v}{c}$$
        <ul><li>Moving <b>away</b> ($v &gt; 0$): longer wavelength, <b>redshift</b></li>
        <li>Moving <b>towards</b> us ($v &lt; 0$): shorter wavelength, <b>blueshift</b></li></ul>`,
    },
    {
      id: "warmup", part: "Measuring velocities", title: "Warm-up: the Doppler defence",
      text: `<p>You are pulled over by the police for driving through a red light. Having just learned about the Doppler effect, you say:</p>
        <p class="quote">"At the speed I was going, the red light looked green!"</p>
        <p>How fast would you have to drive? Take red light as 600 nm and green as 500 nm.</p>
        <div class="step">$$\\frac{v}{c} = \\frac{500 - 600}{600} = -\\frac{1}{6}$$
        $$\\Rightarrow\\quad |v| \\approx 5\\times10^{4}\\ \\text{km/s}$$
        <p>That is about 1.8 × 10⁸ km/h. You get a speeding ticket instead.</p></div>`,
      controls: [{ id: "v", type: "range", label: "v / c (− = towards)", min: -0.25, max: 0.25, step: 0.005, value: 0, fmt: (v) => v.toFixed(3) }],
      readout: (s) => [["v", `${sci(s.v * c_kms)} km/s`], ["red light (630 nm) seen at", `${(630 * (1 + s.v)).toFixed(0)} nm`]],
      draw: (s) => {
        // typical LED traffic-light wavelengths; the housing and lamps are drawn in their physical colours
        const lights = [{ nm: 630 }, { nm: 590 }, { nm: 505 }];
        const H = Math.min(s.H, 2.6 * s.W), W = H * 0.42, R = H * 0.115;
        const { cv, g } = canvas(s, W, H);
        cv.style.margin = "0 auto";
        g.fillStyle = "#1f2937";
        g.beginPath(); g.roundRect(W * 0.08, H * 0.01, W * 0.84, H * 0.98, W * 0.16); g.fill();
        g.textAlign = "center"; g.textBaseline = "middle"; g.font = `600 ${Math.round(s.fs * 1.1)}px system-ui, sans-serif`;
        lights.forEach((l, i) => {
          const obs = l.nm * (1 + s.v), col = wavelengthToRGB(obs), y = H * (0.18 + 0.32 * i);
          g.fillStyle = col ?? "#374151";
          g.beginPath(); g.arc(W / 2, y, R, 0, 2 * Math.PI); g.fill();
          g.fillStyle = col ? "#0b1120" : "#e5e7eb";
          g.fillText(col ? `${obs.toFixed(0)} nm` : obs < 380 ? "UV" : "IR", W / 2, y);
        });
        return cv;
      },
    },
    {
      id: "lines", part: "Measuring velocities", title: "Line shifts in galaxy spectra",
      text: `<p>Atoms emit and absorb light at fixed, known wavelengths, for example the hydrogen Balmer lines.
        Compare the observed wavelength with the laboratory one:</p>
        <div class="key">$$z \\equiv \\frac{\\lambda_\\text{obs} - \\lambda_\\text{em}}{\\lambda_\\text{em}} \\qquad (= v/c \\text{ for small } v)$$</div>
        <p>$z$ is the <b>redshift</b>. It is what we actually measure.</p>`,
    },
    {
      id: "spectrum", part: "Measuring velocities", title: "Try it: redshift a spectrum",
      text: `<p>Slide the redshift and watch the emission lines move to longer wavelengths.</p>
        <p class="small"><i>Schematic</i> spectrum built from real rest wavelengths, not a real object. The rainbow bar marks visible light.</p>`,
      controls: [{ id: "z", type: "range", label: "redshift z", min: 0, max: 7, step: 0.01, value: 0, fmt: (v) => v.toFixed(2) }],
      readout: (s) => {
        const ly = 1216 * (1 + s.z), ha = 6563 * (1 + s.z);
        return [["Lyα (1216 Å) seen at", `${ly.toFixed(0)} Å`], [ly > 3000 ? "visible from the ground" : "blocked by the atmosphere"],
          ["Hα (6563 Å) seen at", `${ha.toFixed(0)} Å`], ...(ha > 7500 ? [["(infrared)"]] : [])];
      },
      draw: (s) => {
        const shown = lines.map((L) => ({ ...L, obs: L.lam * (1 + s.z) })).filter((L) => L.obs < 11000);
        return plot(s, {
          marginLeft: 2 * s.fs,
          x: { domain: [1000, 11000], label: "observed wavelength (Å) →" },
          y: { domain: [-0.6, 8.5], label: "↑ flux (arbitrary units)", ticks: [] },
          marks: [
            Plot.rect([0], { x1: 1000, x2: 3000, y1: -0.6, y2: 8.5, fill: s.C.soft, fillOpacity: 0.18 }),
            Plot.text(["atmosphere blocks UV"], { x: 2000, y: 0.4, fill: s.C.soft }),
            Plot.rect(rainbow, { x1: "x1", x2: "x2", y1: -0.6, y2: -0.15, fill: "c" }),
            Plot.line(spectrum(s.z), { x: "lam", y: "f", stroke: s.C.cool, strokeWidth: 1.8 }),
            Plot.text(shown, { x: "obs", y: (d) => Math.min(8, d.amp + 1.6), text: "name", dx: (d) => ((d.dx ?? 0) * s.fs) / 10, fill: s.C.hot }),
          ],
        });
      },
    },
    {
      id: "slipher", part: "Measuring velocities", title: "Almost all galaxies are redshifted",
      text: `<ul><li><b>Vesto Slipher</b> (Lowell Observatory) measured the first spectra of spiral nebulae, starting in 1912.</li>
        <li>By 1917 most of the ~25 nebulae he had measured were <b>redshifted</b>, some by more than 1000 km/s. That is far faster than any star in the Milky Way.</li>
        <li>Only a few of the very closest galaxies, such as Andromeda, are blueshifted.</li></ul>
        <p class="step">Slipher had the velocities. What was missing was the <b>distances</b>.</p>`,
    },
    {
      id: "hubble-law", part: "Hubble's law", title: "Combining distance and velocity",
      text: `<p>Hubble (1929) combined Slipher's velocities with his own distances:</p>
        <div class="key">$$v = H_0\\, r$$</div>
        <ul><li>$v = cz$: recession velocity (for $z \\ll 1$)</li>
        <li>$r$: distance (later we will call it the proper distance $d_p$)</li>
        <li>$H_0$: the <b>Hubble constant</b>, in <b>km s⁻¹ Mpc⁻¹</b></li></ul>
        <p class="step">Hubble found $H_0 \\approx 500$ km s⁻¹ Mpc⁻¹. Today we measure about 70. His distances were about <b>7× too small</b>:
        he mixed up two types of Cepheids (found by Baade in 1952) and took glowing gas clouds for bright stars (found by Sandage in 1958).</p>`,
    },
    {
      id: "fit", part: "Hubble's law", title: "Fit the Hubble constant yourself",
      text: `<p>Type Ia supernovae with distances from the Pantheon+ catalogue. Move your line until it follows the points, then reveal the best fit.</p>
        <p>Then make Hubble's mistakes: shrink all distances 7×, or drop the peculiar-velocity correction and look at the nearby galaxies.</p>`,
      note: "Type Ia supernovae: Pantheon+ (Scolnic et al. 2022; Brout et al. 2022), distances calibrated with SH0ES Cepheids. Triangles: Hubble (1929).",
      controls: [
        { id: "H0", type: "range", label: "your H₀ (km s⁻¹ Mpc⁻¹)", min: 30, max: 600, step: 1, value: 50 },
        { id: "range", type: "choice", label: "supernovae", value: "all", options: [{ value: "all", label: "z < 0.1" }, { value: "near", label: "nearby (r < 60 Mpc)" }] },
        { id: "shrink", type: "toggle", label: "distances 7× too small", value: false },
        { id: "helio", type: "toggle", label: "no peculiar-velocity correction", value: false },
        { id: "h29", type: "toggle", label: "overlay Hubble 1929", value: false },
        { id: "best", type: "toggle", label: "show best fit", value: false },
      ],
      readout: (s) => {
        const sn = supernovae(s), fit = hubbleFit(s, sn);
        return [["supernovae", sn.length], ["rms scatter about your line", `${fit.rms.toFixed(0)} km/s`],
          ...(s.best ? [["best fit H₀ (km s⁻¹ Mpc⁻¹)", fit.best.toFixed(1)]] : [])];
      },
      draw: (s) => {
        const sn = supernovae(s), fit = hubbleFit(s, sn), xmax = d3.max(sn, (d) => d.r) * 1.05;
        return plot(s, {
          grid: true, marginLeft: 4.2 * s.fs,
          x: { label: "distance r (Mpc) →", domain: [0, xmax] },
          y: { label: "↑ velocity v = cz (km/s)" },
          marks: [
            Plot.ruleY([0], { stroke: s.C.soft }),
            Plot.dot(sn, { x: "r", y: "v", r: 3, fill: s.C.cool, fillOpacity: 0.6 }),
            Plot.line([[0, 0], [xmax, s.H0 * xmax]], { stroke: s.C.hot, strokeWidth: 2.5 }),
            s.best ? Plot.line([[0, 0], [xmax, fit.best * xmax]], { stroke: s.C.good, strokeWidth: 2.5, strokeDasharray: "6 4" }) : null,
            s.h29 ? Plot.dot(hubble29, { x: "r_Mpc", y: "v_kms", r: 7, symbol: "triangle", fill: s.C.gold, stroke: s.C.bg }) : null,
          ],
        });
      },
    },
    {
      id: "relativistic", part: "Hubble's law", title: "Common confusion: relativistic Doppler and redshift",
      text: `<p>For large $r$, Hubble's law gives $v &gt; c$. Shouldn't we use the special-relativistic Doppler formula instead?</p>
        $$\\frac{\\lambda_\\text{obs}}{\\lambda_\\text{em}} = \\sqrt{\\frac{1 + v/c}{1 - v/c}} \\quad ?$$
        <div class="step"><p><b>No.</b> Cosmological redshift comes from the <b>expansion of space</b>, not from motion through space. We define</p>
        $$\\frac{\\lambda_\\text{obs}}{\\lambda_\\text{em}} = 1 + z$$
        <p>and $v = cz$ is only a low-$z$ approximation. Recession speeds above $c$ are allowed.</p></div>`,
      draw: (s) => {
        const zs = d3.range(0, 5.01, 0.02);
        const sr = (z) => ((1 + z) ** 2 - 1) / ((1 + z) ** 2 + 1);
        return plot(s, {
          grid: true,
          x: { label: "redshift z →", domain: [0, 5] }, y: { label: "↑ v / c", domain: [0, 5] },
          marks: [
            Plot.rect([0], { x1: 0, x2: 5, y1: 1, y2: 5, fill: s.C.gold, fillOpacity: 0.12 }),
            Plot.text(["v > c"], { x: 0.15, y: 4.7, textAnchor: "start", fill: s.C.gold }),
            Plot.line(zs.map((z) => [z, z]), { stroke: s.C.hot, strokeWidth: 2.5 }),
            Plot.line(zs.map((z) => [z, sr(z)]), { stroke: s.C.cool, strokeWidth: 2.5 }),
            Plot.text([[3.2, 3.2]], { text: () => "v = cz", dx: -10, dy: -10, textAnchor: "end", fill: s.C.hot }),
            Plot.text([[4.9, sr(4.9)]], { text: () => "special-relativistic Doppler", dy: -14, textAnchor: "end", fill: s.C.cool }),
          ],
        });
      },
    },
    {
      id: "h0-history", part: "Hubble's law", title: "Measuring H₀: a century of progress",
      text: `<p>Modern measurements lie between <b>67 and 73</b> km s⁻¹ Mpc⁻¹.</p>
        <ul><li><b>Blue band</b>: the early Universe (CMB, Planck)</li>
        <li><b>Red band</b>: the local distance ladder (Cepheids + supernovae, SH0ES)</li></ul>
        <p class="step">They disagree by about 5σ. This is the <b>Hubble tension</b>, one of today's big open questions and a good literature-project topic.</p>
        <p class="small">Hover over a point to see the measurement.</p>`,
      controls: [{ id: "zoom", type: "choice", label: "view", value: false, options: [{ value: false, label: "1920–2030" }, { value: true, label: "zoom in on 2000–2025" }] }],
      draw: (s) => {
        const data = s.zoom ? h0hist.filter((d) => d.year > 2000) : h0hist;
        const [x1, x2] = s.zoom ? [1998, 2025] : [1920, 2030];
        return plot(s, {
          grid: true,
          x: { label: "year →", tickFormat: "d", domain: [x1, x2] },
          y: { label: "↑ H₀ (km s⁻¹ Mpc⁻¹)", domain: s.zoom ? [60, 82] : [0, 550] },
          marks: [
            Plot.rect([0], { x1, x2, y1: 66.9, y2: 67.9, fill: s.C.cool, fillOpacity: 0.3 }),
            Plot.rect([0], { x1, x2, y1: 72.0, y2: 74.08, fill: s.C.hot, fillOpacity: 0.3 }),
            Plot.ruleX(data, { x: "year", y1: (d) => d.H0 - d.err, y2: (d) => d.H0 + d.err, stroke: s.C.ink, strokeWidth: 2 }),
            Plot.dot(data, { x: "year", y: "H0", r: 6, fill: s.C.ink, tip: true, title: (d) => `${d.who}: ${d.H0} ± ${d.err}` }),
          ],
        });
      },
    },
    {
      id: "quasars", part: "Hubble's law", title: "Quasar spectra: which is farthest?",
      text: `<p>Three quasars. The circled line is <b>Lyα</b> (rest wavelength 1216 Å) in all three. <i>(Schematic spectra.)</i></p>
        <p class="step">C is farthest: its Lyα is shifted the most. Redshifts: A: z = 4.4, B: z = 2.8, C: z = 6.3.</p>`,
      draw: (s) => plot(s, {
        marginLeft: 2.4 * s.fs,
        x: { domain: [4000, 12000], label: "observed wavelength (Å) →" },
        y: { ticks: [], label: null },
        fy: { label: null, tickSize: 0, padding: 0.15 },
        style: { fontSize: `${s.fs}px` },
        marks: [
          Plot.axisFy({ fontSize: 1.6 * s.fs, fontWeight: "bold", tickSize: 0, label: null }),
          Plot.line(qsos.flatMap((q) => spectrum(q.z, 4000, 12000, 900).map((d) => ({ ...d, id: q.id }))), { x: "lam", y: "f", fy: "id", stroke: s.C.cool, strokeWidth: 1.6 }),
          Plot.dot(qsos, { x: (q) => 1216 * (1 + q.z), y: 6.5, fy: "id", r: 0.9 * s.fs, stroke: s.C.hot, strokeWidth: 2.5 }),
        ],
      }),
    },
    {
      id: "expansion", part: "Why Hubble's law holds", title: "Hubble's law follows from homogeneous, isotropic expansion",
      text: `<div class="cols"><div><p>Take three galaxies. If the expansion is homogeneous and isotropic, every distance grows by the <b>same factor</b>:</p>
        $$r_{12}(t) = a(t)\\, r_{12}(t_0), \\quad r_{23}(t) = a(t)\\, r_{23}(t_0), \\ \\ldots$$
        <ul><li>$a(t)$ is the <b>scale factor</b></li>
        <li><b>homogeneous</b>: $a$ depends on $t$, not on position</li>
        <li><b>isotropic</b>: $a$ is the same in every direction</li>
        <li>normalised so that $a(t_0) = 1$ today</li></ul></div>
        <div class="step"><p>Differentiate:</p>
        $$v_{12} = \\frac{dr_{12}}{dt} = \\dot a\\, r_{12}(t_0) = \\frac{\\dot a}{a}\\, r_{12}(t)$$
        <div class="key">$$v = H(t)\\, r, \\qquad H(t) \\equiv \\frac{\\dot a}{a}$$</div>
        <p>$H(t)$ is the <b>Hubble parameter</b>. Today $H(t_0) = H_0$, the Hubble constant.</p></div></div>`,
    },
    {
      id: "centre", part: "Why Hubble's law holds", title: "Common confusion: are we at the centre?",
      text: `<p>Grey: galaxies at time $t_1$. Bright: the same galaxies at $t_2$. Yellow: how far each moved, <b>seen from the red galaxy</b>.</p>
        <p><b>Click any galaxy</b> to move there.</p>
        <p class="small">From <b>every</b> galaxy you see the same thing: everything recedes, with speed $\\propto$ distance.</p>`,
      controls: [{ id: "grow", type: "range", label: "a(t₂) / a(t₁)", min: 1, max: 2, step: 0.01, value: 1.3, fmt: (v) => v.toFixed(2) }],
      draw: (s) => {
        s.obs ??= 60;
        return expansionFigure(s);
      },
    },
    {
      id: "hubble-time", part: "Why Hubble's law holds", title: "Hubble time",
      text: `<p>$H_0$ has units of 1/time:</p>
        $$H_0 \\approx 70\\ \\frac{\\text{km}}{\\text{s Mpc}} \\times \\frac{1\\ \\text{Mpc}}{3.09\\times10^{19}\\ \\text{km}}$$
        $$\\approx 2.3\\times10^{-18}\\ \\text{s}^{-1}$$
        $$H_0^{-1} \\approx 4.4\\times10^{17}\\ \\text{s} \\approx 14\\ \\text{Gyr}$$
        <p>If the Universe had always expanded at today's rate, it would be about <b>14 billion years old</b>.
        We will see in Lectures 4–6 why the true age, 13.7 Gyr in the benchmark model, is so close.</p>`,
      controls: [{ id: "H0", type: "range", label: "H₀ (km s⁻¹ Mpc⁻¹)", min: 40, max: 600, step: 1, value: 70 }],
      readout: (s) => [["Hubble time 1/H₀", `${hubbleTime(s.H0).toFixed(2)} Gyr`], ["Hubble distance c/H₀", `${(c_kms / s.H0).toFixed(0)} Mpc`],
        ...(hubbleTime(s.H0) < 4.5 ? [[`<span style="color:var(--hot)">Younger than the Earth (4.5 Gyr)! This was a real problem with Hubble's value.</span>`]] : [])],
      draw: (s) => plot(s, {
        grid: true,
        x: { label: "H₀ (km s⁻¹ Mpc⁻¹) →", domain: [40, 600] },
        y: { label: "↑ Hubble time 1/H₀ (Gyr)", domain: [0, 25] },
        marks: [
          Plot.ruleY([4.5], { stroke: s.C.gold, strokeDasharray: "6 4" }),
          Plot.text([[600, 4.5]], { text: () => "age of the Earth", dy: -10, textAnchor: "end", fill: s.C.gold }),
          Plot.line(d3.range(40, 600.1, 2).map((H) => [H, hubbleTime(H)]), { stroke: s.C.cool, strokeWidth: 2.5 }),
          Plot.dot([[s.H0, hubbleTime(s.H0)]], { r: 7, fill: s.C.hot }),
        ],
      }),
    },
    {
      id: "scale-factor", part: "Why Hubble's law holds", title: "Redshift and the scale factor",
      text: `<p>As space expands, the wavelength of light travelling through it is <b>stretched</b> by the same factor:</p>
        $$\\frac{\\lambda_\\text{obs}}{\\lambda_\\text{em}} = \\frac{a(t_\\text{obs})}{a(t_\\text{em})} = \\frac{1}{a(t_\\text{em})}$$
        <div class="key">$$1 + z = \\frac{1}{a(t_\\text{em})}$$</div>
        <p class="small">We derive this properly from the Robertson–Walker metric next week (Ryden §3.5).</p>`,
      controls: [{ id: "a", type: "range", label: "a(t_em)", min: 0.1, max: 1, step: 0.01, value: 0.5, fmt: (v) => v.toFixed(2) }],
      readout: (s) => [["λ_obs / λ_em = 1/a", (1 / s.a).toFixed(2)], ["z", (1 / s.a - 1).toFixed(2)]],
      draw: (s) => {
        const xs = d3.range(0, 10.001, 0.01);
        return plot(s, {
          marginLeft: s.fs,
          x: { label: "distance (in emitted wavelengths) →", domain: [0, 10] }, y: { axis: null, domain: [-1, 2.3] },
          marks: [
            Plot.line(xs.map((x) => [x, 1.4 + 0.5 * Math.sin(2 * Math.PI * x)]), { stroke: s.C.cool, strokeWidth: 2.5 }),
            Plot.line(xs.map((x) => [x, -0.2 + 0.5 * Math.sin(2 * Math.PI * x * s.a)]), { stroke: s.C.hot, strokeWidth: 2.5 }),
            Plot.text([[0, 2.05]], { text: () => "emitted", textAnchor: "start", fill: s.C.cool }),
            Plot.text([[0, 0.45]], { text: () => "observed today", textAnchor: "start", fill: s.C.hot }),
          ],
        });
      },
    },
    {
      id: "quasars-again", part: "Why Hubble's law holds", title: "Back to the quasars",
      text: `<p>How much smaller was the Universe when the light from each quasar was emitted?</p>
        <table><tr><th>Quasar</th><th>$z$</th><th>$a = 1/(1+z)$</th><th>Universe was</th></tr>
        <tr><td>B</td><td>2.8</td><td><span class="step">0.26</span></td><td><span class="step">3.8× smaller</span></td></tr>
        <tr><td>A</td><td>4.4</td><td><span class="step">0.19</span></td><td><span class="step">5.4× smaller</span></td></tr>
        <tr><td>C</td><td>6.3</td><td><span class="step">0.14</span></td><td><span class="step">7.3× smaller</span></td></tr></table>
        <p class="step small">"Smaller" means that all distances between galaxies were shorter by this factor.</p>`,
    },
    {
      id: "peculiar", part: "Why Hubble's law holds", title: "Peculiar velocities",
      text: `<p>A galaxy's redshift has two parts:</p>
        <ul><li><b>cosmological redshift</b> from the expansion of the Universe</li>
        <li><b>Doppler shift</b> from its own motion through space, its <b>peculiar velocity</b>, caused by the gravity of nearby structures</li></ul>
        $$1 + z_\\text{obs} = (1 + z_\\text{cos})\\left(1 + \\frac{v_\\text{pec}}{c}\\right)
        \\quad\\Rightarrow\\quad z_\\text{obs} \\approx z_\\text{cos} + \\frac{v_\\text{pec}}{c}$$
        <div class="step"><p>Peculiar velocities are typically a few hundred km/s and rarely more than ~1000 km/s.
        At $z \\gtrsim 0.01$ ($cz \\gtrsim 3000$ km/s) the expansion dominates.</p>
        <p class="small">See for yourself: go back to the <a href="#fit">Hubble diagram</a>, select "nearby" and switch off the peculiar-velocity correction.</p></div>`,
    },
    {
      id: "exercises-1", part: "Exercises", title: "Exercises: redshifts (1/2)",
      text: `<ol><li>The hydrogen atom has a prominent line at 6563 Å. At what wavelength do we observe this line in a galaxy at $z = 0.1$?</li>
        <li>Star-forming galaxies have a prominent Lyman-α emission line at 1216 Å. The Earth's atmosphere blocks UV light with wavelengths
        shorter than 3000 Å. What must the redshift of a galaxy be for us to observe its Lyα line with ground-based telescopes?</li>
        <li>A "double blind survey" searched for galaxies emitting in Lyα, Hα (6563 Å), or both, at a certain redshift $z$.
        For Lyα a filter at 3880 Å was used. Which redshift was studied, and which filter was used for Hα?</li></ol>
        <p class="small">Problem 3 is based on a survey led by Matthew Hayes and Göran Östlin at this department: Hayes et al. (2010), <i>Nature</i> 464, 562.</p>`,
    },
    {
      id: "exercises-2", part: "Exercises", title: "Exercises: redshifts (2/2)",
      text: `<ol start="4"><li>Light can be described by its wavelength $\\lambda$ or its frequency $\\nu$, with $\\lambda\\nu = c$.
        Derive the relation between the emitted and observed frequencies of light from an object at redshift $z$.</li>
        <li>Neutral hydrogen emits a line at the radio frequency 1.4 GHz. At $z = 13$, at what frequency do we observe this line?
        What are the intrinsic and observed wavelengths? Would Stockholm be a good place to observe at this frequency?</li></ol>
        <p class="small">Check your answers with the <a href="#spectrum">spectrum widget</a>.</p>`,
    },
    {
      id: "next", part: "Exercises", title: "Before next time",
      text: `<ul><li><b>Homework 1</b> is due <b>Tuesday 10 November</b>, before class, in Canvas.</li>
        <li>Read <b>Ryden chapter 3</b>: curvature and the Robertson–Walker metric.</li>
        <li>Literature project: first topic choice due <b>12 November</b>.</li></ul>`,
    },
  ],
});
