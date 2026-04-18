import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import type { Context } from "@netlify/functions";

/**
 * Netlify Function to proxy Gemini AI requests securely.
 * This keeps the GEMINI_API_KEY on the server and hidden from the browser.
 */
export default async (req: Request, context: Context) => {
  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured on server" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 0. AUTHENTICATION: Ensure the request is from an authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized: Missing authentication" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
    
    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized: Invalid session" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    const { prompt, ip } = await req.json();
    
    // 1. If an IP is provided, try real security APIs first
    if (ip) {
      const vtKey = process.env.VIRUSTOTAL_API_KEY;
      const abuseKey = process.env.ABUSEIPDB_API_KEY;

      // Try VirusTotal
      if (vtKey) {
        try {
          const vtResponse = await fetch(`https://www.virustotal.com/api/v3/ip_addresses/${ip}`, {
            headers: { 'x-apikey': vtKey }
          });
          if (vtResponse.ok) {
            const data = await vtResponse.json();
            const stats = data.data.attributes.last_analysis_stats;
            if (stats.malicious > 0 || stats.suspicious > 0) {
              return new Response(JSON.stringify({
                reputation: stats.malicious > 0 ? "Malicious" : "Suspicious",
                malicious: stats.malicious > 0,
                details: `VirusTotal: ${stats.malicious} malicious, ${stats.suspicious} suspicious detections.`,
                provider: "VirusTotal"
              }), { status: 200, headers: { "Content-Type": "application/json" } });
            }
          }
        } catch (e) { console.error("VT Error:", e); }
      }

      // Try AbuseIPDB
      if (abuseKey) {
        try {
          const abuseResponse = await fetch(`https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}`, {
            headers: { 'Key': abuseKey, 'Accept': 'application/json' }
          });
          if (abuseResponse.ok) {
            const data = await abuseResponse.json();
            if (data.data.abuseConfidenceScore > 25) {
              return new Response(JSON.stringify({
                reputation: data.data.abuseConfidenceScore > 75 ? "Malicious" : "Suspicious",
                malicious: data.data.abuseConfidenceScore > 50,
                details: `AbuseIPDB: Confidence Score ${data.data.abuseConfidenceScore}%. ISP: ${data.data.isp}.`,
                provider: "AbuseIPDB"
              }), { status: 200, headers: { "Content-Type": "application/json" } });
            }
          }
        } catch (e) { console.error("Abuse Error:", e); }
      }
    }

    // 2. Fallback to Gemini AI if no IP data found or if it's a general prompt
    if (!prompt) {
      return new Response(JSON.stringify({ error: "Missing prompt or IP data" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{
        parts: [{ text: prompt }]
      }],
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json"
      }
    });

    return new Response(response.text || "{}", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Gemini Proxy Error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error", details: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config = {
  path: "/api/gemini-analysis",
};
