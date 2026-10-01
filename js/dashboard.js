// ──────────────────────────────────────────────────────────
// dashboard.js
// The home screen overview: wallet totals, investment totals,
// monthly spending by category (navigable), an all-time
// category bar chart, recent activity feed, budget progress,
// and recurring payment reminders.
// ──────────────────────────────────────────────────────────

function renderDashboard() {
  // Wallet totals per currency
  const wTotals={};
  S.wallets.forEach(w=>{wTotals[w.currency]=(wTotals[w.currency]||0)+w.balance;});

  // Investment totals per currency
  const invTotals={};
  S.investments.forEach(inv=>{invTotals[inv.currency]=(invTotals[inv.currency]||0)+inv.totalCost;});

  // Outstanding debts per currency
  const lentTotals={};
  S.debts.filter(d=>!d.settled&&d.type==='lent').forEach(d=>{lentTotals[d.currency]=(lentTotals[d.currency]||0)+d.amount;});

  const statsEl=document.getElementById('dash-stats');
  const walletStats=Object.entries(wTotals).map(([c,v])=>`
    <div class="stat">
      <div class="stat-lbl">💳 Wallets ${c}</div>
      <div class="stat-val">${fmt(v,c)}</div>
      <div class="stat-sub">${S.wallets.filter(w=>w.currency===c).length} wallet(s)</div>
    </div>`);
  const invStats=Object.entries(invTotals).map(([c,v])=>`
    <div class="stat">
      <div class="stat-lbl">📈 Invested ${c}</div>
      <div class="stat-val" style="color:var(--primary)">${fmt(v,c)}</div>
      <div class="stat-sub">${S.investments.filter(i=>i.currency===c).length} transaction(s)</div>
    </div>`);
  const lentStats=Object.entries(lentTotals).map(([c,v])=>`
    <div class="stat">
      <div class="stat-lbl">🤝 Lent Out ${c}</div>
      <div class="stat-val" style="color:var(--warning)">${fmt(v,c)}</div>
      <div class="stat-sub">${S.debts.filter(d=>!d.settled&&d.type==='lent'&&d.currency===c).length} outstanding</div>
    </div>`);

  // Category spending breakdown — uses _dashMonth (navigable)
  const mStr=_dashMonth;
  const [_my,_mm]=mStr.split('-').map(Number);
  const mLabel=new Date(_my,_mm-1,1).toLocaleString('default',{month:'long',year:'numeric'});
  const mLabelEl=document.getElementById('dash-month-label');
  if (mLabelEl) mLabelEl.textContent=mLabel;
  const mExpenses=S.expenses.filter(e=>e.date?.startsWith(mStr));

  // Collection spending this month (own contributions + wallet overages)
  const _colMap=Object.fromEntries(S.collections.map(c=>[c.id,c]));
  const mColOwn=S.colEntries.filter(e=>e.type==='own'&&e.date?.startsWith(mStr));
  const _byCol={};
  for (const e of S.colEntries) { (_byCol[e.collectionId]||(_byCol[e.collectionId]=[])).push(e); }
  const mColOverages=[];
  for (const [cid,entries] of Object.entries(_byCol)) {
    const cl=_colMap[cid]; if(!cl) continue;
    const tIn=entries.filter(e=>e.type!=='disburse').reduce((s,e)=>s+e.amount,0);
    const tOut=entries.filter(e=>e.type==='disburse').reduce((s,e)=>s+e.amount+(e.charges||0),0);
    const extra=tOut-tIn; if(extra<=0) continue;
    const lastD=[...entries].filter(e=>e.type==='disburse').sort((a,b)=>b.date.localeCompare(a.date))[0];
    if (lastD?.date?.startsWith(mStr)) mColOverages.push({amount:extra,currency:cl.currency});
  }

  // Total expenses this month (regular + collections) per currency
  const expTotals={};
  mExpenses.forEach(e=>{ if(e.currency) expTotals[e.currency]=(expTotals[e.currency]||0)+e.amount+(e.charges||0); });
  mColOwn.forEach(e=>{ const cur=(_colMap[e.collectionId]||{}).currency||''; if(cur) expTotals[cur]=(expTotals[cur]||0)+e.amount; });
  mColOverages.forEach(e=>{ if(e.currency) expTotals[e.currency]=(expTotals[e.currency]||0)+e.amount; });
  const expStats=Object.entries(expTotals).map(([c,v])=>`
    <div class="stat">
      <div class="stat-lbl">💸 Spent ${mLabel}</div>
      <div class="stat-val" style="color:var(--danger)">${fmt(v,c)}</div>
      <div class="stat-sub">${mExpenses.filter(e=>e.currency===c).length + mColOwn.filter(e=>(_colMap[e.collectionId]||{}).currency===c).length} expense(s)</div>
    </div>`);
  statsEl.innerHTML=[...walletStats,...invStats,...lentStats,...expStats].join('')||`<div class="stat"><div class="stat-lbl">No data yet</div><div class="stat-val">—</div></div>`;

  const catTotals={};
  mExpenses.forEach(e=>{
    const cat=e.category||'Uncategorized';
    if(!catTotals[cat]) catTotals[cat]={amount:0,currency:e.currency};
    catTotals[cat].amount+=e.amount+(e.charges||0);
  });
  // Add collection own contributions under "Collections" category
  mColOwn.forEach(e=>{
    const cl=_colMap[e.collectionId]||{};
    if(!catTotals['Collections']) catTotals['Collections']={amount:0,currency:cl.currency||''};
    catTotals['Collections'].amount+=e.amount;
  });
  // Add wallet overages under "Collections" category
  mColOverages.forEach(e=>{
    if(!catTotals['Collections']) catTotals['Collections']={amount:0,currency:e.currency};
    catTotals['Collections'].amount+=e.amount;
  });
  const catEntries=Object.entries(catTotals).sort((a,b)=>b[1].amount-a[1].amount);
  const dashCats=document.getElementById('dash-categories');
  if (dashCats) {
    if (!catEntries.length) {
      dashCats.innerHTML='<div style="color:var(--muted);font-size:13px;padding:8px 0;text-align:center">No expenses recorded this month</div>';
    } else {
      dashCats.innerHTML='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px">'+
        catEntries.map(([cat,data])=>{
          const budget=S.budgets.find(b=>b.category.toLowerCase()===cat.toLowerCase()&&b.currency===data.currency);
          let border='var(--border)', badge='', bgTint='var(--surface)';
          if (budget) {
            const pct=(data.amount/budget.limit)*100;
            if (pct>=100) { border='var(--danger)'; bgTint='#fff5f5'; badge=`<div style="font-size:10px;font-weight:700;color:var(--danger);margin-top:4px">⚠️ Over by ${fmt(data.amount-budget.limit,data.currency)}</div>`; }
            else if (pct>=80) { border='var(--warning)'; bgTint='#fffbeb'; badge=`<div style="font-size:10px;font-weight:700;color:var(--warning);margin-top:4px">⚡ ${Math.round(pct)}% of budget</div>`; }
            else { badge=`<div style="font-size:10px;color:var(--muted);margin-top:4px">${fmt(budget.limit-data.amount,data.currency)} left</div>`; }
          }
          return `<div style="padding:12px;border-radius:10px;border:1.5px solid ${border};background:${bgTint}">
            <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">${x(cat)}</div>
            <div style="font-size:18px;font-weight:800;margin-top:3px">${fmt(data.amount,data.currency)}</div>
            ${budget?`<div style="font-size:10px;color:var(--muted)">Budget ${fmt(budget.limit,budget.currency)}</div>`:''}
            ${badge}
          </div>`;
        }).join('')+'</div>';
    }
  }

  // All-time category chart
  const allCatTotals={};
  S.expenses.forEach(e=>{
    const cat=e.category||'Uncategorized';
    if(!allCatTotals[cat]) allCatTotals[cat]={};
    allCatTotals[cat][e.currency]=(allCatTotals[cat][e.currency]||0)+e.amount+(e.charges||0);
  });
  // Include own collection contributions all-time
  S.colEntries.filter(e=>e.type==='own').forEach(e=>{
    const cl=_colMap[e.collectionId]||{}; const cur=cl.currency||'';
    if(!cur) return;
    if(!allCatTotals['Collections']) allCatTotals['Collections']={};
    allCatTotals['Collections'][cur]=(allCatTotals['Collections'][cur]||0)+e.amount;
  });
  const chartEl=document.getElementById('dash-cat-chart');
  const chartLbl=document.getElementById('dash-chart-label');
  if (chartEl) {
    const entries=Object.entries(allCatTotals);
    if (!entries.length) {
      chartEl.innerHTML='<div style="color:var(--muted);font-size:13px;padding:8px 0;text-align:center">No expense data yet</div>';
    } else {
      // Pick primary currency (most common across expenses)
      const curCount={};
      S.expenses.forEach(e=>{ curCount[e.currency]=(curCount[e.currency]||0)+1; });
      const primaryCur=Object.entries(curCount).sort((a,b)=>b[1]-a[1])[0]?.[0]||'';
      if (chartLbl) chartLbl.textContent=primaryCur;
      // Build sorted list by total in primary currency
      const sorted=entries.map(([cat,byCur])=>({cat,total:byCur[primaryCur]||0}))
        .filter(d=>d.total>0).sort((a,b)=>b.total-a.total);
      if (!sorted.length) { chartEl.innerHTML='<div style="color:var(--muted);font-size:13px;padding:8px 0;text-align:center">No data in primary currency</div>'; }
      else {
        const maxVal=sorted[0].total;
        // Colour palette
        const colours=['#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16'];
        const grandTotal=sorted.reduce((s,d)=>s+d.total,0);
        chartEl.innerHTML=`
          <div style="margin-bottom:16px">
            ${sorted.map((d,i)=>{
              const pct=Math.round((d.total/grandTotal)*100);
              const barW=Math.round((d.total/maxVal)*100);
              const col=colours[i%colours.length];
              return `<div style="margin-bottom:10px">
                <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
                  <span style="font-weight:600;color:#374151">${x(d.cat)}</span>
                  <span style="color:var(--muted)">${fmt(d.total,primaryCur)} · <strong>${pct}%</strong></span>
                </div>
                <div style="background:#f3f4f6;border-radius:999px;height:10px;overflow:hidden">
                  <div style="background:${col};width:${barW}%;height:100%;border-radius:999px;transition:width .4s"></div>
                </div>
              </div>`;
            }).join('')}
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px">
            ${sorted.map((d,i)=>`<span style="display:flex;align-items:center;gap:4px;font-size:11px"><span style="width:10px;height:10px;border-radius:50%;background:${colours[i%colours.length]};display:inline-block"></span>${x(d.cat)}</span>`).join('')}
          </div>`;
      }
    }
  }

  // Recent activity
  const expRows=S.expenses.slice(0,4).map(e=>({sort:e.date,icon:'💸',bg:'#fef9f0',name:e.name,meta:`${e.category||'Expense'} · ${e.date}`,amt:`-${fmt(e.amount,e.currency)}`,cls:'red'}));
  const trRows=S.transfers.slice(0,3).map(t=>({sort:t.date,icon:'🔄',bg:'#eff6ff',name:`${t.fromName} → ${t.toName}`,meta:`Transfer · ${t.date}`,amt:num(t.amount),cls:''}));
  const divRows=S.dividends.slice(0,2).map(d=>({sort:d.date,icon:'💵',bg:'#f0fdf4',name:d.assetName,meta:`Dividend · ${d.date}`,amt:`+${fmt(d.amount,d.currency)}`,cls:'green'}));
  const incRows=S.income.slice(0,3).map(i=>({sort:i.date,icon:'💰',bg:'#f0fdf4',name:i.source||'Income',meta:`${x(i.walletName)} · ${i.date}`,amt:`+${fmt(i.amount,i.currency)}`,cls:'green'}));
  const colOwnRows=S.colEntries.filter(e=>e.type==='own').slice(0,3).map(e=>{
    const cl=_colMap[e.collectionId]||{}; return {sort:e.date,icon:'🫙',bg:'#f0fdf4',name:'Collection: '+(cl.name||'—'),meta:`My contribution · ${e.date}`,amt:`-${fmt(e.amount,cl.currency||'')}`,cls:'red'};
  });
  const colDisburseRows=S.colEntries.filter(e=>e.type==='disburse').slice(0,2).map(e=>{
    const cl=_colMap[e.collectionId]||{}; return {sort:e.date,icon:'🫙',bg:'#fef2f2',name:'Disbursed: '+(cl.name||'—'),meta:`Collection · ${e.date}`,amt:`-${fmt(e.amount+(e.charges||0),cl.currency||'')}`,cls:'red'};
  });
  const recent=[...expRows,...trRows,...divRows,...incRows,...colOwnRows,...colDisburseRows].sort((a,b)=>b.sort>a.sort?1:-1).slice(0,6);
  document.getElementById('dash-recent').innerHTML=recent.length
    ?recent.map(r=>`
      <div class="recent-row">
        <div class="rr-left">
          <div class="rr-icon" style="background:${r.bg}">${r.icon}</div>
          <div><div class="rr-name">${x(r.name)}</div><div class="rr-meta">${x(r.meta)}</div></div>
        </div>
        <div class="rr-amt ${r.cls}">${r.amt}</div>
      </div>`).join('')
    :'<div style="color:var(--muted);font-size:13px;padding:20px 0;text-align:center">No recent activity</div>';

  // Budget mini (uses same _dashMonth as category view)
  document.getElementById('dash-budget').innerHTML=S.budgets.length
    ?S.budgets.map(b=>{
        const spent=spentInBudgetCurrency(b.category, b.currency, mStr);
        const pct=Math.min((spent/b.limit)*100,100);
        const barCls=pct>=100?'bar-over':pct>=80?'bar-warn':'bar-ok';
        return `<div style="margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
            <strong>${x(b.category)}</strong><span style="color:var(--muted)">${fmt(spent,b.currency)} / ${fmt(b.limit,b.currency)}</span>
          </div>
          <div class="bar-wrap"><div class="bar ${barCls}" style="width:${pct}%"></div></div>
        </div>`;
      }).join('')
    :'<div style="color:var(--muted);font-size:13px;padding:20px 0;text-align:center">No budgets set</div>';

  // Recurring reminders
  const now = new Date();
  const dashRec = document.getElementById('dash-recurring');
  const dashRecCard = document.getElementById('dash-recurring-card');
  if (dashRec) {
    const today = now.getDate();
    const thisMonthStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const dueItems = S.recurring.filter(r => {
      const paidThisMonth = r.lastPaidDate && r.lastPaidDate.startsWith(thisMonthStr);
      return !paidThisMonth;
    }).sort((a,b)=>a.dayOfMonth-b.dayOfMonth);
    if (dashRecCard) dashRecCard.style.display = dueItems.length ? 'block' : 'none';
    if (!dueItems.length) {
      dashRec.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:8px 0">All recurring payments settled this month 🎉</div>';
    } else {
      dashRec.innerHTML = dueItems.map(r => {
        const overdue = today >= r.dayOfMonth;
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
          <div>
            <div style="font-weight:700;font-size:13px">${x(r.description)}</div>
            <div style="font-size:11px;color:${overdue?'var(--danger)':'var(--muted)'}">${overdue?'⚠️ Due on the ':'📅 Due on the '}${r.dayOfMonth}${ordinal(r.dayOfMonth)} · ${fmt(r.amount,r.currency)}</div>
          </div>
          <button class="btn btn-success btn-sm" onclick="openPayRecurring('${r.id}')">Pay</button>
        </div>`;
      }).join('');
    }
  }
}
