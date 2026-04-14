import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log(`Edge Function get-wazuh-alerts called with method: ${req.method}`)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the user from the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), { status: 401, headers: corsHeaders })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: corsHeaders })
    }

    // Get the client's wazuh_group
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('wazuh_group, id')
      .eq('user_id', user.id)
      .single()

    if (clientError || !client) {
      console.error(`Client not found for user ${user.id}. Error: ${clientError?.message}`)
      return new Response(JSON.stringify({ 
        error: 'Client not found', 
        details: 'Your account is not fully set up. Please run the SQL query to create your client record in the "clients" table.',
        userId: user.id
      }), { status: 404, headers: corsHeaders })
    }

    const wazuhGroup = client.wazuh_group
    const wazuhManager = Deno.env.get('WAZUH_MANAGER_IP')
    const wazuhUser = Deno.env.get('WAZUH_API_USER')
    const wazuhPass = Deno.env.get('WAZUH_API_PASSWORD')

    if (!wazuhManager || !wazuhUser || !wazuhPass) {
      console.error('Wazuh configuration missing in environment variables')
      return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500, headers: corsHeaders })
    }

    console.log(`Syncing Wazuh data for group: ${wazuhGroup}`)

    // 1. Authenticate with Wazuh
    const authRes = await fetch(`https://${wazuhManager}:55000/security/user/authenticate`, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + btoa(`${wazuhUser}:${wazuhPass}`),
      }
    })

    if (!authRes.ok) {
      const errText = await authRes.text()
      console.error('Wazuh Auth Failed:', errText)
      return new Response(JSON.stringify({ error: 'Wazuh authentication failed', details: errText }), { status: 500, headers: corsHeaders })
    }

    const authData = await authRes.json()
    const token = authData.data.token

    // 2. Get agents in the group and sync them
    const agentsRes = await fetch(`https://${wazuhManager}:55000/agents?group=${wazuhGroup}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    })

    if (!agentsRes.ok) {
      const errText = await agentsRes.text()
      console.error('Wazuh Agents Fetch Failed:', errText)
      return new Response(JSON.stringify({ error: 'Failed to fetch agents', details: errText }), { status: 500, headers: corsHeaders })
    }

    const agentsData = await agentsRes.json()
    const wazuhAgents = agentsData.data.affected_items || []
    
    // Sync agents to Supabase
    if (wazuhAgents.length > 0) {
      const transformedAgents = wazuhAgents.map((agent: any) => ({
        id: agent.id,
        name: agent.name,
        ip: agent.ip,
        status: agent.status,
        os: agent.os?.name || 'Unknown',
        version: agent.version,
        wazuh_group: wazuhGroup,
        client_id: client.id,
        last_keepalive: agent.lastKeepAlive || new Date().toISOString()
      }))

      const { error: agentsError } = await supabase
        .from('agents')
        .upsert(transformedAgents, { onConflict: 'id' })
      
      if (agentsError) {
        console.error('Supabase Agents Sync Error:', agentsError)
        // Continue anyway, as alerts are more important
      }
    }

    const agentIds = wazuhAgents.map((a: any) => a.id).join(',')

    if (!agentIds) {
      return new Response(JSON.stringify({ alerts: [], agents: [], message: 'No agents found in this group' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 3. Fetch alerts for these agents
    // We'll try to fetch the last 100 alerts for these agents.
    const alertsRes = await fetch(`https://${wazuhManager}:55000/alerts?agent_id=${agentIds}&limit=100&sort=-timestamp`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    })

    let transformedAlerts: any[] = []

    if (alertsRes.ok) {
      const alertsData = await alertsRes.json()
      const wazuhAlerts = alertsData.data.affected_items || []

      transformedAlerts = wazuhAlerts.map((alert: any) => ({
        id: `WAZ-${alert.id || alert._id || Math.random().toString(36).substr(2, 9)}`,
        timestamp: alert.timestamp || new Date().toISOString(),
        severity: alert.rule?.level >= 12 ? 'CRITICAL' : alert.rule?.level >= 7 ? 'HIGH' : alert.rule?.level >= 4 ? 'MEDIUM' : 'LOW',
        status: 'Active',
        description: alert.rule?.description || 'Wazuh Alert',
        agent_name: alert.agent?.name || 'Unknown Agent',
        agent_id: alert.agent?.id,
        rule_id: alert.rule?.id || '0',
        rule_level: alert.rule?.level || 0,
        source_ip: alert.data?.srcip || 'N/A',
        dest_ip: alert.data?.dstip || 'N/A',
        raw_log: alert,
        client_id: client.id,
        wazuh_group: wazuhGroup
      }))

      // Sync alerts to Supabase (Upsert)
      if (transformedAlerts.length > 0) {
        const { error: upsertError } = await supabase
          .from('alerts')
          .upsert(transformedAlerts, { onConflict: 'id' })
        
        if (upsertError) {
          console.error('Supabase Alerts Sync Error:', upsertError)
        }
      }
    } else {
      const errText = await alertsRes.text()
      console.warn('Wazuh Alerts Fetch Failed (endpoint might be disabled or restricted):', errText)
      // Fallback: If /alerts is disabled, we might want to try other endpoints or just return empty
    }

    return new Response(JSON.stringify({ 
      alerts: transformedAlerts, 
      agentsCount: wazuhAgents.length,
      alertsCount: transformedAlerts.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err: any) {
    console.error('Edge Function Error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
