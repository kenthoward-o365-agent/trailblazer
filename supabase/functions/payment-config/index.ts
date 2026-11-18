import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { installConsoleRedaction } from "../_shared/pci.ts";
installConsoleRedaction();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { propertyId } = await req.json();

    if (!propertyId) {
      return new Response(
        JSON.stringify({ error: 'Property ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch property payment configuration
    const { data: property, error } = await supabase
      .from('properties')
      .select('payment_gateway_mode, adyen_merchant_account, adyen_client_key')
      .eq('id', propertyId)
      .single();

    if (error) {
      console.error('Error fetching property:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch property configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mode = property?.payment_gateway_mode || 'mock';

    // For mock mode, return minimal config
    if (mode === 'mock') {
      console.log(`Property ${propertyId} using mock payment mode`);
      return new Response(
        JSON.stringify({
          mode: 'mock',
          clientKey: null,
          environment: null,
          merchantAccount: null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For test/live mode, return Adyen configuration
    // Note: API key is never returned - it's only used server-side
    const clientKey = property?.adyen_client_key;
    const merchantAccount = property?.adyen_merchant_account;

    if (!clientKey || !merchantAccount) {
      console.warn(`Property ${propertyId} missing Adyen configuration`);
      return new Response(
        JSON.stringify({
          mode: 'mock', // Fall back to mock if not configured
          clientKey: null,
          environment: null,
          merchantAccount: null,
          warning: 'Adyen not fully configured, using mock mode',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Property ${propertyId} using ${mode} payment mode`);
    return new Response(
      JSON.stringify({
        mode,
        clientKey,
        environment: mode === 'live' ? 'live' : 'test',
        merchantAccount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
