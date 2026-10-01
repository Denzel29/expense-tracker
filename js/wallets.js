// ──────────────────────────────────────────────────────────
// wallets.js
// All wallet CRUD operations plus the income history table
// that appears below wallets. Wallets hold a running balance
// updated atomically with every expense/transfer/income.
// ──────────────────────────────────────────────────────────

function openWalletModal() { document.getElementById('m-wallet-title').textContent='Add Wallet'; openModal('m-wallet'); }

function renderWallets() {
  const grid = document.getElementById('wallets-grid');
  if (!S.wallets.length) {
    grid.innerHTML=`<div class="empty" style="grid-column:1/-1"><div class="empty-icon">💳</div><div class="empty-title">No wallets yet</div><div>Add your first bank, mobile money, or cash wallet</div></div>`;
  } else {
    const tMap={bank:'bank',mobile_money:'mobile',cash:'cash'};
    const tLbl={bank:'🏦 Bank',mobile_money:'📱 Mobile Money',cash:'💵 Cash'};
    grid.innerHTML=S.wallets.map(w=>`
      <div class="wallet-card">
        <span class="badge badge-${tMap[w.type]||'bank'}">${tLbl[w.type]||w.type}</span>
        <div class="w-name">${x(w.entityName)}${w.name?` <span style="font-weight:400;color:var(--muted)">· ${x(w.name)}</span>`:''}</div>
        <div class="w-cur">${w.currency}</div>
        <div class="w-bal">${fmt(w.balance,w.currency)}</div>
        <div class="w-actions">
          <button class="btn btn-ghost btn-sm" onclick="editWallet('${w.id}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="delWallet('${w.id}')">Delete</button>
        </div>
      </div>`).join('');
  }
  renderIncomeHistory();
}

function renderIncomeHistory() {
  const tbody=document.getElementById('tb-income');
  const empty=document.getElementById('income-empty');
  const tbl=document.getElementById('t-income');
  if (!tbody) return;
  if (!S.income.length) { tbody.innerHTML=''; tbl.style.display='none'; empty.style.display='block'; return; }
  tbl.style.display='table'; empty.style.display='none';

  // Total by currency
  const totals={};
  S.income.forEach(i=>{ totals[i.currency]=(totals[i.currency]||0)+i.amount; });
  const totalStr=Object.entries(totals).map(([c,v])=>`<span style="font-weight:800;color:var(--success)">${fmt(v,c)}</span>`).join(' + ');

  tbody.innerHTML=`<tr style="background:var(--primary-lt)">
    <td colspan="3" style="font-size:12px;font-weight:700;color:var(--muted)">Total received (all time)</td>
    <td colspan="3" style="font-size:15px">${totalStr}</td>
  </tr>`+
  S.income.map(i=>`
    <tr>
      <td>${i.date}</td>
      <td><strong>${x(i.source)||'—'}</strong></td>
      <td style="font-size:12px;color:var(--muted)">${x(i.walletName)}</td>
      <td class="green" style="font-weight:700">+${fmt(i.amount,i.currency)}</td>
      <td style="font-size:12px;color:var(--muted)">${x(i.notes)||'—'}</td>
      <td><button class="btn btn-danger btn-sm" onclick="delIncome('${i.id}','${i.walletId}',${i.amount})">×</button></td>
    </tr>`).join('');
}

async function delIncome(id,walId,amount) {
  if (!confirm('Delete this income entry? Wallet balance will be reversed.')) return;
  const b=db.batch(); b.delete(col('income').doc(id));
  if (walId) b.update(col('wallets').doc(walId),{balance:INC(-amount)});
  await b.commit(); toast('Income entry deleted'); await loadAll(); renderWallets();
}

async function saveWallet() {
  const id=document.getElementById('w-id').value;
  const type=document.getElementById('w-type').value;
  const entity=document.getElementById('w-entity').value.trim();
  const name=document.getElementById('w-name').value.trim();
  const cur=document.getElementById('w-currency').value;
  const bal=parseFloat(document.getElementById('w-balance').value)||0;
  if (!entity) return toast('Enter entity name');
  const data={type,entityName:entity,name,currency:cur,balance:bal};
  if (id) { await col('wallets').doc(id).update(data); toast('Wallet updated'); }
  else    { await col('wallets').add({...data,createdAt:TS()}); toast('Wallet added'); }
  closeModal('m-wallet'); await loadAll(); renderWallets();
}

function editWallet(id) {
  const w=S.wallets.find(v=>v.id===id); if(!w) return;
  document.getElementById('w-id').value=id;
  document.getElementById('m-wallet-title').textContent='Edit Wallet';
  document.getElementById('w-type').value=w.type;
  document.getElementById('w-entity').value=w.entityName;
  document.getElementById('w-name').value=w.name||'';
  document.getElementById('w-currency').value=w.currency;
  document.getElementById('w-balance').value=w.balance;
  document.getElementById('m-wallet').classList.add('open');
}

async function delWallet(id) {
  if (!confirm('Delete this wallet? Existing transactions are kept.')) return;
  await col('wallets').doc(id).delete(); toast('Wallet deleted');
  await loadAll(); renderWallets();
}
