// ──────────────────────────────────────────────────────────
// expenses.js
// Daily expense tracking with category filtering, month picker,
// and template quick-fill. Also merges in collection entries
// (own contributions + wallet overages) for a full spending view.
// ──────────────────────────────────────────────────────────

function fillExpenseModal() {
  const wo=S.wallets.map(w=>`<option value="${w.id}">${x(w.entityName)}${w.name?' · '+w.name:''} (${w.currency})</option>`).join('');
  document.getElementById('e-wallet').innerHTML='<option value="">— Select wallet —</option>'+wo;
  const to=S.templates.map(t=>`<option value="${t.id}">${x(t.name)} · ${x(t.category)} (${num(t.defaultAmount)})</option>`).join('');
  document.getElementById('e-template').innerHTML='<option value="">— or fill manually below —</option>'+to;
  const cats=[...new Set(S.expenses.map(e=>e.category).filter(Boolean))];
  document.getElementById('e-cat-list').innerHTML=cats.map(c=>`<option value="${x(c)}">`).join('');
  document.getElementById('e-date').value=new Date().toISOString().split('T')[0];
  document.getElementById('e-charges').value='0';
}

function openExpenseModal() { openModal('m-expense'); }

function editExpense(id) {
  const e=S.expenses.find(v=>v.id===id); if(!e) return;
  _editExpId=id;
  fillExpenseModal();
  document.getElementById('m-expense').classList.add('open');
  document.getElementById('e-name').value=e.name||'';
  document.getElementById('e-category').value=e.category||'';
  document.getElementById('e-amount').value=e.amount||'';
  document.getElementById('e-charges').value=e.charges||0;
  document.getElementById('e-wallet').value=e.walletId||'';
  document.getElementById('e-date').value=e.date||'';
  document.querySelector('#m-expense .mh-title').textContent='Edit Expense';
  document.querySelector('#m-expense .mf .btn-primary').textContent='Update Expense';
}

function fillTemplate() {
  const id=document.getElementById('e-template').value;
  const tpl=S.templates.find(t=>t.id===id); if(!tpl) return;
  document.getElementById('e-name').value=tpl.name;
  document.getElementById('e-category').value=tpl.category;
  document.getElementById('e-amount').value=tpl.defaultAmount;
  if (tpl.defaultCharges) document.getElementById('e-charges').value=tpl.defaultCharges;
}

async function saveExpense() {
  const name=document.getElementById('e-name').value.trim();
  const cat=document.getElementById('e-category').value.trim();
  const amount=parseFloat(document.getElementById('e-amount').value)||0;
  const charges=parseFloat(document.getElementById('e-charges').value)||0;
  const walId=document.getElementById('e-wallet').value;
  const date=document.getElementById('e-date').value;
  const saveTpl=document.getElementById('e-save-tpl').checked;
  if (!name)   return toast('Enter description');
  if (!amount) return toast('Enter amount');
  if (!walId)  return toast('Select a wallet');
  if (!date)   return toast('Select a date');
  if (_editExpId) {
    const old=S.expenses.find(v=>v.id===_editExpId); if(!old) return;
    const wal=S.wallets.find(w=>w.id===walId);
    const b=db.batch();
    b.update(col('expenses').doc(_editExpId),{name,category:cat,amount,charges,walletId:walId,walletName:wal.entityName,currency:wal.currency,date});
    if (old.walletId) b.update(col('wallets').doc(old.walletId),{balance:INC(old.amount+(old.charges||0))});
    b.update(col('wallets').doc(walId),{balance:INC(-(amount+charges))});
    await b.commit();
    _editExpId=null;
    document.querySelector('#m-expense .mh-title').textContent='Add Expense';
    document.querySelector('#m-expense .mf .btn-primary').textContent='Save Expense';
    toast('Expense updated'); closeModal('m-expense'); await loadAll(); renderExpenses();
    return;
  }
  const wal=S.wallets.find(w=>w.id===walId);
  if ((amount+charges)>wal.balance) return toast('Insufficient wallet balance');
  const b=db.batch();
  b.set(col('expenses').doc(),{name,category:cat,amount,charges,walletId:walId,walletName:wal.entityName,currency:wal.currency,date,createdAt:TS()});
  b.update(col('wallets').doc(walId),{balance:INC(-(amount+charges))});
  if (saveTpl && !S.templates.find(t=>t.name.toLowerCase()===name.toLowerCase())) {
    b.set(col('templates').doc(),{name,category:cat,defaultAmount:amount,defaultCharges:charges});
  }
  await b.commit();
  // Auto-template: if this exact expense (name+amount+wallet) has now occurred 5+ times, save/update template with charges
  const matchingExpenses=S.expenses.filter(e=>e.name?.toLowerCase()===name.toLowerCase()&&e.amount===amount&&e.walletId===walId);
  if (matchingExpenses.length>=4) { // 4 in history + this one = 5
    const existing=S.templates.find(t=>t.name.toLowerCase()===name.toLowerCase());
    if (existing) {
      // Update charges if they differ
      if (existing.defaultCharges!==charges) await col('templates').doc(existing.id).update({defaultCharges:charges});
    } else {
      await col('templates').doc().set({name,category:cat,defaultAmount:amount,defaultCharges:charges});
      toast('Template auto-saved (5+ repeats detected)');
    }
  }
  toast('Expense saved'); closeModal('m-expense'); await loadAll(); renderExpenses();
}

