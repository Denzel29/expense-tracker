// ──────────────────────────────────────────────────────────
// investments.js
// Portfolio tracking: buy/sell investments (stocks, funds,
// crypto, etc.) and record dividends. Holdings are aggregated
// by asset name and currency for the holdings grid view.
// ──────────────────────────────────────────────────────────

const INV_EMOJI = {stocks:'📈',unit_trust:'🏦',crypto:'🪙',bonds:'🏛️',real_estate:'🏠',mutual_fund:'💼',other:'📦'};
const INV_LBL   = {stocks:'Stocks',unit_trust:'Unit Trust / Fund',crypto:'Crypto',bonds:'Bonds',real_estate:'Real Estate',mutual_fund:'Mutual Fund',other:'Other'};

function fillInvModal() {
  const opts=S.wallets.map(w=>`<option value="${w.id}">${x(w.entityName)}${w.name?' · '+w.name:''}</option>`).join('');
  document.getElementById('inv-wallet').innerHTML='<option value="">— External / None —</option>'+opts;
  document.getElementById('inv-date').value=new Date().toISOString().split('T')[0];
  document.getElementById('inv-fees').value='0';
  // reset toggle
  document.getElementById('inv-fixed-mode').checked=false;
  document.getElementById('inv-units-section').style.display='block';
  document.getElementById('inv-amount-section').style.display='none';
}

function toggleInvMode() {
  const fixed=document.getElementById('inv-fixed-mode').checked;
  document.getElementById('inv-units-section').style.display=fixed?'none':'block';
  document.getElementById('inv-amount-section').style.display=fixed?'block':'none';
}

function editInvestment(id) {
  const inv=S.investments.find(v=>v.id===id); if(!inv) return;
  _editInvId=id;
  openModal('m-investment'); // auto-calls fillInvModal() which resets form
  document.getElementById('inv-type').value=inv.type||'stocks';
  document.getElementById('inv-name').value=inv.name||'';
  document.getElementById('inv-fixed-mode').checked=inv.isFixedAmount||false;
  document.getElementById('inv-units-section').style.display=inv.isFixedAmount?'none':'block';
  document.getElementById('inv-amount-section').style.display=inv.isFixedAmount?'block':'none';
  document.getElementById('inv-qty').value=inv.quantity||'';
  document.getElementById('inv-price').value=inv.pricePerUnit||'';
  document.getElementById('inv-total-amount').value=inv.totalCost||'';
  document.getElementById('inv-fees').value=inv.fees||0;
  document.getElementById('inv-currency').value=inv.currency||'USD';
  document.getElementById('inv-wallet').value=inv.walletId||'';
  document.getElementById('inv-broker').value=inv.broker||'';
  document.getElementById('inv-date').value=inv.date||'';
  document.getElementById('inv-note').value=inv.note||'';
  document.querySelector('#m-investment .mh-title').textContent='Edit Investment';
  document.querySelector('#m-investment .mf .btn-primary').textContent='Update Investment';
}

async function saveInvestment() {
  const type=document.getElementById('inv-type').value;
  const name=document.getElementById('inv-name').value.trim();
  const fees=parseFloat(document.getElementById('inv-fees').value)||0;
  const cur=document.getElementById('inv-currency').value;
  const walId=document.getElementById('inv-wallet').value;
  const broker=document.getElementById('inv-broker').value.trim();
  const date=document.getElementById('inv-date').value;
  const note=document.getElementById('inv-note').value.trim();
  const isFixed=document.getElementById('inv-fixed-mode').checked;
  if (!name) return toast('Enter asset name');
  if (!date) return toast('Select date');
  let qty=0, price=0, total=0;
  if (isFixed) {
    total=parseFloat(document.getElementById('inv-total-amount').value)||0;
    if (!total) return toast('Enter amount invested');
  } else {
    qty=parseFloat(document.getElementById('inv-qty').value)||0;
    price=parseFloat(document.getElementById('inv-price').value)||0;
    if (!qty)   return toast('Enter quantity');
    if (!price) return toast('Enter price per unit');
    total=qty*price;
  }
  const wal=walId?S.wallets.find(w=>w.id===walId):null;
  if (_editInvId) {
    const old=S.investments.find(v=>v.id===_editInvId); if(!old) return;
    const b=db.batch();
    b.update(col('investments').doc(_editInvId),{type,name,quantity:qty,pricePerUnit:price,fees,currency:cur,totalCost:total,isFixedAmount:isFixed,walletId:walId,walletName:wal?.entityName||'',broker,note,date});
    if (old.walletId) b.update(col('wallets').doc(old.walletId),{balance:INC(old.totalCost+(old.fees||0))});
    if (walId) b.update(col('wallets').doc(walId),{balance:INC(-(total+fees))});
    await b.commit();
    _editInvId=null;
    document.querySelector('#m-investment .mh-title').textContent='Add Investment';
    document.querySelector('#m-investment .mf .btn-primary').textContent='Save Investment';
    toast('Investment updated'); closeModal('m-investment'); await loadAll(); renderInvestments();
    return;
  }
  if (wal && (total+fees)>wal.balance) return toast('Insufficient wallet balance (cost + fees)');
  const b=db.batch();
  b.set(col('investments').doc(),{type,name,quantity:qty,pricePerUnit:price,fees,currency:cur,totalCost:total,isFixedAmount:isFixed,walletId:walId,walletName:wal?.entityName||'',broker,note,date,createdAt:TS()});
  if (walId) b.update(col('wallets').doc(walId),{balance:INC(-(total+fees))});
  await b.commit(); toast('Investment added'); closeModal('m-investment'); await loadAll(); renderInvestments();
}

