// ──────────────────────────────────────────────────────────
// utils.js
// Pure helper functions used throughout the app: number/
// currency formatting, HTML escaping, toast notifications,
// currency conversion, and ordinal suffix generation.
// ──────────────────────────────────────────────────────────

// ── Currency formatter ────────────────────────────────────
// fmt(amount, currencyCode) → formatted string (or •••••• if hidden)
function fmt(n, c) {
  if (_hideVals) return '••••••';
  const r = CUR[c] || {sym:(c||'')+' ',dec:2,maxDec:2};
  const v = Number(n||0);
  // Show trailing zeros only when the currency requires them (e.g. USD always shows .00)
  // For currencies like TZS: show decimals only if the value actually has them
  const minD = (r.maxDec > r.dec) ? 0 : r.dec;
  return r.sym + v.toLocaleString(undefined,{minimumFractionDigits:minD,maximumFractionDigits:r.maxDec??r.dec});
}

// ── Plain number formatter (no currency symbol) ───────────
function num(n) { return Number(n||0).toLocaleString(); }

// ── HTML escape ───────────────────────────────────────────
// Prevents XSS when inserting user-supplied text into innerHTML
function x(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Toast notification ────────────────────────────────────
let _tt; // timeout handle
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(_tt);
  _tt = setTimeout(() => el.classList.remove('show'), 3000);
}

// ── Currency conversion ───────────────────────────────────
// Uses the static FX table in config.js. Falls back to as-is if pair unknown.
function convertCurrency(amount, from, to) {
  if (from === to) return amount;
  const rate = FX[from]?.[to];
  return rate ? amount * rate : amount; // if unknown pair, return as-is
}

// ── Budget spending helper ────────────────────────────────
// Sum expenses for a category this month, converting all currencies
// to the budget's target currency using the FX table.
function spentInBudgetCurrency(category, budgetCurrency, monthStr) {
  return S.expenses
    .filter(e => e.category?.toLowerCase() === category.toLowerCase() && e.date?.startsWith(monthStr))
    .reduce((s, e) => s + convertCurrency(e.amount, e.currency, budgetCurrency), 0);
}

// ── Ordinal suffix ────────────────────────────────────────
// ordinal(15) → 'th', ordinal(1) → 'st', etc.
function ordinal(n) {
  const s=['th','st','nd','rd'], v=n%100;
  return s[(v-20)%10]||s[v]||s[0];
}
