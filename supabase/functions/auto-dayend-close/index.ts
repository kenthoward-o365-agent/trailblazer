import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  resolvePendingArrivals,
  resolvePendingDueOuts,
  recordExceptions,
  generateAiSummary,
} from "../_shared/dayendExceptions.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PropertySettings {
  property_id: string;
  auto_run_enabled: boolean;
  auto_run_time: string;
  property_name: string;
  property_timezone: string;
}

interface FolioData {
  id: string;
  balance: number;
  reservation_id: string;
  reservations: {
    id: string;
    check_in_date: string;
    check_out_date: string;
    total_price: number;
    adults_count: number;
    status: string;
    sites: { site_number: string };
    guests: { first_name: string; last_name: string };
    rates: { rate_code: string; revenue_account_id: string | null } | null;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Restrict invocation to the internal scheduler (service-role bearer).
  const auth = req.headers.get("authorization") ?? "";
  const cronSecret = Deno.env.get("CRON_SCHEDULER_SECRET") ?? "";
  const isServiceRole = !!supabaseServiceKey && auth === `Bearer ${supabaseServiceKey}`;
  const isScheduler = !!cronSecret && req.headers.get("x-scheduler-secret") === cronSecret;
  if (!isServiceRole && !isScheduler) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);


  console.log("Auto Day-End Close triggered at:", new Date().toISOString());

