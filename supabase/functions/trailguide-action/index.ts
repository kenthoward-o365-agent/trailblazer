// Executes a TrailGuide write action after the user confirms it.
// Uses the caller's JWT so RLS applies (property access, roles).

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

interface Body {
  propertyId: string;
  tool: string;
  args: Record<string, any>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveSiteId(supabase: any, propertyId: string, ref: any): Promise<{ id: string | null; label: string | null; error?: string }> {
  if (ref === null || ref === undefined || ref === '') return { id: null, label: null };
  const s = String(ref).trim();
  if (UUID_RE.test(s)) {
    const { data } = await supabase.from('sites').select('id, site_number').eq('id', s).eq('property_id', propertyId).maybeSingle();
    if (!data) return { id: null, label: s, error: `Site ${s} not found on this property` };
    return { id: data.id, label: data.site_number };
  }
  // Look up by user-facing site number (case-insensitive exact match)
  const { data } = await supabase
    .from('sites')
    .select('id, site_number')
    .eq('property_id', propertyId)
    .ilike('site_number', s)
    .limit(2);
  if (!data || data.length === 0) return { id: null, label: s, error: `No site found with ID "${s}" on this property` };
  if (data.length > 1) return { id: null, label: s, error: `Multiple sites match "${s}" — please be more specific` };
  return { id: data[0].id, label: data[0].site_number };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization') ?? '';
    if (!auth) return json({ error: 'Not authenticated' }, 401);

    const { propertyId, tool, args } = (await req.json()) as Body;
    if (!propertyId || !tool) return json({ error: 'propertyId and tool required' }, 400);

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return json({ error: 'Not authenticated' }, 401);

    switch (tool) {
      case 'check_in_reservation': {
        const { error } = await supabase
          .from('reservations')
          .update({ status: 'checked_in' })
          .eq('id', args.reservation_id)
          .eq('property_id', propertyId);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, message: 'Guest checked in.' });
      }
      case 'check_out_reservation': {
        const { error } = await supabase
          .from('reservations')
          .update({ status: 'checked_out' })
          .eq('id', args.reservation_id)
          .eq('property_id', propertyId);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, message: 'Guest checked out.' });
      }
      case 'update_work_order_status': {
        const patch: any = { status: args.status };
        if (args.status === 'completed') patch.completed_at = new Date().toISOString();
        const { error } = await supabase
          .from('work_orders')
          .update(patch)
          .eq('id', args.work_order_id)
          .eq('property_id', propertyId);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, message: `Work order set to ${args.status}.` });
      }
      case 'update_site_status': {
        const resolved = await resolveSiteId(supabase, propertyId, args.site_id ?? args.site_number);
        if (resolved.error || !resolved.id) return json({ error: resolved.error ?? 'site_id or site_number required' }, 400);
        const { error } = await supabase
          .from('sites')
          .update({ maintenance_status: args.status })
          .eq('id', resolved.id)
          .eq('property_id', propertyId);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, message: `Site ${resolved.label} marked ${args.status}.` });
      }
      case 'create_work_order': {
        const title = String(args.title ?? '').trim();
        const validCategories = new Set(['plumbing', 'electrical', 'grounds', 'structural', 'site_specific', 'other']);
        const validPriorities = new Set(['low', 'normal', 'high', 'urgent']);
        const category = validCategories.has(args.category) ? args.category : 'other';
        const normalizedPriority = args.priority === 'medium' ? 'normal' : (args.priority ?? 'normal');
        const priority = validPriorities.has(normalizedPriority) ? normalizedPriority : 'normal';

        if (!title) return json({ error: 'Work order title is required' }, 400);
        let siteId: string | null = null;
        if (args.site_id ?? args.site_number) {
          const resolved = await resolveSiteId(supabase, propertyId, args.site_id ?? args.site_number);
          if (resolved.error) return json({ error: resolved.error }, 400);
          siteId = resolved.id;
        }
        const { error, data } = await supabase.from('work_orders').insert({
          property_id: propertyId,
          title,
          description: args.description ? String(args.description).trim() : null,
          category,
          priority,
          status: 'open',
          site_id: siteId,
          location_text: args.location_text ? String(args.location_text).trim() : null,
          reported_by_user_id: userId,
        }).select('wo_number').single();
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, message: `Work order ${data?.wo_number ?? ''} created.` });
      }
      case 'modify_reservation_dates': {
        const patch: any = {};
        if (args.check_in_date) patch.check_in_date = args.check_in_date;
        if (args.check_out_date) patch.check_out_date = args.check_out_date;
        if (!Object.keys(patch).length) return json({ error: 'Provide check_in_date and/or check_out_date' }, 400);
        const { error } = await supabase
          .from('reservations')
          .update(patch)
          .eq('id', args.reservation_id)
          .eq('property_id', propertyId);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, message: `Reservation dates updated${args.confirmation ? ` (${args.confirmation})` : ''}. Folio pricing was NOT recalculated — post an adjustment if needed.` });
      }
      case 'move_reservation_site': {
        const resolved = await resolveSiteId(supabase, propertyId, args.site_id ?? args.site_number);
        if (resolved.error || !resolved.id) return json({ error: resolved.error ?? 'site_id or site_number required' }, 400);
        const { error } = await supabase
          .from('reservations')
          .update({ site_id: resolved.id })
          .eq('id', args.reservation_id)
          .eq('property_id', propertyId);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, message: `Reservation moved to site ${resolved.label}.` });
      }
      case 'cancel_reservation': {
        const patch: any = { status: 'CANCELLED' };
        if (args.reason) {
          const { data: existing } = await supabase
            .from('reservations')
            .select('special_requests')
            .eq('id', args.reservation_id)
            .eq('property_id', propertyId)
            .maybeSingle();
          const prev = (existing?.special_requests ?? '').trim();
          const note = `Cancellation reason: ${String(args.reason).trim()}`;
          patch.special_requests = prev ? `${prev}\n${note}` : note;
        }
        const { error } = await supabase
          .from('reservations')
          .update(patch)
          .eq('id', args.reservation_id)
          .eq('property_id', propertyId);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, message: `Reservation ${args.confirmation ?? ''} cancelled. Refund/deposit handling still runs from the folio page.` });
      }
      case 'post_folio_charge':
      case 'post_folio_adjustment':
      case 'apply_payment_manual': {
        const isCharge = tool === 'post_folio_charge';
        const isPayment = tool === 'apply_payment_manual';
        const isAdjust = tool === 'post_folio_adjustment';
        const amt = Number(args.amount);
        if (!Number.isFinite(amt) || amt === 0) return json({ error: 'amount must be a non-zero number' }, 400);
        if ((isCharge || isPayment) && amt <= 0) return json({ error: 'amount must be positive for charges and payments' }, 400);
        if (!args.description) return json({ error: 'description required' }, 400);
        if (!args.account_id) return json({ error: 'account_id required' }, 400);

        // Locate the reservation's guest ledger account.
        const { data: la, error: laErr } = await supabase
          .from('ledger_accounts')
          .select('id, balance')
          .eq('property_id', propertyId)
          .eq('reservation_id', args.reservation_id)
          .eq('ledger_type', 'guest_ledger')
          .maybeSingle();
        if (laErr) return json({ error: laErr.message }, 400);
        if (!la) return json({ error: 'No guest folio found for that reservation.' }, 400);

        const { data: staffProfile } = await supabase
          .from('staff_profiles')
          .select('first_name, last_name')
          .eq('user_id', userId)
          .maybeSingle();
        const staffName = [staffProfile?.first_name, staffProfile?.last_name].filter(Boolean).join(' ') || 'TrailGuide';

        // Current running balance from most recent posting, else account balance.
        const { data: lastPosting } = await supabase
          .from('folio_postings')
          .select('running_balance')
          .eq('ledger_account_id', la.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        const currentBalance = Number(lastPosting?.running_balance ?? la.balance ?? 0);

        // Convert to (posting_type, signed amount, debit/credit).
        let posting_type: string;
        let postAmount: number;
        let debit_amount = 0;
        let credit_amount = 0;
        if (isPayment) {
          posting_type = 'payment';
          postAmount = -Math.abs(amt);
          credit_amount = Math.abs(amt);
        } else if (isAdjust) {
          posting_type = 'adjustment';
          postAmount = amt;
          if (amt < 0) credit_amount = Math.abs(amt);
          else debit_amount = amt;
        } else {
          posting_type = 'charge';
          postAmount = Math.abs(amt);
          debit_amount = Math.abs(amt);
        }
        const running_balance = currentBalance + postAmount;

        const today = new Date().toISOString().slice(0, 10);
        const { error: pErr } = await supabase.from('folio_postings').insert({
          ledger_account_id: la.id,
          property_id: propertyId,
          posting_type,
          description: String(args.description).trim(),
          amount: postAmount,
          debit_amount,
          credit_amount,
          running_balance,
          posting_date: today,
          posted_by: userId,
          posted_by_name: staffName,
          account_id: args.account_id,
        });
        if (pErr) return json({ error: pErr.message }, 400);
        await supabase.from('ledger_transactions').insert({
          ledger_account_id: la.id,
          property_id: propertyId,
          transaction_type: isPayment ? 'payment' : (isAdjust ? 'adjustment' : 'charge'),
          description: String(args.description).trim(),
          debit_amount,
          credit_amount,
          posted_by_name: staffName,
          account_id: args.account_id,
        });
        const label = isPayment ? 'Payment' : (isAdjust ? 'Adjustment' : 'Charge');
        return json({
          ok: true,
          message: `${label} of ${postAmount.toFixed(2)} posted. New folio balance: ${running_balance.toFixed(2)}. ${isCharge ? 'Note: taxes are NOT auto-calculated for TrailGuide charges — verify or post taxes from the folio page.' : ''}`.trim(),
        });
      }
      case 'set_rate_price': {
        const price = Number(args.price);
        if (!Number.isFinite(price) || price < 0) return json({ error: 'price must be a non-negative number' }, 400);
        // Try update first, insert if none.
        const { data: existing, error: exErr } = await supabase
          .from('rate_site_type_prices')
          .select('id')
          .eq('rate_id', args.rate_id)
          .eq('site_type_id', args.site_type_id)
          .maybeSingle();
        if (exErr) return json({ error: exErr.message }, 400);
        if (existing) {
          const { error } = await supabase
            .from('rate_site_type_prices')
            .update({ price, adjustment_type: null, adjustment_value: null })
            .eq('id', existing.id);
          if (error) return json({ error: error.message }, 400);
        } else {
          const { error } = await supabase.from('rate_site_type_prices').insert({
            property_id: propertyId,
            rate_id: args.rate_id,
            site_type_id: args.site_type_id,
            price,
          });
          if (error) return json({ error: error.message }, 400);
        }
        return json({ ok: true, message: `Nightly price set to $${price.toFixed(2)} on ${args.rate_code ?? 'rate'} for ${args.site_type_name ?? 'site type'}.` });
      }
      // ---------- Setup mode executors ----------
      case 'create_accounts': {
        const rows = (args.accounts ?? []).map((a: any) => ({
          property_id: propertyId,
          name: a.name,
          account_number: a.account_number ?? null,
          account_type: a.account_type,
          external_account_code: a.external_account_code ?? null,
          is_active: true,
        }));
        if (!rows.length) return json({ error: 'No accounts provided' }, 400);
        const { error, data } = await supabase.from('accounts').insert(rows).select('id');
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, message: `Created ${data.length} accounts.` });
      }
      case 'create_taxes': {
        const rows = (args.taxes ?? []).map((t: any) => ({
          property_id: propertyId,
          name: t.name,
          rate: t.rate,
          calculation_method: t.calculation_method ?? 'additive',
          is_active: true,
        }));
        if (!rows.length) return json({ error: 'No taxes provided' }, 400);
        const { error, data } = await supabase.from('account_taxes').insert(rows).select('id');
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, message: `Created ${data.length} taxes.` });
      }
      case 'create_site_types': {
        const rows = (args.site_types ?? []).map((st: any, i: number) => ({
          property_id: propertyId,
          name: st.name,
          code: st.code ?? null,
          description: st.description ?? null,
          sort_order: i,
          is_active: true,
        }));
        if (!rows.length) return json({ error: 'No site types provided' }, 400);
        const { error, data } = await supabase.from('site_types').insert(rows).select('id');
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, message: `Created ${data.length} site types.` });
      }
      case 'bulk_create_sites': {
        const { site_type_id, prefix = '', from, to, pad = 0 } = args;
        if (!site_type_id || from == null || to == null) return json({ error: 'site_type_id, from, to required' }, 400);
        const rows: any[] = [];
        for (let i = from; i <= to; i++) {
          const num = pad ? String(i).padStart(pad, '0') : String(i);
          rows.push({
            property_id: propertyId,
            site_type_id,
            site_number: `${prefix}${num}`,
            is_active: true,
          });
        }
        const { error, data } = await supabase.from('sites').insert(rows).select('id');
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, message: `Created ${data.length} sites.` });
      }
      case 'create_rate': {
        const { error, data } = await supabase.from('rates').insert({
          property_id: propertyId,
          rate_code: args.rate_code,
          description: args.description,
          start_date: args.start_date,
          end_date: args.end_date,
          is_default: !!args.is_default,
          is_base_rate: args.is_base_rate ?? true,
          deposit_requirement: args.deposit_requirement ?? 'first_night',
          revenue_account_id: args.revenue_account_id ?? null,
        }).select('rate_code').single();
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, message: `Created rate ${data.rate_code}.` });
      }
      case 'create_guarantee_options': {
        const rows = (args.options ?? []).map((o: any, i: number) => ({
          property_id: propertyId,
          code: o.code,
          description: o.description,
          sort_order: i,
          is_active: true,
        }));
        if (!rows.length) return json({ error: 'No options provided' }, 400);
        const { error, data } = await supabase.from('guarantee_options').insert(rows).select('id');
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, message: `Created ${data.length} guarantee options.` });
      }
      case 'create_source_of_business': {
        const rows = (args.sources ?? []).map((s: any) => ({
          property_id: propertyId,
          name: s.name,
          code: s.code ?? null,
          is_default: !!s.is_default,
        }));
        if (!rows.length) return json({ error: 'No sources provided' }, 400);
        const { error, data } = await supabase.from('source_of_business').insert(rows).select('id');
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, message: `Created ${data.length} sources of business.` });
      }
      case 'enable_booking_engine': {
        const { error, data } = await supabase
          .from('booking_engine_settings')
          .upsert(
            { property_id: propertyId, is_enabled: true, ...(args.slug ? { public_slug: args.slug } : {}) },
            { onConflict: 'property_id' },
          )
          .select('public_slug')
          .single();
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, message: `Booking engine enabled${data?.public_slug ? ' at /b/' + data.public_slug : ''}.` });
      }
      case 'create_campaign': {
        const channel = args.channel === 'sms' ? 'sms' : 'email';
        const validTriggers = new Set(['manual', 'pre_arrival', 'post_departure', 'in_house']);
        const trigger_type = validTriggers.has(args.trigger_type) ? args.trigger_type : 'manual';
        const { error, data } = await supabase.from('campaigns').insert({
          property_id: propertyId,
          name: args.name,
          channel,
          trigger_type,
          trigger_days: args.trigger_days ?? null,
          subject: args.subject ?? null,
          content: args.content ?? null,
          segment_filters: {},
          status: 'draft',
        }).select('name').single();
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, message: `Created draft campaign "${data.name}". Activate it in CRM to start sending.` });
      }
      case 'send_broadcast': {
        const name = String(args.name ?? '').trim() || `Broadcast ${new Date().toISOString().slice(0, 16)}`;
        const audience = String(args.audience ?? 'in_house');
        const channels: string[] = Array.isArray(args.channels) ? args.channels.filter((c: any) => c === 'email' || c === 'sms') : [];
        if (!channels.length) return json({ error: 'At least one channel (email or sms) is required.' }, 400);
        const subject = args.subject ? String(args.subject) : null;
        const emailBody = args.email_body ? String(args.email_body) : null;
        const smsBody = args.sms_body ? String(args.sms_body) : null;
        if (channels.includes('email') && !emailBody) return json({ error: 'email_body is required when email channel is selected.' }, 400);
        if (channels.includes('sms') && !smsBody) return json({ error: 'sms_body is required when sms channel is selected.' }, 400);

        // Resolve audience → reservations with guest contact info.
        const today = new Date().toISOString().slice(0, 10);
        let q = supabase
          .from('reservations')
          .select('id, guest_id, check_in_date, check_out_date, status, guests(id, first_name, last_name, email, phone)')
          .eq('property_id', propertyId);
        if (audience === 'in_house') q = q.eq('status', 'CHECKED_IN');
        else if (audience === 'arrivals_today') q = q.eq('status', 'CONFIRMED').eq('check_in_date', today);
        else if (audience === 'departures_today') q = q.eq('status', 'CHECKED_IN').eq('check_out_date', today);
        else if (audience === 'all_upcoming') q = q.in('status', ['CONFIRMED', 'PENDING']).gte('check_in_date', today);
        else return json({ error: `Unknown audience "${audience}"` }, 400);

        const { data: reservations, error: resErr } = await q;
        if (resErr) return json({ error: resErr.message }, 400);
        const targets = (reservations ?? []) as any[];
        if (!targets.length) {
          return json({ ok: true, message: `No guests match audience "${audience}". Nothing sent.` });
        }

        // Create one campaign row per channel so send tracking is per-channel.
        const summaries: string[] = [];
        for (const channel of channels) {
          const body = channel === 'email' ? emailBody! : smsBody!;
          const { data: camp, error: cErr } = await supabase.from('campaigns').insert({
            property_id: propertyId,
            name: channels.length > 1 ? `${name} (${channel.toUpperCase()})` : name,
            channel,
            trigger_type: 'manual',
            subject: channel === 'email' ? subject : null,
            content: body,
            segment_filters: { broadcast_audience: audience },
            status: 'active',
          }).select('id, name').single();
          if (cErr) return json({ error: `Campaign create failed: ${cErr.message}` }, 400);

          // Fire mocked sends: one row per recipient, skipping missing contact info.
          const sendRows: any[] = [];
          for (const r of targets) {
            const g = r.guests;
            if (!g) continue;
            if (channel === 'email' && !g.email) continue;
            if (channel === 'sms' && !g.phone) continue;
            sendRows.push({
              campaign_id: camp.id,
              guest_id: g.id,
              reservation_id: r.id,
              status: 'sent',
            });
          }
          if (sendRows.length) {
            const { error: sErr } = await supabase.from('campaign_sends').insert(sendRows);
            if (sErr) return json({ error: `Send tracking failed: ${sErr.message}` }, 400);
            await supabase
              .from('campaigns')
              .update({ sent_count: sendRows.length, status: 'completed' })
              .eq('id', camp.id);
          }
          summaries.push(`${sendRows.length} ${channel}`);
        }

        return json({
          ok: true,
          message: `Broadcast "${name}" sent to ${audience.replace('_', ' ')} — ${summaries.join(', ')}. (Delivery is mocked in this environment; recipients and content are recorded on the campaign.)`,
        });
      }
      case 'create_pos_outlet': {
        const { error, data } = await supabase.from('pos_outlets').insert({
          property_id: propertyId,
          name: args.name,
          is_active: true,
        }).select('name').single();
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, message: `Created POS outlet "${data.name}".` });
      }
      case 'create_custom_role': {
        const rows = (args.roles ?? []).map((r: any) => ({
          property_id: propertyId,
          name: r.name,
          description: r.description ?? null,
          permissions: {},
        }));
        if (!rows.length) return json({ error: 'No roles provided' }, 400);
        const { error, data } = await supabase.from('custom_roles').insert(rows).select('id');
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, message: `Created ${data.length} custom role${data.length === 1 ? '' : 's'}.` });
      }
      case 'mark_step_done': {
        if (!args.step) return json({ error: 'step required' }, 400);
        const { data: existing } = await supabase
          .from('onboarding_progress')
          .select('steps')
          .eq('property_id', propertyId)
          .maybeSingle();
        const steps = { ...((existing?.steps as any) ?? {}), [args.step]: 'complete' };
        const { error } = await supabase
          .from('onboarding_progress')
          .upsert(
            { property_id: propertyId, steps, current_step: args.next ?? null },
            { onConflict: 'property_id' },
          );
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, message: `Marked ${args.step} complete.` });
      }
      default:
        return json({ error: `Unknown tool ${tool}` }, 400);
    }
  } catch (e: any) {
    return json({ error: e?.message || 'Internal error' }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
