// ──────────────────────────────────────────────────────────
// firebase.js
// Firebase initialisation, authentication, Firestore helpers,
// and the top-level data loader. Wires everything together
// on window load and kicks off the app after sign-in.
// ──────────────────────────────────────────────────────────

// ── Firebase init ─────────────────────────────────────────
// Default config baked in so any browser/device works without the
// setup screen. A Firebase web config is not a secret — security is
// enforced by Firestore rules + auth, not by hiding these values.
// A config stored in localStorage still takes precedence if present.
const DEFAULT_CFG = {
  apiKey: "AIzaSyA77K8n1sI23onumNSQeacRDv8bKl7UPC8",
  authDomain: "expense-tracker-7526e.firebaseapp.com",
  projectId: "expense-tracker-7526e",
  storageBucket: "expense-tracker-7526e.firebasestorage.app",
  messagingSenderId: "215647782078",
  appId: "1:215647782078:web:31c6bca97489a1aaf7caef",
  measurementId: "G-QWCP39Z5MH"
};

function storedCfg() { try { return JSON.parse(localStorage.getItem('mt_cfg')); } catch { return null; } }

async function initFirebase(cfg) {
  if (!cfg) {
    try { cfg = JSON.parse(document.getElementById('fc-input').value.trim()); }
    catch { return showSetupErr('Invalid JSON — paste the full firebaseConfig object.'); }
  }
  try {
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    db = firebase.firestore(); auth = firebase.auth();
    localStorage.setItem('mt_cfg', JSON.stringify(cfg));
    auth.onAuthStateChanged(user => user ? bootApp(user) : show('s-auth'));
  } catch (e) { showSetupErr('Firebase error: ' + e.message); }
}

function showSetupErr(msg) { const el = document.getElementById('setup-err'); el.textContent = msg; el.style.display = 'block'; }

// ── Auth ──────────────────────────────────────────────────
function doGoogleSignIn() { auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(e => toast('Sign-in failed: ' + e.message)); }
function doSignOut() { auth.signOut().then(() => show('s-auth')); }

// ── Boot ──────────────────────────────────────────────────
async function bootApp(user) {
  uid = user.uid; show('s-app');
  const name = user.displayName?.split(' ')[0] || 'there';
  document.getElementById('u-av').textContent = (user.displayName || 'U')[0].toUpperCase();
  document.getElementById('u-nm').textContent = user.displayName || 'User';
  const hr = new Date().getHours();
  document.getElementById('dash-greet').textContent =
    (hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening') + ', ' + name;
  // Set initial eye icon state
  const icon = _hideVals ? '🙈' : '👁️';
  document.querySelectorAll('.eye-btn').forEach(el => el.textContent = icon);

  const today = new Date().toISOString().split('T')[0];
  ['tr-date', 'e-date', 'inv-date', 'div-date', 'd-date'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = today;
  });
  const me = document.getElementById('exp-month');
  if (me) me.value = today.slice(0, 7);
  await loadAll();
}

// ── Firestore helpers ─────────────────────────────────────
const col = name => db.collection('users').doc(uid).collection(name);
const TS = () => firebase.firestore.FieldValue.serverTimestamp();
const INC = n => firebase.firestore.FieldValue.increment(n);

// ── Load all collections into S ───────────────────────────
async function loadAll() {
  const [w, tr, ex, tp, inv, b, d, dv, inc, cl, ce, rec] = await Promise.all([
    col('wallets').orderBy('createdAt').get(),
    col('transfers').orderBy('date', 'desc').get(),
    col('expenses').orderBy('date', 'desc').get(),
    col('templates').orderBy('name').get(),
    col('investments').orderBy('date', 'desc').get(),
    col('budgets').get(),
    col('debts').orderBy('date', 'desc').get(),
    col('dividends').orderBy('date', 'desc').get(),
    col('income').orderBy('date', 'desc').get(),
    col('collections').orderBy('createdAt', 'desc').get(),
    col('col_entries').orderBy('date', 'desc').get(),
    col('recurring').orderBy('dayOfMonth', 'asc').get()
  ]);
  S.wallets = w.docs.map(d => { return { id: d.id, ...d.data() }; });
  S.transfers = tr.docs.map(d => { return { id: d.id, ...d.data() }; });
  S.expenses = ex.docs.map(d => { return { id: d.id, ...d.data() }; });
  S.templates = tp.docs.map(d => { return { id: d.id, ...d.data() }; });
  S.investments = inv.docs.map(d => { return { id: d.id, ...d.data() }; });
  S.budgets = b.docs.map(d => { return { id: d.id, ...d.data() }; });
  S.debts = d.docs.map(d => { return { id: d.id, ...d.data() }; });
  S.dividends = dv.docs.map(d => { return { id: d.id, ...d.data() }; });
  S.income = inc.docs.map(d => { return { id: d.id, ...d.data() }; });
  S.collections = cl.docs.map(d => { return { id: d.id, ...d.data() }; });
  S.colEntries = ce.docs.map(d => { return { id: d.id, ...d.data() }; });
  S.recurring = rec.docs.map(d => { return { id: d.id, ...d.data() }; });
  renderDashboard();
}

// ── App entry point ───────────────────────────────────────
// On load: use stored config if available, otherwise fall back to the
// baked-in default so a fresh browser never sees the setup screen.
window.addEventListener('load', () => {
  const cfg = storedCfg() || DEFAULT_CFG;
  initFirebase(cfg);
});
