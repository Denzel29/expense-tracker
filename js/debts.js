// ──────────────────────────────────────────────────────────
// debts.js
// Track money you lent to others or borrowed from others.
// Records show as outstanding until settled; settling reverses
// the wallet balance effect (lent = money back, borrowed = money out).
// ──────────────────────────────────────────────────────────

function openDebtModal() { openModal('m-debt'); }

function editDebt(id) {
  const d=S.debts.find(v=>v.id===id); if(!d) return;
  _editDebtId=id;
  openModal('m-debt'); // auto-calls fillDebtModal()
  document.getElementById('d-type').value=d.type||'lent';
  document.getElementById('d-person').value=d.person||'';
  document.getElementById('d-amount').value=d.amount||'';
  document.getElementById('d-currency').value=d.currency||'USD';
  document.getElementById('d-wallet').value=d.walletId||'';
  document.getElementById('d-date').value=d.date||'';
  document.getElementById('d-due').value=d.dueDate||'';
  document.getElementById('d-notes').value=d.notes||'';
  document.querySelector('#m-debt .mh-title').textContent='Edit Debt / Loan';
  document.querySelector('#m-debt .mf .btn-primary').textContent='Update';
}

function fillDebtModal() {
  const wo=S.wallets.map(w=>`<option value="${w.id}">${x(w.entityName)}${w.name?' · '+w.name:''} (${w.currency})</option>`).join('');
  document.getElementById('d-wallet').innerHTML='<option value="">— No wallet update —</option>'+wo;
  document.getElementById('d-date').value=new Date().toISOString().split('T')[0];
}

async function saveDebt() {
  const type=document.getElementById('d-type').value;
  const person=document.getElementById('d-person').value.trim();
  const amount=parseFloat(document.getElementById('d-amount').value)||0;
  const cur=document.getElementById('d-currency').value;
  const walId=document.getElementById('d-wallet').value;
  const date=document.getElementById('d-date').value;
  const due=document.getElementById('d-due').value;
  const notes=document.getElementById('d-notes').value.trim();
  if (!person) return toast('Enter person name');
  if (!amount) return toast('Enter amount');
  if (!date)   return toast('Select date');
  const wal=walId?S.wallets.find(w=>w.id===walId):null;
  if (_editDebtId) {
    const old=S.debts.find(v=>v.id===_editDebtId); if(!old) return;
    const b=db.batch();
    b.update(col('debts').doc(_editDebtId),{type,person,amount,currency:cur,walletId:walId,walletName:wal?.entityName||'',date,dueDate:due,notes});
    if (old.walletId) b.update(col('wallets').doc(old.walletId),{balance:INC(old.type==='lent'?old.amount:-old.amount)});
    if (walId) b.update(col('wallets').doc(walId),{balance:INC(type==='lent'?-amount:amount)});
    await b.commit();
    _editDebtId=null;
    document.querySelector('#m-debt .mh-title').textContent='Record Debt / Loan';
    document.querySelector('#m-debt .mf .btn-primary').textContent='Save';
    toast('Updated'); closeModal('m-debt'); await loadAll(); renderDebts();
    return;
  }
  if (wal && type==='lent' && amount>wal.balance) return toast('Insufficient wallet balance');
  const b=db.batch();
  b.set(col('debts').doc(),{type,person,amount,currency:cur,walletId:walId,walletName:wal?.entityName||'',date,dueDate:due,notes,settled:false,createdAt:TS()});
  if (walId) {
    // lent: deduct from wallet; borrowed: add to wallet
    b.update(col('wallets').doc(walId),{balance:INC(type==='lent'?-amount:amount)});
  }
  await b.commit(); toast('Recorded'); closeModal('m-debt'); await loadAll(); renderDebts();
}

async function settleDebt(id) {
  const debt=S.debts.find(d=>d.id===id); if(!debt) return;
  if (!confirm(`Mark as settled? ${debt.walletId?'Wallet balance will be updated.':''}`)) return;
  const b=db.batch();
  b.update(col('debts').doc(id),{settled:true,settledDate:new Date().toISOString().split('T')[0]});
  if (debt.walletId) {
    // reverse: lent settled = money comes back; borrowed settled = money goes out
    b.update(col('wallets').doc(debt.walletId),{balance:INC(debt.type==='lent'?debt.amount:-debt.amount)});
  }
  await b.commit(); toast('Marked as settled'); await loadAll(); renderDebts();
}

async function delDebt(id) {
  if (!confirm('Delete this record entirely? No balance changes will be made.')) return;
  await col('debts').doc(id).delete(); toast('Record deleted'); await loadAll(); renderDebts();
}

function renderDebts() {
  const outstanding=S.debts.filter(d=>!d.settled);
  const settled=S.debts.filter(d=>d.settled);
  const typeBadge = d => d.type==='lent'
    ? `<span class="badge debt-lent">Lent</span>`
    : `<span class="badge debt-borrowed">Borrowed</span>`;

  // Outstanding
  const outTbody=document.getElementById('tb-debts-out');
  const outEmpty=document.getElementById('debts-out-empty');
  const outTbl=document.getElementById('t-debts-out');
  if (!outstanding.length) { outTbody.innerHTML=''; outTbl.style.display='none'; outEmpty.style.display='block'; }
  else {
    outTbl.style.display='table'; outEmpty.style.display='none';
    outTbody.innerHTML=outstanding.map(d=>`
      <tr>
        <td>${typeBadge(d)}</td>
        <td><strong>${x(d.person)}</strong></td>
        <td style="font-weight:700;color:${d.type==='lent'?'var(--warning)':'var(--danger)'}">${fmt(d.amount,d.currency)}</td>
        <td>${d.date}</td>
        <td style="color:${d.dueDate&&d.dueDate<new Date().toISOString().split('T')[0]?'var(--danger)':'var(--muted)'}">${d.dueDate||'—'}</td>
        <td style="font-size:12px;color:var(--muted)">${x(d.notes)||'—'}</td>
        <td style="display:flex;gap:6px;padding:11px 14px">
          <button class="btn btn-ghost btn-sm" onclick="editDebt('${d.id}')">✏️</button>
          <button class="btn btn-success btn-sm" onclick="settleDebt('${d.id}')">Settle</button>
          <button class="btn btn-danger btn-sm" onclick="delDebt('${d.id}')">×</button>
        </td>
      </tr>`).join('');
  }

  // Settled
  const setTbody=document.getElementById('tb-debts-settled');
  const setEmpty=document.getElementById('debts-settled-empty');
  const setTbl=document.getElementById('t-debts-settled');
  if (!settled.length) { setTbody.innerHTML=''; setTbl.style.display='none'; setEmpty.style.display='block'; }
  else {
    setTbl.style.display='table'; setEmpty.style.display='none';
    setTbody.innerHTML=settled.map(d=>`
      <tr>
        <td>${typeBadge(d)}</td>
        <td>${x(d.person)}</td>
        <td style="font-weight:600">${fmt(d.amount,d.currency)}</td>
        <td style="color:var(--muted)">${d.date}</td>
        <td style="color:var(--success)">${d.settledDate||'—'}</td>
        <td style="font-size:12px;color:var(--muted)">${x(d.notes)||'—'}</td>
      </tr>`).join('');
  }
}
