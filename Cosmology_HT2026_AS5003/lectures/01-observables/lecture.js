// Lecture 1: introduction, course information and five fundamental observations.
import { story, plot, canvas, csv, h } from "../../../assets/story.js";
import { planckMJy, wienPeakGHz, sci, rng, age, aOfT, benchmark, hubbleTime, c_kms, T_cmb, Gyr_s } from "../../_shared/cosmo.js";

const [firas, hubble29] = await Promise.all([csv("public/firas.csv"), csv("public/hubble1929.csv")]);

// ---------- timeline of the hot Big Bang ----------
const aL = (benchmark.Om / benchmark.OL) ** (1 / 3);
const epochs = [
  { t: 5.4e-44, name: "Planck time", text: "Our physics breaks down before this; quantum gravity is needed." },
  { t: 1e-36, name: "Inflation?", text: "Proposed period of exponential expansion (Lecture 13)." },
  { t: 1e-12, name: "Electroweak", text: "Electromagnetic and weak forces separate." },
  { t: 1e-5, name: "Quarks → hadrons", text: "Quarks are bound into protons and neutrons." },
  { t: 1, name: "ν decoupling", text: "Neutrinos stop interacting and stream freely." },
  { t: 180, name: "BBN", text: "First ~3–20 minutes: H, D, He, Li nuclei form (Lecture 12)." },
  { t: age(1 / 3400) * Gyr_s, name: "Matter = radiation", text: "From here on, matter dominates the energy density (Lecture 6)." },
  { t: age(1 / 1091) * Gyr_s, name: "Recombination / CMB", text: "Atoms form and the Universe becomes transparent; the CMB is released (Lectures 10–11)." },
  { t: age(1 / 21) * Gyr_s, name: "First stars", text: "Cosmic dawn: the dark ages end." },
  { t: age(1 / 7) * Gyr_s, name: "Reionization", text: "UV light from galaxies reionizes the hydrogen between galaxies (complete by z ≈ 6)." },
  { t: age(aL) * Gyr_s, name: "Λ dominates", text: "Dark energy starts to dominate; expansion accelerates (Lecture 6)." },
  { t: age(1) * Gyr_s, name: "Today", text: "t₀ ≈ 13.7 Gyr in the benchmark model." },
];
const H0s = 1 / (hubbleTime(benchmark.H0) * Gyr_s);
function timeState(logt) {
  const t = 10 ** logt, tGyr = t / Gyr_s;
  // before a = 1e-10 use the radiation-era solution a = (2 √Ω_r H0 t)^(1/2)
  const a = tGyr < age(1e-10) ? Math.sqrt(2 * Math.sqrt(benchmark.Or) * H0s * t) : aOfT(tGyr);
  const T = T_cmb / a;
  const current = epochs.filter((e) => e.t <= t * 1.0001).at(-1) ?? epochs[0];
  return { t, a, z: 1 / a - 1, T, kT: 8.617333e-5 * T, current };
}
const yr = 3.15576e7;
const fmtTime = (t) => (t < 1e3 * yr ? `${sci(t)} s` : t < 1e6 * yr ? `${sci(t / yr)} yr` : t < 1e9 * yr ? `${sci(t / 1e6 / yr)} Myr` : `${(t / Gyr_s).toFixed(2)} Gyr`);
const fmtE = (e) => (e > 1e9 ? `${sci(e / 1e9)} GeV` : e > 1e6 ? `${sci(e / 1e6)} MeV` : e > 1e3 ? `${sci(e / 1e3)} keV` : `${sci(e)} eV`);

// ---------- Olbers' forest ----------
function forest(n, R, D) {
  const L = 300, r = rng(7), trees = [];
  const N = Math.round(n * (2 * L) ** 2);
  for (let i = 0; i < N; i++) {
    const x = (r.uniform() * 2 - 1) * L, y = (r.uniform() * 2 - 1) * L;
    if (Math.hypot(x, y) > R * 2) trees.push([x, y]);
  }
  const rays = [];
  let blocked = 0;
  for (let k = 0; k < 720; k++) {
    const th = (2 * Math.PI * k) / 720, ux = Math.cos(th), uy = Math.sin(th);
    let d = D;
    for (const [x, y] of trees) {
      const s = x * ux + y * uy;
      if (s <= 0 || s - R > d) continue;
      const b2 = x * x + y * y - s * s;
      if (b2 < R * R) d = Math.min(d, s - Math.sqrt(R * R - b2));
    }
    if (d < D) blocked++;
    rays.push({ ux, uy, d, hit: d < D });
  }
  return { trees, rays, frac: blocked / rays.length, lam: 1 / (2 * R * n) };
}

