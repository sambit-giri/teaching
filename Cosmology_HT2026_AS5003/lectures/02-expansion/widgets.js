// Lecture 2 widgets. Each slide with a widget has a figure box <div class="w-fig" data-widget="name">
// and inputs with a data-k="name" attribute; the widget redraws when an input changes and when the
// light/dark theme is switched. Charts use Observable Plot (from the CDN, with d3).
import { c_kms, hubbleTime, sci, wavelengthToRGB } from "../../_shared/cosmo.js";

const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const colours = () => Object.fromEntries(["ink", "ink-soft", "accent", "hot", "cool", "good", "gold", "edge", "bg"].map((k) => [k.replace("-", "_"), css(`--${k}`)]));

// a Plot chart of the given size in the slide's look
function plot(W, H, opts) {
  const C = colours();
  return Plot.plot({
    width: W, height: H, marginLeft: 70, marginBottom: 50, marginTop: 34, marginRight: 20,
    style: { background: "transparent", color: C.ink, fontSize: "17px", fontFamily: css("--f-ui") },
    ...opts,
  });
}

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
// observed frame at redshift z (arbitrary units), with a simple Lyα-forest suppression blueward
// of Lyα and nothing below the Lyman limit
const spectrum = (z, lo = 1000, hi = 11000, n = 1500) => d3.range(n).map((i) => {
  const lobs = lo + ((hi - lo) * i) / (n - 1), lr = lobs / (1 + z);
  let f = 1.2 * (lr / 3000) ** -0.5;
  for (const L of lines) f += L.amp * Math.exp(-0.5 * ((lr - L.lam) / (L.w * L.lam)) ** 2);
  if (lr < 1216) f *= Math.exp(-0.0036 * (lobs / 1216) ** 3.7);
  if (lr < 912) f = 0;
  return { lam: lobs, f };
});
const rainbow = d3.range(3800, 7500, 25).map((l) => ({ x1: l, x2: l + 25, c: wavelengthToRGB(l / 10) }));

// ---------- raisins in an unrisen dough (cm from its centre; dough 12 × 7.6 cm) ----------
const raisinBread = [
  [-4.2, -0.6], [-3.0, 1.6], [-2.6, -1.9], [-1.4, 0.2], [-0.8, 2.3], [-0.2, -2.4], [0.5, 0.9],
  [1.3, -0.9], [2.0, 2.0], [2.6, -2.2], [3.3, 0.4], [4.4, -0.8], [-1.9, 2.9], [1.0, -2.9],
].map(([x, y]) => ({ x, y }));

