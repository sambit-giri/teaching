// Shared cosmology helpers for the AS5003 lecture widgets.
// Units: H0 in km/s/Mpc, distances in Mpc, times in Gyr, frequencies in GHz.

export const c_kms = 299792.458;
export const Mpc_km = 3.0857e19;
export const Gyr_s = 3.15576e16;
export const h_planck = 6.62607015e-34;
export const k_B = 1.380649e-23;
export const c_ms = 2.99792458e8;
export const T_cmb = 2.7255;

// Benchmark model, Ryden (2nd ed.) Table 2.1
export const benchmark = { H0: 68, Om: 0.31, Or: 9.0e-5, OL: 0.69 };

export const z2a = (z) => 1 / (1 + z);
export const a2z = (a) => 1 / a - 1;

// Hubble time 1/H0 in Gyr
export const hubbleTime = (H0) => Mpc_km / H0 / Gyr_s;

// H(a)/H0
export function E(a, p = benchmark) {
  const Ok = 1 - p.Om - p.Or - p.OL;
  return Math.sqrt(p.Or / a ** 4 + p.Om / a ** 3 + Ok / a ** 2 + p.OL);
}

// Simpson's rule on [x0, x1] with n (even) intervals
export function simpson(f, x0, x1, n = 400) {
  const h = (x1 - x0) / n;
  let s = f(x0) + f(x1);
  for (let i = 1; i < n; i++) s += f(x0 + i * h) * (i % 2 ? 4 : 2);
  return (s * h) / 3;
}

// Cosmic time t(a) in Gyr: t = ∫ dln a / H, integrated in ln a from a ~ 0
export function age(a, p = benchmark) {
  const lnA0 = Math.log(1e-12);
  const tiny = 1e-12 ** 2 / (2 * Math.sqrt(p.Or || 1e-30)); // radiation era t ∝ a^2
  return hubbleTime(p.H0) * (tiny + simpson((x) => 1 / E(Math.exp(x), p), lnA0, Math.log(a), 2000));
}

// Scale factor at cosmic time t (Gyr), by bisection in ln a
export function aOfT(t, p = benchmark) {
  let lo = Math.log(1e-12), hi = Math.log(10);
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (age(Math.exp(mid), p) < t) lo = mid; else hi = mid;
  }
  return Math.exp((lo + hi) / 2);
}

// Proper distance today (comoving), Mpc
export function comovingDistance(z, p = benchmark) {
  return (c_kms / p.H0) * simpson((zz) => 1 / E(1 / (1 + zz), p), 0, z, 400);
}

// Planck specific intensity B_nu(T) in MJy/sr, nu in GHz
export function planckMJy(nu_GHz, T) {
  const nu = nu_GHz * 1e9;
  const B = (2 * h_planck * nu ** 3) / c_ms ** 2 / Math.expm1((h_planck * nu) / (k_B * T));
  return B / 1e-20;
}

// Wien peak in frequency: nu_peak = 2.821 k T / h
export const wienPeakGHz = (T) => (2.821439 * k_B * T) / h_planck / 1e9;

// Seeded RNG so toy data look the same on every reload
export function rng(seed = 1) {
  let s = seed >>> 0;
  const uniform = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => Math.sqrt(-2 * Math.log(uniform() || 1e-12)) * Math.cos(2 * Math.PI * uniform());
  return { uniform, normal };
}

// Compact number formatting for readouts: 1.2 × 10^17
export function sci(x, digits = 2) {
  if (x === 0 || !isFinite(x)) return String(x);
  const e = Math.floor(Math.log10(Math.abs(x)));
  if (e >= -2 && e < 4) return String(Number(x.toPrecision(digits + 1)));
  const m = x / 10 ** e;
  return `${m.toFixed(digits - 1)} × 10${String(e).replace(/-/g, "⁻").replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[d])}`;
}

// Approximate display colour of light with wavelength in nm (visible 380–750 nm).
// Returns null outside the visible range.
export function wavelengthToRGB(nm) {
  if (nm < 380 || nm > 750) return null;
  let r = 0, g = 0, b = 0;
  if (nm < 440) { r = (440 - nm) / 60; b = 1; }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { g = 1; b = (510 - nm) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645) { r = 1; g = (645 - nm) / 65; }
  else { r = 1; }
  // Dim towards the edges of human vision
  const f = nm < 420 ? 0.3 + (0.7 * (nm - 380)) / 40 : nm > 700 ? 0.3 + (0.7 * (750 - nm)) / 50 : 1;
  const c = (x) => Math.round(255 * (x * f) ** 0.8);
  return `rgb(${c(r)}, ${c(g)}, ${c(b)})`;
}
