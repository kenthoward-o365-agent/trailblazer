// Shared Auto Day-End Close exception handling.
// Resolves reservations still due to arrive and in-house guests still due to depart
// according to the property's night_audit_settings policy, and records a full
// audit trail in public.dayend_exceptions.

export type ArrivalAction = "auto_cancel" | "move_next_day" | "auto_no_show" | "stop";
export type DepartureAction = "extend_stay" | "checkout_hold" | "stop";
export type DepositAction = "forfeit" | "hold_review" | "stop";

export interface ExceptionRecord {
  exception_type: "pending_arrival" | "due_out";
  action_taken: string;
  status_before: string | null;
  status_after: string | null;
  amount_posted: number;
  confirmation_number: string | null;
  guest_name: string | null;
  site_number: string | null;
  reservation_id: string;
  details: Record<string, unknown>;
  deposit_amount?: number;
  deposit_disposition?: string | null;
  deposit_folio_id?: string | null;
}

export interface ResolveResult {
  handled: ExceptionRecord[];
  blocked: boolean;
  blockedCount: number;
  blockedMessage?: string;
}

const addDays = (dateStr: string, days: number): string => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
};

const guestName = (r: any) =>
  r?.guests ? `${r.guests.first_name ?? ""} ${r.guests.last_name ?? ""}`.trim() : null;

const baseRecord = (r: any, type: ExceptionRecord["exception_type"]) => ({
  exception_type: type,
  reservation_id: r.id,
  confirmation_number: r.confirmation_number ?? null,
  guest_name: guestName(r),
  site_number: r.sites?.site_number ?? null,
  status_before: r.status ?? null,
  amount_posted: 0,
});

/** Look up the reservation's advance deposit ledger and its current balance. */
async function getAdvanceDeposit(
  supabase: any,
  propertyId: string,
  reservationId: string,
): Promise<{ id: string; balance: number } | null> {
  const { data } = await supabase
    .from("ledger_accounts")
    .select("id, balance")
    .eq("property_id", propertyId)
    .eq("reservation_id", reservationId)
    .eq("ledger_type", "advance_deposit")
    .maybeSingle();
  if (!data) return null;
  const balance = Number(data.balance || 0);
  if (balance <= 0) return null;
  return { id: data.id, balance };
}

