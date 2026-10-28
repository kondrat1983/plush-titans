// Plush Titans helpers with no Phaser: number format and calendar days. Node and browser (window.PTUtil).
(function (root) {
  'use strict';

  const UNITS = ['', 'K', 'M', 'B', 'T'];
  const A = 'abcdefghijklmnopqrstuvwxyz';

  // One formatter for every number on screen: 999, 1.00K, 12.4K, 152K, ... T, then aa, ab, ... zz.
  function fmt(n) {
    if (n === Infinity) return '∞';
    if (!(n > 0)) return '0'; // NaN, undefined, 0 and negatives
    if (n < 1000) return String(Math.floor(n));
    let u = Math.floor(Math.log10(n) / 3);
    let v = n / Math.pow(1000, u);
    if (v >= 1000 - 1e-9) { u++; v /= 1000; } // log10 rounding at an exact power of 1000
    if (v < 1) { u--; v *= 1000; }
    // always round down: the number on screen is never more than the child has, and it never goes down as it grows
    // (the 1e-9 absorbs float noise like 4.2 -> 4.1999999; the cap keeps 9.9999999 at 9.99, never 10.00)
    const down = (x, d, cap) => Math.min(Math.floor(x * Math.pow(10, d) + 1e-9), cap * Math.pow(10, d) - 1) / Math.pow(10, d);
    const num = v < 10 ? down(v, 2, 10).toFixed(2) : v < 100 ? down(v, 1, 100).toFixed(1) : String(down(v, 0, 1000));
    if (u < UNITS.length) return num + UNITS[u];
    const k = u - UNITS.length; // 0 = aa
    if (k >= A.length * A.length) return '∞';
    return num + A[Math.floor(k / A.length)] + A[k % A.length];
  }

  const pad = (x) => String(x).padStart(2, '0');

  // Local calendar date 'YYYY-MM-DD'. All day logic uses this or dayNum, never 24 h arithmetic.
  function todayKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  // Calendar day number of a local date (days since 1970-01-01 as a calendar, not as elapsed time).
  function dayNum(d) {
    d = d || new Date();
    return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const U = { fmt, todayKey, dayNum, clamp };
  if (typeof module === 'object' && module.exports) module.exports = U;
  else root.PTUtil = U;
})(typeof self !== 'undefined' ? self : this);