  try {
    // Get all properties with auto_run_enabled
    const { data: settings, error: settingsError } = await supabase
      .from("night_audit_settings")
      .select(`
        property_id,
        auto_run_enabled,
        auto_run_time,
        auto_advance_audit_date,
        pending_arrivals_action,
        inhouse_departure_action,
        ai_summary_enabled,
        properties!inner(name, timezone)
      `)
      .eq("auto_run_enabled", true);

    if (settingsError) {
      console.error("Error fetching settings:", settingsError);
      throw settingsError;
    }

    if (!settings || settings.length === 0) {
      console.log("No properties have auto-run enabled");
      return new Response(
        JSON.stringify({ success: true, message: "No properties with auto-run enabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${settings.length} properties with auto-run enabled`);

    const results: { propertyId: string; status: string; message: string }[] = [];

    for (const setting of settings) {
      const propertyId = setting.property_id;
      const autoRunTime = setting.auto_run_time || "02:00:00";
      const propertyName = (setting.properties as any)?.name || "Unknown";
      const propertyTimezone = (setting.properties as any)?.timezone || "America/New_York";

      console.log(`Processing property: ${propertyName} (${propertyId}), scheduled time: ${autoRunTime}`);

      try {
        // Resolve the property's true local hour/date (DST-aware)
        const now = new Date();
        const fmt = new Intl.DateTimeFormat("en-CA", {
          timeZone: propertyTimezone,
          hour12: false,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
        });
        const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
        const localToday = `${parts.year}-${parts.month}-${parts.day}`;
        const localHour = parseInt(parts.hour === "24" ? "0" : parts.hour, 10);
        const scheduledHour = parseInt(autoRunTime.split(":")[0], 10);

        // The audit date can only be closed AFTER that business day has ended in
        // the property's local timezone. Closing "today" at 2am would advance the
        // audit date a full day early.
        const { data: preCheck } = await supabase
          .from("properties")
          .select("audit_date")
          .eq("id", propertyId)
          .single();
        const currentAuditDate = preCheck?.audit_date as string | undefined;

        const dayDiff = (a: string, b: string) =>
          Math.round(
            (Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000,
          );
        const daysBehind = currentAuditDate ? dayDiff(localToday, currentAuditDate) : 0;

        console.log(
          `${propertyName}: local ${localToday} ${localHour}:00, audit ${currentAuditDate}, scheduled ${scheduledHour}:00, daysBehind=${daysBehind}`,
        );

        if (daysBehind <= 0) {
          console.log(
            `Skipping ${propertyName}: audit date ${currentAuditDate} has not ended yet locally (${localToday})`,
          );
          continue;
        }

        // Normal case (one day behind): wait for the scheduled hour.
        // Multiple days behind: catch up immediately at any hour.
        if (daysBehind === 1 && localHour < scheduledHour) {
          console.log(`Skipping ${propertyName}: before scheduled run time`);
          continue;
        }




        // Get the current audit date for this property
        const { data: propertyData, error: propError } = await supabase
          .from("properties")
          .select("audit_date")
          .eq("id", propertyId)
          .single();

        if (propError || !propertyData?.audit_date) {
          console.error(`Error fetching audit date for ${propertyName}:`, propError);
          await logResult(supabase, propertyId, "full_cycle", "error", "Failed to fetch audit date", null);
          results.push({ propertyId, status: "error", message: "Failed to fetch audit date" });
          continue;
        }

        const auditDate = propertyData.audit_date;
        console.log(`Property ${propertyName} audit date: ${auditDate}`);

        // Check if night audit already ran for this date
        const { data: existingAudit } = await supabase
          .from("night_audits")
          .select("id, status")
          .eq("property_id", propertyId)
          .eq("audit_date", auditDate)
          .maybeSingle();

        // Check if day-end close already ran for this date
        const { data: existingClose } = await supabase
          .from("dayend_closes")
          .select("id, status")
          .eq("property_id", propertyId)
          .eq("close_date", auditDate)
          .maybeSingle();

        if (existingClose?.status === "closed") {
          console.log(`Skipping ${propertyName}: Day-end close already completed for ${auditDate}`);
          await logResult(supabase, propertyId, "full_cycle", "skipped", `Already completed for ${auditDate}`, auditDate);
          results.push({ propertyId, status: "skipped", message: `Already completed for ${auditDate}` });
          continue;
        }

        // ---- Policy-driven exception handling ----
        const arrivalsAction = (setting as any).pending_arrivals_action || "stop";
        const departuresAction = (setting as any).inhouse_departure_action || "stop";
        const depositAction = (setting as any).deposit_action || "hold_review";

        const arrivalResult = await resolvePendingArrivals(supabase, {
          propertyId,
          auditDate,
          action: arrivalsAction,
          depositAction,
        });

        if (arrivalResult.blocked) {
          console.log(`Stopping ${propertyName}: ${arrivalResult.blockedMessage}`);
          await logResult(supabase, propertyId, "full_cycle", "failed", arrivalResult.blockedMessage!, auditDate);
          results.push({ propertyId, status: "failed", message: arrivalResult.blockedMessage! });
          continue;
        }

        const departureResult = await resolvePendingDueOuts(supabase, {
          propertyId,
          auditDate,
          action: departuresAction,
        });

        if (departureResult.blocked) {
          console.log(`Stopping ${propertyName}: ${departureResult.blockedMessage}`);
          await logResult(supabase, propertyId, "full_cycle", "failed", departureResult.blockedMessage!, auditDate);
          results.push({ propertyId, status: "failed", message: departureResult.blockedMessage! });
          continue;
        }

        const exceptionRecords = [...arrivalResult.handled, ...departureResult.handled];

        // Check for CHECKED_OUT guests with outstanding folio balances
        // (Check-Out Hold folios are intentionally left open and are excluded.)
        const { data: checkedOutWithBalance } = await supabase
          .from("ledger_accounts")
          .select(`
            id,
            balance,
            reservations!ledger_accounts_reservation_id_fkey!inner(id, status, hold_folio_type)
          `)
          .eq("property_id", propertyId)
          .eq("ledger_type", "guest")
          .eq("is_active", true)
          .eq("reservations.status", "CHECKED_OUT")
          .is("reservations.hold_folio_type", null)
          .neq("balance", 0);

        if (checkedOutWithBalance && checkedOutWithBalance.length > 0) {
          console.log(`Failing ${propertyName}: ${checkedOutWithBalance.length} checked-out folios with balance`);
          await logResult(supabase, propertyId, "full_cycle", "failed", `${checkedOutWithBalance.length} checked-out guests have outstanding balances`, auditDate);
          results.push({ propertyId, status: "failed", message: `${checkedOutWithBalance.length} checked-out guests have outstanding balances` });
          continue;
        }


        // Run Night Audit if not completed
        let nightAuditId = existingAudit?.id;
        let totalRoomRevenue = 0;
        let totalTaxRevenue = 0;
        let foliosProcessed = 0;

        if (!existingAudit || existingAudit.status !== "completed") {
          console.log(`Running night audit for ${propertyName}...`);

          // Create or update night audit record
          if (!nightAuditId) {
            const { data: newAudit, error: auditError } = await supabase
              .from("night_audits")
              .insert({
                property_id: propertyId,
                audit_date: auditDate,
                status: "in_progress",
                started_at: new Date().toISOString(),
              })
              .select()
              .single();

            if (auditError) throw auditError;
            nightAuditId = newAudit.id;
          } else {
            await supabase
              .from("night_audits")
              .update({
                status: "in_progress",
                started_at: new Date().toISOString(),
              })
              .eq("id", nightAuditId);
          }

          // Get in-house guest folios - ONLY for CHECKED_IN reservations where audit date is within stay
          const { data: folios } = await supabase
            .from("ledger_accounts")
            .select(`
              id,
              balance,
              reservation_id,
              reservations!ledger_accounts_reservation_id_fkey!inner (
                id,
                check_in_date,
                check_out_date,
                total_price,
                adults_count,
                status,
                sites (site_number),
                guests (first_name, last_name),
                rates (rate_code, revenue_account_id)
              )
            `)
            .eq("property_id", propertyId)
            .eq("ledger_type", "guest")
            .eq("is_active", true)
            .eq("reservations.status", "CHECKED_IN")
            .lte("reservations.check_in_date", auditDate)
            .gt("reservations.check_out_date", auditDate);

          console.log(`Found ${folios?.length || 0} in-house folios for ${auditDate}`);

          if (folios && folios.length > 0) {
            for (const folio of folios as unknown as FolioData[]) {
              const reservation = folio.reservations;
              if (!reservation) continue;

              // Defense in depth: Double-check the reservation is actually in-house on the audit date
              const checkInDate = new Date(reservation.check_in_date);
              const checkOutDate = new Date(reservation.check_out_date);
              const auditDateObj = new Date(auditDate);
              
              if (reservation.status !== 'CHECKED_IN' || checkInDate > auditDateObj || checkOutDate <= auditDateObj) {
                console.log(`Skipping reservation ${reservation.id}: not in-house on ${auditDate} (status: ${reservation.status})`);
                continue;
              }

              // Calculate nightly rate
              const totalNights = Math.max(1, Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)));
              const nightlyRate = reservation.total_price / totalNights;
              const adultsCount = reservation.adults_count || 1;

              // Get current running balance
              const { data: lastPosting } = await supabase
                .from("folio_postings")
                .select("running_balance")
                .eq("ledger_account_id", folio.id)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

              let currentBalance = lastPosting?.running_balance ?? folio.balance;
              const revenueAccountId = reservation.rates?.revenue_account_id;

              // Post room revenue
              const newRoomBalance = currentBalance + nightlyRate;
              await supabase.from("folio_postings").insert({
                ledger_account_id: folio.id,
                night_audit_id: nightAuditId,
                posting_type: "room",
                description: `Night Audit - Room Charge (Auto)`,
                amount: nightlyRate,
                debit_amount: nightlyRate,
                credit_amount: 0,
                running_balance: newRoomBalance,
                posting_date: auditDate,
                posted_by_name: "Auto Night Audit",
                account_id: revenueAccountId,
              });

              await supabase.from("ledger_transactions").insert({
                ledger_account_id: folio.id,
                transaction_type: "charge",
                description: "Night Audit - Room Charge",
                debit_amount: nightlyRate,
                credit_amount: 0,
                posted_by_name: "Auto Night Audit",
                account_id: revenueAccountId,
                account_code: reservation.rates?.rate_code,
              });

              totalRoomRevenue += nightlyRate;
              currentBalance = newRoomBalance;

              // Get and apply taxes
              if (revenueAccountId) {
                const { data: taxConfigs } = await supabase
                  .from("account_taxes")
                  .select(`
                    id,
                    rate_value,
                    calculation_type,
                    tax_account_id,
                    accounts!account_taxes_tax_account_id_fkey (code, name)
                  `)
                  .eq("revenue_account_id", revenueAccountId)
                  .eq("is_active", true)
                  .order("sort_order");

                if (taxConfigs && taxConfigs.length > 0) {
                  for (const tax of taxConfigs) {
                    let taxAmount = 0;
                    if (tax.calculation_type === "percent") {
                      taxAmount = nightlyRate * (tax.rate_value / 100);
                    } else if (tax.calculation_type === "per_night") {
                      taxAmount = tax.rate_value;
                    } else if (tax.calculation_type === "per_person_per_night") {
                      taxAmount = tax.rate_value * adultsCount;
                    }

                    if (taxAmount > 0) {
                      currentBalance += taxAmount;
                      const taxAccount = tax.accounts as any;

                      await supabase.from("folio_postings").insert({
                        ledger_account_id: folio.id,
                        night_audit_id: nightAuditId,
                        posting_type: "tax",
                        description: `Night Audit - ${taxAccount?.name || "Tax"} (Auto)`,
                        amount: taxAmount,
                        debit_amount: taxAmount,
                        credit_amount: 0,
                        running_balance: currentBalance,
                        posting_date: auditDate,
                        posted_by_name: "Auto Night Audit",
                        account_id: tax.tax_account_id,
                      });

                      await supabase.from("ledger_transactions").insert({
                        ledger_account_id: folio.id,
                        transaction_type: "charge",
                        description: `Night Audit - ${taxAccount?.name || "Tax"}`,
                        debit_amount: taxAmount,
                        credit_amount: 0,
                        posted_by_name: "Auto Night Audit",
                        account_id: tax.tax_account_id,
                        account_code: taxAccount?.code,
                      });

                      totalTaxRevenue += taxAmount;
                    }
                  }
                }
              }

              // Update ledger account balance
              await supabase
                .from("ledger_accounts")
                .update({ balance: currentBalance })
                .eq("id", folio.id);

              foliosProcessed++;
            }
          }

          // Close folios for checked-out guests and mark reservations as COMPLETED
          const { data: checkedOutFolios } = await supabase
            .from("ledger_accounts")
            .select(`
              id,
              reservation_id,
              reservations!ledger_accounts_reservation_id_fkey!inner(id, status, hold_folio_type)
            `)
            .eq("property_id", propertyId)
            .eq("ledger_type", "guest")
            .eq("is_active", true)
            .eq("reservations.status", "CHECKED_OUT")
            .is("reservations.hold_folio_type", null);

          if (checkedOutFolios && checkedOutFolios.length > 0) {
            const folioIds = checkedOutFolios.map((f) => f.id);
            const reservationIds = checkedOutFolios
              .map((f) => f.reservation_id)
              .filter((id): id is string => id !== null);

            // Close the folios
            await supabase
              .from("ledger_accounts")
              .update({ is_active: false, closed_at: new Date().toISOString() })
              .in("id", folioIds);

            // Note: Reservations stay in CHECKED_OUT status as there's no COMPLETED enum value
            // Guest History uses folio is_active=false + closed_at to determine completed stays
            if (reservationIds.length > 0) {
              console.log(`Closed ${reservationIds.length} folios for CHECKED_OUT reservations`);
            }
          }

          // Complete night audit
          await supabase
            .from("night_audits")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
              total_room_revenue: totalRoomRevenue,
              total_tax_revenue: totalTaxRevenue,
              folios_processed: foliosProcessed,
            })
            .eq("id", nightAuditId);

          console.log(`Night audit completed for ${propertyName}: ${foliosProcessed} folios, $${totalRoomRevenue.toFixed(2)} room, $${totalTaxRevenue.toFixed(2)} tax`);
        } else {
          nightAuditId = existingAudit.id;
          console.log(`Night audit already completed for ${propertyName}`);
        }

        // Run Day-End Close
        console.log(`Running day-end close for ${propertyName}...`);

        // Calculate summary data
        const nextDay = new Date(auditDate);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDayStr = nextDay.toISOString().split("T")[0];

        const { data: propertyLedgerIds } = await supabase
          .from("ledger_accounts")
          .select("id")
          .eq("property_id", propertyId);

        const ledgerIds = propertyLedgerIds?.map((l) => l.id) || [];

        const { data: todayPostings } = await supabase
          .from("folio_postings")
          .select("posting_type, amount")
          .in("ledger_account_id", ledgerIds)
          .gte("posting_date", auditDate)
          .lt("posting_date", nextDayStr);

        const summary = { revenue: 0, taxes: 0, payments: 0, refunds: 0 };
        todayPostings?.forEach((p) => {
          if (p.posting_type === "revenue" || p.posting_type === "room") {
            summary.revenue += p.amount;
          } else if (p.posting_type === "tax") {
            summary.taxes += p.amount;
          } else if (p.posting_type === "payment") {
            summary.payments += Math.abs(p.amount);
          } else if (p.posting_type === "refund") {
            summary.refunds += Math.abs(p.amount);
          }
        });

        // Get ledger summary
        const { data: ledgers } = await supabase
          .from("ledger_accounts")
          .select("ledger_type, balance, is_active")
          .eq("property_id", propertyId);

        const ledgerSummary = {
          guest: { count: 0, balance: 0 },
          advance_deposit: { count: 0, balance: 0 },
          city: { count: 0, balance: 0 },
        };

        ledgers?.forEach((l) => {
          if (l.is_active) {
            const type = l.ledger_type as keyof typeof ledgerSummary;
            if (ledgerSummary[type]) {
              ledgerSummary[type].count++;
              ledgerSummary[type].balance += l.balance;
            }
          }
        });

        // Create or update day-end close record
        const { data: existingCloseRecord } = await supabase
          .from("dayend_closes")
          .select("id")
          .eq("property_id", propertyId)
          .eq("close_date", auditDate)
          .maybeSingle();

        let dayendCloseId: string | null = existingCloseRecord?.id ?? null;

        if (existingCloseRecord) {
          await supabase
            .from("dayend_closes")
            .update({
              status: "closed",
              closed_at: new Date().toISOString(),
              closed_by_name: "Auto Day-End Close",
              night_audit_id: nightAuditId,
              total_revenue: summary.revenue,
              total_taxes: summary.taxes,
              total_payments: summary.payments,
              total_refunds: summary.refunds,
              ledger_summary: ledgerSummary,
              exceptions_handled: exceptionRecords.length,
            })
            .eq("id", existingCloseRecord.id);
        } else {
          const { data: insertedClose } = await supabase.from("dayend_closes").insert({
            property_id: propertyId,
            close_date: auditDate,
            status: "closed",
            closed_at: new Date().toISOString(),
            closed_by_name: "Auto Day-End Close",
            night_audit_id: nightAuditId,
            total_revenue: summary.revenue,
            total_taxes: summary.taxes,
            total_payments: summary.payments,
            total_refunds: summary.refunds,
            ledger_summary: ledgerSummary,
            exceptions_handled: exceptionRecords.length,
          }).select("id").maybeSingle();
          dayendCloseId = insertedClose?.id ?? null;
        }

        // Record the full exception audit trail for this close
        await recordExceptions(supabase, {
          propertyId,
          closeDate: auditDate,
          nightAuditId,
          dayendCloseId,
          resolution: "auto",
          records: exceptionRecords,
        });

        // Agentic narrative of the run
        if ((setting as any).ai_summary_enabled !== false && dayendCloseId) {
          const aiSummary = await generateAiSummary({
            propertyName,
            auditDate,
            arrivalsAction,
            departuresAction,
            exceptions: exceptionRecords,
            foliosProcessed,
            roomRevenue: totalRoomRevenue,
            taxRevenue: totalTaxRevenue,
          });
          if (aiSummary) {
            await supabase.from("dayend_closes").update({ ai_summary: aiSummary }).eq("id", dayendCloseId);
          }
        }

        // Update housekeeping status for occupied rooms
        const { data: checkedInReservations } = await supabase
          .from("reservations")
          .select("site_id")
          .eq("property_id", propertyId)
          .eq("status", "CHECKED_IN")
          .not("site_id", "is", null);

        if (checkedInReservations && checkedInReservations.length > 0) {
          const occupiedSiteIds = checkedInReservations.map((r) => r.site_id);
          await supabase.from("sites").update({ occupancy_status: "occupied" }).in("id", occupiedSiteIds);
        }

        await supabase
          .from("sites")
          .update({ housekeeping_status: "dirty" })
          .eq("property_id", propertyId)
          .eq("occupancy_status", "occupied")
          .neq("housekeeping_status", "out_of_order");

        // Process *Out room guests with zero balance - close their folios back to history
        const { data: outRoomGuests } = await supabase
          .from("sites")
          .select("id")
          .eq("property_id", propertyId)
          .eq("site_number", "*Out")
          .maybeSingle();

        if (outRoomGuests?.id) {
          const { data: outGuestFolios } = await supabase
            .from("ledger_accounts")
            .select(`
              id,
              balance,
              reservation_id,
              reservations!ledger_accounts_reservation_id_fkey!inner(id, status, site_id)
            `)
            .eq("property_id", propertyId)
            .eq("ledger_type", "guest")
            .eq("is_active", true)
            .eq("reservations.status", "CHECKED_IN")
            .eq("reservations.site_id", outRoomGuests.id)
            .eq("balance", 0);

          if (outGuestFolios && outGuestFolios.length > 0) {
            console.log(`Processing ${outGuestFolios.length} *Out room guests with zero balance`);
            
            for (const folio of outGuestFolios) {
              // Set reservation to CHECKED_OUT
              await supabase
                .from("reservations")
                .update({ status: "CHECKED_OUT" })
                .eq("id", folio.reservation_id);

              // Close the folio
              await supabase
                .from("ledger_accounts")
                .update({ 
                  is_active: false, 
                  closed_at: new Date().toISOString() 
                })
                .eq("id", folio.id);

              console.log(`Closed *Out folio ${folio.id} with zero balance`);
            }
          }
        }

        // Purge change journal entries older than 45 days
        const purgeDate = new Date();
        purgeDate.setDate(purgeDate.getDate() - 45);
        await supabase
          .from("change_journal")
          .delete()
          .eq("property_id", propertyId)
          .lt("created_at", purgeDate.toISOString());

        // Advance audit date (policy-controlled)
        const shouldAdvance = (setting as any).auto_advance_audit_date !== false;
        const newAuditDate = nextDayStr;
        if (shouldAdvance) {
          await supabase.from("properties").update({ audit_date: newAuditDate }).eq("id", propertyId);
        }

        console.log(`Day-end close completed for ${propertyName}. ${shouldAdvance ? `Audit date advanced to ${newAuditDate}` : "Audit date not advanced (policy)"}`);

        await logResult(
          supabase,
          propertyId,
          "full_cycle",
          "success",
          `Night Audit: ${foliosProcessed} folios, Room: $${totalRoomRevenue.toFixed(2)}, Tax: $${totalTaxRevenue.toFixed(2)}, Exceptions handled: ${exceptionRecords.length}. ${shouldAdvance ? `Audit date advanced to ${newAuditDate}` : "Audit date unchanged"}`,
          auditDate,
          foliosProcessed,
          totalRoomRevenue,
          totalTaxRevenue
        );

        results.push({
          propertyId,
          status: "success",
          message: `Completed for ${auditDate}${shouldAdvance ? `, advanced to ${newAuditDate}` : ""} (${exceptionRecords.length} exception(s) handled)`,
        });
      } catch (propertyError) {
        console.error(`Error processing property ${propertyName}:`, propertyError);
        await logResult(
          supabase,
          propertyId,
          "full_cycle",
          "error",
          propertyError instanceof Error ? propertyError.message : "Unknown error",
          null
        );
        results.push({
          propertyId,
          status: "error",
          message: propertyError instanceof Error ? propertyError.message : "Unknown error",
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Auto Day-End Close error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function logResult(
  supabase: any,
  propertyId: string,
  runType: string,
  status: string,
  message: string,
  auditDate: string | null,
  foliosProcessed?: number,
  totalRoomRevenue?: number,
  totalTaxRevenue?: number
) {
  try {
    await supabase.from("auto_run_logs").insert({
      property_id: propertyId,
      run_type: runType,
      status,
      message,
      audit_date: auditDate,
      folios_processed: foliosProcessed,
      total_room_revenue: totalRoomRevenue,
      total_tax_revenue: totalTaxRevenue,
    });
  } catch (logError) {
    console.error("Failed to log result:", logError);
  }
}
