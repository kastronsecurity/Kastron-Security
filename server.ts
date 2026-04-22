import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

let supabase: any = null;

if (!supabaseUrl || !supabaseKey) {
  console.error('CRITICAL: Supabase environment variables VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY are missing!');
} else {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Trust proxy for rate limiting accurate IP identification
  app.set('trust proxy', 1);

  // Security Headers
  app.use(helmet({
    contentSecurityPolicy: false, // Vite handles CSP in dev
    crossOriginEmbedderPolicy: false
  }));

  app.use(express.json());
  app.use(cors());

  // Public ping route to keep the server awake on free tiers (like Render)
  app.get("/ping", (req, res) => {
    res.send("pong");
  });

  // Rate Limiting
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." }
  });

  // Apply rate limiter to all API routes
  app.use("/api/", apiLimiter);

  // PII Masking utility
  const maskPII = (obj: any): any => {
    if (!obj) return obj;
    const masked = JSON.parse(JSON.stringify(obj));
    const mask = (val: string) => {
      if (typeof val !== 'string') return val;
      // Mask IP addresses
      const maskedIp = val.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, (match) => {
        const parts = match.split('.');
        return `${parts[0]}.${parts[1]}.[MASKED].[MASKED]`;
      });
      return maskedIp;
    };

    const traverse = (o: any) => {
      for (const key in o) {
        if (typeof o[key] === 'object' && o[key] !== null) {
          traverse(o[key]);
        } else if (typeof o[key] === 'string') {
          o[key] = mask(o[key]);
        }
      }
    };
    traverse(masked);
    return masked;
  };

  // Auth Middleware
  const authenticateUser = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "No authorization header" });
    }

    const token = authHeader.split(' ')[1];
    try {
      if (!supabase) {
        return res.status(503).json({ error: "Supabase not initialized" });
      }
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) {
        return res.status(401).json({ error: "Invalid or expired session" });
      }
      req.user = user;
      next();
    } catch (e) {
      return res.status(401).json({ error: "Authentication failed" });
    }
  };

  app.get("/api/health", authenticateUser, async (req: any, res) => {
    let alertCount = 0;
    let clientCount = 0;
    let agentCount = 0;

    // Only allow counts for the user's own client
    try {
      if (!supabase) {
        return res.json({ status: "ok", supabaseConnected: false, alertCount: 0, clientCount: 0, agentCount: 0 });
      }
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', req.user.id)
        .single();

      if (client) {
        const { count: aCount } = await supabase
          .from('alerts')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', client.id);
        alertCount = aCount || 0;

        const { count: agCount } = await supabase
          .from('agents')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', client.id);
        agentCount = agCount || 0;
        
        clientCount = 1; // They are their own client
      }
    } catch (e) {
      console.error('Health check data fetch failed:', e);
    }

    res.json({ status: "ok", supabaseConnected: !!supabaseUrl, alertCount, clientCount, agentCount });
  });

  // Wazuh Webhook Endpoint
  // This is where a Wazuh custom integration script would POST alerts
  app.post("/api/wazuh/webhook", async (req, res) => {
    console.log('Received Wazuh webhook request');
    
    // Security check: Verify webhook secret if configured
    const webhookSecret = process.env.WAZUH_WEBHOOK_SECRET;
    const providedSecret = req.headers['x-wazuh-secret'];
    
    if (webhookSecret && providedSecret !== webhookSecret) {
      console.warn('Unauthorized Wazuh webhook attempt');
      return res.status(401).json({ status: "error", message: "Unauthorized" });
    }

    try {
      const wazuhAlert = req.body;
      console.log('Wazuh Alert Body (Sanitized):', JSON.stringify(maskPII(wazuhAlert)).substring(0, 500) + '...');
      
      if (!supabaseUrl || !supabaseKey) {
        console.error('Supabase credentials missing in server.ts');
        return res.status(500).json({ status: "error", message: "Supabase not configured" });
      }

      // Map Wazuh alert to our internal schema
      // Check if we have threat intel for this IP already in the cache
      let threatIntel = {
        reputation: 'Unknown',
        malicious: (wazuhAlert.rule?.level || 0) >= 10,
        details: `Wazuh Level: ${wazuhAlert.rule?.level || 'N/A'}. Agent: ${wazuhAlert.agent?.name || 'Unknown'}`,
        provider: 'Wazuh'
      };

      const sourceIp = wazuhAlert.data?.srcip;
      if (sourceIp && sourceIp !== 'N/A' && supabase) {
        try {
          const { data: cachedIntel } = await supabase
            .from('threat_intel_cache')
            .select('*')
            .eq('ip', sourceIp)
            .maybeSingle();
          
          if (cachedIntel) {
            threatIntel = {
              reputation: cachedIntel.reputation,
              malicious: cachedIntel.malicious,
              details: cachedIntel.details,
              provider: cachedIntel.provider.replace(/\s*(\(Cached\)|API)/g, '')
            };
          }
        } catch (e) {
          console.warn('Cache lookup failed during ingestion:', e);
        }
      }

      // Dynamic client_id lookup
      let clientId = '7cf44f70-c67a-470f-a7e4-7e8a1627d514'; // Default fallback
      const agentName = wazuhAlert.agent?.name;
      const agentId = wazuhAlert.agent?.id;

      if (agentName || agentId) {
        try {
          // Try to find the client_id from previous alerts for this agent
          const { data: existingAlert } = await supabase
            .from('alerts')
            .select('client_id')
            .or(`agent_name.eq."${agentName}",agent_id.eq."${agentId}"`)
            .order('timestamp', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (existingAlert?.client_id) {
            clientId = existingAlert.client_id;
            console.log(`Found client_id ${clientId} for agent ${agentName || agentId}`);
          } else {
            // Try to find in agents table
            const { data: agent } = await supabase
              .from('agents')
              .select('client_id')
              .or(`name.eq."${agentName}",id.eq."${agentId}"`)
              .maybeSingle();
            
            if (agent?.client_id) {
              clientId = agent.client_id;
              console.log(`Found client_id ${clientId} in agents table for ${agentName || agentId}`);
            }
          }
        } catch (e) {
          console.warn('Client ID lookup failed:', e);
        }
      }

      const mappedAlert = {
        id: `WAZ-${wazuhAlert.id || Math.random().toString(36).substr(2, 9)}`,
        timestamp: wazuhAlert.timestamp || new Date().toISOString(),
        severity: mapWazuhLevelToSeverity(wazuhAlert.rule?.level),
        status: 'Active',
        description: wazuhAlert.rule?.description || 'Wazuh Security Alert',
        source_ip: sourceIp || 'N/A',
        dest_ip: wazuhAlert.data?.dstip || 'N/A',
        rule_id: wazuhAlert.rule?.id || '0',
        agent_name: agentName || 'Unknown',
        agent_id: agentId,
        rule_level: wazuhAlert.rule?.level || 0,
        threat_intel: threatIntel,
        raw_log: wazuhAlert,
        client_id: clientId
      };

      console.log('Mapped Alert for Supabase (Sanitized):', JSON.stringify(maskPII(mappedAlert)).substring(0, 500) + '...');

      const { error } = await supabase
        .from('alerts')
        .insert([mappedAlert]);

      if (error) {
        console.error('Supabase Insert Error:', error);
        throw error;
      }

      console.log('Successfully ingested Wazuh alert:', mappedAlert.id);
      res.status(200).json({ status: "success", alertId: mappedAlert.id });
    } catch (error) {
      console.error('Error ingesting Wazuh alert:', error);
      res.status(500).json({ status: "error", message: "Failed to ingest alert", details: error instanceof Error ? error.message : String(error) });
    }
  });

  function mapWazuhLevelToSeverity(level: number): string {
    if (!level) return 'LOW';
    if (level >= 12) return 'CRITICAL';
    if (level >= 8) return 'HIGH';
    if (level >= 5) return 'MEDIUM';
    return 'LOW';
  }

  // Generic IOC Threat Intel Route (IP, Domain, Hash)
  app.get("/api/threat-intel/ioc/:ioc", authenticateUser, async (req, res) => {
    const { ioc } = req.params;
    const forceRefresh = req.query.refresh === 'true';
    const CACHE_TTL_HOURS = 24;

    try {
      // 1. Detect IOC Type
      let iocType = 'ip'; // default
      if (/^[a-fA-F0-9]{32}$|^[a-fA-F0-9]{40}$|^[a-fA-F0-9]{64}$/.test(ioc)) {
        iocType = 'hash';
      } else if (/[a-zA-Z]/.test(ioc) && ioc.includes('.')) {
        iocType = 'domain';
      } else if (/^(\d{1,3}\.){3}\d{1,3}$/.test(ioc)) {
        iocType = 'ip';
      }

      // 2. Check Cache
      if (supabase && !forceRefresh) {
        const { data: cachedData } = await supabase
          .from('threat_intel_cache')
          .select('*')
          .eq('ip', ioc) // we use 'ip' column to store any ioc string for now
          .maybeSingle();

        if (cachedData) {
          const lastUpdated = new Date(cachedData.last_updated);
          const diffHours = (new Date().getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
          if (diffHours < CACHE_TTL_HOURS) {
            return res.json({ ...cachedData, cached: true });
          }
        }
      }

      let intelResult: any = null;
      const vtKey = process.env.VIRUSTOTAL_API_KEY;

      // 3. VirusTotal Logic based on type
      if (vtKey) {
        try {
          let vtEndpoint = `https://www.virustotal.com/api/v3/ip_addresses/${ioc}`;
          if (iocType === 'domain') vtEndpoint = `https://www.virustotal.com/api/v3/domains/${ioc}`;
          if (iocType === 'hash') vtEndpoint = `https://www.virustotal.com/api/v3/files/${ioc}`;

          const vtResponse = await fetch(vtEndpoint, { headers: { 'x-apikey': vtKey } });
          if (vtResponse.ok) {
            const data = await vtResponse.json();
            const stats = data.data.attributes.last_analysis_stats;
            const maliciousCount = stats.malicious;
            const suspiciousCount = stats.suspicious;
            
            intelResult = {
              reputation: maliciousCount > 0 ? "Malicious" : suspiciousCount > 0 ? "Suspicious" : "Clean",
              malicious: maliciousCount > 0,
              details: `VirusTotal: ${maliciousCount} malicious, ${suspiciousCount} suspicious detections. ${data.data.attributes.meaningful_name || data.data.attributes.as_owner || ''}`,
              provider: "VirusTotal"
            };
          }
        } catch (e) { console.error("VT Error:", e); }
      }

      // 4. AbuseIPDB Fallback (Only for IPs)
      if (!intelResult && iocType === 'ip') {
        const abuseKey = process.env.ABUSEIPDB_API_KEY;
        if (abuseKey) {
          try {
            const abuseResponse = await fetch(`https://api.abuseipdb.com/api/v2/check?ipAddress=${ioc}`, {
              headers: { 'Key': abuseKey, 'Accept': 'application/json' }
            });
            if (abuseResponse.ok) {
              const data = await abuseResponse.json();
              const score = data.data.abuseConfidenceScore;
              intelResult = {
                reputation: score >= 75 ? "Malicious" : score >= 25 ? "Suspicious" : "Clean",
                malicious: score >= 50,
                details: `AbuseIPDB Score: ${score}%. Usage: ${data.data.usageType || 'N/A'}.`,
                provider: "AbuseIPDB"
              };
            }
          } catch (e) { console.error("Abuse Error:", e); }
        }
      }

      // 5. Update Cache & Return
      if (intelResult) {
        if (supabase) {
          supabase.from('threat_intel_cache').upsert({
            ip: ioc,
            reputation: intelResult.reputation,
            malicious: intelResult.malicious,
            details: intelResult.details,
            provider: intelResult.provider,
            last_updated: new Date().toISOString()
          }, { onConflict: 'ip' }).then();
        }
        return res.json(intelResult);
      }

      res.json({
        reputation: "Unknown",
        malicious: false,
        details: "No current intelligence available for this IOC.",
        provider: "System"
      });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Threat Intel Proxy Route with Caching and Failover
  app.get("/api/threat-intel/ip/:ip", authenticateUser, async (req, res) => {
    const { ip } = req.params;
    const cacheOnly = req.query.cacheOnly === 'true';
    const forceRefresh = req.query.refresh === 'true';
    const CACHE_TTL_HOURS = 24;

    try {
      // 1. Check Cache First (Skip if forceRefresh is true)
      if (supabase && !forceRefresh) {
        const { data: cachedData, error: cacheError } = await supabase
          .from('threat_intel_cache')
          .select('*')
          .eq('ip', ip)
          .maybeSingle();

        if (!cacheError && cachedData) {
          const lastUpdated = new Date(cachedData.last_updated);
          const now = new Date();
          const diffHours = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);

          if (diffHours < CACHE_TTL_HOURS) {
            console.log(`Cache hit for IP: ${ip}`);
            return res.json({
              reputation: cachedData.reputation,
              malicious: cachedData.malicious,
              details: cachedData.details,
              provider: cachedData.provider.replace(/\s*(\(Cached\)|API)/g, ''),
              cached: true
            });
          }
        }
      }

      // If cacheOnly is true and we didn't find a valid cache entry, return unknown
      if (cacheOnly) {
        return res.json({
          reputation: "Unknown",
          malicious: false,
          details: "IP not found in cache. Manual refresh required.",
          provider: "Cache",
          notInCache: true
        });
      }

      let intelResult: any = null;

      // 2. Try VirusTotal
      const vtKey = process.env.VIRUSTOTAL_API_KEY;
      if (vtKey) {
        try {
          const vtResponse = await fetch(`https://www.virustotal.com/api/v3/ip_addresses/${ip}`, {
            headers: { 'x-apikey': vtKey }
          });
          if (vtResponse.ok) {
            const data = await vtResponse.json();
            const stats = data.data.attributes.last_analysis_stats;
            const maliciousCount = stats.malicious;
            const suspiciousCount = stats.suspicious;
            
            let reputation = "Clean";
            if (maliciousCount > 0) reputation = "Malicious";
            else if (suspiciousCount > 0) reputation = "Suspicious";

            intelResult = {
              reputation,
              malicious: maliciousCount > 0,
              details: `VirusTotal: ${maliciousCount} malicious, ${suspiciousCount} suspicious. Country: ${data.data.attributes.country || 'Unknown'}. ASN: ${data.data.attributes.as_owner || 'Unknown'}.`,
              provider: "VirusTotal"
            };
          }
        } catch (e) {
          console.error("VirusTotal failover:", e);
        }
      }

      // 3. Try AbuseIPDB (Failover)
      if (!intelResult) {
        const abuseKey = process.env.ABUSEIPDB_API_KEY;
        if (abuseKey) {
          try {
            const abuseResponse = await fetch(`https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}`, {
              headers: { 'Key': abuseKey, 'Accept': 'application/json' }
            });
            if (abuseResponse.ok) {
              const data = await abuseResponse.json();
              const score = data.data.abuseConfidenceScore;
              
              let reputation = "Clean";
              if (score >= 75) reputation = "Malicious";
              else if (score >= 25) reputation = "Suspicious";

              intelResult = {
                reputation,
                malicious: score >= 50,
                details: `AbuseIPDB: Confidence Score ${score}%. Usage: ${data.data.usageType || 'Unknown'}. ISP: ${data.data.isp || 'Unknown'}.`,
                provider: "AbuseIPDB"
              };
            }
          } catch (e) {
            console.error("AbuseIPDB failover:", e);
          }
        }
      }

      // 4. Final Result & Cache Update
      if (intelResult) {
        // Update Cache in background
        if (supabase) {
          supabase.from('threat_intel_cache').upsert({
            ip,
            reputation: intelResult.reputation,
            malicious: intelResult.malicious,
            details: intelResult.details,
            provider: intelResult.provider,
            last_updated: new Date().toISOString()
          }, { onConflict: 'ip' }).then(({ error }) => {
            if (error) console.error("Cache update error:", JSON.stringify(error));
          });
        }
        return res.json(intelResult);
      }

      // 5. If all APIs fail, return unknown (Frontend will fallback to Gemini Search)
      res.json({
        reputation: "Unknown",
        malicious: false,
        details: "External intelligence services are currently unavailable. Attempting AI-assisted analysis...",
        provider: "System"
      });

    } catch (error) {
      console.error('Threat Intel Route Error:', error);
      res.status(500).json({ 
        error: "Internal server error", 
        reputation: "Error",
        malicious: false,
        provider: "System"
      });
    }
  });

  // Update Threat Intel Cache manually (e.g. from frontend AI search)
  app.post("/api/threat-intel/cache", authenticateUser, async (req, res) => {
    const { ip, reputation, malicious, details, provider } = req.body;
    
    if (!ip || !reputation) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      if (supabase) {
        const { error } = await supabase.from('threat_intel_cache').upsert({
          ip,
          reputation,
          malicious: !!malicious,
          details: details || "",
          provider: provider || "Manual",
          last_updated: new Date().toISOString()
        }, { onConflict: 'ip' });

        if (error) {
          console.error("Manual cache update error:", JSON.stringify(error));
          return res.status(500).json({ error: "Failed to update cache", details: error.message });
        }

        return res.json({ status: "success" });
      } else {
        return res.status(500).json({ error: "Supabase not configured" });
      }
    } catch (error) {
      console.error("Cache update error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Wazuh Group Creation Route (Server-side to protect credentials)
  app.post("/api/wazuh/groups", authenticateUser, async (req, res) => {
    const { groupId } = req.body;
    const wazuhIp = process.env.WAZUH_MANAGER_IP;
    const wazuhUser = process.env.WAZUH_API_USER;
    const wazuhPass = process.env.WAZUH_API_PASSWORD;

    if (!wazuhIp || !wazuhUser || !wazuhPass) {
      return res.status(500).json({ error: "Wazuh credentials not configured on server" });
    }

    if (!groupId) {
      return res.status(400).json({ error: "Missing groupId" });
    }

    try {
      // SECURITY: Removed process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
      // This was a critical vulnerability that disabled TLS checking globally.
      // To connect to Wazuh with self-signed certificates, please use a valid CA.

      // 1. Authenticate with Wazuh
      const authRes = await fetch(`https://${wazuhIp}:55000/security/user/authenticate`, {
        method: 'GET',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${wazuhUser}:${wazuhPass}`).toString('base64'),
          'Content-Type': 'application/json'
        }
      });

      if (!authRes.ok) {
        const errText = await authRes.text();
        throw new Error(`Wazuh authentication failed: ${authRes.status} ${errText}`);
      }

       const authData: any = await authRes.json();
      const token = authData.data.token;

      // 2. Create Group
      const groupRes = await fetch(`https://${wazuhIp}:55000/groups`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ group_id: groupId })
      });

      if (!groupRes.ok && groupRes.status !== 400) { 
        const errText = await groupRes.text();
        throw new Error(`Wazuh group creation failed: ${groupRes.status} ${errText}`);
      }

      res.json({ status: "success", message: "Wazuh group created or already exists" });
    } catch (error) {
      console.error("Wazuh Group Error:", error);
      res.status(500).json({ error: "Failed to create Wazuh group", details: String(error) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