function toggleCat(cat) {
  const i=_activeCats.indexOf(cat);
  if(i>=0) _activeCats.splice(i,1); else _activeCats.push(cat);
  renderExpenses();
}

function renderExpenses() {
  const month=document.getElementById('exp-month')?.value;

  // Build virtual rows from collection entries
  const colMap = Object.fromEntries(S.collections.map(c=>[c.id,c]));
  const walMap = Object.fromEntries(S.wallets.map(w=>[w.id,w]));

  // 1. My own contributions to collections (already deducted from wallet when saved)
  let ownRows = S.colEntries.filter(e=>e.type==='own').map(e=>{
    const cl=colMap[e.collectionId]||{}; const wl=walMap[e.walletId]||{};
    return {_v:'own', id:e.id, colId:e.collectionId, date:e.date,
      name:'Contribution – '+(cl.name||'Collection'), category:'Collections',
      walletName:(wl.entityName||'')+(wl.name?' · '+wl.name:''), currency:cl.currency, amount:e.amount};
  });

  // 2. Wallet overage per collection: when (disbursed+charges) > total contributed
  const byCol={};
  for (const e of S.colEntries) { (byCol[e.collectionId]||(byCol[e.collectionId]=[])).push(e); }
  let exceedRows=[];
  for (const [colId,entries] of Object.entries(byCol)) {
    const cl=colMap[colId]; if(!cl) continue;
    const totalIn  = entries.filter(e=>e.type!=='disburse').reduce((s,e)=>s+e.amount,0);
    const totalOut = entries.filter(e=>e.type==='disburse').reduce((s,e)=>s+e.amount+(e.charges||0),0);
    const extra=totalOut-totalIn; if(extra<=0) continue;
    const lastD=[...entries].filter(e=>e.type==='disburse').sort((a,b)=>b.date.localeCompare(a.date))[0];
    const wl=lastD?(walMap[lastD.walletId]||{}):{};
    exceedRows.push({_v:'exceed', id:'xc-'+colId, colId, date:lastD?.date||'',
      name:'Wallet overage – '+(cl.name||'Collection'), category:'Collections',
      walletName:(wl.entityName||'')+(wl.name?' · '+wl.name:''), currency:cl.currency, amount:extra});
  }

  // Apply filters
  let base=S.expenses;
  if (month) {
    base     = base.filter(e=>e.date?.startsWith(month));
    ownRows  = ownRows.filter(e=>e.date?.startsWith(month));
    exceedRows = exceedRows.filter(e=>e.date?.startsWith(month));
  }
  const hasCollectionRows = ownRows.length>0||exceedRows.length>0;
  const allCats=[...new Set([...S.expenses.map(e=>e.category), ...(hasCollectionRows?['Collections']:[])].filter(Boolean))];
  if (_activeCats.length) {
    base=base.filter(e=>_activeCats.includes(e.category));
    if (!_activeCats.includes('Collections')) { ownRows=[]; exceedRows=[]; }
  }

  const allRows=[...base,...ownRows,...exceedRows].sort((a,b)=>(b.date||'').localeCompare(a.date||''));

  document.getElementById('cat-chips').innerHTML=allCats.map(c=>
    `<div class="chip${_activeCats.includes(c)?' on':''}" onclick="toggleCat('${x(c)}')">${x(c)}</div>`).join('');

  // Expense summary bar
  const sumByCur={};
  allRows.forEach(e=>{ sumByCur[e.currency]=(sumByCur[e.currency]||0)+e.amount; });
  const periodLabel = month ? (() => { const [y,m]=month.split('-'); return new Date(y,m-1).toLocaleString('default',{month:'long',year:'numeric'}); })() : 'All time';
  const summaryEl = document.getElementById('exp-summary');
  if (summaryEl) {
    if (allRows.length) {
      summaryEl.innerHTML=`<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px">`+
        Object.entries(sumByCur).map(([cur,total])=>`
          <div style="background:var(--primary-lt);border-radius:10px;padding:10px 16px;display:flex;align-items:center;gap:10px">
            <span style="font-size:12px;color:var(--primary);font-weight:700">${periodLabel}</span>
            <span style="font-size:18px;font-weight:800;color:var(--danger)">-${fmt(total,cur)}</span>
            <span style="font-size:11px;color:var(--muted)">${allRows.filter(e=>e.currency===cur).length} item${allRows.filter(e=>e.currency===cur).length!==1?'s':''}</span>
          </div>`).join('')+
        `</div>`;
    } else { summaryEl.innerHTML=''; }
  }

  const tbody=document.getElementById('tb-expenses');
  const empty=document.getElementById('expenses-empty');
  const tbl=document.getElementById('t-expenses');
  if (!allRows.length) { tbody.innerHTML=''; tbl.style.display='none'; empty.style.display='block'; return; }
  tbl.style.display='table'; empty.style.display='none';

  tbody.innerHTML=allRows.map(e=>{
    if (e._v==='own') return `
      <tr style="background:#f0fdf4">
        <td>${e.date}</td>
        <td><strong>${x(e.name)}</strong></td>
        <td><span style="background:#dcfce7;color:#166534;font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px">Collections</span></td>
        <td style="font-size:12px;color:var(--muted)">${x(e.walletName)}</td>
        <td class="red" style="font-weight:600">-${fmt(e.amount,e.currency)}</td>
        <td>—</td>
        <td style="font-size:10px;color:var(--muted);font-style:italic">from collection</td>
      </tr>`;
    if (e._v==='exceed') return `
      <tr style="background:#fffbeb">
        <td>${e.date}</td>
        <td><strong>${x(e.name)}</strong></td>
        <td><span style="background:#fef3c7;color:#92400e;font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px">Collections</span></td>
        <td style="font-size:12px;color:var(--muted)">${x(e.walletName)}</td>
        <td class="red" style="font-weight:600">-${fmt(e.amount,e.currency)}</td>
        <td>—</td>
        <td style="font-size:10px;color:var(--muted);font-style:italic">wallet overage</td>
      </tr>`;
    return `
      <tr>
        <td>${e.date}</td>
        <td><strong>${x(e.name)}</strong></td>
        <td><span style="background:#f3f4f6;color:#374151;font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px">${x(e.category)||'—'}</span></td>
        <td style="font-size:12px;color:var(--muted)">${x(e.walletName)}</td>
        <td class="red" style="font-weight:600">-${fmt(e.amount,e.currency)}</td>
        <td style="color:var(--muted);font-size:12px">${e.charges?fmt(e.charges,e.currency):'—'}</td>
        <td style="display:flex;gap:6px;padding:11px 14px"><button class="btn btn-ghost btn-sm" onclick="editExpense('${e.id}')">✏️</button><button class="btn btn-danger btn-sm" onclick="delExpense('${e.id}','${e.walletId}',${e.amount},${e.charges||0})">×</button></td>
      </tr>`;
  }).join('');
}

async function delExpense(id,walId,amount,charges) {
  if (!confirm('Delete this expense? Balance will be restored.')) return;
  const b=db.batch(); b.delete(col('expenses').doc(id));
  if (walId) b.update(col('wallets').doc(walId),{balance:INC(amount+(charges||0))});
  await b.commit(); toast('Expense deleted'); await loadAll(); renderExpenses();
}
