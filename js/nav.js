// ──────────────────────────────────────────────────────────
// nav.js
// Navigation and modal management: switching between top-level
// screens (show/go), opening/closing modals, balance visibility
// toggle, and the dashboard month navigator.
// ──────────────────────────────────────────────────────────

// ── Screen routing ────────────────────────────────────────
// show() toggles the top-level page (loading/setup/auth/app)
function show(id) {
  ['s-loading','s-setup','s-auth','s-app'].forEach(s => document.getElementById(s).style.display = 'none');
  document.getElementById(id).style.display = id === 's-app' ? 'block' : 'flex';
}

// go() activates a named section within the app (wallets, expenses, etc.)
function go(page) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item,.bn-item').forEach(n => n.classList.remove('active'));
  document.getElementById('sc-'+page).classList.add('active');
  document.querySelectorAll('.nav-item,.bn-item').forEach(n => {
    if (n.getAttribute('onclick')?.includes("'"+page+"'")) n.classList.add('active');
  });
  ({wallets:renderWallets,transfers:renderTransfers,expenses:renderExpenses,
    investments:renderInvestments,debts:renderDebts,budget:renderBudget,
    collections:renderCollections,dashboard:renderDashboard})[page]?.();
}

// ── Modal helpers ─────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add('open');
  if (id==='m-transfer')   fillTransferWallets();
  if (id==='m-expense')    fillExpenseModal();
  if (id==='m-investment') fillInvModal();
  if (id==='m-dividend')   fillDividendModal();
  if (id==='m-debt')       fillDebtModal();
  if (id==='m-income')     fillIncomeModal();
  if (id==='m-new-col')    fillNewColModal();
  if (id==='m-col-entry')  fillColEntryModal();
  if (id==='m-templates')  renderTemplates();
  if (id==='m-recurring')  fillRecurringModal();
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.getElementById(id).querySelectorAll('input,select,textarea').forEach(el=>{
    if (el.type==='checkbox') el.checked=false;
    else if (el.tagName==='SELECT') { el.selectedIndex=0; el.disabled=false; }
    else el.value='';
  });
  if (id==='m-wallet')     { document.getElementById('w-id').value=''; document.getElementById('m-wallet-title').textContent='Add Wallet'; }
  if (id==='m-transfer')   { if(_editTrId){_editTrId=null;} document.querySelector('#m-transfer .mh-title').textContent='New Transfer'; document.querySelector('#m-transfer .mf .btn-primary').textContent='Confirm Transfer'; }
  if (id==='m-expense')    { if(_editExpId){_editExpId=null;} document.querySelector('#m-expense .mh-title').textContent='Add Expense'; document.querySelector('#m-expense .mf .btn-primary').textContent='Save Expense'; }
  if (id==='m-investment') { if(_editInvId){_editInvId=null;} document.querySelector('#m-investment .mh-title').textContent='Add Investment'; document.querySelector('#m-investment .mf .btn-primary').textContent='Save Investment'; }
  if (id==='m-dividend')   { if(_editDivId){_editDivId=null;} document.querySelector('#m-dividend .mh-title').textContent='Record Dividend'; document.querySelector('#m-dividend .mf .btn-primary').textContent='Save Dividend'; }
  if (id==='m-debt')       { if(_editDebtId){_editDebtId=null;} document.querySelector('#m-debt .mh-title').textContent='Record Debt / Loan'; document.querySelector('#m-debt .mf .btn-primary').textContent='Save'; }
  if (id==='m-budget')     { if(_editBudgetId){_editBudgetId=null;} document.querySelector('#m-budget .mh-title').textContent='Set Budget'; document.querySelector('#m-budget .mf .btn-primary').textContent='Save Budget'; }
  if (id==='m-col-entry')  { if(_editColEntId){_editColEntId=null;} }
  if (id==='m-edit-tpl')   { if(_editTplId){_editTplId=null;} }
  if (id==='m-recurring')  { _editRecId=null; }
}

// Close any modal when clicking outside it
document.querySelectorAll('.overlay').forEach(ov=>{
  ov.addEventListener('click',e=>{if(e.target===ov) closeModal(ov.id);});
});

// ── Balance visibility toggle ─────────────────────────────
function toggleHide() {
  _hideVals = !_hideVals;
  localStorage.setItem('mt_hide', _hideVals ? '1' : '0');
  const icon = _hideVals ? '🙈' : '👁️';
  document.querySelectorAll('.eye-btn').forEach(el => el.textContent = icon);
  reRenderCurrent();
}

// Re-render whichever screen is currently active
function reRenderCurrent() {
  const active = document.querySelector('.screen.active');
  if (!active) return;
  const page = active.id.replace('sc-', '');
  ({dashboard:renderDashboard, wallets:renderWallets, transfers:renderTransfers,
    expenses:renderExpenses, investments:renderInvestments, debts:renderDebts,
    collections:renderCollections, budget:renderBudget})[page]?.();
}

// ── Dashboard month navigator ─────────────────────────────
// dir: -1 = previous month, +1 = next month
function shiftDashMonth(dir) {
  const [y,m]=_dashMonth.split('-').map(Number);
  const d=new Date(y,m-1+dir,1);
  _dashMonth=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  renderDashboard();
}
