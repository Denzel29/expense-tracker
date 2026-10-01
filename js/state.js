// ──────────────────────────────────────────────────────────
// state.js
// Global application state: Firebase handles (db/auth/uid),
// the central data store S, all edit-mode tracking variables,
// and UI state like the active dashboard month.
// ──────────────────────────────────────────────────────────

// ── Firebase handles (set by firebase.js on init) ─────────
let db, auth, uid;

// ── Central data store ────────────────────────────────────
// All Firestore collections are loaded into S by loadAll().
// Every render function reads from S rather than re-fetching.
const S = {
  wallets:[], transfers:[], expenses:[], templates:[],
  investments:[], budgets:[], debts:[], dividends:[],
  income:[], collections:[], colEntries:[], recurring:[]
};

// ── Edit-mode IDs ─────────────────────────────────────────
// Set to the Firestore doc ID when editing an existing record,
// cleared (null) after save or modal close.
let _editTrId=null, _editExpId=null, _editInvId=null, _editDivId=null;
let _editDebtId=null, _editBudgetId=null, _editColEntId=null, _editTplId=null;
let _editRecId=null;

// ── UI state ──────────────────────────────────────────────
let _activeColId = null; // currently-open collection in detail modal
let _activeCats  = [];   // active category filter chips on Expenses screen

// Dashboard month navigator (default = current month, YYYY-MM)
let _dashMonth = (()=>{
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
})();

// Balance visibility toggle (persisted to localStorage)
let _hideVals = localStorage.getItem('mt_hide') === '1';
