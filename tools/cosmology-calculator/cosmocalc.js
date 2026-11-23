// Cosmology calculator engine: ages, lookback times and distances for a universe with radiation,
// matter, curvature and dark energy, after Ned Wright's calculator. Self-contained (no imports), so
// any page can use it: the calculator page next to this file, and the AS5003 Lecture 6 slide.
// Notation follows Ryden, Introduction to Cosmology (2nd ed.). Units: H0 in km/s/Mpc, times in Gyr,
// distances in Mpc.
//
// Inputs s = { H0, Om, OL, z, flat, rad, w0, wa }:
//   OL    the dark-energy density today, Ω_DE,0 (Ω_Λ,0 for a cosmological constant)
//   flat  true: OL is replaced by 1 − Ωm − Ωr (κ = 0)
//   rad   true: radiation (photons + neutrinos) with Ωr,0 h² = 4.16 × 10⁻⁵; false: Ωr,0 = 0
//   w0,wa dark-energy equation of state w(a) = w0 + wa (1 − a) (Chevallier–Polarski–Linder);
//         the default w0 = −1, wa = 0 is a cosmological constant Λ
// The integrals are done in ln a; distances as in Ryden ch. 7, with Sκ(r) for curved space.

export const c_kms = 299792.458;
const Mpc_km = 3.0857e19, Gyr_s = 3.15576e16;

export const defaults = { H0: 67.4, Om: 0.315, OL: 0.685, z: 1, flat: true, rad: true, w0: -1, wa: 0 };   // Planck 2018, Λ

// Hubble time 1/H0 in Gyr
export const hubbleTime = (H0) => Mpc_km / H0 / Gyr_s;

// Simpson's rule on [x0, x1] with n (even) intervals
export function simpson(f, x0, x1, n = 400) {
  const h = (x1 - x0) / n;
  let s = f(x0) + f(x1);
  for (let i = 1; i < n; i++) s += f(x0 + i * h) * (i % 2 ? 4 : 2);
  return (s * h) / 3;
}

// The first a between a1 and a2 (either order) where E² reaches zero: a bounce in the past or the
// maximum before a Big Crunch, or null. Found on a log grid and refined by bisection.
export function turning(E2, a1, a2) {
  const n = 3000, r = (a2 / a1) ** (1 / n);
  for (let i = 1, lo = a1; i <= n; i++, lo *= r) {
    let hi = lo * r;
    if (E2(hi) > 0) continue;
    for (let j = 0; j < 50; j++) { const mid = Math.sqrt(lo * hi); if (E2(mid) > 0) lo = mid; else hi = mid; }
    return lo;
  }
  return null;
}

// The numbers, and the readouts as text (keys = the data-v names of a results table)
export function calc(s) {
  const H0 = s.H0 > 0 ? s.H0 : 67.4, h = H0 / 100, Or = s.rad ? 4.16e-5 / h ** 2 : 0, Om = s.Om;
  const OL = s.flat ? 1 - Om - Or : s.OL, Ok = 1 - Or - Om - OL, z = Math.max(0, s.z || 0), ae = 1 / (1 + z);
  const w0 = Number.isFinite(s.w0) ? s.w0 : -1, wa = Number.isFinite(s.wa) ? s.wa : 0, isL = w0 === -1 && wa === 0;
  // dark-energy density relative to today: ε(a)/ε0 = a^(−3(1 + w0 + wa)) exp(−3 wa (1 − a))
  const de = isL ? () => 1 : (a) => a ** (-3 * (1 + w0 + wa)) * Math.exp(-3 * wa * (1 - a));
  const E2 = (a) => Or / a ** 4 + Om / a ** 3 + OL * de(a) + Ok / a ** 2;
  const Ez = (a) => Math.sqrt(E2(a));                   // H(a)/H0
  const tH = hubbleTime(H0), dH = c_kms / H0;           // Gyr and Mpc
  const amin = turning(E2, 1, 1e-10), amax = turning(E2, 1, 1e8);
  const reached = amin === null || amin < ae;           // light from z left after the bounce
  const tOf = (a) => simpson((x) => 1 / Ez(Math.exp(x)), Math.log(1e-10), Math.log(a), 4000);
  const r = reached ? simpson((x) => 1 / (Math.exp(x) * Ez(Math.exp(x))), Math.log(ae), 0, 2000) : NaN;
  const Sk = Ok > 1e-6 ? Math.sinh(Math.sqrt(Ok) * r) / Math.sqrt(Ok) : Ok < -1e-6 ? Math.sin(Math.sqrt(-Ok) * r) / Math.sqrt(-Ok) : r;
  const t0 = amin === null ? tOf(1) : Infinity, te = amin === null ? tOf(ae) : Infinity, look = reached ? simpson((x) => 1 / Ez(Math.exp(x)), Math.log(ae), 0, 2000) : NaN;
  const dL = Sk * (1 + z), dA = Sk * ae;
  const gyr = (x) => (isFinite(x) ? `${(x * tH).toFixed(2)} Gyr` : "∞ (no Big Bang)");
  const mpc = (x) => (isFinite(x) ? `${(x * dH).toFixed(x * dH < 100 ? 1 : 0)} Mpc (${(x * dH * 3.2616e-3).toFixed(1)} Gly)` : "—");
  const fmt = (x, n = 3) => (Math.abs(x) < 0.5 * 10 ** -n ? (0).toFixed(n) : x.toFixed(n)).replace("-", "−");
  const text = {
    Orv: s.rad ? `${(Or * 1e5).toFixed(1)}×10⁻⁵` : "0",
    OLv: fmt(OL, 4),
    Ok: `${fmt(Ok)} (${Math.abs(Ok) < 5e-4 ? "flat" : Ok > 0 ? "κ = −1" : "κ = +1"})`,
    tH: `${tH.toFixed(2)} Gyr`, dH: `${dH.toFixed(0)} Mpc`,
    Hz: reached ? `${(H0 * Ez(ae)).toFixed(1)} km/s/Mpc` : "—",
    t0: gyr(t0), te: reached ? gyr(te) : "— (before the bounce)", look: reached ? `${(look * tH).toFixed(2)} Gyr` : "—",
    dp0: mpc(r), dpe: mpc(r * ae), dL: mpc(dL), dA: mpc(dA),
    mu: reached && z > 0 && dL > 0 ? `${(5 * Math.log10(dL * dH) + 25).toFixed(2)} mag` : "—",
    scale: reached && z > 0 ? `${(dA * dH * 1000 * Math.PI / 648000).toFixed(2)} kpc` : "—",
    fate: amax !== null ? `Big Crunch, aₘₐₓ = ${amax.toPrecision(3)}` : "expands forever",
  };
  return { H0, Om, Or, OL, Ok, w0, wa, z, ae, E2, Ez, tH, dH, amin, amax, reached, r, Sk, t0, te, look, text };
}

