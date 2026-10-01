// ──────────────────────────────────────────────────────────
// transfers.js
// Move money between wallets. Each transfer atomically debits
// the source wallet and credits the destination wallet.
// Supports optional transfer charges deducted from source.
//
// Cross-currency transfers: when the source and destination
// wallets use different currencies, the destination is credited
// with the currency-converted amount (amount * rate, rounded to
// 2 decimals). Charges stay in the source currency and are never
// converted. The live rate is fetched from Frankfurter (keyless,
// CORS-enabled, ECB-backed) with a manual-entry fallback that
// works offline.
// ──────────────────────────────────────────────────────────

// Fetch the destination-per-source FX rate for a currency pair.
// Returns a Number, or throws on network error / unsupported pair.
// Does NOT swallow errors — the caller decides to toast and fall
// back to manual rate entry.
async function fetchRate(from, to) {
  if (from === to) return 1;
  const res = await fetch('https://api.frankfurter.app/latest?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to));
  if (!res.ok) throw new Error('FX request failed (' + res.status + ')');
  const data = await res.json();
  const rate = data && data.rates ? data.rates[to] : undefined;
  if (typeof rate !== 'number' || !isFinite(rate)) throw new Error('Unsupported currency pair');
  return rate;
}

// Currency code of the wallet with the given id (or '' if unknown).
function trWalletCur(id) {
  const w = S.wallets.find(v => v.id === id);
  return w ? (w.currency || '') : '';
}

function fillTransferWallets() {
  const opts = S.wallets.map(w => `<option value="${w.id}">${x(w.entityName)}${w.name ? ' · ' + w.name : ''} (${w.currency})</option>`).join('');
  document.getElementById('tr-from').innerHTML = opts;
  document.getElementById('tr-to').innerHTML = opts;
  refreshTrFxRow();
}

// Recompute the "Destination receives" preview from the current
// amount and rate inputs. Shows empty when either is missing/invalid.
function updateTrConvertedPreview() {
  const out = document.getElementById('tr-converted');
  if (!out) return;
  const amount = parseFloat(document.getElementById('tr-amount').value);
  const rate = parseFloat(document.getElementById('tr-rate').value);
  const toCur = trWalletCur(document.getElementById('tr-to').value);
  if (!isFinite(amount) || !isFinite(rate) || amount < 0 || rate <= 0) { out.value = ''; return; }
  const converted = Math.round(amount * rate * 100) / 100;
  out.value = fmt(converted, toCur);
}

// Token guards against stale fetches clobbering the input when the
// user switches wallets quickly.
let _trFxToken = 0;

// Show/hide the conversion row for the current wallet pair and,
// when currencies differ, fetch a live rate (manual fallback on error).
async function refreshTrFxRow() {
  const row = document.getElementById('tr-fx-row');
  if (!row) return;
  const fromCur = trWalletCur(document.getElementById('tr-from').value);
  const toCur = trWalletCur(document.getElementById('tr-to').value);
  const rateEl = document.getElementById('tr-rate');
  const noteEl = document.getElementById('tr-fx-note');
  if (!fromCur || !toCur || fromCur === toCur) {
    row.style.display = 'none';
    rateEl.value = '';
    noteEl.textContent = '';
    updateTrConvertedPreview();
    return;
  }
  row.style.display = 'flex';
  noteEl.textContent = 'Fetching rate…';
  const token = ++_trFxToken;
  try {
    const rate = await fetchRate(fromCur, toCur);
    if (token !== _trFxToken) return; // a newer request superseded this one
    rateEl.value = rate;
    noteEl.textContent = 'Live rate (Frankfurter): 1 ' + fromCur + ' = ' + rate + ' ' + toCur;
  } catch (e) {
    if (token !== _trFxToken) return;
    rateEl.value = '';
    noteEl.textContent = 'Enter the rate manually (1 ' + fromCur + ' = ? ' + toCur + ')';
    toast('Could not fetch rate — enter it manually');
  }
  updateTrConvertedPreview();
}

function editTransfer(id) {
  const t = S.transfers.find(v => v.id === id); if (!t) return;
  _editTrId = id;
  fillTransferWallets();
  document.getElementById('m-transfer').classList.add('open');
  document.getElementById('tr-from').value = t.fromWalletId;
  document.getElementById('tr-to').value = t.toWalletId;
  document.getElementById('tr-amount').value = t.amount;
  document.getElementById('tr-charges').value = t.charges || 0;
  document.getElementById('tr-date').value = t.date;
  document.getElementById('tr-note').value = t.note || '';
  // Reflect the originally-used rate (not a freshly fetched one) when editing.
  refreshTrFxRow();
  if (t.rate && trWalletCur(t.fromWalletId) !== trWalletCur(t.toWalletId)) {
    _trFxToken++; // ignore any in-flight fetch so it can't overwrite the stored rate
    document.getElementById('tr-rate').value = t.rate;
    document.getElementById('tr-fx-note').textContent = 'Stored rate: 1 ' + trWalletCur(t.fromWalletId) + ' = ' + t.rate + ' ' + trWalletCur(t.toWalletId);
    updateTrConvertedPreview();
  }
  document.querySelector('#m-transfer .mh-title').textContent = 'Edit Transfer';
  document.querySelector('#m-transfer .mf .btn-primary').textContent = 'Update Transfer';
}

async function saveTransfer() {
  const fromId = document.getElementById('tr-from').value;
  const toId = document.getElementById('tr-to').value;
  const amount = parseFloat(document.getElementById('tr-amount').value) || 0;
  const charges = parseFloat(document.getElementById('tr-charges').value) || 0;
  const date = document.getElementById('tr-date').value;
  const note = document.getElementById('tr-note').value.trim();
  if (!fromId || !toId) return toast('Select both wallets');
  if (fromId === toId) return toast('From and To must differ');
  if (!amount) return toast('Enter transfer amount');
  if (!date) return toast('Select a date');
  const fromCur = trWalletCur(fromId);
  const toCur = trWalletCur(toId);
  let rate;
  if (fromCur === toCur) {
    rate = 1;
  } else {
    rate = parseFloat(document.getElementById('tr-rate').value);
    if (!isFinite(rate) || rate <= 0) return toast('Enter a valid exchange rate');
  }
  const convertedAmount = fromCur === toCur ? amount : Math.round(amount * rate * 100) / 100;
  if (_editTrId) {
    const old = S.transfers.find(v => v.id === _editTrId); if (!old) return;
    const fromW = S.wallets.find(w => w.id === fromId);
    const toW = S.wallets.find(w => w.id === toId);
    const b = db.batch();
    b.update(col('transfers').doc(_editTrId), { fromWalletId: fromId, toWalletId: toId, fromName: fromW.entityName, toName: toW.entityName, amount, charges, date, note, fromCurrency: fromCur, toCurrency: toCur, rate, convertedAmount });
    if (old.fromWalletId) b.update(col('wallets').doc(old.fromWalletId), { balance: INC(old.amount + (old.charges || 0)) });
    if (old.toWalletId) b.update(col('wallets').doc(old.toWalletId), { balance: INC(-(old.convertedAmount ?? old.amount)) });
    b.update(col('wallets').doc(fromId), { balance: INC(-(amount + charges)) });
    b.update(col('wallets').doc(toId), { balance: INC(convertedAmount) });
    await b.commit();
    _editTrId = null;
    document.querySelector('#m-transfer .mh-title').textContent = 'New Transfer';
    document.querySelector('#m-transfer .mf .btn-primary').textContent = 'Confirm Transfer';
    toast('Transfer updated'); closeModal('m-transfer'); await loadAll(); renderTransfers();
    return;
  }
  const fromW = S.wallets.find(w => w.id === fromId);
  const toW = S.wallets.find(w => w.id === toId);
  if ((amount + charges) > fromW.balance) return toast('Insufficient balance in source wallet');
  const b = db.batch();
  b.set(col('transfers').doc(), { fromWalletId: fromId, toWalletId: toId, fromName: fromW.entityName, toName: toW.entityName, amount, charges, date, note, fromCurrency: fromCur, toCurrency: toCur, rate, convertedAmount, createdAt: TS() });
  b.update(col('wallets').doc(fromId), { balance: INC(-(amount + charges)) });
  b.update(col('wallets').doc(toId), { balance: INC(convertedAmount) });
  await b.commit();
  toast('Transfer recorded'); closeModal('m-transfer'); await loadAll(); renderTransfers();
}

function renderTransfers() {
  const tbody = document.getElementById('tb-transfers');
  const empty = document.getElementById('transfers-empty');
  const tbl = document.getElementById('t-transfers');
  if (!S.transfers.length) { tbody.innerHTML = ''; tbl.style.display = 'none'; empty.style.display = 'block'; return; }
  tbl.style.display = 'table'; empty.style.display = 'none';
  tbody.innerHTML = S.transfers.map(t => {
    const cross = t.fromCurrency && t.toCurrency && t.fromCurrency !== t.toCurrency;
    const amountCell = cross
      ? `${fmt(t.amount, t.fromCurrency)}<div style="color:var(--muted);font-size:11px;font-weight:400">→ ${fmt(t.convertedAmount ?? t.amount, t.toCurrency)} @ ${num(t.rate)}</div>`
      : num(t.amount);
    return `
    <tr>
      <td>${t.date}</td><td>${x(t.fromName)}</td><td>${x(t.toName)}</td>
      <td style="font-weight:600">${amountCell}</td>
      <td style="color:var(--muted)">${t.charges ? num(t.charges) : '—'}</td>
      <td style="color:var(--muted);font-size:12px">${x(t.note) || '—'}</td>
      <td style="display:flex;gap:6px;padding:11px 14px"><button class="btn btn-ghost btn-sm" onclick="editTransfer('${t.id}')">✏️</button><button class="btn btn-danger btn-sm" onclick="delTransfer('${t.id}')">×</button></td>
    </tr>`;
  }).join('');
}

async function delTransfer(id) {
  const t = S.transfers.find(v => v.id === id); if (!t) return;
  if (!confirm('Delete this transfer? Balances will be restored.')) return;
  const b = db.batch();
  b.delete(col('transfers').doc(id));
  if (t.fromWalletId) b.update(col('wallets').doc(t.fromWalletId), { balance: INC(t.amount + (t.charges || 0)) });
  if (t.toWalletId) b.update(col('wallets').doc(t.toWalletId), { balance: INC(-(t.convertedAmount ?? t.amount)) });
  await b.commit(); toast('Transfer deleted'); await loadAll(); renderTransfers();
}

// ── Conversion-row listeners ──────────────────────────────
// Changing wallets refetches the live rate (debounced); editing
// amount or rate only recomputes the preview (manual edits respected).
let _trFxTimer;
document.addEventListener('DOMContentLoaded', () => {
  const from = document.getElementById('tr-from');
  const to = document.getElementById('tr-to');
  const amt = document.getElementById('tr-amount');
  const rate = document.getElementById('tr-rate');
  const onPairChange = () => { clearTimeout(_trFxTimer); _trFxTimer = setTimeout(refreshTrFxRow, 300); };
  if (from) from.addEventListener('change', onPairChange);
  if (to) to.addEventListener('change', onPairChange);
  if (amt) amt.addEventListener('input', updateTrConvertedPreview);
  if (rate) rate.addEventListener('input', updateTrConvertedPreview);
});
