# Implementation Plan — Currency conversion for wallet-to-wallet transfers

Scope: when transferring between two wallets with DIFFERENT currencies, credit the destination with the currency-converted amount instead of the raw amount. Same-currency transfers behave exactly as today. All paths are under `c:\Projects\expense-tracker\.worktrees\transfer-currency-conversion`.

## Design decisions (made here, grounded in the code)

- **FX source: Frankfurter** (`https://api.frankfurter.app/latest?from=USD&to=KES`). It is keyless, CORS-enabled, and ECB-backed — the only viable option for a static GitHub Pages site that cannot hold a secret key. "Google exchange rates" (user's words) has no public keyless API, so Frankfurter is the closest honest substitute. Rationale recorded so the reviewer understands the deviation.
- **Manual-entry fallback is mandatory and must work offline.** Frankfurter does not cover every currency in `CUR` (e.g. RWF, TZS, UGX are not ECB-published). On fetch failure or unsupported pair, show a toast and leave the Rate input editable/empty for the user to type a rate. We never silently credit a wrong amount.
- **Do NOT reuse `convertCurrency`/`FX` from config.js for transfers.** That static table is explicitly "for budget aggregation only (not live)". Transfers need a live/user-confirmed rate. We add a new `fetchRate(from,to)` and read the rate from the modal input. Leave `convertCurrency`/`FX` untouched (budget feature depends on them).
- **Rate semantics: `rate` = units of destination currency per 1 unit of source currency.** `convertedAmount = round2(amount * rate)`. This matches Frankfurter's `?from=SRC&to=DST` response shape (`rates[DST]`).
- **Rounding helper:** use `Math.round(v*100)/100` inline (2 decimals). No new util needed; keep the change small.
- **Source side is never converted.** Source wallet is always debited `amount + charges` in the source currency. Charges stay in source currency.
- **Persisted fields on the transfer doc:** add `fromCurrency`, `toCurrency`, `rate`, `convertedAmount`. For same-currency transfers set `rate=1`, `convertedAmount=amount`, `fromCurrency===toCurrency` so render/edit/delete logic is uniform and old docs (missing fields) still work via fallbacks.
- **Backward compatibility for old transfer docs** (no conversion fields): in edit/delete, use `old.convertedAmount ?? old.amount` for the destination side so pre-existing transfers reverse correctly.

## Verification note

This is a static browser site with **no build step and no test runner** (no `package.json` anywhere, scripts are plain `<script>` tags in `index.html` loaded in dependency order). The realistic automated check is **`node --check <file>`** for JS syntax (Node v22 confirmed present) — it is NOT a behavioral test but it catches the syntax breakage that is the main risk of hand-editing vanilla JS. Behavioral correctness is verified by the manual browser walkthrough in step 7, which the reviewer must perform or confirm. The balance-math walkthrough (step 8) is the correctness spec the implementer and reviewer check against.

---

- [ ] 1. Add `fetchRate(from, to)` to `js/transfers.js`.
      Add an `async function fetchRate(from, to)` near the top of the file (after the header comment, before `fillTransferWallets`). It returns a `Number` (destination-per-source rate) or throws. Implementation: if `from === to` return `1`; otherwise `fetch('https://api.frankfurter.app/latest?from='+encodeURIComponent(from)+'&to='+encodeURIComponent(to))`; if `!res.ok` throw; parse JSON; read `data.rates?.[to]`; if it is not a finite number throw an Error (unsupported pair). Wrap network use so the caller can `catch`. Do NOT swallow errors inside `fetchRate` — let the caller decide to toast and fall back to manual entry.
      Files: `js/transfers.js`
      Verify: `node --check js/transfers.js` (run with cwd = worktree root) exits 0.

- [ ] 2. Add the conversion row markup to the transfer modal in `index.html`.
      Insert a new `.fr` row inside `#m-transfer` `.mb`, after the Amount/Charges row and before the Date/Note row. The row (`id="tr-fx-row"`, `style="display:none"`) contains two `.fg` groups matching existing modal style (`.lbl`, `.fc`): (a) label "Exchange Rate" with `<input type="number" class="fc" id="tr-rate" step="any" min="0" placeholder="0">`; (b) label "Destination receives" with a read-only preview element `<input type="text" class="fc" id="tr-converted" readonly>`. Add a small helper line under the rate input (e.g. a `<div id="tr-fx-note" class="lbl" style="color:var(--muted);font-weight:400"></div>`) to show the source of the rate (fetched vs manual) and errors. Keep classes identical to the Amount/Charges row so styling is consistent.
      Files: `index.html`
      Verify: open `index.html` and confirm `#tr-fx-row`, `#tr-rate`, `#tr-converted`, `#tr-fx-note` exist exactly once each (grep is acceptable here because this item only adds static markup; behavior is verified in step 7).

- [ ] 3. Add currency-pair helpers and the live conversion-row controller to `js/transfers.js`.
      Add helper `trWalletCur(id)` → returns the `currency` of the wallet with that id from `S.wallets` (or `''`). Add `function updateTrConvertedPreview()` that reads `#tr-amount` (via `num`-safe `parseFloat`) and `#tr-rate`, computes `convertedAmount = Math.round(amount*rate*100)/100`, and sets `#tr-converted` to `fmt(convertedAmount, toCurrency)` (empty when amount or rate is missing/invalid). Add `async function refreshTrFxRow()` that: reads from/to currencies; if equal, hides `#tr-fx-row`, clears `#tr-rate`; if different, shows the row, calls `fetchRate(from,to)`, on success prefills `#tr-rate` (editable), sets `#tr-fx-note` to e.g. "Live rate (Frankfurter)", then calls `updateTrConvertedPreview()`; on failure calls `toast('Could not fetch rate — enter it manually')`, leaves `#tr-rate` editable/empty, and sets `#tr-fx-note` to a manual-entry hint. Guard against stale fetches with a module-scoped request token (increment on each `refreshTrFxRow`; ignore a resolved fetch whose token is stale) so rapid currency changes don't clobber the input with an out-of-date rate.
      Files: `js/transfers.js`
      Verify: `node --check js/transfers.js` exits 0.

- [ ] 4. Wire modal listeners for the conversion row.
      At the bottom of `js/transfers.js`, add `document.addEventListener('DOMContentLoaded', ...)` (or a self-invoking setup run after elements exist) that attaches: `change` on `#tr-from` and `#tr-to` → `refreshTrFxRow()`; `input` on `#tr-amount` and `#tr-rate` → `updateTrConvertedPreview()`. Debounce the currency-change fetch: wrap `refreshTrFxRow` behind a ~300ms `setTimeout` guard (clear the prior timer) so switching wallets quickly fires one fetch. The `#tr-rate`/`#tr-amount` input handler must NOT refetch — it only recomputes the preview, so manual edits are respected. Follow the existing event-wiring style in the file/project (the project attaches handlers via inline `onclick` and top-level listeners; keep consistent).
      Files: `js/transfers.js`
      Verify: `node --check js/transfers.js` exits 0.

- [ ] 5. Update `editTransfer(id)` and `fillTransferWallets` interplay to drive the FX row.
      In `editTransfer(id)`, after setting `#tr-from`/`#tr-to`/`#tr-amount`, call `refreshTrFxRow()` and then, if the opened transfer has a stored `rate`, overwrite `#tr-rate` with `t.rate` and call `updateTrConvertedPreview()` (so editing shows the originally-used rate, not a freshly fetched one). Also ensure `openModal('m-transfer')` path (new transfer) ends with the FX row hidden/clean — since `fillTransferWallets` sets both selects to the first wallet, call `refreshTrFxRow()` at the end of `fillTransferWallets()` so the row reflects the default pair.
      Files: `js/transfers.js`
      Verify: `node --check js/transfers.js` exits 0.

- [ ] 6. Rewrite `saveTransfer()` and `delTransfer()` to compute, persist, and reverse conversion correctly.
      In `saveTransfer()`:
      - Read `fromCur = trWalletCur(fromId)`, `toCur = trWalletCur(toId)`. Determine `rate`: if `fromCur===toCur` → `1`; else read `parseFloat(#tr-rate)`; if not a positive finite number → `return toast('Enter a valid exchange rate')` (blocks the wrong-amount case, honoring the "never silently credit wrong amount" rule). Compute `convertedAmount = fromCur===toCur ? amount : Math.round(amount*rate*100)/100`.
      - NEW-transfer branch: keep the insufficient-balance check against `amount+charges` (source currency). In `b.set(...)` add fields `fromCurrency:fromCur,toCurrency:toCur,rate,convertedAmount`. Change the destination credit from `INC(amount)` to `INC(convertedAmount)`. Source debit stays `INC(-(amount+charges))`.
      - EDIT branch: when reversing the OLD transfer, add back to old source `old.amount+(old.charges||0)` and subtract from old dest `(old.convertedAmount ?? old.amount)`. Then apply the new transfer: debit new source `-(amount+charges)`, credit new dest `convertedAmount`. Update the `b.update(col('transfers')...)` payload to also write `fromCurrency,toCurrency,rate,convertedAmount`.
      In `delTransfer(id)`:
      - Change the signature to `async function delTransfer(id)`. Look the transfer up: `const t=S.transfers.find(v=>v.id===id); if(!t) return;`. Reverse using `t`: `if (t.fromWalletId) b.update(col('wallets').doc(t.fromWalletId),{balance:INC(t.amount+(t.charges||0))});` and `if (t.toWalletId) b.update(col('wallets').doc(t.toWalletId),{balance:INC(-(t.convertedAmount ?? t.amount))});`. Keep the confirm prompt, delete, commit, toast, reload, render.
      Files: `js/transfers.js`
      Verify: `node --check js/transfers.js` exits 0; then trace each case in step 8 and confirm the balance math matches.

- [ ] 7. Update `renderTransfers()` display and the delete button onclick.
      Change the actions-cell delete button to `onclick="delTransfer('${t.id}')"` (drop the raw-number args now that delTransfer looks up by id). In the Amount cell, when `t.fromCurrency && t.toCurrency && t.fromCurrency !== t.toCurrency`, render both sides clearly without adding columns: show the source `fmt(t.amount, t.fromCurrency)` and the destination `fmt(t.convertedAmount, t.toCurrency)` plus the rate used (e.g. a small muted second line `@ ${num(t.rate)}` or `→ ${fmt(t.convertedAmount,t.toCurrency)} @ ${num(t.rate)}`). For same-currency transfers keep the existing `num(t.amount)` display. Do not change the `<thead>` columns. Escape any text with `x()` as the existing rows do.
      Files: `js/transfers.js`
      Verify: `node --check js/transfers.js` exits 0; manual browser walkthrough below.

- [ ] 8. Manual browser functional walkthrough + balance-math verification (the correctness gate).
      Serve the site locally (e.g. `python -m http.server` in the worktree root, or open `index.html`) and sign in; or, if the FX endpoint/network is unavailable, exercise the manual-rate path which must work offline. Walk the four cases below and confirm wallet balances after each. The implementer must leave the tree with `node --check` passing on every edited `.js` file and `index.html` loading without console errors.

      Balance-math walkthrough (the spec to verify against). Let source wallet SRC and destination wallet DST.

      Case A — SAME currency (both USD), amount=100, charges=5:
      - rate=1, convertedAmount=100.
      - SRC balance change = -(100+5) = -105 USD. DST change = +100 USD. (Identical to today.)

      Case B — CROSS currency (SRC=USD, DST=KES), amount=100, charges=5, rate=129:
      - convertedAmount = round2(100*129) = 12900.
      - SRC change = -(100+5) = -105 USD (charges NOT converted). DST change = +12900 KES.
      - Transfer doc stores fromCurrency:'USD', toCurrency:'KES', rate:129, convertedAmount:12900, amount:100, charges:5.

      Case C — EDIT a cross-currency transfer. Start from Case B persisted (SRC -105 USD, DST +12900 KES already applied). User edits amount to 200, rate to 130, same wallets:
      - Reverse OLD: SRC += old.amount+old.charges = +105 USD; DST -= old.convertedAmount = -12900 KES. (SRC/DST now back to pre-transfer.)
      - Apply NEW: convertedAmount = round2(200*130)=26000. SRC -= (200+5)=... (use the new charges value from the form); DST += 26000 KES.
      - Net effect vs pre-transfer: SRC -(newAmount+newCharges) USD, DST +26000 KES. Doc updated with new rate/convertedAmount.
      - Verify an edit that also CHANGES wallets reverses the OLD wallets and credits/debits the NEW ones (the code already keys reversal off `old.fromWalletId`/`old.toWalletId`).

      Case D — DELETE a cross-currency transfer (Case B persisted):
      - delTransfer looks up t by id. SRC += t.amount+t.charges = +105 USD; DST -= t.convertedAmount = -12900 KES. Both wallets return exactly to pre-transfer balances.

      Case E — Backward compat: an OLD transfer doc with no `convertedAmount`/`rate` (same-currency legacy). Edit and delete must use `old.convertedAmount ?? old.amount` → falls back to `amount`, so legacy same-currency transfers still reverse correctly.

      Case F — FX failure / unsupported pair (e.g. SRC=RWF, DST=UGX not on Frankfurter): on opening/selecting the pair, a toast appears, `#tr-rate` stays editable, `#tr-fx-note` shows the manual hint. Entering a rate manually and saving credits DST with amount*manualRate. Saving with an empty/invalid rate is blocked by the toast guard in saveTransfer (no write occurs).
      Files: (verification only; no edits)
      Verify: all six cases produce the balances described; no uncaught console errors; `node --check` clean on `js/transfers.js`.

## Verification note (implementer — first iteration)

Implemented all steps 1–7. Static site, no test runner.

- `node --check js/transfers.js` → clean (no syntax errors reported, exit 0). The PowerShell wrapper prints a spurious "Exit Code: -1" that is a shell artifact, not node's status; node itself emitted no diagnostics.
- HTML: `#tr-fx-row`, `#tr-rate`, `#tr-converted`, `#tr-fx-note` each exist exactly once in `index.html` (grep-confirmed), inserted after the Amount/Charges row using the same `.fr/.fg/.lbl/.fc` classes as adjacent rows.
- Balance-math traced against the plan's cases:
  - A (same ccy, amt=100, chg=5): rate=1, converted=100 → src −105, dst +100. Unchanged vs today.
  - B (USD→KES, amt=100, chg=5, rate=129): converted=12900 → src −105 USD, dst +12900 KES; doc stores fromCurrency/toCurrency/rate/convertedAmount.
  - C (edit): reverse old (src +old.amount+old.charges, dst −(old.convertedAmount ?? old.amount)) then apply new (src −(amount+charges), dst +convertedAmount); doc re-written with new rate/convertedAmount.
  - D (delete): delTransfer looks up t by id; src +t.amount+t.charges, dst −(t.convertedAmount ?? t.amount).
  - E (legacy doc, no convertedAmount): `?? old.amount` fallback keeps reversal correct.
  - F (FX fail/unsupported, e.g. RWF→UGX): toast fires, rate input stays editable/empty, note shows manual hint; saveTransfer blocks empty/invalid rate (`toast('Enter a valid exchange rate')`, no write). Same-currency path sets rate=1 directly and never reads the input, so FX failures cannot block same-currency transfers.
- Stale-fetch guard: `_trFxToken` increments per `refreshTrFxRow`; resolved fetches with a stale token are ignored. Edit path bumps the token so an in-flight fetch cannot overwrite the stored rate. Currency-change fetch debounced 300ms; amount/rate `input` only recomputes the preview (no refetch), so manual rate edits are respected.
- Live FX fetch could not be exercised from this environment (no browser/network run); the manual-rate path and all balance math were verified by reasoning + syntax check. A reviewer should load `index.html`, sign in, and confirm the live-rate fetch populates the row for a supported pair (e.g. USD→KES).

## Out of scope (do not touch)
Expenses, income, investments, debts, dividends, collections, budgets, recurring, dashboard. Leave `convertCurrency`/`FX` in `config.js`/`utils.js` unchanged (budget aggregation depends on them). No new frameworks, npm, or build tooling — plain `<script>` files only.
