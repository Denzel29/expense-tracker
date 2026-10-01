// ──────────────────────────────────────────────────────────
// recurring.js
// Fixed monthly bills (rent, subscriptions, insurance, etc.).
// Each recurring item has a day-of-month trigger. Paying one
// creates a real expense entry and marks it paid for the month.
// ──────────────────────────────────────────────────────────

function fillRecurringModal() {
  const wo = S.wallets.map(w=>`<option value="${w.id}">${x(w.entityName)}${w.name?' · '+w.name:''} (${w.currency})</option>`).join('');
  document.getElementById('rec-wallet').innerHTML = '<option value="">— Select wallet —</option>' + wo;
  const cats = [...new Set(S.expenses.map(e=>e.category).filter(Boolean))];
  document.getElementById('rec-cat-list').innerHTML = cats.map(c=>`<option value="${x(c)}">`).join('');
  document.getElementById('rec-charges').value = '0';
  document.getElementById('m-recurring-title').textContent = 'New Recurring Payment';
  document.getElementById('rec-save-btn').textContent = 'Save';
}

async function saveRecurring() {
  const desc     = document.getElementById('rec-desc').value.trim();
  const amount   = parseFloat(document.getElementById('rec-amount').value)||0;
  const charges  = parseFloat(document.getElementById('rec-charges').value)||0;
  const category = document.getElementById('rec-category').value.trim();
  const day      = parseInt(document.getElementById('rec-day').value)||0;
  const walId    = document.getElementById('rec-wallet').value;
  const cur      = document.getElementById('rec-currency').value;
  const notes    = document.getElementById('rec-notes').value.trim();
  if (!desc)   return toast('Enter a description');
  if (!amount) return toast('Enter amount');
  if (!day||day<1||day>31) return toast('Enter a valid day (1–31)');
  const wal = walId ? S.wallets.find(w=>w.id===walId) : null;
  if (_editRecId) {
    await col('recurring').doc(_editRecId).update({description:desc,amount,charges,category,dayOfMonth:day,walletId:walId,walletName:wal?.entityName||'',currency:cur,notes});
    _editRecId = null;
    toast('Updated'); closeModal('m-recurring'); await loadAll(); renderBudget();
    return;
  }
  await col('recurring').add({description:desc,amount,charges,category,dayOfMonth:day,walletId:walId,walletName:wal?.entityName||'',currency:cur,notes,lastPaidDate:'',active:true,createdAt:TS()});
  toast('Recurring payment saved'); closeModal('m-recurring'); await loadAll(); renderBudget();
}

function editRecurring(id) {
  const r = S.recurring.find(v=>v.id===id); if(!r) return;
  _editRecId = id;
  fillRecurringModal();
  document.getElementById('rec-desc').value = r.description;
  document.getElementById('rec-amount').value = r.amount;
  document.getElementById('rec-charges').value = r.charges||0;
  document.getElementById('rec-category').value = r.category||'';
  document.getElementById('rec-day').value = r.dayOfMonth;
  document.getElementById('rec-wallet').value = r.walletId||'';
  document.getElementById('rec-currency').value = r.currency||'RWF';
  document.getElementById('rec-notes').value = r.notes||'';
  document.getElementById('m-recurring-title').textContent = 'Edit Recurring Payment';
  document.getElementById('rec-save-btn').textContent = 'Update';
  openModal('m-recurring');
  // restore values overwritten by fillRecurringModal inside openModal
  document.getElementById('rec-desc').value = r.description;
  document.getElementById('rec-amount').value = r.amount;
  document.getElementById('rec-charges').value = r.charges||0;
  document.getElementById('rec-category').value = r.category||'';
  document.getElementById('rec-day').value = r.dayOfMonth;
  document.getElementById('rec-wallet').value = r.walletId||'';
  document.getElementById('rec-currency').value = r.currency||'RWF';
  document.getElementById('rec-notes').value = r.notes||'';
}

async function delRecurring(id) {
  if (!confirm('Delete this recurring payment?')) return;
  await col('recurring').doc(id).delete();
  toast('Deleted'); await loadAll(); renderBudget();
}

