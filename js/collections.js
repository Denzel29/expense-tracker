// ──────────────────────────────────────────────────────────
// collections.js
// Group money pools for shared events (funerals, trips, etc.).
// Each collection has a target wallet and tracks contributions,
// personal expenses, and disbursements with running balance.
// ──────────────────────────────────────────────────────────

function fillNewColModal() {
  const opts=S.wallets.map(w=>`<option value="${w.id}">${x(w.entityName)}${w.name?' · '+w.name:''} (${w.currency})</option>`).join('');
  document.getElementById('nc-wallet').innerHTML='<option value="">— Select wallet —</option>'+opts;
}

async function saveCollection() {
  const name=document.getElementById('nc-name').value.trim();
  const purpose=document.getElementById('nc-purpose').value.trim();
  const walId=document.getElementById('nc-wallet').value;
  const goal=parseFloat(document.getElementById('nc-goal').value)||0;
  if (!name)  return toast('Enter collection name');
  if (!walId) return toast('Select a receiving wallet');
  const wal=S.wallets.find(w=>w.id===walId);
  await col('collections').add({name,purpose,targetWalletId:walId,targetWalletName:wal.entityName,currency:wal.currency,goalAmount:goal,status:'active',createdAt:TS()});
  toast('Collection created'); closeModal('m-new-col'); await loadAll(); renderCollections();
}

function renderCollections() {
  const active=S.collections.filter(c=>c.status==='active');
  const closed=S.collections.filter(c=>c.status==='closed');
  const renderCards=(list,el)=>{
    if (!list.length) { document.getElementById(el).innerHTML=`<div class="empty" style="grid-column:1/-1;padding:24px 0;text-align:center;color:var(--muted)">${el==='col-active'?'No active collections':'No closed collections'}</div>`; return; }
    document.getElementById(el).innerHTML=list.map(c=>{
      const entries=S.colEntries.filter(e=>e.collectionId===c.id);
      const totalIn=entries.filter(e=>e.type!=='disburse').reduce((s,e)=>s+e.amount,0);
      const totalOut=entries.filter(e=>e.type==='disburse').reduce((s,e)=>s+e.amount,0);
      const contributors=[...new Set(entries.filter(e=>e.type!=='disburse').map(e=>e.person).filter(Boolean))];
      const pct=c.goalAmount?Math.min((totalIn/c.goalAmount)*100,100):0;
      return `
        <div class="card cp" style="cursor:pointer" onclick="openColDetail('${c.id}')">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px">
            <div>
              <div style="font-weight:800;font-size:15px">${x(c.name)}</div>
              ${c.purpose?`<div style="font-size:12px;color:var(--muted);margin-top:2px">${x(c.purpose)}</div>`:''}
            </div>
            <span class="badge ${c.status==='active'?'badge-mobile':'badge-cash'}">${c.status}</span>
          </div>
          <div style="font-size:22px;font-weight:800;color:var(--primary)">${fmt(totalIn,c.currency)}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:3px">
            ${contributors.length} contributor${contributors.length!==1?'s':''}
            ${totalOut?` · ${fmt(totalOut,c.currency)} disbursed`:''}
            · via ${x(c.targetWalletName)}
          </div>
          ${c.goalAmount?`
            <div class="bar-wrap" style="margin-top:10px"><div class="bar bar-ok" style="width:${pct}%"></div></div>
            <div style="font-size:11px;color:var(--muted);margin-top:4px">${fmt(totalIn,c.currency)} of ${fmt(c.goalAmount,c.currency)} goal</div>
          `:''}
        </div>`;
    }).join('');
  };
  renderCards(active,'col-active');
  renderCards(closed,'col-closed');
}

function openColDetail(id) {
  _activeColId=id;
  const c=S.collections.find(cl=>cl.id===id); if(!c) return;
  document.getElementById('col-detail-title').textContent=c.name;
  document.getElementById('col-close-btn').textContent=c.status==='active'?'Close Collection':'Re-open Collection';
  renderColEntries(id);
  openModal('m-col-detail');
}

