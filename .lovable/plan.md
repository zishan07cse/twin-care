# Prompt 14 — Dealer & Distribution Module

Nationwide dealer network for device sales, sharing the inventory pool with the patient program but with its own catalog pricing, orders, deliveries, invoices, payments, ledger, aging, and reports.

Given the scope, I'll ship this in 4 phases so you can start onboarding dealers and taking orders after Phase A.

---

## Phase A — Dealer Master + Catalog + Pricing (ship first)

**Schema**
- `dealers` — code (DLR-0001 auto), business_name, proprietor, trade_license, tin, bin, address, district, division, territory, phone, whatsapp, email, dealer_type (distributor/sub_dealer/retailer/pharmacy/hospital_shop), onboarded_at, agreement_url, security_deposit_bdt, status (active/suspended/terminated), sales_officer_id, credit_limit_bdt, credit_period_days, price_tier (distributor/dealer/retailer), early_payment_discount_pct, penalty_pct
- `dealer_price_tiers` — item_id + tier → unit_price_bdt (+ MRP on inventory_items)
- Extend `inventory_items`: add `mrp_bdt`, `trade_stock_qty` (allocation split from program stock), `is_trade_sellable`
- `stock_allocations` — item_id, from_pool ('program'|'trade'), to_pool, quantity, moved_by, note (audit trail for reallocating between pools)
- `dealer_targets` — dealer_id, period (month/quarter/year), target_bdt, target_units

**UI**
- New sidebar section "Distribution" with sub-pages: Dealers, Orders, Deliveries, Invoices, Payments, Ledger, Reports
- Dealers page: list with search/filter by district/type/status/officer, create/edit dialog, per-dealer detail with tabs (Profile, Pricing, Targets, Documents)
- Catalog page: manage MRP + tier prices per product; "Move stock program ⇄ trade" action

## Phase B — Orders → Delivery → Invoice → Payments

**Schema**
- `sales_orders` (dealer, date, status draft→confirmed→partially_delivered→delivered→closed/cancelled, subtotal, discount, vat, ait, total, notes, credit_check_override_by)
- `sales_order_items` (order, item, qty, unit_price, discount_pct, line_total)
- `delivery_challans` (order, challan_no, dispatch_date, courier, transport_ref, receiver_ack_url, delivered_by)
- `challan_items` (challan, order_item, delivered_qty, serials text[], batch_no, expiry_date)
- `trade_invoices` (challan or consolidated, invoice_no series, invoice_date, due_date auto = date+credit_period, vat_pct, ait_pct, subtotal, vat_amt, ait_amt, total, status unpaid/partial/paid/overdue/disputed, paid_amount)
- `trade_invoice_items`
- `dealer_payments` (dealer, amount, date, method cash/bank/cheque/bkash/nagad/card, reference, received_by, deposit_slip_url, notes)
- `payment_allocations` (payment_id, invoice_id, amount) — supports FIFO auto-allocate or manual
- `cheques` (payment_id, cheque_no, bank, cheque_date, status received/deposited/cleared/bounced, cleared_on)

**Logic (triggers + server fns)**
- Order confirm: reserve trade_stock (soft), block if insufficient
- Challan create: decrement `trade_stock_qty`, update order status by delivered qty
- Invoice auto-generated on challan (or manual consolidate multiple challans)
- Payment insert: FIFO allocate to oldest unpaid invoices unless targeted; update invoice `paid_amount` + status
- Cheque bounce: reverse allocations, restore outstanding, flag dealer, create task
- Credit enforcement: server-side check at order confirm — outstanding + new order ≤ credit_limit AND no invoices overdue > grace; admin override recorded

**UI**
- Orders page: kanban by status + table; create order dialog picks dealer → auto-loads tier pricing
- Deliveries page: create challan against order, capture serials/batch/expiry, ack upload
- Invoices page: list with status chips + aging, PDF download (Experto branding, VAT/AIT, Bengali amount-in-words)
- Payments page: record payment with allocation UI (FIFO or manual per invoice), cheque tracker sub-tab

