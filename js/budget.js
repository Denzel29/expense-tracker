// ──────────────────────────────────────────────────────────
// budget.js
// Monthly spending limits per category. Shows a progress bar
// (green/amber/red) comparing actual spend (from expenses) to
// the limit, converting currencies via FX when needed.
// ──────────────────────────────────────────────────────────

function editBudget(id) {
  const b=S.budgets.find(v=>v.id===id); if(!b) return;
  _editBudgetId=id;
  document.getElementById('b-category').value=b.category||'';
  document.getElementById('b-limit').value=b.limit||'';
  document.getElementById('b-currency').value=b.currency||'USD';
  document.querySelector('#m-budget .mh-title').textContent='Edit Budget';
  document.querySelector('#m-budget .mf .btn-primary').textContent='Update Budget';
  document.getElementById('m-budget').classList.add('open');
}

async function saveBudget() {
  const cat=document.getElementById('b-category').value.trim();
  const limit=parseFloat(document.getElementById('b-limit').value)||0;
  const cur=document.getElementById('b-currency').value;
  if (!cat)   return toast('Enter category');
  if (!limit) return toast('Enter limit');
  if (_editBudgetId) {
    await col('budgets').doc(_editBudgetId).update({category:cat,limit,currency:cur});
    _editBudgetId=null;
    document.querySelector('#m-budget .mh-title').textContent='Set Budget';
    document.querySelector('#m-budget .mf .btn-primary').textContent='Save Budget';
    toast('Budget updated'); closeModal('m-budget'); await loadAll(); renderBudget();
    return;
  }
  const existing=S.budgets.find(b=>b.category.toLowerCase()===cat.toLowerCase());
  if (existing) { await col('budgets').doc(existing.id).update({limit,currency:cur}); toast('Budget updated'); }
  else          { await col('budgets').add({category:cat,limit,currency:cur,createdAt:TS()}); toast('Budget added'); }
  closeModal('m-budget'); await loadAll(); renderBudget();
}

function renderBudget() {
  const list=document.getElementById('budget-list');
  const cats=[...new Set(S.expenses.map(e=>e.category).filter(Boolean))];
  document.getElementById('b-cat-list').innerHTML=cats.map(c=>`<option value="${x(c)}">`).join('');
  if (!S.budgets.length) {
    list.innerHTML=`<div class="empty" style="grid-column:1/-1"><div class="empty-icon">📊</div><div class="empty-title">No budgets set</div><div>Add spending limits per category</div></div>`;
    renderRecurring();
    return;
  }
  const now=new Date();
  const monthStr=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  list.innerHTML=S.budgets.map(b=>{
    const spent=spentInBudgetCurrency(b.category, b.currency, monthStr);
    const pct=Math.min((spent/b.limit)*100,100);
    const barCls=pct>=100?'bar-over':pct>=80?'bar-warn':'bar-ok';
    // Check if any expense in this category uses a different currency (to show conversion note)
    const hasMixed=S.expenses.some(e=>e.category?.toLowerCase()===b.category.toLowerCase()&&e.date?.startsWith(monthStr)&&e.currency!==b.currency);
    return `
      <div class="card cp">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
          <div><div style="font-weight:800;font-size:15px">${x(b.category)}</div><div style="font-size:11px;color:var(--muted)">Monthly · ${b.currency}${hasMixed?' · converted':''}</div></div>
          <button class="btn btn-ghost btn-sm" onclick="editBudget('${b.id}')">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="delBudget('${b.id}')">×</button>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
          <span style="color:var(--muted)">Spent</span>
          <span><strong>${fmt(spent,b.currency)}</strong> / ${fmt(b.limit,b.currency)}</span>
        </div>
        <div class="bar-wrap"><div class="bar ${barCls}" style="width:${pct}%"></div></div>
        <div style="font-size:11px;color:${pct>=100?'var(--danger)':'var(--muted)'};margin-top:6px;text-align:right">
          ${pct>=100?`⚠️ Over by ${fmt(spent-b.limit,b.currency)}`:`${fmt(b.limit-spent,b.currency)} left`}
        </div>
      </div>`;
  }).join('');
  renderRecurring();
}

async function delBudget(id) { await col('budgets').doc(id).delete(); toast('Budget removed'); await loadAll(); renderBudget(); }