// ---------- Olbers in the real Universe ----------
const Rsun_Mpc = 6.957e8 / 3.0857e22;
const ctGyr = (c_kms / 3.0857e19) * Gyr_s; // Mpc travelled by light in 1 Gyr
function olbers({ logn, Rstar }) {
  const lam = 1 / (10 ** logn * Math.PI * (Rstar * Rsun_Mpc) ** 2); // Mpc
  return { lam, lamGyr: lam / ctGyr };
}
const pow10 = (d) => (d === 1 ? "1" : `10${String(Math.round(Math.log10(d))).replace(/[-0-9]/g, (c) => "⁻⁰¹²³⁴⁵⁶⁷⁸⁹"["-0123456789".indexOf(c)])}`);
const skyFraction = (t0, lamGyr) => -Math.expm1(-t0 / lamGyr);

// ---------- toy galaxy field for homogeneity ----------
const galaxies = (() => {
  // superclusters on a jittered 50 Mpc grid → clusters → galaxies, plus a smooth background
  const r = rng(42), box = 1000, pts = [];
  const wrap = (x) => ((x % box) + box) % box;
  for (let gx = 25; gx < box; gx += 50) for (let gy = 25; gy < box; gy += 50) {
    const sx = gx + 20 * r.normal(), sy = gy + 20 * r.normal();
    for (let j = 0; j < 4; j++) {
      const cx = sx + 15 * r.normal(), cy = sy + 15 * r.normal();
      for (let k = 0; k < 10; k++) pts.push([wrap(cx + 4 * r.normal()), wrap(cy + 4 * r.normal())]);
    }
  }
  for (let i = 0; i < 4000; i++) pts.push([r.uniform() * box, r.uniform() * box]);
  return pts;
})();
const cellSizes = [10, 20, 25, 40, 50, 100, 125, 200, 250];
const scales = cellSizes.map((L) => {
  const n = Math.round(1000 / L), counts = new Array(n * n).fill(0);
  for (const [x, y] of galaxies) counts[Math.min(n - 1, Math.floor(x / L)) * n + Math.min(n - 1, Math.floor(y / L))]++;
  const mean = d3.mean(counts);
  return { L, rms: d3.deviation(counts) * Math.sqrt((counts.length - 1) / counts.length) / mean, poisson: 1 / Math.sqrt(mean) };
});

const K29 = d3.sum(hubble29, (d) => d.r_Mpc * d.v_kms) / d3.sum(hubble29, (d) => d.r_Mpc ** 2);

// side-by-side figures that stack when the figure is tall and narrow
function pair(s, left, right) {
  const wide = s.W > 1.2 * s.H;
  const a = { ...s, W: wide ? Math.floor(s.W * 0.5) - 8 : s.W, H: wide ? s.H : Math.floor(s.H / 2) - 8 };
  return h("div", { style: `display:flex;flex-direction:${wide ? "row" : "column"};gap:16px` }, left(a), right(a));
}

