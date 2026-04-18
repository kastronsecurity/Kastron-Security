
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with Service Role Key
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the user from the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) {
      throw new Error('Invalid token')
    }

    // Get the client data from the request body
    const { name, install_key, wazuh_group } = await req.json()

    if (!name || !install_key || !wazuh_group) {
      throw new Error('Missing required fields')
    }

    // SECURITY: Sanitize wazuh_group to prevent shell injection in installation scripts
    const sanitizedGroup = wazuh_group.replace(/[^a-zA-Z0-9_-]/g, '');
    if (sanitizedGroup !== wazuh_group) {
      console.warn(`Sanitized malicious wazuh_group input from "${wazuh_group}" to "${sanitizedGroup}"`);
    }

    console.log(`Creating/Updating client for user ${user.id}: ${name}`)

    // Upsert the client record
    const { data, error } = await supabase
      .from('clients')
      .upsert({
        user_id: user.id,
        name: name,
        install_key: install_key,
        wazuh_group: sanitizedGroup
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in create-client function:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