function renderInvestments() {
  // Holdings: aggregate by name+currency
  const agg={};
  S.investments.forEach(inv=>{
    const key=inv.name+'|'+inv.currency;
    if (!agg[key]) agg[key]={name:inv.name,type:inv.type,currency:inv.currency,totalQty:0,totalCost:0,totalFees:0,count:0,isFixed:false};
    agg[key].totalQty+=inv.quantity||0;
    agg[key].totalCost+=inv.totalCost;
    agg[key].totalFees+=(inv.fees||0);
    agg[key].count++;
    if (inv.isFixedAmount) agg[key].isFixed=true;
  });
  const holdings=Object.values(agg);
  const holdGrid=document.getElementById('holdings-grid');

  if (!holdings.length) {
    holdGrid.innerHTML=`<div class="empty" style="grid-column:1/-1"><div class="empty-icon">📈</div><div class="empty-title">No investments yet</div><div>Start building your portfolio</div></div>`;
  } else {
    holdGrid.innerHTML=holdings.map(h=>{
      const avgPrice=(!h.isFixed&&h.totalQty)?h.totalCost/h.totalQty:0;
      const qtyLine=h.isFixed
        ? `<div class="hc-qty">${h.count} deposit${h.count!==1?'s':''} · amount-based</div>`
        : `<div class="hc-qty">${num(h.totalQty)} units · ${h.count} transaction${h.count!==1?'s':''}</div>`;
      const avgLine=!h.isFixed&&avgPrice
        ? `<div class="hc-avg">Avg ${fmt(avgPrice,h.currency)}/unit${h.totalFees?` · Fees: ${fmt(h.totalFees,h.currency)}`:''}</div>`
        : (h.totalFees?`<div class="hc-avg">Total fees: ${fmt(h.totalFees,h.currency)}</div>`:'');
      return `
        <div class="holding-card">
          <div class="hc-type">${INV_EMOJI[h.type]||'📦'} ${INV_LBL[h.type]||h.type}</div>
          <div class="hc-name">${x(h.name)}</div>
          ${qtyLine}
          <div class="hc-val">${fmt(h.totalCost,h.currency)}</div>
          ${avgLine}
        </div>`;
    }).join('');
  }

  // History table
  const tbody=document.getElementById('tb-inv-hist');
  const empty=document.getElementById('inv-hist-empty');
  const tbl=document.getElementById('t-inv-hist');
  if (!S.investments.length) { tbody.innerHTML=''; tbl.style.display='none'; empty.style.display='block'; }
  else {
    tbl.style.display='table'; empty.style.display='none';
    tbody.innerHTML=S.investments.map(inv=>`
      <tr>
        <td>${inv.date}</td>
        <td><strong>${x(inv.name)}</strong>${inv.broker?`<div style="font-size:11px;color:var(--muted)">${x(inv.broker)}</div>`:''}</td>
        <td><span style="font-size:11px;font-weight:600;color:var(--muted)">${INV_EMOJI[inv.type]||''} ${INV_LBL[inv.type]||inv.type}</span></td>
        <td>${num(inv.quantity)}</td>
        <td>${fmt(inv.pricePerUnit,inv.currency)}</td>
        <td style="color:var(--muted)">${inv.fees?fmt(inv.fees,inv.currency):'—'}</td>
        <td style="font-weight:700;color:var(--primary)">${fmt(inv.totalCost,inv.currency)}</td>
        <td style="font-size:12px;color:var(--muted)">${x(inv.walletName)||'—'}</td>
        <td style="display:flex;gap:6px;padding:11px 14px"><button class="btn btn-ghost btn-sm" onclick="editInvestment('${inv.id}')">✏️</button><button class="btn btn-danger btn-sm" onclick="delInvestment('${inv.id}','${inv.walletId}',${inv.totalCost},${inv.fees||0})">×</button></td>
      </tr>`).join('');
  }

  // Dividends
  renderDividendsTable();
}

async function delInvestment(id,walId,total,fees) {
  if (!confirm('Delete this investment? Wallet balance will be restored if applicable.')) return;
  const b=db.batch(); b.delete(col('investments').doc(id));
  if (walId) b.update(col('wallets').doc(walId),{balance:INC(total+(fees||0))});
  await b.commit(); toast('Investment deleted'); await loadAll(); renderInvestments();
}