function openPayRecurring(id) {
  const r = S.recurring.find(v=>v.id===id); if(!r) return;
  document.getElementById('pr-rec-id').value = id;
  document.getElementById('pr-title').textContent = r.description;
  document.getElementById('pr-amount').value = r.amount;
  document.getElementById('pr-charges').value = r.charges||0;
  document.getElementById('pr-date').value = new Date().toISOString().split('T')[0];
  const wo = S.wallets.map(w=>`<option value="${w.id}"${w.id===r.walletId?' selected':''}>${x(w.entityName)}${w.name?' · '+w.name:''} (${w.currency})</option>`).join('');
  document.getElementById('pr-wallet').innerHTML = '<option value="">— Select wallet —</option>' + wo;
  openModal('m-pay-recurring');
}

async function confirmPayRecurring() {
  const id     = document.getElementById('pr-rec-id').value;
  const amount = parseFloat(document.getElementById('pr-amount').value)||0;
  const charges= parseFloat(document.getElementById('pr-charges').value)||0;
  const date   = document.getElementById('pr-date').value;
  const walId  = document.getElementById('pr-wallet').value;
  const r      = S.recurring.find(v=>v.id===id); if(!r) return;
  if (!amount) return toast('Enter amount');
  if (!date)   return toast('Select date');
  if (!walId)  return toast('Select a wallet');
  const wal = S.wallets.find(w=>w.id===walId);
  const b = db.batch();
  // Create expense
  b.set(col('expenses').doc(), {
    name: r.description, category: r.category||'Recurring',
    amount, charges, walletId:walId, walletName:wal.entityName,
    currency: wal.currency, date, createdAt:TS()
  });
  // Deduct from wallet
  b.update(col('wallets').doc(walId), {balance: INC(-(amount+charges))});
  // Mark as paid
  b.update(col('recurring').doc(id), {lastPaidDate: date});
  await b.commit();
  toast('Paid and recorded as expense');
  closeModal('m-pay-recurring'); await loadAll(); renderBudget(); renderDashboard();
}

function renderRecurring() {
  const list = document.getElementById('recurring-list');
  if (!list) return;
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  if (!S.recurring.length) {
    list.innerHTML = `<div class="empty" style="grid-column:1/-1;padding:16px 0;text-align:center;color:var(--muted)">No recurring payments set up yet</div>`;
    return;
  }
  list.innerHTML = S.recurring.map(r => {
    const paidThisMonth = r.lastPaidDate && r.lastPaidDate.startsWith(thisMonth);
    const status = paidThisMonth ? 'paid' : (now.getDate() >= r.dayOfMonth ? 'due' : 'upcoming');
    const statusBadge = status==='paid'
      ? `<span style="background:#dcfce7;color:#166534;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px">✓ Paid</span>`
      : status==='due'
      ? `<span style="background:#fee2e2;color:#991b1b;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px">⚠️ Due</span>`
      : `<span style="background:#f3f4f6;color:#374151;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px">Upcoming</span>`;
    return `
      <div class="card" style="border-left:4px solid ${status==='paid'?'var(--success)':status==='due'?'var(--danger)':'var(--border)'}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;padding:16px 16px 0">
          <div>
            <div style="font-weight:800;font-size:15px">${x(r.description)}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px">Every ${r.dayOfMonth}${ordinal(r.dayOfMonth)} of the month · ${x(r.category||'—')}</div>
          </div>
          ${statusBadge}
        </div>
        <div style="padding:0 16px">
          <div style="font-size:20px;font-weight:800;color:var(--primary)">${fmt(r.amount,r.currency)}${r.charges?`<span style="font-size:12px;font-weight:400;color:var(--muted)"> + ${fmt(r.charges,r.currency)} charges</span>`:''}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:3px">${x(r.walletName)||'No wallet'}</div>
          ${r.lastPaidDate ? `<div style="font-size:11px;color:var(--muted);margin-top:4px">Last paid: ${r.lastPaidDate}</div>` : ''}
          <div style="display:flex;gap:8px;margin-top:12px;margin-bottom:16px;flex-wrap:wrap">
            ${!paidThisMonth ? `<button class="btn btn-success btn-sm" onclick="openPayRecurring('${r.id}')">✓ Pay Now</button>` : ''}
            <button class="btn btn-ghost btn-sm" onclick="editRecurring('${r.id}')">✏️ Edit</button>
            <button class="btn btn-danger btn-sm" onclick="delRecurring('${r.id}')">×</button>
          </div>
        </div>
      </div>`;
  }).join('');
}
