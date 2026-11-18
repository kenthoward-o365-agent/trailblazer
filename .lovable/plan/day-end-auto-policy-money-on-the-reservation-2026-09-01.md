# Day-End Auto Policy: Money on the Reservation

Good catch — two gaps and one already-handled case.

## What is already handled

If the property picks "Move reservation to next day" and pushing the arrival forward would make arrival and departure the same day, the close does not create a zero-night stay. It cancels the reservation instead and records the reason in the exception journal. That behavior stays, but it inherits the deposit gap below.

## What is missing

When a guest is cancelled or no-showed by a staff member today, the app forces an explicit decision about any advance deposit — refund it, transfer it to another reservation, or forfeit it (in full or as a fee, with the remainder refunded). The automated day-end close skips that decision entirely:

- Auto-cancel flips the status to cancelled and leaves any advance deposit sitting in the deposit ledger with no disposition.
- The same applies to a moved reservation that collapses to zero nights and gets cancelled.
- Auto no-show posts the first night, tax and package items to the hold folio but never applies the deposit against those charges, so the folio shows a balance due even when the guest already paid.

## Proposed behavior

Add a third day-end policy setting: **Deposit handling on auto-cancel / auto no-show**, with these choices.

- **Forfeit to revenue** (default for no-show): the deposit is applied against the charges. On auto no-show it pays down the first-night charge on the hold folio; anything left over is recognized as a forfeited-deposit charge. On auto-cancel it is recognized as forfeited revenue.
- **Hold for review**: the deposit is left in place and the reservation is flagged so front desk resolves it manually. This is the safest choice and would be the default for auto-cancel.
- **Stop the audit**: any reservation carrying a deposit blocks the close, exactly like the existing "stop" options, so a human decides.

For **move to next day**, no money moves — the reservation and its deposit simply carry forward. If it collapses to zero nights and becomes a cancellation, the deposit setting above applies.

Every case is written to the Exceptions journal with the deposit amount, where it went, and the resulting folio balance, and it is called out in the AI close summary so nobody discovers a stray deposit weeks later.

## Zero-night edge case, spelled out

```text
audit date = Sep 1, reservation Sep 1 -> Sep 2
move to next day  ->  new arrival Sep 2 >= departure Sep 2
                  ->  zero nights, cannot exist
                  ->  cancelled, deposit rule applies, logged as
                      "Cannot move arrival past departure date"
```

Reservations with two or more nights left simply shift their arrival and keep the original departure, losing one night of revenue, which is also noted in the journal.

## Technical notes

- New columns on `night_audit_settings`: `deposit_action` (`forfeit` | `hold_review` | `stop`), defaulting to `hold_review`.
- New columns on `dayend_exceptions`: `deposit_amount`, `deposit_disposition`, `deposit_folio_id`.
- `_shared/dayendExceptions.ts`: before cancelling or no-showing, look up the reservation's `advance_deposit` ledger balance; apply the configured disposition by posting transfer-out / transfer-in / forfeit entries mirroring the logic already used by `CancellationBalanceDialog`, so manual and automatic paths produce identical accounting.
- `auto-dayend-close` and `dayend-resolve-exceptions` both pass the setting through; a `stop` deposit action returns a blocker with the affected confirmation numbers.
- Day-End Close UI: the new setting in the settings dialog, deposit columns in the Exceptions tab, and deposit totals in the blocker cards.