// ── DIVIDENDS ─────────────────────────────────────────────
function fillDividendModal() {
  const wo=S.wallets.map(w=>`<option value="${w.id}">${x(w.entityName)}${w.name?' · '+w.name:''}</option>`).join('');
  document.getElementById('div-wallet').innerHTML='<option value="">— Don\'t update wallet —</option>'+wo;
  document.getElementById('div-date').value=new Date().toISOString().split('T')[0];
  // Asset name suggestions from existing investments
  const assets=[...new Set(S.investments.map(i=>i.name).filter(Boolean))];
  document.getElementById('div-asset-list').innerHTML=assets.map(a=>`<option value="${x(a)}">`).join('');
}

function editDividend(id) {
  const d=S.dividends.find(v=>v.id===id); if(!d) return;
  _editDivId=id;
  openModal('m-dividend'); // auto-calls fillDividendModal()
  document.getElementById('div-asset').value=d.assetName||'';
  document.getElementById('div-amount').value=d.amount||'';
  document.getElementById('div-currency').value=d.currency||'USD';
  document.getElementById('div-wallet').value=d.walletId||'';
  document.getElementById('div-date').value=d.date||'';
  document.getElementById('div-notes').value=d.notes||'';
  document.querySelector('#m-dividend .mh-title').textContent='Edit Dividend';
  document.querySelector('#m-dividend .mf .btn-primary').textContent='Update Dividend';
}

async function saveDividend() {
  const asset=document.getElementById('div-asset').value.trim();
  const amount=parseFloat(document.getElementById('div-amount').value)||0;
  const cur=document.getElementById('div-currency').value;
  const walId=document.getElementById('div-wallet').value;
  const date=document.getElementById('div-date').value;
  const notes=document.getElementById('div-notes').value.trim();
  if (!asset)  return toast('Enter asset/fund name');
  if (!amount) return toast('Enter dividend amount');
  if (!date)   return toast('Select date');
  const wal=walId?S.wallets.find(w=>w.id===walId):null;
  if (_editDivId) {
    const old=S.dividends.find(v=>v.id===_editDivId); if(!old) return;
    const b=db.batch();
    b.update(col('dividends').doc(_editDivId),{assetName:asset,amount,currency:cur,walletId:walId,walletName:wal?.entityName||'',date,notes});
    if (old.walletId) b.update(col('wallets').doc(old.walletId),{balance:INC(-old.amount)});
    if (walId) b.update(col('wallets').doc(walId),{balance:INC(amount)});
    await b.commit();
    _editDivId=null;
    document.querySelector('#m-dividend .mh-title').textContent='Record Dividend';
    document.querySelector('#m-dividend .mf .btn-primary').textContent='Save Dividend';
    toast('Dividend updated'); closeModal('m-dividend'); await loadAll(); renderInvestments();
    return;
  }
  const b=db.batch();
  b.set(col('dividends').doc(),{assetName:asset,amount,currency:cur,walletId:walId,walletName:wal?.entityName||'',date,notes,createdAt:TS()});
  if (walId) b.update(col('wallets').doc(walId),{balance:INC(amount)});
  await b.commit(); toast('Dividend recorded'); closeModal('m-dividend'); await loadAll(); renderInvestments();
}

function renderDividendsTable() {
  const tbody=document.getElementById('tb-dividends');
  const empty=document.getElementById('dividends-empty');
  const tbl=document.getElementById('t-dividends');
  if (!S.dividends.length) { tbody.innerHTML=''; tbl.style.display='none'; empty.style.display='block'; return; }
  tbl.style.display='table'; empty.style.display='none';
  tbody.innerHTML=S.dividends.map(d=>`
    <tr>
      <td>${d.date}</td>
      <td><strong>${x(d.assetName)}</strong>${d.notes?`<div style="font-size:11px;color:var(--muted)">${x(d.notes)}</div>`:''}</td>
      <td class="green" style="font-weight:700">+${fmt(d.amount,d.currency)}</td>
      <td style="font-size:12px;color:var(--muted)">${x(d.walletName)||'—'}</td>
      <td style="display:flex;gap:6px;padding:11px 14px"><button class="btn btn-ghost btn-sm" onclick="editDividend('${d.id}')">✏️</button><button class="btn btn-danger btn-sm" onclick="delDividend('${d.id}','${d.walletId}',${d.amount})">×</button></td>
    </tr>`).join('');
}

async function delDividend(id,walId,amount) {
  if (!confirm('Delete this dividend? Wallet balance will be reversed if applicable.')) return;
  const b=db.batch(); b.delete(col('dividends').doc(id));
  if (walId) b.update(col('wallets').doc(walId),{balance:INC(-amount)});
  await b.commit(); toast('Dividend deleted'); await loadAll(); renderInvestments();
}
