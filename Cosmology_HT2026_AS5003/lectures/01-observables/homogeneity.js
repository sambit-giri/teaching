// Isotropy and homogeneity widgets.
// 1. canvas.pattern[data-kind]: stripes (homogeneous, not isotropic), bullseye (isotropic about
//    the centre, not homogeneous) and random dots (both), after Ryden Fig. 2.3.
// 2. canvas.cluster-map: a toy 2D map of clustered galaxies; the slider sets the diameter of 40
//    circles placed at random ("Shuffle circles" places them anew), and the panel shows how much
//    the galaxy counts in them differ.

// small seeded random generator, so the map is the same on every load
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

for (const c of document.querySelectorAll("canvas.pattern")) {
  const n = 300, ctx = c.getContext("2d");
  c.width = c.height = n;
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, n, n);
  ctx.fillStyle = ctx.strokeStyle = "#0f172a";
  if (c.dataset.kind === "stripes") {
    for (let x = 0; x < n; x += 24) ctx.fillRect(x, 0, 12, n);
  } else if (c.dataset.kind === "bullseye") {
    ctx.lineWidth = 9;
    for (let r = 14; r < n; r += 26) { ctx.beginPath(); ctx.arc(n / 2, n / 2, r, 0, 2 * Math.PI); ctx.stroke(); }
  } else {
    const r = rng(7);
    for (let i = 0; i < 900; i++) { ctx.beginPath(); ctx.arc(r() * n, r() * n, 3, 0, 2 * Math.PI); ctx.fill(); }
  }
}

for (const map of document.querySelectorAll("canvas.cluster-map")) {
  const panel = map.parentElement.querySelector(".cluster-panel");
  const slider = panel.querySelector(".cluster-slider");
  const out = panel.querySelector(".cluster-out");
  const shuffle = panel.querySelector(".cluster-shuffle");
  const L = 1000, px = 500; // box size in Mpc, canvas size in pixels
  map.width = map.height = px;
  const ctx = map.getContext("2d");

  // galaxies: groups of 5 (σ = 2 Mpc), 3 groups per supercluster (σ = 20 Mpc), plus 25% scattered
  // in the field; beyond ~100 Mpc the positions are uncorrelated. Tuned so that circles differ by
  // about ±100% at 10 Mpc, ±16% at 100 Mpc and ±8% at 200 Mpc.
  const r = rng(2026), gx = [], gy = [];
  const add = (x, y) => { gx.push(((x % L) + L) % L); gy.push(((y % L) + L) % L); };
  for (let s = 0; s < 2000; s++) {
    const sx = r() * L, sy = r() * L;
    for (let k = 0; k < 3; k++) {
      const cx = sx + 20 * gauss(r), cy = sy + 20 * gauss(r);
      for (let g = 0; g < 5; g++) add(cx + 2 * gauss(r), cy + 2 * gauss(r));
    }
  }
  const nField = Math.round(gx.length / 4);
  for (let g = 0; g < nField; g++) add(r() * L, r() * L);

  // fixed random centres in units of the box; scaled so every circle stays inside the map
  let centres = Array.from({ length: 40 }, () => [r(), r()]);

  function draw() {
    const d = 10 ** Number(slider.value), rad = d / 2;
    ctx.fillStyle = "#05080f";
    ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = "rgba(226, 232, 240, 0.6)";
    for (let i = 0; i < gx.length; i++) ctx.fillRect(gx[i] * px / L, gy[i] * px / L, 1.2, 1.2);

    const counts = centres.map(([u, v]) => {
      const x = rad + u * (L - 2 * rad), y = rad + v * (L - 2 * rad);
      let n = 0;
      for (let i = 0; i < gx.length; i++) n += (gx[i] - x) ** 2 + (gy[i] - y) ** 2 < rad * rad;
      return { x, y, n };
    });
    const mean = counts.reduce((a, c) => a + c.n, 0) / counts.length;
    const sd = Math.sqrt(counts.reduce((a, c) => a + (c.n - mean) ** 2, 0) / counts.length);
    ctx.lineWidth = 2;
    for (const c of counts) {
      ctx.strokeStyle = c.n > mean ? "rgba(251, 146, 60, 0.9)" : "rgba(96, 165, 250, 0.9)";
      ctx.beginPath();
      ctx.arc(c.x * px / L, c.y * px / L, Math.max(rad * px / L, 1.5), 0, 2 * Math.PI);
      ctx.stroke();
    }
    const lo = Math.min(...counts.map((c) => c.n)), hi = Math.max(...counts.map((c) => c.n));
    out.innerHTML = `<b>Diameter ${d < 20 ? d.toFixed(1) : Math.round(d)} Mpc</b><br>` +
      `Galaxies per circle: ${lo}–${hi} (mean ${mean.toFixed(mean < 10 ? 1 : 0)})<br>` +
      `Circles differ by <b>±${Math.round(100 * sd / Math.max(mean, 1e-9))} %</b>` +
      (sd / mean < 0.1 ? ` <span class="cluster-ok">✓ below 10%: homogeneous</span>` : "") +
      `<br><span class="cluster-key"><i style="color:#fb923c">○</i> denser than average · <i style="color:#60a5fa">○</i> emptier</span>`;
  }
  slider.addEventListener("input", draw);
  shuffle?.addEventListener("click", () => {
    centres = centres.map(() => [Math.random(), Math.random()]);
    draw();
    shuffle.blur(); // arrow keys go back to changing slides
  });
  slider.addEventListener("change", () => slider.blur()); // arrow keys go back to changing slides
  draw();
}
