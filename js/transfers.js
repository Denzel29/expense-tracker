// ──────────────────────────────────────────────────────────
// transfers.js
// Move money between wallets. Each transfer atomically debits
// the source wallet and credits the destination wallet.
// Supports optional transfer charges deducted from source.
// ──────────────────────────────────────────────────────────

function fillTransferWallets() {
  const opts=S.wallets.map(w=>`<option value="${w.id}">${x(w.entityName)}${w.name?' · '+w.name:''} (${w.currency})</option>`).join('');
  document.getElementById('tr-from').innerHTML=opts;
  document.getElementById('tr-to').innerHTML=opts;
}

function editTransfer(id) {
  const t=S.transfers.find(v=>v.id===id); if(!t) return;
  _editTrId=id;
  fillTransferWallets();
  document.getElementById('m-transfer').classList.add('open');
  document.getElementById('tr-from').value=t.fromWalletId;
  document.getElementById('tr-to').value=t.toWalletId;
  document.getElementById('tr-amount').value=t.amount;
  document.getElementById('tr-charges').value=t.charges||0;
  document.getElementById('tr-date').value=t.date;
  document.getElementById('tr-note').value=t.note||'';
  document.querySelector('#m-transfer .mh-title').textContent='Edit Transfer';
  document.querySelector('#m-transfer .mf .btn-primary').textContent='Update Transfer';
}

async function saveTransfer() {
  const fromId=document.getElementById('tr-from').value;
  const toId=document.getElementById('tr-to').value;
  const amount=parseFloat(document.getElementById('tr-amount').value)||0;
  const charges=parseFloat(document.getElementById('tr-charges').value)||0;
  const date=document.getElementById('tr-date').value;
  const note=document.getElementById('tr-note').value.trim();
  if (!fromId||!toId) return toast('Select both wallets');
  if (fromId===toId)  return toast('From and To must differ');
  if (!amount)        return toast('Enter transfer amount');
  if (!date)          return toast('Select a date');
  if (_editTrId) {
    const old=S.transfers.find(v=>v.id===_editTrId); if(!old) return;
    const fromW=S.wallets.find(w=>w.id===fromId);
    const toW=S.wallets.find(w=>w.id===toId);
    const b=db.batch();
    b.update(col('transfers').doc(_editTrId),{fromWalletId:fromId,toWalletId:toId,fromName:fromW.entityName,toName:toW.entityName,amount,charges,date,note});
    if (old.fromWalletId) b.update(col('wallets').doc(old.fromWalletId),{balance:INC(old.amount+(old.charges||0))});
    if (old.toWalletId)   b.update(col('wallets').doc(old.toWalletId),{balance:INC(-old.amount)});
    b.update(col('wallets').doc(fromId),{balance:INC(-(amount+charges))});
    b.update(col('wallets').doc(toId),{balance:INC(amount)});
    await b.commit();
    _editTrId=null;
    document.querySelector('#m-transfer .mh-title').textContent='New Transfer';
    document.querySelector('#m-transfer .mf .btn-primary').textContent='Confirm Transfer';
    toast('Transfer updated'); closeModal('m-transfer'); await loadAll(); renderTransfers();
    return;
  }
  const fromW=S.wallets.find(w=>w.id===fromId);
  const toW=S.wallets.find(w=>w.id===toId);
  if ((amount+charges)>fromW.balance) return toast('Insufficient balance in source wallet');
  const b=db.batch();
  b.set(col('transfers').doc(),{fromWalletId:fromId,toWalletId:toId,fromName:fromW.entityName,toName:toW.entityName,amount,charges,date,note,createdAt:TS()});
  b.update(col('wallets').doc(fromId),{balance:INC(-(amount+charges))});
  b.update(col('wallets').doc(toId),{balance:INC(amount)});
  await b.commit();
  toast('Transfer recorded'); closeModal('m-transfer'); await loadAll(); renderTransfers();
}

function renderTransfers() {
  const tbody=document.getElementById('tb-transfers');
  const empty=document.getElementById('transfers-empty');
  const tbl=document.getElementById('t-transfers');
  if (!S.transfers.length) { tbody.innerHTML=''; tbl.style.display='none'; empty.style.display='block'; return; }
  tbl.style.display='table'; empty.style.display='none';
  tbody.innerHTML=S.transfers.map(t=>`
    <tr>
      <td>${t.date}</td><td>${x(t.fromName)}</td><td>${x(t.toName)}</td>
      <td style="font-weight:600">${num(t.amount)}</td>
      <td style="color:var(--muted)">${t.charges?num(t.charges):'—'}</td>
      <td style="color:var(--muted);font-size:12px">${x(t.note)||'—'}</td>
      <td style="display:flex;gap:6px;padding:11px 14px"><button class="btn btn-ghost btn-sm" onclick="editTransfer('${t.id}')">✏️</button><button class="btn btn-danger btn-sm" onclick="delTransfer('${t.id}','${t.fromWalletId}','${t.toWalletId}',${t.amount},${t.charges||0})">×</button></td>
    </tr>`).join('');
}

async function delTransfer(id,fromId,toId,amount,charges) {
  if (!confirm('Delete this transfer? Balances will be restored.')) return;
  const b=db.batch();
  b.delete(col('transfers').doc(id));
  if (fromId) b.update(col('wallets').doc(fromId),{balance:INC(amount+charges)});
  if (toId)   b.update(col('wallets').doc(toId),{balance:INC(-amount)});
  await b.commit(); toast('Transfer deleted'); await loadAll(); renderTransfers();
}
