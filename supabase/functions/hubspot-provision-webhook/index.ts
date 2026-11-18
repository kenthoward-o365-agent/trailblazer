// HubSpot -> Trailblazer provisioning webhook.
// Configure a HubSpot workflow to POST here when a deal is Closed Won.
// Body shape (map fields in HubSpot workflow):
// {
//   webhook_secret: "...",
//   org_name, admin_first_name, admin_last_name, admin_email,
//   max_sites, price_per_site, flat_amount, pricing_model, billing_cycle,
//   contract_start_date, contract_end_date
// }
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  try {
    const body = await req.json()

    // Forward to provision-organization with internal flag
    const forwardUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/provision-organization`
    const res = await fetch(forwardUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Service role bypasses the JWT check on the target function
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ ...body, internal_source: 'hubspot' }),
    })

    const data = await res.json()
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? 'Webhook failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