async function nextBalance(supabase: any, folioId: string, fallback: number): Promise<number> {
  const { data } = await supabase
    .from("folio_postings")
    .select("running_balance")
    .eq("ledger_account_id", folioId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return Number(data?.running_balance ?? fallback ?? 0);
}

/** Find or create the guest folio for a reservation. */
async function ensureGuestFolio(supabase: any, reservation: any, propertyId: string) {
  const { data: existing } = await supabase
    .from("ledger_accounts")
    .select("id, balance")
    .eq("property_id", propertyId)
    .eq("reservation_id", reservation.id)
    .eq("ledger_type", "guest")
    .maybeSingle();
  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("ledger_accounts")
    .insert({
      property_id: propertyId,
      reservation_id: reservation.id,
      guest_id: reservation.guest_id,
      ledger_type: "guest",
      contact_name: guestName(reservation),
      is_active: true,
      balance: 0,
    })
    .select("id, balance")
    .single();
  if (error) throw error;
  return created;
}

/**
 * Apply the property's deposit policy when the close cancels or no-shows a reservation.
 * "forfeit" moves the advance deposit onto the guest folio and recognizes any unapplied
 * remainder as forfeited revenue so the folio nets to zero.
 */
async function applyDepositDisposition(
  supabase: any,
  opts: {
    reservation: any;
    propertyId: string;
    auditDate: string;
    nightAuditId: string | null;
    action: DepositAction;
    context: "auto_cancel" | "auto_no_show";
  },
): Promise<{ amount: number; disposition: string | null; folioId: string | null; note: string | null }> {
  const { reservation, propertyId, auditDate, nightAuditId, action, context } = opts;
  const deposit = await getAdvanceDeposit(supabase, propertyId, reservation.id);
  if (!deposit) return { amount: 0, disposition: null, folioId: null, note: null };

  if (action !== "forfeit") {
    return {
      amount: deposit.balance,
      disposition: "hold_review",
      folioId: deposit.id,
      note: "Advance deposit left in the deposit ledger for front desk review",
    };
  }

  const label = context === "auto_no_show" ? "No Show" : "Cancellation";

  // 1) Move the deposit out of the advance deposit ledger
  const depBal = await nextBalance(supabase, deposit.id, deposit.balance);
  await supabase.from("folio_postings").insert({
    ledger_account_id: deposit.id,
    night_audit_id: nightAuditId,
    posting_type: "transfer_out",
    description: `Deposit applied - ${label} (Day-End Close)`,
    amount: deposit.balance,
    debit_amount: deposit.balance,
    credit_amount: 0,
    running_balance: depBal - deposit.balance,
    posting_date: auditDate,
    posted_by_name: "Auto Day-End Close",
  });
  await supabase.from("ledger_accounts").update({ balance: depBal - deposit.balance }).eq("id", deposit.id);

  // 2) Credit it onto the guest folio
  const folio = await ensureGuestFolio(supabase, reservation, propertyId);
  let bal = await nextBalance(supabase, folio.id, folio.balance);
  bal -= deposit.balance;
  await supabase.from("folio_postings").insert({
    ledger_account_id: folio.id,
    night_audit_id: nightAuditId,
    posting_type: "transfer_in",
    description: `Deposit applied - ${label} (Day-End Close)`,
    amount: deposit.balance,
    debit_amount: 0,
    credit_amount: deposit.balance,
    running_balance: bal,
    posting_date: auditDate,
    posted_by_name: "Auto Day-End Close",
  });

  // 3) Anything not absorbed by charges becomes forfeited revenue
  let forfeited = 0;
  if (bal < 0) {
    forfeited = Math.abs(bal);
    bal += forfeited;
    await supabase.from("folio_postings").insert({
      ledger_account_id: folio.id,
      night_audit_id: nightAuditId,
      posting_type: "revenue",
      description: `Forfeited Deposit - ${label} (Day-End Close)`,
      amount: forfeited,
      debit_amount: forfeited,
      credit_amount: 0,
      running_balance: bal,
      posting_date: auditDate,
      posted_by_name: "Auto Day-End Close",
    });
  }

  await supabase.from("ledger_accounts").update({ balance: bal }).eq("id", folio.id);

  return {
    amount: deposit.balance,
    disposition: "forfeit",
    folioId: folio.id,
    note: forfeited > 0
      ? `Deposit applied to charges; $${forfeited.toFixed(2)} recognized as forfeited revenue`
      : "Deposit applied against posted charges",
  };
}

/** Post the first-night room charge, taxes and any package/add-on items to a hold folio. */
async function postFirstNight(
  supabase: any,
  reservation: any,
  propertyId: string,
  auditDate: string,
  nightAuditId: string | null,
): Promise<{ amount: number; lines: Record<string, unknown>[] }> {
  const lines: Record<string, unknown>[] = [];
  let posted = 0;

  // Find or create the guest folio for this reservation
  let { data: folio } = await supabase
    .from("ledger_accounts")
    .select("id, balance")
    .eq("property_id", propertyId)
    .eq("reservation_id", reservation.id)
    .eq("ledger_type", "guest")
    .maybeSingle();

  if (!folio) {
    const { data: created, error } = await supabase
      .from("ledger_accounts")
      .insert({
        property_id: propertyId,
        reservation_id: reservation.id,
        guest_id: reservation.guest_id,
        ledger_type: "guest",
        contact_name: guestName(reservation),
        is_active: true,
        balance: 0,
      })
      .select("id, balance")
      .single();
    if (error) throw error;
    folio = created;
  }

  const { data: lastPosting } = await supabase
    .from("folio_postings")
    .select("running_balance")
    .eq("ledger_account_id", folio.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let balance = lastPosting?.running_balance ?? folio.balance ?? 0;

  const nights = Math.max(
    1,
    Math.round(
      (new Date(`${reservation.check_out_date}T00:00:00Z`).getTime() -
        new Date(`${reservation.check_in_date}T00:00:00Z`).getTime()) /
        86400000,
    ),
  );
  const nightlyRate = Number(reservation.total_price || 0) / nights;
  const adults = reservation.adults_count || 1;
  const revenueAccountId = reservation.rates?.revenue_account_id ?? null;

  if (nightlyRate > 0) {
    balance += nightlyRate;
    await supabase.from("folio_postings").insert({
      ledger_account_id: folio.id,
      night_audit_id: nightAuditId,
      posting_type: "room",
      description: "No-Show Charge - Room (Day-End Close)",
      amount: nightlyRate,
      debit_amount: nightlyRate,
      credit_amount: 0,
      running_balance: balance,
      posting_date: auditDate,
      posted_by_name: "Auto Day-End Close",
      account_id: revenueAccountId,
    });
    posted += nightlyRate;
    lines.push({ type: "room", amount: nightlyRate });
  }

  if (revenueAccountId) {
    const { data: taxConfigs } = await supabase
      .from("account_taxes")
      .select("rate_value, calculation_type, tax_account_id, accounts!account_taxes_tax_account_id_fkey (code, name)")
      .eq("revenue_account_id", revenueAccountId)
      .eq("is_active", true)
      .order("sort_order");

    for (const tax of taxConfigs || []) {
      let amount = 0;
      if (tax.calculation_type === "percent") amount = nightlyRate * (Number(tax.rate_value) / 100);
      else if (tax.calculation_type === "per_night") amount = Number(tax.rate_value);
      else if (tax.calculation_type === "per_person_per_night") amount = Number(tax.rate_value) * adults;
      if (amount <= 0) continue;

      balance += amount;
      const taxAccount = tax.accounts as any;
      await supabase.from("folio_postings").insert({
        ledger_account_id: folio.id,
        night_audit_id: nightAuditId,
        posting_type: "tax",
        description: `No-Show Charge - ${taxAccount?.name || "Tax"} (Day-End Close)`,
        amount,
        debit_amount: amount,
        credit_amount: 0,
        running_balance: balance,
        posting_date: auditDate,
        posted_by_name: "Auto Day-End Close",
        account_id: tax.tax_account_id,
      });
      posted += amount;
      lines.push({ type: "tax", name: taxAccount?.name, amount });
    }
  }

  // Package / add-on items attached to the reservation
  const { data: addOns } = await supabase
    .from("reservation_add_ons")
    .select("quantity, price_at_booking, add_ons (name)")
    .eq("reservation_id", reservation.id);

  for (const item of addOns || []) {
    const amount = Number(item.price_at_booking || 0) * Number(item.quantity || 1);
    if (amount <= 0) continue;
    balance += amount;
    await supabase.from("folio_postings").insert({
      ledger_account_id: folio.id,
      night_audit_id: nightAuditId,
      posting_type: "revenue",
      description: `No-Show Charge - ${(item.add_ons as any)?.name || "Package Item"} (Day-End Close)`,
      amount,
      debit_amount: amount,
      credit_amount: 0,
      running_balance: balance,
      posting_date: auditDate,
      posted_by_name: "Auto Day-End Close",
    });
    posted += amount;
    lines.push({ type: "add_on", name: (item.add_ons as any)?.name, amount });
  }

  await supabase.from("ledger_accounts").update({ balance }).eq("id", folio.id);

  return { amount: posted, lines };
}

export async function resolvePendingArrivals(
  supabase: any,
  opts: {
    propertyId: string;
    auditDate: string;
    action: ArrivalAction;
    depositAction?: DepositAction;
    nightAuditId?: string | null;
  },
): Promise<ResolveResult> {
  const { propertyId, auditDate, action, depositAction = "hold_review", nightAuditId = null } = opts;

  const { data: arrivals } = await supabase
    .from("reservations")
    .select(
      `id, confirmation_number, status, check_in_date, check_out_date, total_price, adults_count, guest_id,
       sites (site_number), guests (first_name, last_name), rates (rate_code, revenue_account_id)`,
    )
    .eq("property_id", propertyId)
    .lte("check_in_date", auditDate)
    .in("status", ["CONFIRMED", "PENDING", "CHECK_IN_HOLD"]);

  const list = arrivals || [];
  if (list.length === 0) return { handled: [], blocked: false, blockedCount: 0 };

  if (action === "stop") {
    return {
      handled: [],
      blocked: true,
      blockedCount: list.length,
      blockedMessage: `${list.length} reservation(s) still due to arrive — audit stopped by policy`,
    };
  }

  // Policy: a deposit on the reservation must be decided by a human
  if (depositAction === "stop" && action !== "move_next_day") {
    const withDeposits: string[] = [];
    for (const r of list) {
      const dep = await getAdvanceDeposit(supabase, propertyId, r.id);
      if (dep) withDeposits.push(r.confirmation_number ?? r.id);
    }
    if (withDeposits.length > 0) {
      return {
        handled: [],
        blocked: true,
        blockedCount: withDeposits.length,
        blockedMessage:
          `${withDeposits.length} reservation(s) due to arrive carry an advance deposit ` +
          `(${withDeposits.join(", ")}) — audit stopped so the deposit can be resolved manually`,
      };
    }
  }

  const handled: ExceptionRecord[] = [];

  for (const r of list) {
    const rec = baseRecord(r, "pending_arrival");
    try {
      if (action === "auto_cancel") {
        const dep = await applyDepositDisposition(supabase, {
          reservation: r,
          propertyId,
          auditDate,
          nightAuditId,
          action: depositAction,
          context: "auto_cancel",
        });
        await supabase.from("reservations").update({ status: "CANCELLED" }).eq("id", r.id);
        handled.push({
          ...rec,
          action_taken: "auto_cancel",
          status_after: "CANCELLED",
          amount_posted: 0,
          deposit_amount: dep.amount,
          deposit_disposition: dep.disposition,
          deposit_folio_id: dep.folioId,
          details: {
            reason: "Auto-cancelled by Day-End Close (no arrival)",
            original_check_in: r.check_in_date,
            deposit: dep.note,
          },
        });
      } else if (action === "move_next_day") {
        const newCheckIn = addDays(auditDate, 1);
        if (newCheckIn >= r.check_out_date) {
          const dep = await applyDepositDisposition(supabase, {
            reservation: r,
            propertyId,
            auditDate,
            nightAuditId,
            action: depositAction,
            context: "auto_cancel",
          });
          await supabase.from("reservations").update({ status: "CANCELLED" }).eq("id", r.id);
          handled.push({
            ...rec,
            action_taken: "auto_cancel",
            status_after: "CANCELLED",
            amount_posted: 0,
            deposit_amount: dep.amount,
            deposit_disposition: dep.disposition,
            deposit_folio_id: dep.folioId,
            details: {
              reason: "Cannot move arrival past departure date (zero-night stay) — cancelled by Day-End Close",
              original_check_in: r.check_in_date,
              check_out: r.check_out_date,
              deposit: dep.note,
            },
          });
        } else {
          await supabase.from("reservations").update({ check_in_date: newCheckIn }).eq("id", r.id);
          handled.push({
            ...rec,
            action_taken: "move_next_day",
            status_after: r.status,
            amount_posted: 0,
            details: {
              reason: "Arrival moved to next day, departure unchanged; any deposit carries forward",
              original_check_in: r.check_in_date,
              new_check_in: newCheckIn,
              check_out: r.check_out_date,
            },
          });
        }
      } else if (action === "auto_no_show") {
        const { amount, lines } = await postFirstNight(supabase, r, propertyId, auditDate, nightAuditId);
        const dep = await applyDepositDisposition(supabase, {
          reservation: r,
          propertyId,
          auditDate,
          nightAuditId,
          action: depositAction,
          context: "auto_no_show",
        });
        await supabase
          .from("reservations")
          .update({ status: "NO_SHOW", hold_folio_type: "no_show_hold" })
          .eq("id", r.id);
        handled.push({
          ...rec,
          action_taken: "auto_no_show",
          status_after: "NO_SHOW",
          amount_posted: amount,
          deposit_amount: dep.amount,
          deposit_disposition: dep.disposition,
          deposit_folio_id: dep.folioId,
          details: {
            reason: "No-showed into a hold folio (excluded from occupancy)",
            hold_folio_type: "no_show_hold",
            postings: lines,
            deposit: dep.note,
          },
        });
      }
    } catch (e) {
      handled.push({
        ...rec,
        action_taken: "error",
        status_after: r.status,
        amount_posted: 0,
        details: { error: e instanceof Error ? e.message : String(e) },
      });
    }
  }

  return { handled, blocked: false, blockedCount: 0 };
}

export async function resolvePendingDueOuts(
  supabase: any,
  opts: { propertyId: string; auditDate: string; action: DepartureAction },
): Promise<ResolveResult> {
  const { propertyId, auditDate, action } = opts;

  const { data: dueOuts } = await supabase
    .from("reservations")
    .select(
      `id, confirmation_number, status, check_in_date, check_out_date, total_price,
       sites (site_number), guests (first_name, last_name)`,
    )
    .eq("property_id", propertyId)
    .lte("check_out_date", auditDate)
    .eq("status", "CHECKED_IN");

  const list = dueOuts || [];
  if (list.length === 0) return { handled: [], blocked: false, blockedCount: 0 };

  if (action === "stop") {
    return {
      handled: [],
      blocked: true,
      blockedCount: list.length,
      blockedMessage: `${list.length} in-house guest(s) still due to depart — audit stopped by policy`,
    };
  }

  const handled: ExceptionRecord[] = [];

  for (const r of list) {
    const rec = baseRecord(r, "due_out");
    try {
      if (action === "extend_stay") {
        const newCheckOut = addDays(auditDate, 1);
        await supabase.from("reservations").update({ check_out_date: newCheckOut }).eq("id", r.id);
        handled.push({
          ...rec,
          action_taken: "extend_stay",
          status_after: "CHECKED_IN",
          amount_posted: 0,
          details: {
            reason: "Stay extended one night by Day-End Close; charges post normally in the night audit",
            original_check_out: r.check_out_date,
            new_check_out: newCheckOut,
          },
        });
      } else if (action === "checkout_hold") {
        const { data: folio } = await supabase
          .from("ledger_accounts")
          .select("id, balance")
          .eq("property_id", propertyId)
          .eq("reservation_id", r.id)
          .eq("ledger_type", "guest")
          .eq("is_active", true)
          .maybeSingle();

        await supabase
          .from("reservations")
          .update({ status: "CHECKED_OUT", hold_folio_type: "checkout_hold" })
          .eq("id", r.id);

        handled.push({
          ...rec,
          action_taken: "checkout_hold",
          status_after: "CHECKED_OUT",
          amount_posted: 0,
          details: {
            reason: "Checked out with no posting; folio stays open in the guest ledger as a Check-Out Hold",
            hold_folio_type: "checkout_hold",
            open_balance: folio?.balance ?? 0,
            folio_id: folio?.id ?? null,
          },
        });
      }
    } catch (e) {
      handled.push({
        ...rec,
        action_taken: "error",
        status_after: r.status,
        amount_posted: 0,
        details: { error: e instanceof Error ? e.message : String(e) },
      });
    }
  }

  return { handled, blocked: false, blockedCount: 0 };
}

export async function recordExceptions(
  supabase: any,
  opts: {
    propertyId: string;
    closeDate: string;
    nightAuditId?: string | null;
    dayendCloseId?: string | null;
    performedByName?: string;
    resolution?: "auto" | "manual";
    records: ExceptionRecord[];
  },
) {
  if (opts.records.length === 0) return;
  const rows = opts.records.map((r) => ({
    property_id: opts.propertyId,
    close_date: opts.closeDate,
    night_audit_id: opts.nightAuditId ?? null,
    dayend_close_id: opts.dayendCloseId ?? null,
    reservation_id: r.reservation_id,
    confirmation_number: r.confirmation_number,
    guest_name: r.guest_name,
    site_number: r.site_number,
    exception_type: r.exception_type,
    action_taken: r.action_taken,
    status_before: r.status_before,
    status_after: r.status_after,
    amount_posted: r.amount_posted,
    deposit_amount: r.deposit_amount ?? 0,
    deposit_disposition: r.deposit_disposition ?? null,
    deposit_folio_id: r.deposit_folio_id ?? null,
    resolution: opts.resolution ?? "auto",
    details: r.details,
    performed_by_name: opts.performedByName ?? "Auto Day-End Close",
  }));
  const { error } = await supabase.from("dayend_exceptions").insert(rows);
  if (error) console.error("Failed to record day-end exceptions:", error);
}

/** Agentic narrative of the run, written with Lovable AI. Returns null when unavailable. */
export async function generateAiSummary(
  context: {
    propertyName: string;
    auditDate: string;
    arrivalsAction: string;
    departuresAction: string;
    exceptions: ExceptionRecord[];
    foliosProcessed: number;
    roomRevenue: number;
    taxRevenue: number;
  },
): Promise<string | null> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return null;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "You are a campground night auditor. Write a concise (max 150 words) plain-English summary of an automated day-end close: what was closed, which reservations were auto-handled and why, money posted, and anything a manager must review in the morning. No markdown headings.",
          },
          { role: "user", content: JSON.stringify(context) },
        ],
      }),
    });
    if (!res.ok) {
      console.error("AI summary failed:", res.status, await res.text());
      return null;
    }
    const json = await res.json();
    return json.choices?.[0]?.message?.content ?? null;
  } catch (e) {
    console.error("AI summary error:", e);
    return null;
  }
}
