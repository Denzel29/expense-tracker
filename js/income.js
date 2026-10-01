// ──────────────────────────────────────────────────────────
// income.js
// Record money coming into a wallet (salary, client payments,
// gifts, etc.). Each income entry credits the chosen wallet
// and is listed in the income history on the Wallets screen.
// ──────────────────────────────────────────────────────────

function fillIncomeModal() {
  const opts = S.wallets.map(w => `<option value="${w.id}">${x(w.entityName)}${w.name?' · '+w.name:''} (${w.currency})</option>`).join('');
  document.getElementById('inc-wallet').innerHTML = '<option value="">— Select wallet —</option>' + opts;
  document.getElementById('inc-date').value = new Date().toISOString().split('T')[0];
}

async function saveIncome() {
  const walId  = document.getElementById('inc-wallet').value;
  const amount = parseFloat(document.getElementById('inc-amount').value) || 0;
  const date   = document.getElementById('inc-date').value;
  const source = document.getElementById('inc-source').value.trim();
  const notes  = document.getElementById('inc-notes').value.trim();
  if (!walId)  return toast('Select a wallet');
  if (!amount) return toast('Enter amount');
  if (!date)   return toast('Select a date');
  const wal = S.wallets.find(w => w.id === walId);
  const b = db.batch();
  b.set(col('income').doc(), { walletId:walId, walletName:wal.entityName, currency:wal.currency, amount, source, notes, date, createdAt:TS() });
  b.update(col('wallets').doc(walId), { balance: INC(amount) });
  await b.commit();
  toast('Money added to ' + wal.entityName);
  closeModal('m-income');
  await loadAll();
  renderWallets();
}
