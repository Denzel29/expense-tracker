// ──────────────────────────────────────────────────────────
// config.js
// App-wide constants: Firebase project config, supported
// currencies (CUR), and fixed FX exchange rates used for
// budget aggregation across currencies.
// ──────────────────────────────────────────────────────────
'use strict';

// ── Firebase Config ───────────────────────────────────────
// Replace the firebaseConfig below with your own Firebase project config
// from console.firebase.google.com → Project Settings → Your apps → Web app.
// This object is only used as a fallback if nothing is stored in localStorage.
// The app's setup screen (s-setup) lets users paste their config at runtime.
const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// ── Currency display config ───────────────────────────────
// sym: symbol prefix, dec: minimum decimal places to show,
// maxDec: maximum decimal places to show
const CUR = {
  RWF:{sym:'RWF ',dec:0,maxDec:0}, TZS:{sym:'TZS ',dec:0,maxDec:2},
  USD:{sym:'$',dec:2,maxDec:2},    EUR:{sym:'€',dec:2,maxDec:2},
  KES:{sym:'KES ',dec:0,maxDec:2}, UGX:{sym:'UGX ',dec:0,maxDec:0},
  GBP:{sym:'£',dec:2,maxDec:2}
};

// ── FX Exchange Rates ─────────────────────────────────────
// Fixed rates used for budget aggregation only (not live).
// 1 RWF = 1.8 TZS is the reference anchor rate.
const FX = {
  RWF: { RWF:1, TZS:1.8,  USD:0.00088, EUR:0.00081, KES:0.114, UGX:3.24,  GBP:0.00070 },
  TZS: { TZS:1, RWF:1/1.8, USD:1/2048,  EUR:1/2230,  KES:1/16.6, UGX:1.80,  GBP:1/2593 },
  USD: { USD:1, RWF:1136,  TZS:2048,   EUR:0.92,   KES:129,   UGX:3700,  GBP:0.79   },
  EUR: { EUR:1, RWF:1235,  TZS:2230,   USD:1.09,   KES:140,   UGX:4020,  GBP:0.86   },
  KES: { KES:1, RWF:8.77,  TZS:16.6,   USD:0.0078, EUR:0.0071, UGX:28.7,  GBP:0.0061 },
  UGX: { UGX:1, RWF:0.31,  TZS:0.556,  USD:0.00027,EUR:0.00025,KES:0.035, GBP:0.00022},
  GBP: { GBP:1, RWF:1429,  TZS:2593,   USD:1.27,   EUR:1.16,  KES:163,   UGX:4566   },
};