## Phase C — Ledger + Returns + Aging + Dunning

**Schema**
- `dealer_ledger_entries` (dealer, date, entry_type invoice/payment/credit_note/debit_note/opening, ref_id, debit, credit, running_balance) — maintained by triggers on invoice/payment/note inserts
- `credit_notes` (dealer, invoice_id nullable, reason damaged/expired/wrong_item/buyback, amount, items[])
- `debit_notes` (dealer, reason penalty/interest, amount)
- `sales_returns` (challan_id, items with condition good/damaged) → re-enter good stock, damaged goes to quarantine bucket
- `warranty_claims` (dealer, item, serial, claim_date, status open/approved/rejected/replaced, resolution)

**UI**
- Dealer detail → Ledger tab: statement view + PDF + WhatsApp/email send
- Returns tab under dealer + global Returns list
- Aging report: current / 1-30 / 31-60 / 61-90 / 90+ per dealer

**Cron (extends existing notification engine, no new infrastructure)**
- `dealer-dunning`: daily — reminders T-3, T-0, T+7, T+15, T+30 overdue via WATI + Resend; credit-limit breach alerts; cheque clearing follow-ups
- `dealer-statement`: monthly on 1st — PDF statement emailed + WhatsApped
- Reuse existing `dispatch-notifications` hook; add rule types `dealer_invoice_due`, `dealer_overdue`, `dealer_cheque_pending`, `dealer_statement`

## Phase D — Reports, Dashboard, Portal (optional)

**Reports** (all filterable by period / district / product / sales officer, CSV export)
- Top performers (value + units, rank movement)
- Best payers (avg days to pay, on-time %)
- Max outstanding + worst aging
- Product-wise sales trend + district heat map
- Purchase frequency + churn risk (no order 60/90d)
- Sales officer performance
- Cheque bounce, credit-limit breach, discount leakage
- Sales vs. target achievement %

**Distribution dashboard tiles**
- Month trade sales, collections, total outstanding, overdue
- Top 5 / bottom 5 dealers, trade stock position, pending orders, cheques in clearing

**Dealer portal (Phase D optional)**
- Dealer role + login → self-service ledger, invoices, place reorder, delivery tracking

---

## Technical notes

- All tables in `public` with GRANTs → `authenticated` (RLS scoped to staff roles via `is_staff()` / new `has_role('sales_officer')`), `service_role` for cron. New role `sales_officer` added to `app_role` enum.
- Numbering sequences: `dealer_code_seq`, `sales_order_seq`, `challan_seq`, `trade_invoice_seq`, `credit_note_seq`.
- Stock split: program vs trade lives on `inventory_items` (`stock_qty` stays program pool; add `trade_stock_qty`). Existing patient-program logic untouched.
- PDF generation reuses existing `src/lib/pdf.ts` + `reports-pdf.functions.ts` patterns.
- Ledger entries built by DB triggers so balance is always consistent.
- All money in BDT integers-with-decimals as `numeric(14,2)`.
- Bengali amount-in-words: helper in `src/lib/pdf.ts`.

---

## Confirm before I start

1. **Ship Phase A first?** (Dealer master + catalog + tier pricing + stock allocation). You can start onboarding dealers immediately; B follows.
2. **Trade stock split** — do you want a hard split (`stock_qty` program vs `trade_stock_qty` trade, moved manually), or shared pool with warnings? Recommendation: hard split — cleaner for reports and prevents accidental over-issuance to patients.
3. **Invoice numbering** — format `INV-YYYY-000001` (yearly reset)? Same for challan `CHL-YYYY-000001`, dealer `DLR-0001` (no year, sequential).
4. **VAT / AIT defaults** — configurable in settings, or fixed 15% VAT + 5% AIT for now?
5. **Dealer portal (Phase D)** — build now or defer until dealer network is live and you have real demand?
