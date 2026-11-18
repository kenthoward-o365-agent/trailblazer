// TrailGuide AI Agent — chat endpoint with tool-calling.
// - Read-only tools execute server-side inside the loop.
// - Write tools are returned as `proposed_actions` for the client to confirm.
//
// Request:  { messages, propertyId, kb: [{id,title,description,content,category}] }
// Response: { reply: string, proposed_actions: Array<{ id, tool, label, args }> }

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

type Msg = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string; tool_calls?: any[] };

interface Body {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  propertyId: string;
  auditDate?: string; // YYYY-MM-DD from client's audit date context
  kb?: Array<{ id: string; title: string; description: string; content: string; category: string }>;
  mode?: 'operate' | 'setup';
  setupStep?: string;
}

// ------------------- Tool schemas exposed to the model -------------------

const READ_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_property_snapshot',
      description: 'Operational snapshot for the current property using the audit date: today\'s arrivals, departures, in-house count, occupancy %, revenue posted today, and open work orders count.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_reservations',
      description: 'Search reservations by guest name, confirmation number, or site number. Returns up to 15 matches with confirmation, guest, dates, status, balance.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Name, confirmation, or site number' },
          status: { type: 'string', description: 'Optional status filter: confirmed, checked_in, checked_out, cancelled, no_show' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_guests',
      description: 'Search guest profiles by name, email, or phone. Returns up to 15.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_work_orders',
      description: 'List work orders. Filter by status (open, in_progress, on_hold, completed, cancelled) and/or category (plumbing, electrical, grounds, structural, site_specific).',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          category: { type: 'string' },
          limit: { type: 'number', description: 'Default 20' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_site_status_overview',
      description: 'Counts of sites by status (available, occupied, dirty, clean, out_of_order) plus totals.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_financial_summary',
      description: 'Revenue, payments, ADR, and posting counts over the last N days (default 7). Uses folio_postings.',
      parameters: {
        type: 'object',
        properties: { days: { type: 'number' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_knowledge_base',
      description: 'Search the in-app Knowledge Base for how-to answers. Returns matching articles with full content.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'quote_stay',
      description: 'Estimate the price of a stay for a given site type and date range using the property\'s default (base) rate. Returns nightly price × nights, before taxes/add-ons.',
      parameters: {
        type: 'object',
        properties: {
          site_type_id: { type: 'string' },
          check_in: { type: 'string', description: 'YYYY-MM-DD' },
          check_out: { type: 'string', description: 'YYYY-MM-DD' },
          rate_id: { type: 'string', description: 'Optional. Defaults to the property\'s base rate.' },
        },
        required: ['site_type_id', 'check_in', 'check_out'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_rates',
      description: 'List rate plans for the current property.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_ledger_accounts',
      description: 'List GL accounts on the Chart of Accounts. Filter by type (asset, liability, revenue, expense, equity).',
      parameters: {
        type: 'object',
        properties: { account_type: { type: 'string' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_site_types',
      description: 'List site types for the current property with id, name, code.',
      parameters: { type: 'object', properties: {} },
    },
  },
];

const WRITE_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'check_in_reservation',
      description: 'Check in a reservation (moves status to checked_in). REQUIRES USER CONFIRMATION.',
      parameters: {
        type: 'object',
        properties: {
          reservation_id: { type: 'string' },
          confirmation: { type: 'string', description: 'Confirmation number for display' },
          guest_name: { type: 'string' },
        },
        required: ['reservation_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_out_reservation',
      description: 'Check out a reservation. REQUIRES USER CONFIRMATION.',
      parameters: {
        type: 'object',
        properties: {
          reservation_id: { type: 'string' },
          confirmation: { type: 'string' },
          guest_name: { type: 'string' },
        },
        required: ['reservation_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_work_order_status',
      description: 'Change a work order status. REQUIRES USER CONFIRMATION.',
      parameters: {
        type: 'object',
        properties: {
          work_order_id: { type: 'string' },
          wo_number: { type: 'string' },
          status: { type: 'string', description: 'open | in_progress | on_hold | completed | cancelled' },
        },
        required: ['work_order_id', 'status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_site_status',
      description: 'Change a site\'s status (e.g. mark dirty/clean/out_of_order). REQUIRES USER CONFIRMATION.',
      parameters: {
        type: 'object',
        properties: {
          site_id: { type: 'string', description: 'Either the user-facing site number (e.g. "A1", "101") or a UUID. Prefer the site number the user says.' },
          site_number: { type: 'string', description: 'Alias for site_id — user-facing site number.' },
          status: { type: 'string' },
        },
        required: ['status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_work_order',
      description: 'Open a new work order. REQUIRES USER CONFIRMATION.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          category: { type: 'string', description: 'plumbing | electrical | grounds | structural | site_specific' },
          priority: { type: 'string', description: 'low | normal | high | urgent' },
          site_id: { type: 'string', description: 'Optional. Accepts the user-facing site number (e.g. "A1", "101") or a UUID. Omit for park-wide.' },
          location_text: { type: 'string', description: 'Free-text location if not tied to a site.' },
        },
        required: ['title', 'category'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'modify_reservation_dates',
      description: 'Change a reservation\'s check-in and/or check-out dates. Does not re-price the folio. REQUIRES USER CONFIRMATION.',
      parameters: {
        type: 'object',
        properties: {
          reservation_id: { type: 'string' },
          confirmation: { type: 'string' },
          check_in_date: { type: 'string', description: 'YYYY-MM-DD (optional)' },
          check_out_date: { type: 'string', description: 'YYYY-MM-DD (optional)' },
        },
        required: ['reservation_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'move_reservation_site',
      description: 'Reassign a reservation to a different site. REQUIRES USER CONFIRMATION.',
      parameters: {
        type: 'object',
        properties: {
          reservation_id: { type: 'string' },
          confirmation: { type: 'string' },
          site_id: { type: 'string', description: 'Either the user-facing site number (e.g. "A1", "101") or a UUID. Prefer what the user typed.' },
          site_number: { type: 'string', description: 'Alias for site_id — user-facing site number.' },
        },
        required: ['reservation_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_reservation',
      description: 'Cancel a reservation. Optional reason is appended to special requests. Does NOT auto-refund deposits — handle those from the folio. REQUIRES USER CONFIRMATION.',
      parameters: {
        type: 'object',
        properties: {
          reservation_id: { type: 'string' },
          confirmation: { type: 'string' },
          guest_name: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['reservation_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'post_folio_charge',
      description: 'Post a charge to a reservation\'s guest folio. Amount must be positive. Pick a revenue account (use list_ledger_accounts with account_type="revenue" if you do not know the id). REQUIRES USER CONFIRMATION.',
      parameters: {
        type: 'object',
        properties: {
          reservation_id: { type: 'string' },
          confirmation: { type: 'string' },
          account_id: { type: 'string', description: 'Revenue GL account id from accounts table.' },
          amount: { type: 'number' },
          description: { type: 'string' },
        },
        required: ['reservation_id', 'account_id', 'amount', 'description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'post_folio_adjustment',
      description: 'Post an adjustment (usually a credit) to a reservation folio. Use a NEGATIVE amount to reduce the balance (e.g. -25 for a $25 goodwill credit); positive to add. REQUIRES USER CONFIRMATION.',
      parameters: {
        type: 'object',
        properties: {
          reservation_id: { type: 'string' },
          confirmation: { type: 'string' },
          account_id: { type: 'string', description: 'GL account id (usually the same revenue account being adjusted).' },
          amount: { type: 'number', description: 'Signed. Negative reduces guest balance.' },
          description: { type: 'string' },
        },
        required: ['reservation_id', 'account_id', 'amount', 'description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'apply_payment_manual',
      description: 'Record a manual payment against a reservation folio (cash, check, prior card capture recorded outside Adyen). For card payments, use Adyen from the folio page instead. REQUIRES USER CONFIRMATION.',
      parameters: {
        type: 'object',
        properties: {
          reservation_id: { type: 'string' },
          confirmation: { type: 'string' },
          account_id: { type: 'string', description: 'Payment/asset GL account id (e.g. Cash, Check clearing).' },
          amount: { type: 'number', description: 'Positive dollar amount received.' },
          description: { type: 'string', description: 'e.g. "Cash payment", "Check #1234".' },
        },
        required: ['reservation_id', 'account_id', 'amount', 'description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_rate_price',
      description: 'Set the nightly price of a rate for a specific site type. Overwrites the current fixed price. REQUIRES USER CONFIRMATION.',
      parameters: {
        type: 'object',
        properties: {
          rate_id: { type: 'string' },
          rate_code: { type: 'string' },
          site_type_id: { type: 'string' },
          site_type_name: { type: 'string' },
          price: { type: 'number' },
        },
        required: ['rate_id', 'site_type_id', 'price'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_broadcast',
      description: 'Send an immediate one-off message (email and/or SMS) to a chosen audience of guests — e.g. "the pool is closed today". Creates a campaign record and sends right away. REQUIRES USER CONFIRMATION.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Short internal name for the broadcast (e.g. "Pool closed 2026-07-09").' },
          audience: {
            type: 'string',
            description: 'in_house (currently checked-in) | arrivals_today | departures_today | all_upcoming (confirmed/pending future stays)',
          },
          channels: {
            type: 'array',
            items: { type: 'string' },
            description: 'Any combination of "email" and "sms".',
          },
          subject: { type: 'string', description: 'Email subject (ignored for SMS-only).' },
          email_body: { type: 'string', description: 'Email body (HTML or plain text). Supports {{first_name}}, {{last_name}}.' },
          sms_body: { type: 'string', description: 'SMS body, plain text. Supports {{first_name}}, {{last_name}}.' },
        },
        required: ['name', 'audience', 'channels'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_campaign',
      description: 'Create a saved campaign in draft (email or SMS) — for scheduled/automated sends (pre-arrival, post-departure, in-house, or manual). Does NOT send. REQUIRES USER CONFIRMATION.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          channel: { type: 'string', description: 'email | sms' },
          trigger_type: { type: 'string', description: 'manual | pre_arrival | post_departure | in_house' },
          trigger_days: { type: 'number', description: 'Days offset for pre_arrival/post_departure.' },
          subject: { type: 'string' },
          content: { type: 'string', description: 'Message body. Supports {{first_name}}, {{last_name}}, {{check_in_date}}, {{check_out_date}}.' },
        },
        required: ['name', 'channel'],
      },
    },
  },
];

const SETUP_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'create_accounts',
      description: 'Create one or more GL accounts on the Chart of Accounts. REQUIRES USER CONFIRMATION.',
      parameters: {
        type: 'object',
        properties: {
          accounts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                account_number: { type: 'string' },
                account_type: { type: 'string', description: 'asset | liability | equity | revenue | expense' },
                external_account_code: { type: 'string' },
              },
              required: ['name', 'account_type'],
            },
          },
        },
        required: ['accounts'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_taxes',
      description: 'Create tax records. REQUIRES USER CONFIRMATION.',
      parameters: {
        type: 'object',
        properties: {
          taxes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                rate: { type: 'number', description: 'Percent, e.g. 7.5' },
                calculation_method: { type: 'string', description: 'additive | compound' },
              },
              required: ['name', 'rate'],
            },
          },
        },
        required: ['taxes'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_site_types',
      description: 'Create site type categories. REQUIRES USER CONFIRMATION.',
      parameters: {
        type: 'object',
        properties: {
          site_types: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                code: { type: 'string' },
                description: { type: 'string' },
              },
              required: ['name'],
            },
          },
        },
        required: ['site_types'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'bulk_create_sites',
      description: 'Create a numbered range of sites of one site type. REQUIRES USER CONFIRMATION.',
      parameters: {
        type: 'object',
        properties: {
          site_type_id: { type: 'string' },
          prefix: { type: 'string' },
          from: { type: 'number' },
          to: { type: 'number' },
          pad: { type: 'number', description: 'Zero-pad width, e.g. 3 for 001' },
        },
        required: ['site_type_id', 'from', 'to'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_rate',
      description: 'Create a rate plan. REQUIRES USER CONFIRMATION.',
      parameters: {
        type: 'object',
        properties: {
          rate_code: { type: 'string' },
          description: { type: 'string' },
          start_date: { type: 'string' },
          end_date: { type: 'string' },
          is_default: { type: 'boolean' },
          is_base_rate: { type: 'boolean' },
          deposit_requirement: { type: 'string' },
          revenue_account_id: { type: 'string' },
        },
        required: ['rate_code'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_guarantee_options',
      description: 'Create reservation guarantee options. REQUIRES USER CONFIRMATION.',
      parameters: {
        type: 'object',
        properties: {
          options: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                description: { type: 'string' },
              },
              required: ['code', 'description'],
            },
          },
        },
        required: ['options'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_source_of_business',
      description: 'Create source-of-business tags. REQUIRES USER CONFIRMATION.',
      parameters: {
        type: 'object',
        properties: {
          sources: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                code: { type: 'string' },
                is_default: { type: 'boolean' },
              },
              required: ['name'],
            },
          },
        },
        required: ['sources'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'enable_booking_engine',
      description: 'Enable the public booking engine and optionally set its slug. REQUIRES USER CONFIRMATION.',
      parameters: {
        type: 'object',
        properties: { slug: { type: 'string' } },
      },
    },
  },
  // create_campaign and send_broadcast are defined in WRITE_TOOLS above and are
  // also useful in setup mode via the CRM step — re-expose them here.
  ...[
    'send_broadcast',
    'create_campaign',
  ].map((n) => WRITE_TOOLS.find((t) => t.function.name === n)!),
  {
    type: 'function',
    function: {
      name: 'create_pos_outlet',
      description: 'Create a Point-of-Sale outlet. REQUIRES USER CONFIRMATION.',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_custom_role',
      description: 'Create custom roles (permissions default to none; user grants them later). REQUIRES USER CONFIRMATION.',
      parameters: {
        type: 'object',
        properties: {
          roles: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
              },
              required: ['name'],
            },
          },
        },
        required: ['roles'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mark_step_done',
      description: 'Mark an onboarding step complete. REQUIRES USER CONFIRMATION.',
      parameters: {
        type: 'object',
        properties: {
          step: { type: 'string' },
          next: { type: 'string' },
        },
        required: ['step'],
      },
    },
  },
];

const WRITE_TOOL_NAMES = new Set([
  ...WRITE_TOOLS.map(t => t.function.name),
  ...SETUP_TOOLS.map(t => t.function.name),
]);

// ------------------- Tool executors -------------------

async function runReadTool(name: string, args: any, ctx: {
  supabase: any; propertyId: string; auditDate: string; kb: Body['kb'];
}): Promise<any> {
  const { supabase, propertyId, auditDate, kb } = ctx;
  try {
    switch (name) {
      case 'get_property_snapshot': {
        const [arrivals, departures, inHouse, sites, wo, revenue] = await Promise.all([
          supabase.from('reservations').select('id', { count: 'exact', head: true }).eq('property_id', propertyId).eq('check_in_date', auditDate).in('status', ['confirmed', 'checked_in']),
          supabase.from('reservations').select('id', { count: 'exact', head: true }).eq('property_id', propertyId).eq('check_out_date', auditDate).eq('status', 'checked_in'),
          supabase.from('reservations').select('id', { count: 'exact', head: true }).eq('property_id', propertyId).eq('status', 'checked_in'),
          supabase.from('sites').select('id, maintenance_status, is_active', { count: 'exact' }).eq('property_id', propertyId),
          supabase.from('work_orders').select('id', { count: 'exact', head: true }).eq('property_id', propertyId).in('status', ['open', 'in_progress', 'on_hold']),
          supabase.from('folio_postings').select('amount, posting_type').eq('property_id', propertyId).eq('posting_date', auditDate),
        ]);
        const totalSites = sites.count ?? 0;
        const occupied = inHouse.count ?? 0;
        const revenueToday = (revenue.data ?? [])
          .filter((r: any) => r.posting_type === 'charge')
          .reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
        return {
          audit_date: auditDate,
          arrivals_today: arrivals.count ?? 0,
          departures_today: departures.count ?? 0,
          in_house: occupied,
          total_sites: totalSites,
          occupancy_pct: totalSites ? Math.round((occupied / totalSites) * 100) : 0,
          revenue_posted_today: revenueToday,
          open_work_orders: wo.count ?? 0,
        };
      }
      case 'search_reservations': {
        const q = String(args.query || '').trim();
        let query = supabase
          .from('reservations')
          .select('id, confirmation_number, check_in_date, check_out_date, status, site_id, sites(site_number), guests(first_name, last_name, email)')
          .eq('property_id', propertyId)
          .limit(15);
        if (args.status) query = query.eq('status', args.status);
        if (q) query = query.ilike('confirmation_number', `%${q}%`);
        const { data, error } = await query;
        if (error) return { error: error.message };
        // If no matches by confirmation, retry by guest name
        if (q && (!data || data.length === 0)) {
          const { data: byGuest } = await supabase
            .from('reservations')
            .select('id, confirmation_number, check_in_date, check_out_date, status, site_id, sites(site_number), guests!inner(first_name, last_name, email)')
            .eq('property_id', propertyId)
            .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`, { referencedTable: 'guests' })
            .limit(15);
          return { results: byGuest ?? [] };
        }
        return { results: data };
      }
      case 'search_guests': {
        const q = String(args.query || '').trim();
        const { data, error } = await supabase
          .from('guests')
          .select('id, first_name, last_name, email, phone, city, state')
          .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
          .limit(15);
        if (error) return { error: error.message };
        return { results: data };
      }
      case 'list_work_orders': {
        let query = supabase
          .from('work_orders')
          .select('id, wo_number, title, category, priority, status, assigned_to, site_id, location_text, created_at')
          .eq('property_id', propertyId)
          .order('created_at', { ascending: false })
          .limit(Number(args.limit) || 20);
        if (args.status) query = query.eq('status', args.status);
        if (args.category) query = query.eq('category', args.category);
        const { data, error } = await query;
        if (error) return { error: error.message };
        return { results: data };
      }
      case 'get_site_status_overview': {
        const { data, error } = await supabase
          .from('sites')
          .select('maintenance_status, is_active')
          .eq('property_id', propertyId);
        if (error) return { error: error.message };
        const counts: Record<string, number> = {};
        let active = 0;
        (data ?? []).forEach((r: any) => {
          if (r.is_active) active++;
          const k = r.maintenance_status || 'clean';
          counts[k] = (counts[k] || 0) + 1;
        });
        return { total: data?.length ?? 0, active, by_maintenance_status: counts };
      }
      case 'get_financial_summary': {
        const days = Number(args.days) || 7;
        const from = new Date(auditDate);
        from.setDate(from.getDate() - (days - 1));
        const fromStr = from.toISOString().slice(0, 10);
        const { data, error } = await supabase
          .from('folio_postings')
          .select('amount, posting_type, posting_date')
          .eq('property_id', propertyId)
          .gte('posting_date', fromStr)
          .lte('posting_date', auditDate);
        if (error) return { error: error.message };
        let revenue = 0, payments = 0, charges = 0;
        (data ?? []).forEach((r: any) => {
          const amt = Number(r.amount || 0);
          if (r.posting_type === 'payment') payments += Math.abs(amt);
          else if (r.posting_type === 'charge') { charges += amt; revenue += amt; }
        });
        return {
          from: fromStr, to: auditDate, days,
          revenue, payments, charges, postings: data?.length ?? 0,
        };
      }
      case 'search_knowledge_base': {
        const q = String(args.query || '').toLowerCase().split(/\s+/).filter(Boolean);
        if (!kb?.length) return { error: 'KB not provided' };
        const scored = kb.map(a => {
          const hay = `${a.title} ${a.description} ${a.content}`.toLowerCase();
          const score = q.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0);
          return { a, score };
        }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
        return {
          results: scored.map(x => ({
            id: x.a.id, title: x.a.title, category: x.a.category,
            content: x.a.content.slice(0, 4000),
          })),
        };
      }
      case 'list_rates': {
        const { data, error } = await supabase
          .from('rates')
          .select('id, rate_code, description, is_default, is_base_rate, start_date, end_date, deposit_requirement')
          .eq('property_id', propertyId)
          .order('is_default', { ascending: false });
        if (error) return { error: error.message };
        return { results: data };
      }
      case 'list_site_types': {
        const { data, error } = await supabase
          .from('site_types')
          .select('id, name, code, description, is_active')
          .eq('property_id', propertyId)
          .order('sort_order', { ascending: true });
        if (error) return { error: error.message };
        return { results: data };
      }
      case 'list_ledger_accounts': {
        let q = supabase
          .from('accounts')
          .select('id, account_number, name, account_type, is_active, external_account_code')
          .eq('property_id', propertyId)
          .eq('is_active', true)
          .order('account_number', { ascending: true })
          .limit(300);
        if (args.account_type) q = q.eq('account_type', args.account_type);
        const { data, error } = await q;
        if (error) return { error: error.message };
        return { results: data };
      }
      case 'quote_stay': {
        const { site_type_id, check_in, check_out } = args;
        if (!site_type_id || !check_in || !check_out) return { error: 'site_type_id, check_in, check_out required' };
        const nights = Math.max(1, Math.round((new Date(check_out).getTime() - new Date(check_in).getTime()) / 86400000));
        let rateQuery = supabase
          .from('rates')
          .select('id, rate_code, is_default, is_base_rate')
          .eq('property_id', propertyId);
        if (args.rate_id) rateQuery = rateQuery.eq('id', args.rate_id);
        else rateQuery = rateQuery.eq('is_default', true).limit(1);
        const { data: rates, error: rErr } = await rateQuery;
        if (rErr) return { error: rErr.message };
        const rate = rates?.[0];
        if (!rate) return { error: 'No matching rate (no default rate configured?).' };
        const { data: priceRows, error: pErr } = await supabase
          .from('rate_site_type_prices')
          .select('price')
          .eq('rate_id', rate.id)
          .eq('site_type_id', site_type_id)
          .limit(1);
        if (pErr) return { error: pErr.message };
        const nightly = Number(priceRows?.[0]?.price ?? 0);
        return {
          rate_code: rate.rate_code,
          nights,
          nightly_price: nightly,
          subtotal: +(nightly * nights).toFixed(2),
          note: 'Subtotal before taxes and add-ons.',
        };
      }
    }
    return { error: `Unknown tool ${name}` };
  } catch (e: any) {
    return { error: e?.message || String(e) };
  }
}

// ------------------- Main handler -------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) {
      return json({ error: 'LOVABLE_API_KEY not configured' }, 500);
    }
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) return json({ error: 'Not authenticated' }, 401);

    const body = (await req.json()) as Body;
    if (!body.messages?.length || !body.propertyId) {
      return json({ error: 'messages and propertyId required' }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const auditDate = body.auditDate || new Date().toISOString().slice(0, 10);

    // Compact KB index in system prompt so the model knows what to search.
    const kbIndex = (body.kb ?? [])
      .slice(0, 200)
      .map(a => `- [${a.id}] ${a.title} — ${a.description}`)
      .join('\n');

    const mode = body.mode === 'setup' ? 'setup' : 'operate';
    const setupStep = body.setupStep || 'coa';

    const SETUP_STEPS_TEXT = `1. coa — Chart of Accounts
2. taxes — Taxes & Revenue Streams
3. users — Roles & Users
4. site_types — Site Types
5. sites — Sites & Map
6. rates — Rates (Daily, Weekly, Monthly, Packages)
7. reservation_settings — Reservation Settings
8. booking_engine — Booking Engine
9. crm — CRM: Registration Card, Confirmation, OTA→Direct
10. pos — POS (optional)`;

    const operatePrompt = `You are TrailGuide, the AI operations agent for the Trailblazer Campground PMS (Operate mode).

You help staff with: financial reporting, forecasting, guest profiles/CRM, site turnover, work orders, POS lookups, and how-to questions from the knowledge base. You can also take actions in the app (check-in, check-out, post charges, open work orders, update site status).

RULES:
- Current property_id: ${body.propertyId}
- Today (audit date): ${auditDate} — always use this for "today", never the calendar date.
- Prefer TOOLS over guessing. If the user asks for numbers, call the appropriate read tool.
- For how-to questions, call search_knowledge_base and cite article titles in **bold**.
- For actions, call the matching write tool. The user will confirm before it runs — never claim you already did it.
- Never invent IDs, confirmation numbers, or account codes. Look them up first.
- Keep replies concise. Use markdown headings/bullets when helpful.
- To notify guests of something (pool closed, boil-water notice, event, weather), use send_broadcast. Pick the audience (in_house / arrivals_today / departures_today / all_upcoming) and channels (email, sms, or both). Draft a short subject + body yourself if the user only describes the situation. Show your draft in chat before proposing the action so the user can tweak wording.
- To set up an automated or scheduled campaign (pre-arrival email, post-departure survey), use create_campaign — that saves it as a draft; the user activates it in the CRM page.
- Reservations: use modify_reservation_dates, move_reservation_site, cancel_reservation. Always call search_reservations first to look up the real reservation_id; never guess IDs. For date changes and site moves, do NOT try to recalculate rates — say the folio may need a rate adjustment and offer to post_folio_adjustment.
- Folio: use post_folio_charge for new charges, post_folio_adjustment for credits (negative amount to reduce balance), apply_payment_manual for cash/check. For card payments, direct the user to the Adyen flow on the folio page — do not attempt it here. Before posting, call list_ledger_accounts to look up the correct account_id (account_type="revenue" for charges/adjustments, "asset" for payments). Never invent account codes.
- Rates & availability: use quote_stay for price estimates (needs site_type_id + dates; use list_site_types to resolve names). Use set_rate_price to update a rate's nightly price for a given site type. To block a specific site, use update_site_status with status="out_of_order"; to unblock, status="clean". Multi-day blocks on a site aren't modeled — if the user asks for a date range, tell them to also open a work order and mark the site out_of_order today.

KNOWLEDGE BASE INDEX (use search_knowledge_base to fetch full content):
${kbIndex}`;

    const setupPrompt = `You are TrailGuide (Setup mode) — the onboarding guide for the Trailblazer Campground PMS.

Your job is to walk the user through the 10 setup steps below and, when they approve, actually create the configuration in their property.

STEPS:
${SETUP_STEPS_TEXT}

CURRENT STEP: ${setupStep}
Current property_id: ${body.propertyId}

RULES:
- Focus on the current step first. Ask short, plain-English questions.
- When you have enough info to create something, call the matching setup tool (create_accounts, create_taxes, create_site_types, bulk_create_sites, create_rate, create_guarantee_options, create_source_of_business, enable_booking_engine, create_campaign, create_pos_outlet, create_custom_role). The user will confirm before it runs.
- One tool call per turn when possible. If you have no action yet, just reply with a question.
- Never invent GL account numbers the user didn't confirm. For a default CoA proposal, use standard campground numbering (1000/2000/3000/4000/5000/6000).
- For roles (step "users"), use create_custom_role. Permissions default to none; the user grants them in the Users page. Do NOT try to invite users — say to invite them from the Users page.
- Call mark_step_done when the user confirms the current step is complete.
- All writes are scoped to the user's currently selected property; never include property_id in the payload.

KNOWLEDGE BASE INDEX (use search_knowledge_base to fetch full content):
${kbIndex}`;

    const systemPrompt = mode === 'setup' ? setupPrompt : operatePrompt;

    const messages: Msg[] = [
      { role: 'system', content: systemPrompt },
      ...body.messages.map(m => ({ role: m.role, content: m.content })),
    ];

    const tools = mode === 'setup'
      ? [...READ_TOOLS, ...SETUP_TOOLS]
      : [...READ_TOOLS, ...WRITE_TOOLS];
    const proposedActions: any[] = [];
    let finalReply = '';

    // Bounded tool-calling loop.
    for (let step = 0; step < 6; step++) {
      const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages,
          tools,
          tool_choice: 'auto',
        }),
      });

      if (!resp.ok) {
        const txt = await resp.text();
        const status = resp.status === 429 || resp.status === 402 ? resp.status : 500;
        return json({ error: `AI gateway ${resp.status}: ${txt.slice(0, 300)}` }, status);
      }

      const data = await resp.json();
      const choice = data.choices?.[0];
      const msg = choice?.message;
      if (!msg) return json({ error: 'Empty AI response' }, 500);

      const toolCalls = msg.tool_calls ?? [];
      if (!toolCalls.length) {
        finalReply = msg.content ?? '';
        break;
      }

      // Push assistant message with tool_calls into history.
      messages.push({ role: 'assistant', content: msg.content ?? '', tool_calls: toolCalls });

      // Split write vs read. If any writes, collect as proposed and stop.
      const writes = toolCalls.filter((c: any) => WRITE_TOOL_NAMES.has(c.function?.name));
      if (writes.length) {
        for (const c of writes) {
          let args: any = {};
          try { args = JSON.parse(c.function.arguments || '{}'); } catch { /* ignore */ }
          proposedActions.push({
            id: c.id,
            tool: c.function.name,
            args,
          });
        }
        // Also respond to any read calls in the same batch so we can produce a final reply.
        const reads = toolCalls.filter((c: any) => !WRITE_TOOL_NAMES.has(c.function?.name));
        for (const c of reads) {
          let args: any = {};
          try { args = JSON.parse(c.function.arguments || '{}'); } catch {}
          const result = await runReadTool(c.function.name, args, { supabase, propertyId: body.propertyId, auditDate, kb: body.kb });
          messages.push({ role: 'tool', tool_call_id: c.id, content: JSON.stringify(result).slice(0, 12000) });
        }
        // Return placeholder tool results for writes so model finishes.
        for (const c of writes) {
          messages.push({ role: 'tool', tool_call_id: c.id, content: JSON.stringify({ status: 'pending_user_confirmation' }) });
        }
        // One more turn to get final summary text.
        continue;
      }

      // All reads — execute in parallel.
      const results = await Promise.all(toolCalls.map(async (c: any) => {
        let args: any = {};
        try { args = JSON.parse(c.function.arguments || '{}'); } catch {}
        const result = await runReadTool(c.function.name, args, { supabase, propertyId: body.propertyId, auditDate, kb: body.kb });
        return { id: c.id, result };
      }));
      for (const r of results) {
        messages.push({ role: 'tool', tool_call_id: r.id, content: JSON.stringify(r.result).slice(0, 12000) });
      }
    }

    return json({ reply: finalReply || '_(no response)_', proposed_actions: proposedActions });
  } catch (e: any) {
    console.error('trailguide-chat error', e);
    return json({ error: e?.message || 'Internal error' }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
