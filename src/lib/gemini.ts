import { supabase } from "./supabase";

export interface SOCReportParams {
  type: 'Escalation' | 'Weekly' | 'Monthly';
  alertData?: any;
  statsData?: any;
  analystName?: string;
}

async function callGeminiProxy(prompt: string, options: { systemInstruction?: string, ip?: string } = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Authentication required for AI analysis");

  const response = await fetch("/api/gemini-analysis", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`
    },
    body: JSON.stringify({
      prompt,
      systemInstruction: options.systemInstruction,
      ip: options.ip
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "AI Analysis failed");
  }

  return await response.json();
}

export async function generateStructuredSOCReport(params: SOCReportParams): Promise<any> {
  const { type, alertData, statsData, analystName } = params;

  let systemInstruction = "";
  let prompt = "";

  if (type === 'Escalation' || type === 'incident_report' as any) {
    systemInstruction = `You are an expert SOC analyst generating a professional security incident report. Generate a detailed, well-structured incident report in JSON format with these exact sections:
{
  "executive_summary": "string",
  "incident_details": {
    "alert_id": "string",
    "title": "string",
    "severity": "string",
    "timestamp": "string",
    "agent": "string",
    "rule_id": "string",
    "source_ip": "string",
    "dest_ip": "string"
  },
  "attack_analysis": {
    "attack_type": "string",
    "description": "string",
    "attack_chain": ["string"],
    "mitre_techniques": ["string"]
  },
  "ioc_analysis": [
    {
      "type": "string",
      "value": "string",
      "verdict": "string",
      "threat_score": "string",
      "source": "string"
    }
  ],
  "impact_assessment": {
    "affected_systems": "string",
    "data_at_risk": "string",
    "business_impact": "string",
    "containment_status": "string",
    "true_positive": "string",
    "confidence_level": "string"
  },
  "recommendations": {
    "immediate": ["string"],
    "short_term": ["string"],
    "long_term": ["string"]
  },
  "analyst_notes": "string",
  "conclusion": "string"
}
Base your analysis on the provided alert data. Be specific and actionable. Return ONLY the JSON object.`;

    prompt = `Alert Data: ${JSON.stringify(alertData)}
    Analyst: ${analystName || 'System AI'}`;
  } else if (type === 'Weekly' || type === 'weekly_summary' as any) {
    systemInstruction = `You are an expert SOC analyst generating a weekly security summary report. Generate in JSON format:
{
  "overview": {
    "total_alerts": 0,
    "critical_count": 0,
    "high_count": 0,
    "medium_count": 0,
    "low_count": 0,
    "resolved_count": 0,
    "open_count": 0,
    "trend_vs_last_week": "string"
  },
  "top_threats": [{"rule_description": "string", "count": 0, "severity": "string", "recommendation": "string"}],
  "agent_summary": [{"agent_name": "string", "alert_count": 0, "top_rule": "string", "risk_level": "string"}],
  "attack_origins": [{"ip": "string", "country": "string", "count": 0, "verdict": "string"}],
  "key_findings": ["string"],
  "ai_insights": "string",
  "recommendations": {
    "immediate": ["string"],
    "strategic": ["string"]
  },
  "executive_summary": "string"
}
Analyze the provided alert data for the week and generate insights. Return ONLY the JSON object.`;

    prompt = `Weekly Stats: ${JSON.stringify(statsData)}
    Analyst: ${analystName || 'System AI'}`;
  } else if (type === 'Monthly' || type === 'executive' as any) {
    systemInstruction = `You are an expert SOC analyst generating a non-technical executive briefing for management. Generate in JSON format:
{
  "risk_posture": "string",
  "business_impact": "string",
  "strategic_recommendations": ["string"],
  "key_metrics": {
    "total_incidents": 0,
    "critical_incidents": 0,
    "avg_resolution_time": "string"
  },
  "executive_summary": "string",
  "conclusion": "string"
}
Return ONLY the JSON object.`;

    prompt = `Stats: ${JSON.stringify(statsData)}
    Analyst: ${analystName || 'System AI'}`;
  }

  try {
    // SECURITY: Use the proxy instead of client-side SDK
    const fullPrompt = systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt;
    return await callGeminiProxy(fullPrompt);
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}

export async function generateAINarrative(prompt: string, systemInstruction?: string): Promise<any> {
  try {
    const fullPrompt = systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt;
    const result = await callGeminiProxy(fullPrompt);
    
    // Fallback parsing if proxy returns a string or object
    if (typeof result === 'string') {
      return JSON.parse(result.replace(/```json|```/g, '').trim());
    }
    return result;
  } catch (error) {
    console.error("AI Narrative Error:", error);
    throw error;
  }
}
