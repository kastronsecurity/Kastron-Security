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

  const url = new URL(req.url)
  const key = url.searchParams.get('key')
  const os = url.searchParams.get('os') || 'linux'

  console.log(`Installation request received. OS: ${os}, Key: ${key ? 'provided' : 'missing'}`)

  if (!key || key === 'null' || key === 'FETCHING_KEY...') {
    console.error('Invalid or missing installation key provided.')
    return new Response('Invalid or missing installation key. Please ensure you have copied the full command from the dashboard.', { status: 400, headers: corsHeaders })
  }

  // Initialize Supabase client
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Verify the key and get the wazuh_group
  const { data: client, error } = await supabase
    .from('clients')
    .select('wazuh_group')
    .eq('install_key', key)
    .single()

  if (error || !client) {
    return new Response('Invalid installation key', { status: 403, headers: corsHeaders })
  }

  const wazuhGroup = client.wazuh_group
  const wazuhManager = Deno.env.get('WAZUH_MANAGER_IP')

  if (!wazuhManager) {
    console.error('WAZUH_MANAGER_IP not configured in environment variables.')
    return new Response('Server configuration error. Please contact support.', { status: 500, headers: corsHeaders })
  }

  let script = ""

  if (os === 'windows') {
    script = `# KastronSec Windows Agent Installation Script
$wazuhManager = "${wazuhManager}"
$wazuhGroup = "${wazuhGroup}"
$installerUrl = "https://packages.wazuh.com/4.x/windows/wazuh-agent-4.7.2-1.msi"
$tempPath = "$env:TEMP\\wazuh-agent.msi"
$confPath = "C:\\Program Files (x86)\\ossec-agent\\ossec.conf"

Write-Host "Downloading KastronSec Agent..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $installerUrl -OutFile $tempPath

Write-Host "Installing Agent..." -ForegroundColor Cyan
$arguments = "/i \`"$tempPath\`" /q WAZUH_MANAGER=\`"$wazuhManager\`" WAZUH_REGISTRATION_SERVER=\`"$wazuhManager\`" WAZUH_AGENT_GROUP=\`"$wazuhGroup\`""
Start-Process msiexec.exe -ArgumentList $arguments -Wait

# Force update config if already installed
if (Test-Path $confPath) {
    Write-Host "Updating manager configuration..." -ForegroundColor Yellow
    $conf = Get-Content $confPath
    $conf = $conf -replace "<address>.*</address>", "<address>$wazuhManager</address>"
    $conf | Set-Content $confPath
}

Write-Host "Starting KastronSec Service..." -ForegroundColor Cyan
Restart-Service -Name "Wazuh" -ErrorAction SilentlyContinue
Start-Service -Name "Wazuh" -ErrorAction SilentlyContinue

Write-Host "Installation Complete! Your machine is now protected by KastronSec." -ForegroundColor Green
`
  } else {
    script = `#!/bin/bash
# KastronSec Linux Agent Installation Script
WAZUH_MANAGER="${wazuhManager}"
WAZUH_GROUP="${wazuhGroup}"
CONF_PATH="/var/ossec/etc/ossec.conf"

echo "Installing KastronSec Agent for Linux..."
curl -s https://packages.wazuh.com/key/GPG-KEY-WAZUH | gpg --no-default-keyring --keyring gnupg-ring:/usr/share/keyrings/wazuh.gpg --import && chmod 644 /usr/share/keyrings/wazuh.gpg
echo "deb [signed-by=/usr/share/keyrings/wazuh.gpg] https://packages.wazuh.com/4.x/apt/ stable main" | tee -a /etc/apt/sources.list.d/wazuh.list
apt-get update

WAZUH_MANAGER="$WAZUH_MANAGER" WAZUH_AGENT_GROUP="$WAZUH_GROUP" apt-get install wazuh-agent -y

# Force update config if already installed
if [ -f "$CONF_PATH" ]; then
    echo "Updating manager configuration..."
    sed -i "s|<address>.*</address>|<address>$WAZUH_MANAGER</address>|g" "$CONF_PATH"
fi

echo "Starting KastronSec Agent..."
systemctl daemon-reload
systemctl enable wazuh-agent
systemctl restart wazuh-agent

echo "Installation Complete! Your machine is now protected by KastronSec."
`
  }

  return new Response(script, {
    headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
  })
})
