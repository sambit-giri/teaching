// Homogeneity in real data (slide "recap-2dfgrs"). The map shows the two 2dFGRS strips (10° and 15°
// thick) projected onto a plane, ~190 000 galaxies at their comoving distances (made by
// make_2dfgrs_slices.py).
// Circles are centred at the chosen redshift only, so every circle sees galaxies down to the same
// brightness; the panel shows how much the galaxy counts in them differ as they grow.

const DMAX = 1036;                                    // comoving distance of z = 0.25 (Mpc)
const HALF = { ngp: 37.5, sgp: 43.75 };               // half opening angle of each strip (degrees)
// comoving distance (Mpc) at z = 0, 0.025, ..., 0.25 (Ryden's benchmark model); the lookback times on the
// map (0.7, 1.3, 1.9, 2.5 Gyr at z = 0.05 ... 0.2) are from the same model
const DC = [0, 110, 218, 325, 430, 535, 638, 739, 840, 938, 1036];
const dist = (z) => { const i = Math.min(Math.floor(z / 0.025), 9), f = z / 0.025 - i; return DC[i] + f * (DC[i + 1] - DC[i]); };

for (const map of document.querySelectorAll("canvas.survey-map")) {
  const panel = map.closest("section").querySelector(".cluster-panel");
  const zSlider = panel.querySelector(".survey-z");
  const dSlider = panel.querySelector(".survey-d");
  const out = panel.querySelector(".survey-out");
  const shuffle = panel.querySelector(".survey-shuffle");
  const W = 620, H = Math.round(W * Math.sin(HALF.sgp * Math.PI / 180) * 1.04); // canvas size in pixels
  map.width = W; map.height = H;
  const ctx = map.getContext("2d");
  const s = W / (2 * DMAX * 1.02);                    // pixels per Mpc
  const px = (x) => W / 2 + x * s, py = (y) => H / 2 - y * s;

  // 12 circles per strip; u in [-1, 1] places each across its strip, scaled so it stays inside
  const place = () => ["ngp", "sgp"].flatMap((k) => Array.from({ length: 12 }, () => ({ k, u: 2 * Math.random() - 1 })));
  let centres = place(), gx = new Int16Array(0), gy = gx;
  const dots = document.createElement("canvas");      // the galaxies, drawn once
  dots.width = W; dots.height = H;

  function draw() {
    const z = Number(zSlider.value), D = dist(z);
    const d = 10 ** Number(dSlider.value), rad = d / 2;
    ctx.drawImage(dots, 0, 0);

    // the chosen redshift: an arc across each strip
    ctx.strokeStyle = "rgba(250, 204, 21, 0.7)";
    ctx.setLineDash([6, 5]); ctx.lineWidth = 1.5;
    for (const [k, side] of [["ngp", -1], ["sgp", 1]]) {
      const h = HALF[k] * Math.PI / 180, mid = side < 0 ? Math.PI : 0;
      ctx.beginPath(); ctx.arc(W / 2, H / 2, D * s, mid - h, mid + h); ctx.stroke();
    }
    ctx.setLineDash([]);

    // circles fit if they stay inside the survey (radially and across the strip)
    const fits = rad < D && D + rad < DMAX;
    let counts = [];
    if (fits) {
      counts = centres.flatMap(({ k, u }) => {
        const room = HALF[k] * Math.PI / 180 - Math.asin(rad / D);
        if (room <= 0) return [];
        const a = u * room, side = k === "ngp" ? -1 : 1;
        const x = side * D * Math.cos(a), y = D * Math.sin(a);
        let n = 0;
        for (let i = 0; i < gx.length; i++) n += (gx[i] - x) ** 2 + (gy[i] - y) ** 2 < rad * rad;
        return [{ x, y, n }];
      });
    }
    if (!gx.length) { out.innerHTML = "Loading the survey…"; return; }
    if (counts.length < 2) {
      out.innerHTML = `<b>z = ${z.toFixed(3)}</b> (≈ ${Math.round(D)} Mpc), diameter ${Math.round(d)} Mpc<br>` +
        `Circles this big do not fit in the survey at this redshift.`;
      return;
    }
    const mean = counts.reduce((a, c) => a + c.n, 0) / counts.length;
    const sd = Math.sqrt(counts.reduce((a, c) => a + (c.n - mean) ** 2, 0) / counts.length);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(251, 146, 60, 0.95)";
    for (const c of counts) {
      ctx.beginPath();
      ctx.arc(px(c.x), py(c.y), Math.max(rad * s, 1.5), 0, 2 * Math.PI);
      ctx.stroke();
    }
    const lo = Math.min(...counts.map((c) => c.n)), hi = Math.max(...counts.map((c) => c.n));
    const pct = 100 * sd / Math.max(mean, 1e-9);
    out.innerHTML = `<b>z = ${z.toFixed(3)}</b> (≈ ${Math.round(D)} Mpc), <b>diameter ${Math.round(d)} Mpc</b><br>` +
      `Galaxies per circle: ${lo}–${hi} (mean ${mean.toFixed(mean < 10 ? 1 : 0)})<br>` +
      `Circles differ by <b>±${Math.round(pct)} %</b>` +
      (pct < 10 ? ` <span class="cluster-ok">✓ below 10%: homogeneous</span>` : "") +
      `<br><span class="cluster-key">From counting alone (√N): ±${Math.round(100 / Math.sqrt(Math.max(mean, 1)))} %</span>`;
  }

  for (const el of [zSlider, dSlider]) {
    el.addEventListener("input", draw);
    el.addEventListener("change", () => el.blur()); // arrow keys go back to changing slides
  }
  shuffle?.addEventListener("click", () => { centres = place(); draw(); shuffle.blur(); });
  draw();
  fetch(map.dataset.src).then((r) => r.arrayBuffer()).then((buf) => {
    const xy = new Int16Array(buf);
    gx = new Int16Array(xy.length / 2); gy = new Int16Array(xy.length / 2);
    for (let i = 0; i < gx.length; i++) { gx[i] = xy[2 * i]; gy[i] = xy[2 * i + 1]; }
    const d = dots.getContext("2d");
    d.fillStyle = "#05080f";
    d.fillRect(0, 0, W, H);
    d.fillStyle = "rgba(147, 197, 253, 0.3)";
    for (let i = 0; i < gx.length; i++) d.fillRect(px(gx[i]), py(gy[i]), 1, 1);
    // redshift and lookback time, as on the 2dF map in Lecture 1: arcs across both strips, labels along
    // the upper edge of the left strip (redshift) and of the right strip (billion years ago)
    d.strokeStyle = "rgba(226, 232, 240, 0.25)"; d.lineWidth = 1;
    d.fillStyle = "rgba(226, 232, 240, 0.85)"; d.font = "12px system-ui, sans-serif"; d.textAlign = "center";
    for (const [z, t] of [[0.05, 0.7], [0.1, 1.3], [0.15, 1.9], [0.2, 2.5]]) {
      const D = dist(z);
      for (const [k, side] of [["ngp", -1], ["sgp", 1]]) {
        const h = HALF[k] * Math.PI / 180, mid = side < 0 ? Math.PI : 0;
        d.beginPath(); d.arc(W / 2, H / 2, D * s, mid - h, mid + h); d.stroke();
      }
      const hl = HALF.ngp * Math.PI / 180, hr = HALF.sgp * Math.PI / 180;
      d.fillText(`z = ${z}`, W / 2 - (D * s) * Math.cos(hl), H / 2 - (D * s) * Math.sin(hl) - 6);
      d.fillText(`${t} Gyr`, W / 2 + (D * s) * Math.cos(hr), H / 2 - (D * s) * Math.sin(hr) - 6);
    }
    draw();
  });
}
