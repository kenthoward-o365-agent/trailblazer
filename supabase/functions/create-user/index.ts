import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verify the requesting user is authenticated and has permission
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !requestingUser) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if requesting user is admin or org_admin
    const { data: userRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)

    const { data: userAccess } = await supabaseAdmin
      .from('user_property_access')
      .select('is_org_admin')
      .eq('user_id', requestingUser.id)

    const isAdmin = userRoles?.some(r => r.role === 'admin' || r.role === 'super_admin')
    const isOrgAdmin = userAccess?.some(a => a.is_org_admin)

    const body = await req.json()
    
    // Handle password reset action
    if (body.action === 'reset-password') {
      const { userId, newPassword } = body
      
      if (!isAdmin && !isOrgAdmin) {
        return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (!userId || !newPassword) {
        return new Response(JSON.stringify({ error: 'Missing userId or newPassword' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword,
      })

      if (resetError) {
        return new Response(JSON.stringify({ error: resetError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Handle delete user action
    if (body.action === 'delete-user') {
      const { userId } = body
      
      if (!isAdmin && !isOrgAdmin) {
        return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (!userId) {
        return new Response(JSON.stringify({ error: 'Missing userId' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Delete from auth (this will cascade to other tables)
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

      if (deleteError) {
        return new Response(JSON.stringify({ error: deleteError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Original create user logic
    if (!isAdmin && !isOrgAdmin) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { email, password, firstName, lastName, phone, role, propertyId, organizationId, isInternalUser, isOrgAdmin: createAsOrgAdmin } = body

    // Internal users (roomMaster staff) don't need organization/property
    if (!isInternalUser && !createAsOrgAdmin) {
      if (!email || !password || !firstName || !lastName || !role || !organizationId) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } else if (createAsOrgAdmin) {
      // Org admin creation - needs org but not property
      if (!email || !password || !firstName || !lastName || !organizationId) {
        return new Response(JSON.stringify({ error: 'Missing required fields for org admin' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } else {
      // For internal users, only super_admin can create
      const isSuperAdmin = userRoles?.some(r => r.role === 'super_admin')
      if (!isSuperAdmin) {
        return new Response(JSON.stringify({ error: 'Only super admins can create internal users' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      
      if (!email || !password || !firstName || !lastName || !role) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Create the user (idempotent: reuse an existing auth user with the same email)
    let createdUser: { id: string; email?: string | null } | null = null

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
        role: role || 'admin',
      },
    })

    if (createError) {
      const alreadyExists =
        (createError as any).code === 'email_exists' ||
        /already been registered|already exists/i.test(createError.message ?? '')

      if (!alreadyExists) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Find the existing auth user so we can repair/complete their setup
      let existingId: string | null = null
      for (let page = 1; page <= 20 && !existingId; page++) {
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 })
        if (!list?.users?.length) break
        existingId = list.users.find(
          (u) => (u.email ?? '').toLowerCase() === String(email).toLowerCase(),
        )?.id ?? null
      }

      if (!existingId) {
        return new Response(JSON.stringify({ error: 'A user with this email already exists.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      createdUser = { id: existingId, email }
    } else {
      createdUser = { id: newUser.user.id, email: newUser.user.email }
    }

    // Ensure the staff profile exists / is up to date
    const { data: existingProfile } = await supabaseAdmin
      .from('staff_profiles')
      .select('id')
      .eq('user_id', createdUser.id)
      .maybeSingle()

    const profileFields = {
      first_name: firstName,
      last_name: lastName,
      phone: phone || null,
    }

    const { error: profileError } = existingProfile
      ? await supabaseAdmin.from('staff_profiles').update(profileFields).eq('user_id', createdUser.id)
      : await supabaseAdmin.from('staff_profiles').insert({ user_id: createdUser.id, ...profileFields })
    if (profileError) console.error('Error saving staff profile:', profileError)


    // Ensure the role exists
    if (role) {
      const { data: existingRole } = await supabaseAdmin
        .from('user_roles')
        .select('id')
        .eq('user_id', createdUser.id)
        .eq('role', role)
        .maybeSingle()

      if (!existingRole) {
        const { error: roleError } = await supabaseAdmin
          .from('user_roles')
          .insert({ user_id: createdUser.id, role })
        if (roleError) console.error('Error adding role:', roleError)
      }
    }

    // Ensure property access for non-internal users
    if (!isInternalUser && !createAsOrgAdmin && propertyId) {
      const { data: existingAccess } = await supabaseAdmin
        .from('user_property_access')
        .select('id')
        .eq('user_id', createdUser.id)
        .eq('property_id', propertyId)
        .maybeSingle()

      if (!existingAccess) {
        const { error: accessError } = await supabaseAdmin
          .from('user_property_access')
          .insert({
            user_id: createdUser.id,
            property_id: propertyId,
            organization_id: organizationId,
            is_org_admin: false,
          })

        if (accessError) {
          return new Response(JSON.stringify({ error: `User created but property access failed: ${accessError.message}` }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }
    }

    // Note: For org admins, the access record is created by the calling code (AdminUserAccess.tsx)
    // This allows the edge function to remain simple and the caller to control the access setup

    return new Response(JSON.stringify({ 
      success: true, 
      user: { 
        id: createdUser.id, 
        email: createdUser.email 
      } 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
