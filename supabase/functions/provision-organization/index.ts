// Provision a new Trailblazer customer: creates org, property, admin user,
// seeds defaults, and returns a magic invite link. Callable by super admins
// (from Admin app) or via HubSpot webhook wrapper.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Payload {
  org_name: string
  billing_email?: string
  admin_first_name: string
  admin_last_name: string
  admin_email: string
  property_name?: string
  timezone?: string
  country?: string
  max_sites?: number
  pricing_model?: 'per_site' | 'flat'
  price_per_site?: number
  flat_amount?: number
  billing_cycle?: 'monthly' | 'annual'
  contract_start_date?: string | null
  contract_end_date?: string | null
  // Internal: bypass super-admin auth check (webhook path)
  internal_source?: 'hubspot' | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const body = (await req.json()) as Payload & { webhook_secret?: string }

    // Auth: either super admin JWT or shared webhook secret
    let provisioner: string | null = null
    if (body.internal_source === 'hubspot') {
      const expected = Deno.env.get('PROVISIONING_WEBHOOK_SECRET')
      if (!expected || body.webhook_secret !== expected) {
        return json({ error: 'Invalid webhook secret' }, 401)
      }
    } else {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) return json({ error: 'Unauthorized' }, 401)
      const token = authHeader.replace('Bearer ', '')
      const { data: userData, error: userErr } = await admin.auth.getUser(token)
      if (userErr || !userData.user) return json({ error: 'Invalid token' }, 401)
      provisioner = userData.user.id
      const { data: roles } = await admin
        .from('user_roles')
        .select('role')
        .eq('user_id', provisioner)
      if (!roles?.some((r) => r.role === 'super_admin')) {
        return json({ error: 'Super admin required' }, 403)
      }
    }

    // Validate
    const required = ['org_name', 'admin_first_name', 'admin_last_name', 'admin_email']
    for (const f of required) {
      if (!(body as any)[f]) return json({ error: `Missing field: ${f}` }, 400)
    }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRe.test(body.admin_email)) return json({ error: 'Invalid admin_email' }, 400)

    // 1. Create organization (client_number trigger auto-assigns)
    const { data: org, error: orgErr } = await admin
      .from('organizations')
      .insert({
        name: body.org_name,
        billing_email: body.billing_email ?? body.admin_email,
        payment_status: 'active',
      })
      .select()
      .single()
    if (orgErr) throw new Error(`org create failed: ${orgErr.message}`)

    // 2. Create property (draft — needs onboarding)
    const { data: property, error: propErr } = await admin
      .from('properties')
      .insert({
        name: body.property_name || body.org_name,
        organization_id: org.id,
        address: '',
        timezone: body.timezone || 'America/Los_Angeles',
        country: body.country || 'US',
        max_sites: body.max_sites || 50,
        property_type: 'campground',
        inventory_mode: 'unit_required',
        setup_step: 0,
        setup_completed: false,
        setup_started_at: new Date().toISOString(),
        provisioned_at: new Date().toISOString(),
        provisioned_by: provisioner,
      })
      .select()
      .single()
    if (propErr) throw new Error(`property create failed: ${propErr.message}`)

    // 3. Create subscription
    await admin.from('subscriptions').insert({
      organization_id: org.id,
      max_sites: body.max_sites || 50,
      billing_cycle: body.billing_cycle || 'monthly',
      pricing_model: body.pricing_model || 'per_site',
      price_per_site: body.price_per_site || 0,
      flat_amount: body.flat_amount || 0,
      contract_start_date: body.contract_start_date || null,
      contract_end_date: body.contract_end_date || null,
    })

    // 4. Invite admin user (or reuse existing)
    let adminUserId: string | null = null
    const { data: existing } = await admin.auth.admin.listUsers()
    const found = existing?.users?.find(
      (u: any) => u.email?.toLowerCase() === body.admin_email.toLowerCase(),
    )

    let inviteLink: string | null = null
    const redirectTo = `${req.headers.get('origin') || Deno.env.get('SUPABASE_URL')}/onboarding`

    if (found) {
      adminUserId = found.id
      // Generate a magiclink for the existing user
      const { data: linkData } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email: body.admin_email,
        options: { redirectTo },
      })
      inviteLink = linkData?.properties?.action_link ?? null
    } else {
      const { data: created, error: invErr } = await admin.auth.admin.inviteUserByEmail(
        body.admin_email,
        {
          data: {
            first_name: body.admin_first_name,
            last_name: body.admin_last_name,
            role: 'admin',
          },
          redirectTo,
        },
      )
      if (invErr) throw new Error(`invite failed: ${invErr.message}`)
      adminUserId = created.user?.id ?? null
      // Also generate a direct link the admin can copy/share as fallback
      const { data: linkData } = await admin.auth.admin.generateLink({
        type: 'invite',
        email: body.admin_email,
        options: { redirectTo },
      })
      inviteLink = linkData?.properties?.action_link ?? null
    }

    if (!adminUserId) throw new Error('Failed to create admin user')

    // 5. Grant admin access
    await admin.from('user_property_access').insert({
      user_id: adminUserId,
      property_id: property.id,
      organization_id: org.id,
      is_org_admin: true,
    })
    await admin.from('user_roles').insert({
      user_id: adminUserId,
      role: 'admin',
    })

    // 6. Record admin on org + welcome email timestamp
    await admin
      .from('organizations')
      .update({
        admin_user_id: adminUserId,
        welcome_email_sent_at: new Date().toISOString(),
      })
      .eq('id', org.id)

    return json({
      success: true,
      organization_id: org.id,
      property_id: property.id,
      admin_user_id: adminUserId,
      client_number: (org as any).client_number ?? null,
      invite_link: inviteLink,
      message: `Provisioned ${org.name}. Invite email sent to ${body.admin_email}.`,
    })
  } catch (e: any) {
    console.error('provision-organization error:', e)
    return json({ error: e?.message ?? 'Provisioning failed' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