function renderColEntries(id) {
  const c=S.collections.find(cl=>cl.id===id); if(!c) return;
  const entries=S.colEntries.filter(e=>e.collectionId===id);
  const totalIn      = entries.filter(e=>e.type!=='disburse').reduce((s,e)=>s+e.amount,0);
  const totalOut     = entries.filter(e=>e.type==='disburse').reduce((s,e)=>s+e.amount,0);
  const totalCharges = entries.filter(e=>e.type==='disburse').reduce((s,e)=>s+(e.charges||0),0);
  const totalLeft    = entries.filter(e=>e.type==='disburse').reduce((s,e)=>s+e.amount+(e.charges||0),0);
  const net          = totalIn - totalLeft; // remaining in collection wallet
  const extra        = totalLeft - totalIn; // how much beyond collected came from wallet

  document.getElementById('col-detail-stats').innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:${extra>0?'8px':'4px'}">
      <div style="background:#f0fdf4;border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase">Collected</div>
        <div style="font-size:18px;font-weight:800;color:var(--success)">${fmt(totalIn,c.currency)}</div>
      </div>
      <div style="background:#fef2f2;border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase">Sent Out</div>
        <div style="font-size:18px;font-weight:800;color:var(--danger)">${fmt(totalOut,c.currency)}</div>
        ${totalCharges?`<div style="font-size:10px;color:var(--muted);margin-top:2px">+${fmt(totalCharges,c.currency)} charges</div>`:''}
      </div>
      <div style="background:var(--primary-lt);border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase">Remaining</div>
        <div style="font-size:18px;font-weight:800;color:${net<0?'var(--danger)':'var(--primary)'}">${fmt(Math.abs(net),c.currency)}</div>
      </div>
    </div>
    ${extra>0?`<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;font-size:13px;color:#92400e;margin-bottom:4px">
      ⚠️ <strong>${fmt(extra,c.currency)}</strong> extra drawn from wallet beyond what was collected
      ${totalCharges?` (includes ${fmt(totalCharges,c.currency)} in transaction charges)`:''}
    </div>`:''}
    ${net<0&&extra<=0?`<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;font-size:13px;color:#991b1b;margin-bottom:4px">
      ⚠️ Disbursed more than collected — <strong>${fmt(Math.abs(net),c.currency)}</strong> extra used from wallet
    </div>`:''}
    `;

  const tbody=document.getElementById('col-entries-tbody');
  const empty=document.getElementById('col-entries-empty');
  if (!entries.length) { tbody.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display='none';
  const typeLabel={contribution:'Contribution',own:'My Contribution',disburse:'Disbursement'};
  const typeColor={contribution:'var(--success)',own:'var(--warning)',disburse:'var(--danger)'};
  tbody.innerHTML=entries.map(e=>`
    <tr>
      <td>${e.date}</td>
      <td><span style="font-size:11px;font-weight:700;color:${typeColor[e.type]||'var(--muted)'}">${typeLabel[e.type]||e.type}</span></td>
      <td>
        <strong>${x(e.person||e.disburseTo||'Me')}</strong>
        ${e.notes?`<div style="font-size:11px;color:var(--muted)">${x(e.notes)}</div>`:''}
        ${e.walletName?`<div style="font-size:11px;color:var(--muted)">${e.type==='disburse'?'From: ':'Expense from: '}${x(e.walletName)}</div>`:''}
      </td>
      <td style="font-weight:700;color:${e.type==='disburse'?'var(--danger)':'var(--success)'}">
        ${e.type==='disburse'?'-':'+'} ${fmt(e.amount,c.currency)}
        ${(e.type==='disburse'&&e.charges)?`<div style="font-size:11px;color:var(--muted);font-weight:400">+${fmt(e.charges,c.currency)} charges</div>`:''}
      </td>
      <td style="display:flex;gap:6px;padding:11px 14px"><button class="btn btn-ghost btn-sm" onclick="editColEntry('${e.id}')">✏️</button><button class="btn btn-danger btn-sm" onclick="delColEntry('${e.id}','${e.type}','${e.walletId||''}',${e.amount},${e.charges||0},'${c.targetWalletId}')">×</button></td>
    </tr>`).join('');
}

function editColEntry(id) {
  const e=S.colEntries.find(v=>v.id===id); if(!e) return;
  _editColEntId=id;
  // Open modal (which fills wallet dropdown), then override values
  const type=e.type||'contribution';
  const titles={contribution:'Edit Contribution',own:'Edit My Contribution',disburse:'Edit Disbursement'};
  // Set up visibility same as openColEntry
  document.getElementById('ce-type').value=type;
  document.getElementById('col-entry-title').textContent=titles[type]||'Edit Entry';
  document.getElementById('ce-person-row').style.display=(type==='contribution')?'block':'none';
  document.getElementById('ce-wallet-row').style.display=(type!=='contribution')?'block':'none';
  document.getElementById('ce-wallet-lbl').textContent=type==='own'?'Deduct from My Wallet':'Deduct from Wallet';
  document.getElementById('ce-charges-row').style.display=(type==='disburse')?'block':'none';
  document.getElementById('ce-save-btn').textContent=type==='disburse'?'Update Disbursement':'Update';
  openModal('m-col-entry'); // calls fillColEntryModal() which resets wallet dropdown
  // Now override with existing values
  document.getElementById('ce-type').value=type;
  document.getElementById('ce-amount').value=e.amount||'';
  document.getElementById('ce-date').value=e.date||'';
  document.getElementById('ce-notes').value=e.notes||'';
  document.getElementById('ce-person').value=e.person||'';
  document.getElementById('ce-wallet').value=e.walletId||'';
  document.getElementById('ce-charges').value=e.charges||0;
  // Lock type select in edit mode
  document.getElementById('ce-type').disabled=true;
}

function fillColEntryModal() {
  const opts=S.wallets.map(w=>`<option value="${w.id}">${x(w.entityName)}${w.name?' · '+w.name:''} (${w.currency})</option>`).join('');
  document.getElementById('ce-wallet').innerHTML='<option value="">— Select wallet —</option>'+opts;
  document.getElementById('ce-date').value=new Date().toISOString().split('T')[0];
}

function openColEntry(type) {
  document.getElementById('ce-type').value=type;
  const titles={contribution:'Add Contribution',own:'My Contribution (Expense)',disburse:'Disburse / Send Out'};
  document.getElementById('col-entry-title').textContent=titles[type];
  // show/hide fields by type
  document.getElementById('ce-person-row').style.display=(type==='contribution')?'block':'none';
  document.getElementById('ce-wallet-row').style.display=(type!=='contribution')?'block':'none';
  document.getElementById('ce-wallet-lbl').textContent=type==='own'?'Deduct from My Wallet':'Deduct from Wallet';
  document.getElementById('ce-charges-row').style.display=(type==='disburse')?'block':'none';
  document.getElementById('ce-charges').value='0';
  document.getElementById('ce-save-btn').textContent=type==='disburse'?'Record Disbursement':'Save';
  document.getElementById('ce-date').value=new Date().toISOString().split('T')[0];
  openModal('m-col-entry');
}

async function saveColEntry() {
  const type=document.getElementById('ce-type').value;
  const amount=parseFloat(document.getElementById('ce-amount').value)||0;
  const charges=type==='disburse'?(parseFloat(document.getElementById('ce-charges').value)||0):0;
  const date=document.getElementById('ce-date').value;
  const notes=document.getElementById('ce-notes').value.trim();
  const person=document.getElementById('ce-person').value.trim();
  const walId=document.getElementById('ce-wallet').value;
  if (!amount) return toast('Enter amount');
  if (!date)   return toast('Select date');
  if (type==='contribution' && !person) return toast('Enter contributor name');
  if ((type==='own'||type==='disburse') && !walId) return toast('Select a wallet');

  const col_=S.collections.find(c=>c.id===_activeColId); if(!col_) return;
  const wal=walId?S.wallets.find(w=>w.id===walId):null;

  if (_editColEntId) {
    const old=S.colEntries.find(v=>v.id===_editColEntId); if(!old) return;
    const b=db.batch();
    b.update(col('col_entries').doc(_editColEntId),{
      amount,charges,date,notes,
      person: type==='contribution'?person:'Me',
      walletId:walId||'', walletName:wal?.entityName||''
    });
    // Reverse old wallet effect
    if (old.type==='contribution' && col_.targetWalletId) b.update(col('wallets').doc(col_.targetWalletId),{balance:INC(-old.amount)});
    else if (old.type==='own' && old.walletId)            b.update(col('wallets').doc(old.walletId),{balance:INC(old.amount)});
    else if (old.type==='disburse' && old.walletId)       b.update(col('wallets').doc(old.walletId),{balance:INC(old.amount+(old.charges||0))});
    // Apply new wallet effect
    if (type==='contribution') b.update(col('wallets').doc(col_.targetWalletId),{balance:INC(amount)});
    else if (type==='own' && walId) b.update(col('wallets').doc(walId),{balance:INC(-amount)});
    else if (type==='disburse' && walId) b.update(col('wallets').doc(walId),{balance:INC(-(amount+charges))});
    await b.commit();
    _editColEntId=null;
    document.getElementById('ce-type').disabled=false;
    toast('Updated'); closeModal('m-col-entry'); await loadAll();
    renderColEntries(_activeColId); renderCollections();
    return;
  }

  const b=db.batch();

  b.set(col('col_entries').doc(),{
    collectionId:_activeColId,type,amount,charges,date,notes,
    person: type==='contribution'?person:'Me',
    walletId:walId||'', walletName:wal?.entityName||'',
    createdAt:TS()
  });

  if (type==='contribution') {
    b.update(col('wallets').doc(col_.targetWalletId),{balance:INC(amount)});
  } else if (type==='own') {
    if (wal && amount>wal.balance) return toast('Insufficient wallet balance');
    b.update(col('wallets').doc(walId),{balance:INC(-amount)});
  } else if (type==='disburse') {
    const total=amount+charges;
    if (!walId) return toast('Please select a wallet');
    b.update(col('wallets').doc(walId),{balance:INC(-total)});
  }

  await b.commit(); toast('Saved'); closeModal('m-col-entry'); await loadAll();
  renderColEntries(_activeColId); renderCollections();
}

async function delColEntry(id,type,walId,amount,charges,targetWalId) {
  if (!confirm('Delete this entry? Wallet balances will be reversed.')) return;
  const b=db.batch(); b.delete(col('col_entries').doc(id));
  if (type==='contribution' && targetWalId) b.update(col('wallets').doc(targetWalId),{balance:INC(-amount)});
  else if (type==='own' && walId)           b.update(col('wallets').doc(walId),{balance:INC(amount)});
  else if (type==='disburse' && walId)      b.update(col('wallets').doc(walId),{balance:INC(amount+(charges||0))});
  await b.commit(); toast('Entry deleted'); await loadAll();
  renderColEntries(_activeColId); renderCollections();
}

async function toggleCloseCollection() {
  const c=S.collections.find(cl=>cl.id===_activeColId); if(!c) return;
  const newStatus=c.status==='active'?'closed':'active';
  await col('collections').doc(_activeColId).update({status:newStatus});
  toast(newStatus==='closed'?'Collection closed':'Collection re-opened');
  await loadAll(); renderCollections(); closeModal('m-col-detail');
}