story({
  kicker: "AS5003 Cosmology · Lecture 1",
  title: "Introduction and the fundamental observations",
  subtitle: "What any model of the Universe has to explain: a dark night sky, a smooth Universe, a glowing background, the first elements and receding galaxies.",
  meta: "Sambit Kumar Giri · Tue 3 November 2026",
  footer: `<a href="../../">All lectures</a> ·
    <kbd>←</kbd> <kbd>→</kbd> move · <kbd>F</kbd> full screen · <kbd>H</kbd> hide text · <kbd>T</kbd> light/dark`,
  // faint scale factor a(t) of the benchmark model, from the Big Bang to 30 Gyr
  cover: (s) => plot(s, {
    margin: 0, x: { axis: null, domain: [0, 30] }, y: { axis: null, domain: [-0.1, 3.4] },
    marks: [
      Plot.line(d3.range(0.02, 30.01, 0.1).map((t) => [t, aOfT(t)]), { stroke: s.C.accent, strokeOpacity: 0.35, strokeWidth: 2 }),
      Plot.dot([[age(1), 1]], { r: 5, fill: s.C.accent, fillOpacity: 0.6 }),
    ],
  }),
  chapters: [
    {
      id: "who", title: "Who am I?",
      text: `<p><b>Sambit Kumar Giri</b></p>
        <ul><li>Email: <a href="mailto:sambit.giri@astro.su.se">sambit.giri@astro.su.se</a>, the best way to reach me; I try to reply within one working day</li>
        <li>Office: C6:3064 (AlbaNova)</li>
        <li>Research: the early Universe, cosmic dawn and reionization, large-scale structure</li></ul>`,
    },
    {
      id: "plan", title: "Today's plan",
      text: `<ol><li>Course information: schedule, examination, how these interactive lectures work</li>
        <li>Introductions</li>
        <li>Five fundamental observations that any cosmological model has to explain</li></ol>`,
    },
    {
      id: "where", part: "Course information", title: "Where to find things",
      text: `<div class="cols">
        <div><h3>Canvas</h3><p><a href="https://canvas.su.se">canvas.su.se</a>, course <i>Cosmology AS5003 46015 HT2026</i></p>
          <ul><li>Schedule</li><li>Homework sets and hand-in</li><li>Literature project instructions</li><li>Grades and announcements</li></ul></div>
        <div><h3>The interactive lectures (new this year)</h3><p><a href="../../">sambit-giri.github.io/teaching</a></p>
          <ul><li>Every lecture is a page like this one: change the parameters yourself</li>
          <li>Move with the arrow keys or Back/Next; each chapter has its own link</li></ul></div></div>`,
    },
    {
      id: "outcomes", part: "Course information", title: "Learning outcomes",
      text: `<p>After the course you should be able to:</p>
        <ul><li><b>describe</b> the theoretical background to modern cosmology, the main outline of the history of the Universe, and current problems in cosmology</li>
        <li class="step"><b>describe and do calculations</b> on the dynamics of the Universe, its energy components, the CMB, nucleosynthesis and thermodynamics in the early Universe, and inflation</li>
        <li class="step"><b>describe and do calculations</b> on observational methods used to determine properties of the Universe</li>
        <li class="step"><b>show in-depth knowledge</b> of modern research results in one area of cosmology, and present it orally and in writing</li></ul>
        <p class="step small">The phrase "do calculations" appears twice: most of the exam is calculations, so practise them every week.</p>`,
    },
    {
      id: "exam", part: "Course information", title: "Examination",
      text: `<table><tr><th>Component</th><th>Weight</th></tr>
        <tr><td>Homework problems</td><td>20 %</td></tr>
        <tr><td>Literature project: written report</td><td>10 %</td></tr>
        <tr><td>Literature project: oral presentation</td><td>5 %</td></tr>
        <tr><td>Written exam, <b>12 January 2027</b> (re-exam 16 February 2027)</td><td>65 %</td></tr></table>
        <p class="key">Each component needs a passing grade (≥ 50 %) to pass the course.</p>
        <p>Grades: A &gt; 90 %, B 80–90 %, C 70–80 %, D 60–70 %, E 50–60 %.</p>`,
    },
    {
      id: "homework", part: "Course information", title: "Homework",
      text: `<ul><li>Six problem sets, due <b>before class on Tuesdays</b> in Canvas. Homework 1 is due <b>Tuesday 10 November</b>.</li>
        <li><b>Late homework is not accepted</b>, because we discuss the solutions in class. Only your <b>best five</b> sets count, so you can miss one without penalty.</li>
        <li>Discussing problems with classmates is encouraged. The write-up must be your own.</li>
        <li>Generative AI tools may <b>not</b> be used to produce or write solutions.</li>
        <li>Handwritten scans are fine if they are legible. Python helps on some problems.</li></ul>`,
    },
    {
      id: "project", part: "Course information", title: "Literature project",
      text: `<ul><li>Pick a topic in modern cosmology, read research papers, write a short report and give a short talk.</li>
        <li>Instructions and topic suggestions are on Canvas.</li></ul>
        <table><tr><th>Milestone</th><th>Date</th></tr>
        <tr><td>First topic choice</td><td>Thu 12 November</td></tr>
        <tr><td>Final topic and papers</td><td>Tue 24 November</td></tr>
        <tr><td>Written report</td><td>Tue 15 December</td></tr>
        <tr><td>Presentations</td><td>Thu 17 and Fri 18 December</td></tr></table>
        <p>Late reports lose 20 %. Start reading early, since research papers take longer than you expect.</p>`,
    },
    {
      id: "book", part: "Course information", title: "Course book",
      text: `<div class="cols"><div>
        <p><b>Barbara Ryden, <i>Introduction to Cosmology</i>, 2nd edition</b> (Cambridge University Press, 2017)</p>
        <p>We cover chapters 1–10. Structure formation (chapters 11–12) is not part of the course.</p>
        <p>These lectures use <b>Ryden's notation and Ryden's benchmark model</b>. See the <a href="../../notation.html">notation page</a>.</p></div>
        <div class="small"><p><b>Further reading</b></p><ul>
        <li>Liddle, <i>An Introduction to Modern Cosmology</i></li>
        <li>Bergström &amp; Goobar, <i>Cosmology and Particle Astrophysics</i></li>
        <li>Peebles, <i>Principles of Physical Cosmology</i></li>
        <li>Weinberg, <i>The First Three Minutes</i> (popular)</li>
        <li>Mack, <i>The End of Everything</i> (popular)</li></ul></div></div>`,
    },
    {
      id: "advice", part: "Course information", title: "Advice from earlier students",
      text: `<p class="quote">Study from the book, don't stay only on lectures and applying formulas. It's more fun this way!</p>
        <p class="quote">Ask questions during the lectures. And well, go to the lectures.</p>
        <p class="quote">Ask a lot of questions and enjoy.</p>
        <p class="small">And one piece of feedback we act on this year: the different <b>distance definitions</b> were confusing.
        This year they all follow Ryden's names, and we will explore them interactively.</p>`,
    },
    {
      id: "you", part: "Course information", title: "Who are you?",
      text: `<ul><li>Your name and background</li><li>Why cosmology?</li><li>What do you expect from the course?</li></ul>`,
    },
    {
      id: "history", part: "What we know", title: "A short history",
      text: `<table>
        <tr><td>Antiquity</td><td>Myths; Aristotle and Ptolemy: Earth at the centre of a finite cosmos</td></tr>
        <tr><td>1543</td><td>Copernicus: the Earth is not special</td></tr>
        <tr><td>1915–17</td><td>Einstein: general relativity, first relativistic cosmological model</td></tr>
        <tr><td><b>1920</b></td><td><b>Shapley–Curtis "Great Debate"</b>: are the spiral nebulae inside the Milky Way?</td></tr>
        <tr><td>1922–27</td><td>Friedmann and Lemaître: expanding-universe solutions</td></tr>
        <tr><td>1929</td><td>Hubble: velocity $\\propto$ distance</td></tr>
        <tr><td>1965</td><td>Penzias &amp; Wilson: the cosmic microwave background</td></tr>
        <tr><td>1992 → today</td><td>COBE, WMAP, Planck; accelerating expansion (1998); precision cosmology</td></tr></table>
        <p class="small">The 1920 debate was about the <i>scale</i> of the Universe. Curtis was right: the nebulae are galaxies like our own.
        We return to how this was settled in Lecture 2.</p>`,
    },
    {
      id: "timeline", part: "What we know", title: "Today's picture: the hot Big Bang model",
      text: `<p>Slide through cosmic time. The scale factor $a$ tells how much smaller the Universe was, and the temperature
        of the radiation rises as $T = T_0/a$.</p>
        <p class="small">Benchmark ΛCDM (H₀ = 68 km s⁻¹ Mpc⁻¹, Ω<sub>m</sub> = 0.31, Ω<sub>Λ</sub> = 0.69, Ω<sub>r</sub> = 9×10⁻⁵).
        Before ~1 s this is only indicative, because the number of relativistic species changes.</p>`,
      controls: [{ id: "logt", type: "range", label: "log₁₀(t / s)", min: -43, max: Math.log10(age(1) * Gyr_s), step: 0.01,
        value: Math.log10(age(1 / 1091) * Gyr_s), fmt: (v) => v.toFixed(2) }],
      readout: (s) => {
        const ts = timeState(s.logt);
        return [["t", fmtTime(ts.t)], ["a", sci(ts.a)], ["z", sci(ts.z)], ["T", `${sci(ts.T)} K`], ["kT", fmtE(ts.kT)],
          [`<b>${ts.current.name}</b>: ${ts.current.text}`]];
      },
      draw: (s) => {
        const ts = timeState(s.logt);
        const rows = epochs.map((e, i) => ({ ...e, x: Math.log10(e.t), row: i, now: e === ts.current }));
        const col = (d) => (d.now ? s.C.hot : s.C.ink);
        return plot(s, {
          marginLeft: s.fs, marginRight: s.fs,
          x: { domain: [-44, 18], label: "log₁₀ (cosmic time t / s) →", ticks: d3.range(-40, 18, 5), grid: true },
          y: { axis: null, domain: [-0.5, epochs.length - 0.5], reverse: true },
          marks: [
            Plot.ruleX([Math.log10(ts.t)], { stroke: s.C.hot, strokeWidth: 3 }),
            Plot.dot(rows, { x: "x", y: "row", r: 5, fill: col }),
            // one row per epoch; labels point inward so they stay on the plot
            ...[[(d) => d.x <= 0, "start", 10], [(d) => d.x > 0, "end", -10]].map(([keep, textAnchor, dx]) =>
              Plot.text(rows.filter(keep), { x: "x", y: "row", text: "name", textAnchor, dx, fill: col, fontWeight: (d) => (d.now ? "bold" : "normal") })),
          ],
        });
      },
    },
    {
      id: "olbers", part: "Observations", title: "Observation 1: the night sky is dark",
      text: `<p>Imagine a Universe that is <b>infinite, uniform, eternal and static</b>, filled with stars of radius $R_\\star$ and number density $n_\\star$.</p>
        <div class="step"><p>Look along any line of sight. A cylinder of radius $R_\\star$ and length $\\lambda$ contains on average one star when</p>
        $$n_\\star\\,\\pi R_\\star^2\\,\\lambda = 1 \\quad\\Rightarrow\\quad \\lambda = \\frac{1}{n_\\star \\pi R_\\star^2}.$$
        <p>So <b>every line of sight eventually ends on a star</b>, on average at a distance $\\lambda$.</p></div>
        <p class="step">It is like standing in a large forest: whichever way you look, you see a tree trunk.</p>`,
    },
    {
      id: "brightness", part: "Observations", title: "Every line of sight ends on a star",
      text: `<p>The surface brightness of a star, its flux per solid angle, is</p>
        $$f_\\star = \\frac{L_\\star}{4\\pi r^2}, \\qquad \\Omega_\\star = \\frac{\\pi R_\\star^2}{r^2}, \\qquad
        \\Sigma_\\star = \\frac{f_\\star}{\\Omega_\\star} = \\frac{L_\\star}{4\\pi^2 R_\\star^2}$$
        <p class="key">$\\Sigma_\\star$ does not depend on the distance $r$.</p>
        <div class="step"><p>Every line of sight ends on a star, and every star has the same surface brightness.
        So the whole sky should be <b>as bright as the surface of the Sun</b>.</p>
        <p>This is <b>Olbers' paradox</b>. It isn't. So which assumption is wrong?</p></div>`,
    },
    {
      id: "forest", part: "Observations", title: "The forest version: try it",
      text: `<p>You stand in the middle of a forest. Yellow sight lines end on a trunk; grey ones reach the red circle,
        the farthest you can see.</p>
        <p>Make the horizon large and almost every sight line is blocked.</p>
        <p class="small">A 2D forest has $\\lambda = 1/(2rn)$; in 3D it is $\\lambda = 1/(n\\pi R^2)$.</p>`,
      controls: [
        { id: "n", type: "range", label: "trees per m²", min: 0.005, max: 0.1, step: 0.001, value: 0.04, fmt: (v) => v.toFixed(3) },
        { id: "R", type: "range", label: "trunk radius (m)", min: 0.05, max: 0.5, step: 0.01, value: 0.25, fmt: (v) => v.toFixed(2) },
        { id: "D", type: "range", label: "how far you can see (m)", min: 5, max: 300, step: 1, value: 25 },
      ],
      readout: (s) => {
        const f = forest(s.n, s.R, s.D);
        s.forest = f;
        return [["mean free path λ = 1/(2rn)", `${f.lam.toFixed(1)} m`], ["sight lines that hit a tree", `${(100 * f.frac).toFixed(1)} %`],
          ["expected 1 − e<sup>−D/λ</sup>", `${(100 * -Math.expm1(-s.D / f.lam)).toFixed(1)} %`]];
      },
      draw: (s) => {
        const f = s.forest, W = Math.min(s.W, s.H), sc = W / 2 / s.D;
        const { cv, g } = canvas(s, W, W);
        cv.style.margin = "0 auto";
        g.translate(W / 2, W / 2);
        g.lineWidth = 1;
        for (const ray of f.rays) {
          g.strokeStyle = ray.hit ? s.C.gold : s.C.grid;
          g.globalAlpha = ray.hit ? 0.6 : 1;
          g.beginPath(); g.moveTo(0, 0); g.lineTo(ray.ux * ray.d * sc, ray.uy * ray.d * sc); g.stroke();
        }
        g.globalAlpha = 1;
        g.fillStyle = s.C.good;
        for (const [x, y] of f.trees) {
          if (Math.abs(x) > s.D || Math.abs(y) > s.D) continue;
          g.beginPath(); g.arc(x * sc, y * sc, Math.max(s.R * sc, 1.5), 0, 2 * Math.PI); g.fill();
        }
        g.strokeStyle = s.C.hot; g.lineWidth = 1.5; g.setLineDash([6, 6]);
        g.beginPath(); g.arc(0, 0, s.D * sc - 1, 0, 2 * Math.PI); g.stroke();
        g.fillStyle = s.C.ink; g.beginPath(); g.arc(0, 0, 4, 0, 2 * Math.PI); g.fill();
        return cv;
      },
    },
    {
      id: "assumption", part: "Observations", title: "Which assumption fails?",
      text: `<p><b>Infinite? · Uniform? · Eternal? · Static?</b></p>
        <div class="step"><p>The key one: the Universe has a <b>finite age</b> $t_0$. We can only see stars within a distance $\\sim c\\,t_0$.
        Light from farther away has not reached us yet.</p>
        <p>Expansion also helps. Light from distant stars is <b>redshifted</b> and dimmed.</p></div>
        <p class="step small">The curve shows the fraction of the sky covered by stars within $c\\,t$, for a Universe of age $t$:
        $1 - e^{-c t/\\lambda}$.</p>`,
      controls: [
        { id: "logn", type: "range", label: "log₁₀ n★ (Mpc⁻³)", min: 6, max: 12, step: 0.1, value: 9, fmt: (v) => v.toFixed(1) },
        { id: "Rstar", type: "range", label: "R★ (R☉)", min: 0.1, max: 10, step: 0.1, value: 1, fmt: (v) => v.toFixed(1) },
        { id: "t0", type: "range", label: "age t₀ (Gyr)", min: 1, max: 1000, step: 0.1, value: 13.7, fmt: (v) => v.toFixed(1) },
      ],
      readout: (s) => {
        const o = olbers(s);
        return [["mean free path λ", `${sci(o.lam)} Mpc`], ["light travel time over λ", `${sci(o.lamGyr)} Gyr`],
          ["sky covered within c t₀", sci(skyFraction(s.t0, o.lamGyr))],
          [`The sky would only be bright if the Universe were <b>${sci(o.lamGyr / s.t0)}×</b> older.`]];
      },
      draw: (s) => {
        const o = olbers(s);
        const ts = d3.range(-1, 26.01, 0.05).map((e) => 10 ** e);
        return plot(s, {
          x: { type: "log", label: "age of the Universe t (Gyr) →", domain: [0.1, 1e26], ticks: [1e0, 1e5, 1e10, 1e15, 1e20, 1e25], tickFormat: pow10, grid: true },
          y: { type: "log", label: "↑ fraction of sky covered by stars", domain: [1e-30, 2], ticks: [1e-30, 1e-20, 1e-10, 1], tickFormat: pow10, grid: true },
          marks: [
            Plot.ruleY([1], { stroke: s.C.soft, strokeDasharray: "4 4" }),
            Plot.line(ts.map((t) => [t, Math.max(1e-30, skyFraction(t, o.lamGyr))]), { stroke: s.C.cool, strokeWidth: 2.5 }),
            Plot.ruleX([s.t0], { stroke: s.C.hot, strokeWidth: 2 }),
            Plot.dot([[s.t0, Math.max(1e-30, skyFraction(s.t0, o.lamGyr))]], { r: 7, fill: s.C.hot }),
            Plot.text([[s.t0, 1e-27]], { text: () => "our Universe", dx: 8, textAnchor: "start", fill: s.C.hot }),
            Plot.text([[o.lamGyr, 1]], { text: () => "bright sky", dy: -10, textAnchor: "middle", fill: s.C.soft }),
          ],
        });
      },
    },
    {
      id: "homogeneity", part: "Observations", title: "Observation 2: homogeneity and isotropy",
      text: `<p>On large scales (≳ 100 Mpc) the Universe looks the <b>same everywhere</b> (homogeneous) and <b>in every direction</b> (isotropic).</p>
        <p>Count galaxies in boxes of size $L$. Small boxes show clusters and voids; large boxes all contain about the same number.</p>
        <p class="small"><i>Toy model, not survey data.</i></p>`,
      controls: [{ id: "cell", type: "select", label: "cell size L (Mpc)", options: cellSizes, value: 25 }],
      readout: (s) => {
        const c = scales.find((d) => d.L === s.cell);
        return [["rms fluctuation δN/N", c.rms.toFixed(3)], ["Poisson noise alone", c.poisson.toFixed(3)]];
      },
      draw: (s) => pair(s,
        (a) => plot(a, {
          width: Math.min(a.W, a.H), height: Math.min(a.W, a.H), inset: 0,
          x: { domain: [0, 1000], label: "x (Mpc)" }, y: { domain: [0, 1000], label: "y (Mpc)" },
          marks: [
            Plot.dot(galaxies, { x: (d) => d[0], y: (d) => d[1], r: 0.8, fill: s.C.cool, fillOpacity: 0.6 }),
            Plot.ruleX(d3.range(0, 1001, s.cell), { stroke: s.C.hot, strokeOpacity: 0.4 }),
            Plot.ruleY(d3.range(0, 1001, s.cell), { stroke: s.C.hot, strokeOpacity: 0.4 }),
          ],
        }),
        (a) => plot(a, {
          grid: true,
          x: { type: "log", label: "cell size L (Mpc) →", ticks: [10, 20, 50, 100, 200], tickFormat: "~s" },
          y: { type: "log", label: "↑ rms fluctuation δN/N", ticks: [0.03, 0.1, 0.3, 1], tickFormat: "~g" },
          marks: [
            Plot.line(scales, { x: "L", y: "rms", stroke: s.C.cool, strokeWidth: 2.5 }),
            Plot.line(scales, { x: "L", y: "poisson", stroke: s.C.soft, strokeDasharray: "4 4" }),
            Plot.dot(scales.filter((d) => d.L === s.cell), { x: "L", y: "rms", r: 7, fill: s.C.hot }),
            Plot.text([scales.at(-1)], { x: "L", y: "poisson", text: () => "Poisson noise", dy: -12, textAnchor: "end", fill: s.C.soft }),
          ],
        })),
    },
    {
      id: "copernican", part: "Observations", title: "Isotropy + Copernican principle ⇒ homogeneity",
      text: `<ul><li>We <b>observe</b> isotropy around us: galaxy counts, and especially the CMB, which is isotropic to 1 part in 10⁵.</li>
        <li class="step">We cannot travel to check other places. We <b>assume</b> we are not at a special location: the <b>Copernican principle</b>.</li>
        <li class="step">Isotropic about <i>every</i> point ⇒ homogeneous.</li></ul>
        <p class="key step"><b>Cosmological principle:</b> on large scales the Universe is homogeneous and isotropic.</p>
        <p class="step">This one assumption simplifies general relativity enormously (Lecture 3: the Robertson–Walker metric).</p>`,
    },
    {
      id: "cmb", part: "Observations", title: "Observation 3: the cosmic microwave background",
      text: `<p>Discovered by <b>Penzias &amp; Wilson (1965)</b>, Nobel Prize 1978. Its spectrum, measured by COBE/FIRAS, is a near-perfect <b>blackbody</b>.</p>
        <p>Find the temperature that fits. The error bars are about 1000× smaller than the dots.</p>
        <p class="step">The best fit is <b>T₀ = 2.7255 K</b> (Fixsen 2009). A blackbody means the Universe was once
        <b>hot, dense and in thermal equilibrium</b>. More in Lecture 10.</p>`,
      note: "Data: COBE/FIRAS, Fixsen et al. (1996), via NASA LAMBDA.",
      controls: [{ id: "T", type: "range", label: "model temperature T (K)", min: 2.0, max: 3.5, step: 0.0005, value: 2.6, fmt: (v) => `${v.toFixed(4)} K` }],
      readout: (s) => {
        const chi2 = d3.sum(firas, (d) => (((d.I_MJy_sr - planckMJy(d.nu_GHz, s.T)) * 1000) / d.sigma_kJy_sr) ** 2) / (firas.length - 1);
        return [["χ² per data point", sci(chi2, 3)], ["peak frequency", `${wienPeakGHz(s.T).toFixed(0)} GHz`],
          ["peak wavelength (λ)", `${(2.8978 / s.T).toFixed(2)} mm`], ["photon density", `${(410.7 * (s.T / T_cmb) ** 3).toFixed(0)} cm⁻³`]];
      },
      draw: (s) => plot(s, {
        grid: true,
        x: { label: "frequency ν (GHz) →", domain: [0, 700] },
        y: { label: "↑ intensity I_ν (MJy/sr)", domain: [0, 450] },
        marks: [
          Plot.line(d3.range(5, 700, 3).map((nu) => [nu, planckMJy(nu, s.T)]), { stroke: s.C.hot, strokeWidth: 3 }),
          Plot.dot(firas, { x: "nu_GHz", y: "I_MJy_sr", r: 4, fill: s.C.cool }),
        ],
      }),
    },
    {
      id: "elements", part: "Observations", title: "Observation 4: abundances of light elements",
      text: `<p>The oldest stars and the most pristine gas contain almost no heavy elements. Their composition by mass is about:</p>
        <table><tr><th></th><th>Observed (primordial)</th></tr>
        <tr><td>Hydrogen</td><td>≈ 75 %</td></tr><tr><td>Helium-4</td><td>≈ 24 %</td></tr>
        <tr><td>Deuterium</td><td>D/H ≈ 2.5 × 10⁻⁵</td></tr><tr><td>Lithium-7</td><td>⁷Li/H ≈ 1.6 × 10⁻¹⁰</td></tr></table>
        <p>Stars cannot have made this much helium, and they <i>destroy</i> deuterium. The amounts match <b>Big Bang nucleosynthesis</b>
        in the first few minutes (Lecture 12), apart from a puzzling factor of ~3 for lithium.</p>`,
    },
    {
      id: "hubble", part: "Observations", title: "Observation 5: galaxies recede, v ∝ d",
      text: `<p>Hubble's 1929 data for 24 nebulae (PNAS 15, 168). Hover over a point to see which galaxy it is.</p>
        <p>Least-squares slope through the origin: <b>${K29.toFixed(0)} km s⁻¹ Mpc⁻¹</b>.</p>
        <p class="small">Hubble himself, after correcting for the Sun's motion, found 465–513 km s⁻¹ Mpc⁻¹.</p>
        <p class="step">Today's value is ≈ 70 km s⁻¹ Mpc⁻¹. <b>Why was Hubble's about 7× too large?</b> That is next lecture.</p>`,
      note: "Data: Hubble (1929), PNAS 15, 168, Table 1.",
      controls: [{ id: "fit", type: "toggle", label: "show the best-fit line", value: true }],
      draw: (s) => plot(s, {
        grid: true,
        x: { label: "distance (Mpc) →", domain: [0, 2.2] },
        y: { label: "↑ velocity (km/s)" },
        marks: [
          Plot.ruleY([0], { stroke: s.C.soft }),
          s.fit ? Plot.line([[0, 0], [2.2, 2.2 * K29]], { stroke: s.C.hot, strokeWidth: 2.5 }) : null,
          Plot.dot(hubble29, { x: "r_Mpc", y: "v_kms", r: 6, fill: s.C.cool, tip: true, title: (d) => `${d.name}\n${d.r_Mpc} Mpc, ${d.v_kms} km/s` }),
        ],
      }),
    },
    {
      id: "summary", part: "Summary", title: "All five fit the hot Big Bang model",
      text: `<table><tr><th>Observation</th><th>Explanation</th></tr>
        <tr><td>Dark night sky</td><td>Finite age, expansion</td></tr>
        <tr><td>Homogeneous and isotropic</td><td>Cosmological principle → Robertson–Walker metric</td></tr>
        <tr><td>CMB blackbody</td><td>Hot, dense, thermal early phase</td></tr>
        <tr><td>Light elements</td><td>Nucleosynthesis in the first minutes</td></tr>
        <tr><td>$v \\propto d$</td><td>Expanding space</td></tr></table>
        <p>The rest of the course turns this picture into <b>calculations</b>.</p>`,
    },
    {
      id: "next", part: "Summary", title: "Before next time",
      text: `<ul><li>Log in to <b>Canvas</b> and find Homework 1 (due <b>Tue 10 Nov</b>, before class).</li>
        <li>Get the book. Read <b>Ryden chapters 1 and 2</b>.</li>
        <li>Read the literature project instructions. First topic choice is due <b>12 Nov</b>.</li></ul>`,
    },
  ],
});
