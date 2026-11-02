// Olbers' paradox widget (slide "olbers-try"). Each pixel is one line of sight; in a uniform
// universe the distance to the first star along it is exponentially distributed with mean λ.
// A pixel lights up if that star is closer than the distance D we can see (slider, log scale).
// From D ≥ λ on, the panel names Olbers' paradox.

for (const canvas of document.querySelectorAll(".olbers-sky")) {
  const panel = canvas.parentElement.querySelector(".olbers-panel");
  const slider = panel.querySelector(".olbers-slider");
  const out = panel.querySelector(".olbers-out");
  const paradox = panel.querySelector(".olbers-paradox");

  const N = 240; // lines of sight per side
  canvas.width = canvas.height = N;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(N, N);

  // fixed random sky: distance (in units of λ) to the first star, and a star colour
  const hit = new Float64Array(N * N);
  const tint = new Uint8Array(N * N);
  for (let i = 0; i < hit.length; i++) {
    hit[i] = -Math.log(1 - Math.random());
    tint[i] = Math.floor(Math.random() * 3);
  }
  const colours = [[255, 244, 214], [255, 214, 160], [200, 220, 255]];
  const sky = [5, 8, 18];

  const fmt = (x) => {
    const e = Math.floor(x), m = 10 ** (x - e);
    return e >= -2 && e <= 1 ? (10 ** x).toPrecision(2) : `${m.toFixed(1)} × 10<sup>${e}</sup>`;
  };

  function draw() {
    const x = Number(slider.value), D = 10 ** x;
    let lit = 0;
    for (let i = 0; i < hit.length; i++) {
      const on = hit[i] < D;
      const c = on ? colours[tint[i]] : sky;
      lit += on;
      img.data.set([c[0], c[1], c[2], 255], 4 * i);
    }
    ctx.putImageData(img, 0, 0);
    // the sky is (almost) paved with stars: name the paradox (its space is kept, so nothing moves)
    if (paradox) paradox.style.visibility = D < 1 ? "hidden" : "visible";
    out.innerHTML = `<b>D/λ = ${fmt(x)}</b>, so D ≈ ${fmt(x + 18)} Mpc<br>` +
      `Sky covered by stars: <b>${(100 * (1 - Math.exp(-D))).toPrecision(2)} %</b>` +
      ` (${lit.toLocaleString("en-GB")} of ${(N * N).toLocaleString("en-GB")} lines of sight)`;
  }
  slider.addEventListener("input", draw);
  slider.addEventListener("change", () => slider.blur()); // arrow keys go back to changing slides
  draw();
}