// For plots: the redshift dependence from z = 0 up to zmax, built up in ln a. Returns points
// { z, dp0, dpe, dL, dA, te, look } (distances in Mpc, times in Gyr; te is NaN without a Big Bang).
export function zTable(res, zmax = 1000, n = 3000) {
  const { Ez, Ok, dH, tH, amin, t0 } = res;
  const S = (r) => (Ok > 1e-6 ? Math.sinh(Math.sqrt(Ok) * r) / Math.sqrt(Ok) : Ok < -1e-6 ? Math.sin(Math.sqrt(-Ok) * r) / Math.sqrt(-Ok) : r);
  const pts = [];
  let r = 0, look = 0;
  const dx = -Math.log(1 + zmax) / n;
  for (let i = 0; i <= n; i++) {
    const x = i * dx, a = Math.exp(x);
    if (amin !== null && a <= amin * 1.0001) break;
    if (i) {
      const a0 = Math.exp(x - dx);
      r += -0.5 * (1 / (a0 * Ez(a0)) + 1 / (a * Ez(a))) * dx;
      look += -0.5 * (1 / Ez(a0) + 1 / Ez(a)) * dx;
    }
    const z = 1 / a - 1;
    pts.push({ z, dp0: r * dH, dpe: r * a * dH, dL: S(r) * (1 + z) * dH, dA: S(r) * a * dH, look: look * tH, te: isFinite(t0) ? (t0 - look) * tH : NaN });
  }
  return pts;
}

// For plots: a(t) from the start (Big Bang or bounce) to the Big Crunch, a = amaxPlot or tmax Gyr after today.
// Returns points { t, a } with t in Gyr since the Big Bang (or since today, t − t0, when there is no
// Big Bang). A turning point is a mirror: the history on the far side is its reflection in time.
export function aOfT(res, { amaxPlot = 6, tmax = Infinity, n = 1500 } = {}) {
  const { Ez, tH, amin, amax, t0 } = res;
  const lo = Math.log(amin !== null ? amin * 1.000001 : 1e-5), hi = Math.log(amax !== null ? amax * 0.999999 : amaxPlot);
  const dx = (hi - lo) / n;
  // time since today, s = H0 (t − t0), at each a, by the trapezoid rule from a = 1 both ways
  const xs = Array.from({ length: n + 1 }, (_, i) => lo + i * dx);
  const f = (x) => 1 / Ez(Math.exp(x));
  const i1 = Math.max(0, Math.min(n, Math.round(-lo / dx)));
  const s = new Array(n + 1);
  s[i1] = simpson(f, 0, xs[i1], 20);
  for (let i = i1 + 1; i <= n; i++) s[i] = s[i - 1] + 0.5 * (f(xs[i - 1]) + f(xs[i])) * dx;
  for (let i = i1 - 1; i >= 0; i--) s[i] = s[i + 1] - 0.5 * (f(xs[i + 1]) + f(xs[i])) * dx;
  let pts = xs.map((x, i) => ({ s: s[i], a: Math.exp(x) }));
  if (amax !== null) pts = [...pts, ...pts.slice().reverse().map((p) => ({ s: 2 * s[n] - p.s, a: p.a }))];
  if (amin !== null) pts = [...pts.slice().reverse().map((p) => ({ s: 2 * s[0] - p.s, a: p.a })), ...pts];
  const shift = isFinite(t0) ? t0 : 0;
  return pts.map((p) => ({ t: (p.s + shift) * tH, a: p.a })).filter((p) => p.t - shift * tH <= tmax);
}