// ---------- toy cluster for the peculiar-velocities slide: positions in Mpc, us at (0, 0) below ----------
// random orbital velocities of ~800 km/s (vx, vy); the line of sight is (almost) vertical
const toyCluster = (() => {
  let seed = 5;
  const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const n = () => Math.sqrt(-2 * Math.log(r())) * Math.cos(2 * Math.PI * r());
  return Array.from({ length: 45 }, () => {
    const rad = 6 * Math.sqrt(r()), phi = 2 * Math.PI * r();
    return { x: rad * Math.cos(phi), y: 60 + rad * Math.sin(phi), vx: 800 * n(), vy: 800 * n() };
  });
})();
const widgets = {
  // red, amber and green LED wavelengths, seen at speed v/c
  "traffic-light": (box, s, out) => {
    const H = 420, W = 170, R = 48;
    const cv = Object.assign(document.createElement("canvas"), { width: W * 2, height: H * 2 });
    cv.style.width = `${W}px`;
    const g = cv.getContext("2d");
    g.scale(2, 2);
    g.fillStyle = "#1f2937";
    g.beginPath(); g.roundRect(8, 4, W - 16, H - 8, 26); g.fill();
    g.textAlign = "center"; g.textBaseline = "middle"; g.font = `600 18px ${css("--f-ui")}`;
    [630, 590, 505].forEach((nm, i) => {
      const obs = nm * (1 + s.v), col = wavelengthToRGB(obs), y = H * (0.18 + 0.32 * i);
      g.fillStyle = col ?? "#374151";
      g.beginPath(); g.arc(W / 2, y, R, 0, 2 * Math.PI); g.fill();
      g.fillStyle = col ? "#0b1120" : "#e5e7eb";
      g.fillText(col ? `${obs.toFixed(0)} nm` : obs < 380 ? "UV" : "IR", W / 2, y);
    });
    box.replaceChildren(cv);
    out.innerHTML = `<b>v = ${sci(s.v * c_kms)} km/s</b> (${s.v < 0 ? "towards you" : s.v > 0 ? "away from you" : "standing still"})<br>Red light (630 nm) seen at ${(630 * (1 + s.v)).toFixed(0)} nm`;
  },

  spectrum: (box, s, out) => {
    const C = colours();
    const shown = lines.map((L) => ({ ...L, obs: L.lam * (1 + s.z) })).filter((L) => L.obs < 11000);
    box.replaceChildren(plot(700, 440, {
      x: { domain: [1000, 11000], label: "observed wavelength (Å) →" },
      y: { domain: [-0.6, 8.5], label: "↑ flux", ticks: [] },
      marks: [
        Plot.rect([0], { x1: 1000, x2: 3000, y1: -0.6, y2: 8.5, fill: C.ink_soft, fillOpacity: 0.15 }),
        Plot.text(["atmosphere blocks UV"], { x: 2000, y: 0.5, fill: C.ink_soft }),
        Plot.rect(rainbow, { x1: "x1", x2: "x2", y1: -0.6, y2: -0.15, fill: "c" }),
        Plot.line(spectrum(s.z), { x: "lam", y: "f", stroke: C.cool, strokeWidth: 1.8 }),
        Plot.text(shown, { x: "obs", y: (d) => Math.min(8, d.amp + 1.6), text: "name", dx: (d) => d.dx ?? 0, fill: C.hot, fontWeight: 700 }),
      ],
    }));
    const ly = 1216 * (1 + s.z), ha = 6563 * (1 + s.z);
    out.innerHTML = `<b>z = ${s.z.toFixed(2)}</b><br>Lyα (1216 Å) seen at ${ly.toFixed(0)} Å: ${ly > 3000 ? "visible from the ground" : "blocked by the atmosphere"}<br>` +
      `Hα (6563 Å) seen at ${ha.toFixed(0)} Å${ha > 7500 ? " (infrared)" : ""}`;
  },





  // raisin bread: still until a raisin is clicked; that raisin becomes "our galaxy" and the dough rises once
  // (a = 1 → 2 in 4 s), with its distances to three others growing by the same factor.
  raisins: (box, s) => {
    box._stop?.();
    const C = colours(), W = 540, H = 400, cm = 21, R0 = { x: 6, y: 3.8 };
    const cv = Object.assign(document.createElement("canvas"), { width: W * 2, height: H * 2 });
    cv.style.cssText = `width:${W}px;cursor:pointer`;
    const g = cv.getContext("2d");
    g.scale(2, 2);
    let a = 1, me = null, t0, raf;
    const pos = (r) => [W / 2 + r.x * cm * a, H / 2 + r.y * cm * a];
    // three others: nearest, middle and farthest from our raisin
    const others = () => {
      const d = raisinBread.map((r, k) => [k, Math.hypot(r.x - raisinBread[me].x, r.y - raisinBread[me].y)]).filter(([k]) => k !== me).sort((p, q) => p[1] - q[1]);
      return [d[0], d[Math.floor(d.length / 2)], d[d.length - 1]];
    };
    const draw = () => {
      g.clearRect(0, 0, W, H);
      g.fillStyle = "#f3d9a4"; g.strokeStyle = "#c9a15b"; g.lineWidth = 2;
      g.beginPath(); g.ellipse(W / 2, H / 2, R0.x * cm * a, R0.y * cm * a, 0, 0, 2 * Math.PI); g.fill(); g.stroke();
      g.font = `600 14px ${css("--f-ui")}`; g.textAlign = "center"; g.textBaseline = "middle";
      if (me !== null) {
        const [mx, my] = pos(raisinBread[me]);
        for (const [k, d] of others()) {
          const [x, y] = pos(raisinBread[k]);
          g.strokeStyle = C.cool; g.lineWidth = 2.5; g.setLineDash([6, 4]);
          g.beginPath(); g.moveTo(mx, my); g.lineTo(x, y); g.stroke(); g.setLineDash([]);
          // label beside the middle of the line, pushed off it so it does not cover a raisin
          const L = Math.hypot(x - mx, y - my), label = `${(d * a).toFixed(1)} cm`, lx = (mx + x) / 2 - 16 * (y - my) / L, ly = (my + y) / 2 + 16 * (x - mx) / L;
          g.fillStyle = "rgba(255,255,255,0.85)"; g.fillRect(lx - 30, ly - 11, 60, 22);
          g.fillStyle = "#0e7490"; g.fillText(label, lx, ly);
        }
      }
      raisinBread.forEach((r, k) => {
        const [x, y] = pos(r);
        g.fillStyle = k === me ? C.hot : "#4a2c1a";
        g.beginPath(); g.ellipse(x, y, k === me ? 9 : 7, k === me ? 7 : 5, 0.5, 0, 2 * Math.PI); g.fill();
      });
      g.fillStyle = C.ink; g.textAlign = "left"; g.font = `600 17px ${css("--f-ui")}`;
      g.fillText(me === null ? "pick a raisin" : `dough grown by a = ${a.toFixed(2)}`, 10, 18);
    };
    const tick = (t) => {
      a = 1 + Math.min((t - t0) / 4000, 1);
      draw();
      if (a < 2) raf = requestAnimationFrame(tick);
    };
    cv.addEventListener("click", (e) => {
      const b = cv.getBoundingClientRect(), x = (e.clientX - b.left) * W / b.width, y = (e.clientY - b.top) * H / b.height;
      a = 1;
      me = d3.minIndex(raisinBread, (r) => { const [px, py] = pos(r); return Math.hypot(px - x, py - y); });
      cancelAnimationFrame(raf); t0 = performance.now(); raf = requestAnimationFrame(tick);
    });
    box._stop = () => cancelAnimationFrame(raf);
    box.replaceChildren(cv);
    draw();
  },

  // the toy cluster: blue = real positions with velocity arrows; red (layer "red", shown on a click and
  // drawn on top) = where a survey puts them, D = cz/H0, shifted by v_los/H0 along the line of sight
  fog: (box) => {
    const C = colours(), H0 = 70, red = box.dataset.layer === "red", W = 400, H = 470;
    const opts = { x: { domain: [-30, 30], label: "Mpc" }, y: { domain: [0, 90], label: "↑ distance (Mpc)" } };
    const marks = red
      ? [Plot.dot(toyCluster, { x: "x", y: (g) => g.y + g.vy / H0, r: 3.5, fill: C.hot })]
      : [
          Plot.ruleX([0], { y1: 0, y2: 90, stroke: C.ink_soft, strokeDasharray: "4 4" }),
          Plot.arrow(toyCluster, { x1: "x", y1: "y", x2: (g) => g.x + 0.5 * g.vx / H0, y2: (g) => g.y + 0.5 * g.vy / H0, stroke: C.gold, strokeWidth: 1.5, headLength: 6 }),
          Plot.dot(toyCluster, { x: "x", y: "y", r: 3.5, fill: C.cool }),
          Plot.dot([[0, 0]], { r: 8, fill: C.gold, stroke: C.bg }),
          Plot.text([[0, 0]], { text: () => "us", dx: 16, textAnchor: "start", fill: C.ink, fontWeight: 700 }),
        ];
    box.replaceChildren(plot(W, H, red ? { ...opts, x: { ...opts.x, axis: null }, y: { ...opts.y, axis: null }, marks } : { ...opts, grid: true, marks }));
  },

  // the Milky Way with the Sun orbiting its centre and the Earth the Sun, while the other galaxies
  // recede, faster the farther they are. Runs while its slide is shown; the Sun and the Earth appear with the
  // slide's fragment of class "orbits-on".
  // two Cepheids at the same distance: the bright one pulsates slowly (long period), the faint one fast;
  // below each, its brightness against time with a cursor at "now" (periods not to scale)
  cepheids: (box) => {
    box._stop?.();
    const C = colours(), W = 600, H = 215, span = 8;   // the light curves show `span` seconds
    const cv = Object.assign(document.createElement("canvas"), { width: W * 2, height: H * 2 });
    cv.style.width = `${W}px`;
    const g = cv.getContext("2d");
    g.scale(2, 2);
    // a Cepheid light curve: quick rise (first 20% of the period), slow decline; 0 (faint) to 1 (bright)
    const light = (t, P) => { const u = (t / P) % 1; return u < 0.2 ? u / 0.2 : 1 - (u - 0.2) / 0.8; };
    const stars = [
      { x: 150, P: 4, R: 34, lum: 1, label: "bright: slow, long period" },
      { x: 450, P: 1.1, R: 19, lum: 0.7, label: "faint: fast, short period" },
    ];
    let raf;
    const frame = (ms) => {
      raf = requestAnimationFrame(frame);
      if (!box.closest("section")?.classList.contains("present")) return;
      const t = ms / 1000;
      g.clearRect(0, 0, W, H);
      g.font = `600 15px ${css("--f-ui")}`; g.textAlign = "center"; g.textBaseline = "middle";
      for (const s of stars) {
        const b = light(t, s.P), r = s.R * (0.88 + 0.24 * b), cy = 55;
        // glowing star: size and glow follow the brightness
        const glow = g.createRadialGradient(s.x, cy, 0, s.x, cy, r * 2.2);
        glow.addColorStop(0, `rgba(254, 240, 138, ${Math.min(1, s.lum * (0.8 + 0.4 * b))})`);
        glow.addColorStop(0.45, `rgba(250, 204, 21, ${s.lum * (0.45 + 0.4 * b)})`);
        glow.addColorStop(1, "rgba(250, 204, 21, 0)");
        g.fillStyle = glow;
        g.beginPath(); g.arc(s.x, cy, r * 2.2, 0, 2 * Math.PI); g.fill();
        g.fillStyle = `rgba(245, 180, 0, ${0.6 + 0.4 * b})`;   // solid core, visible on the light theme too
        g.beginPath(); g.arc(s.x, cy, r * 0.55, 0, 2 * Math.PI); g.fill();
        g.fillStyle = C.ink;
        g.fillText(s.label, s.x, 125);
        // light curve over the last `span` seconds, cursor at the current time
        const x0 = s.x - 120, w = 240, y0 = 195, h = 50, t0 = t - (t % span);
        g.strokeStyle = C.edge; g.lineWidth = 1;
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + w, y0); g.moveTo(x0, y0); g.lineTo(x0, y0 - h - 6); g.stroke();
        g.strokeStyle = C.gold; g.lineWidth = 2.5;
        g.beginPath();
        for (let i = 0; i <= 240; i++) {
          const tt = (span * i) / 240, y = y0 - 4 - (h - 8) * s.lum * light(tt, s.P);
          i ? g.lineTo(x0 + (w * i) / 240, y) : g.moveTo(x0, y);
        }
        g.stroke();
        const cx = x0 + (w * (t - t0)) / span;
        g.fillStyle = C.hot;
        g.beginPath(); g.arc(cx, y0 - 4 - (h - 8) * s.lum * b, 5, 0, 2 * Math.PI); g.fill();
        g.font = `500 13px ${css("--f-ui")}`; g.fillStyle = C.ink_soft; g.textAlign = "right";
        g.fillText("time →", x0 + w, y0 + 12);
        g.save(); g.translate(x0 - 10, y0 - h / 2); g.rotate(-Math.PI / 2); g.textAlign = "center"; g.fillText("brightness", 0, 0); g.restore();
        g.font = `600 15px ${css("--f-ui")}`; g.textAlign = "center";
      }
    };
    box._stop = () => cancelAnimationFrame(raf);
    box.replaceChildren(cv);
    raf = requestAnimationFrame(frame);
  },

  motion: (box) => {
    box._stop?.();
    const C = colours(), W = 600, H = 430, cx = W / 2, cy = H / 2;
    const cv = Object.assign(document.createElement("canvas"), { width: W * 2, height: H * 2 });
    cv.style.width = `${W}px`;
    const g = cv.getContext("2d");
    g.scale(2, 2);
    const gals = d3.range(16).map((i) => ({ th: 2 * Math.PI * (i + 0.37 * (i % 3)) / 16, f: (i * 0.618) % 1 }));
    const Rmin = 150, Rmax = 420, period = 14;   // a galaxy drifts from Rmin to Rmax in `period` seconds
    let raf;
    const frame = (ms) => {
      raf = requestAnimationFrame(frame);
      if (!box.closest("section")?.classList.contains("present")) return;
      const t = ms / 1000, orbits = box.closest("section").querySelector(".orbits-on")?.classList.contains("visible");
      g.clearRect(0, 0, W, H);
      g.font = `600 14px ${css("--f-ui")}`; g.textAlign = "center"; g.textBaseline = "middle";
      // other galaxies: r grows exponentially (speed ∝ distance); arrows show the speed
      for (const q of gals) {
        const u = (q.f + t / period) % 1, r = Rmin * (Rmax / Rmin) ** u;
        const x = cx + r * Math.cos(q.th), y = cy + 0.62 * r * Math.sin(q.th);
        g.globalAlpha = Math.min(1, u * 6);
        g.strokeStyle = C.hot; g.lineWidth = 2;
        const L = 0.16 * r, ex = x + L * Math.cos(q.th), ey = y + 0.62 * L * Math.sin(q.th);
        g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.stroke();
        const ang = Math.atan2(ey - y, ex - x);
        g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex - 7 * Math.cos(ang - 0.5), ey - 7 * Math.sin(ang - 0.5)); g.lineTo(ex - 7 * Math.cos(ang + 0.5), ey - 7 * Math.sin(ang + 0.5)); g.fillStyle = C.hot; g.fill();
        g.fillStyle = C.ink_soft;
        g.beginPath(); g.ellipse(x, y, 9, 4, q.th, 0, 2 * Math.PI); g.fill();
      }
      g.globalAlpha = 1;
      // the Milky Way, the Sun on its orbit, the Earth around the Sun (sizes and speeds not to scale)
      const disc = g.createRadialGradient(cx, cy, 4, cx, cy, 110);
      disc.addColorStop(0, "rgba(253, 230, 138, 0.95)"); disc.addColorStop(1, "rgba(147, 197, 253, 0.08)");
      g.fillStyle = disc;
      g.beginPath(); g.ellipse(cx, cy, 115, 42, 0, 0, 2 * Math.PI); g.fill();
      g.fillStyle = C.ink;
      g.fillText("Milky Way", cx, cy - 56);
      if (orbits) {
        const ts = 2 * Math.PI * t / 9, sx = cx + 80 * Math.cos(ts), sy = cy + 29 * Math.sin(ts);
        g.strokeStyle = C.edge; g.lineWidth = 1; g.setLineDash([3, 4]);
        g.beginPath(); g.ellipse(cx, cy, 80, 29, 0, 0, 2 * Math.PI); g.stroke();
        g.beginPath(); g.arc(sx, sy, 16, 0, 2 * Math.PI); g.stroke(); g.setLineDash([]);
        const te = 2 * Math.PI * t / 1.8, ex = sx + 16 * Math.cos(te), ey = sy + 16 * Math.sin(te);
        g.fillStyle = "#facc15"; g.beginPath(); g.arc(sx, sy, 5.5, 0, 2 * Math.PI); g.fill();
        g.fillStyle = "#38bdf8"; g.beginPath(); g.arc(ex, ey, 3.5, 0, 2 * Math.PI); g.fill();
        g.fillStyle = C.ink;
        g.fillText("Sun", sx, sy - 26); g.fillText("Earth", ex + 24, ey + 10);
      }
      g.textAlign = "left"; g.font = `600 15px ${css("--f-ui")}`;
      g.fillStyle = C.hot; g.fillText("→ expansion: farther galaxies recede faster", 10, 16);
      if (orbits) { g.fillStyle = C.ink; g.fillText("○ gravity: orbits (peculiar motion)", 10, 38); }
    };
    box._stop = () => cancelAnimationFrame(raf);
    box.replaceChildren(cv);
    raf = requestAnimationFrame(frame);
  },



  "hubble-time": (box, s, out) => {
    const C = colours(), t = hubbleTime(s.H0);
    box.replaceChildren(plot(560, 420, {
      grid: true,
      x: { label: "H₀ (km s⁻¹ Mpc⁻¹) →", domain: [40, 600] },
      y: { label: "↑ Hubble time 1/H₀ (Gyr)", domain: [0, 25] },
      marks: [
        Plot.ruleY([4.5], { stroke: C.gold, strokeDasharray: "6 4", strokeWidth: 2 }),
        Plot.text([[600, 4.5]], { text: () => "age of the Earth", dy: -12, textAnchor: "end", fill: C.gold, fontWeight: 700 }),
        Plot.line(d3.range(40, 600.1, 2).map((H) => [H, hubbleTime(H)]), { stroke: C.cool, strokeWidth: 3 }),
        Plot.dot([[s.H0, t]], { r: 8, fill: C.hot }),
      ],
    }));
    out.innerHTML = `<b>H₀ = ${s.H0} km s⁻¹ Mpc⁻¹</b><br>Hubble time 1/H₀ = <b>${t.toFixed(1)} Gyr</b><br>Hubble distance c/H₀ = ${(c_kms / s.H0).toFixed(0)} Mpc` +
      (t < 4.5 ? `<br><span style="color:var(--hot)"><b>Younger than the Earth (4.5 Gyr)!</b> A real problem with Hubble's value.</span>` : "");
  },

  // the emitted wave and the same wave today, stretched by 1/a
  stretch: (box, s, out) => {
    const C = colours(), xs = d3.range(0, 10.001, 0.01);
    box.replaceChildren(plot(640, 320, {
      marginLeft: 20,
      x: { label: "distance (in emitted wavelengths) →", domain: [0, 10] }, y: { axis: null, domain: [-1, 2.3] },
      marks: [
        Plot.line(xs.map((x) => [x, 1.4 + 0.5 * Math.sin(2 * Math.PI * x)]), { stroke: C.cool, strokeWidth: 3 }),
        Plot.line(xs.map((x) => [x, -0.2 + 0.5 * Math.sin(2 * Math.PI * x * s.a)]), { stroke: C.hot, strokeWidth: 3 }),
        Plot.text([[0, 2.1]], { text: () => "emitted, when the scale factor was a", textAnchor: "start", fill: C.cool, fontWeight: 700 }),
        Plot.text([[0, 0.5]], { text: () => "observed today (a = 1)", textAnchor: "start", fill: C.hot, fontWeight: 700 }),
      ],
    }));
    out.innerHTML = `<b>a(t<sub>em</sub>) = ${s.a.toFixed(2)}</b><br>λ<sub>obs</sub> / λ<sub>em</sub> = 1/a = ${(1 / s.a).toFixed(2)}, so <b>z = ${(1 / s.a - 1).toFixed(2)}</b>`;
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
