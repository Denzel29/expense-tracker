// ──────────────────────────────────────────────────────────
// templates.js
// Reusable expense templates: render the template list,
// edit an existing template, and delete templates.
// Templates can be created manually or auto-saved when an
// expense recurs 5+ times.
// ──────────────────────────────────────────────────────────

function renderTemplates() {
  const list=document.getElementById('tpl-list');
  if (!S.templates.length) { list.innerHTML='<div style="color:var(--muted);text-align:center;padding:24px">No templates yet. Save an expense as a template to start.</div>'; return; }
  list.innerHTML=S.templates.map(t=>`
    <div class="tpl-row">
      <div><div style="font-weight:700;font-size:13px">${x(t.name)}</div><div style="font-size:11px;color:var(--muted)">${x(t.category)} · ${num(t.defaultAmount)}</div></div>
      <button class="btn btn-ghost btn-sm" onclick="editTemplate('${t.id}')">✏️ Edit</button>
      <button class="btn btn-danger btn-sm" onclick="delTemplate('${t.id}')">Delete</button>
    </div>`).join('');
}

async function delTemplate(id) { await col('templates').doc(id).delete(); toast('Template deleted'); await loadAll(); renderTemplates(); }

function editTemplate(id) {
  const t=S.templates.find(v=>v.id===id); if(!t) return;
  _editTplId=id;
  const cats=[...new Set(S.expenses.map(e=>e.category).filter(Boolean))];
  document.getElementById('etpl-cat-list').innerHTML=cats.map(c=>`<option value="${x(c)}">`).join('');
  document.getElementById('etpl-name').value=t.name||'';
  document.getElementById('etpl-category').value=t.category||'';
  document.getElementById('etpl-amount').value=t.defaultAmount||'';
  document.getElementById('m-edit-tpl').classList.add('open');
}

async function saveEditTemplate() {
  const name=document.getElementById('etpl-name').value.trim();
  const category=document.getElementById('etpl-category').value.trim();
  const defaultAmount=parseFloat(document.getElementById('etpl-amount').value)||0;
  if (!name)          return toast('Enter template name');
  if (!defaultAmount) return toast('Enter default amount');
  if (!_editTplId)    return;
  await col('templates').doc(_editTplId).update({name,category,defaultAmount});
  _editTplId=null;
  toast('Template updated'); closeModal('m-edit-tpl'); await loadAll(); renderTemplates();
}
