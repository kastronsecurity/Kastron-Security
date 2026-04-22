import { GoogleGenAI } from "@google/genai";
import { supabase } from "./supabase";

export interface SOCReportParams {
  type: 'Escalation' | 'Weekly' | 'Monthly';
  alertData?: any;
  statsData?: any;
  analystName?: string;
}

// Lazy initializer for Gemini SDK
let aiInstance: GoogleGenAI | null = null;

const getAI = () => {
  if (!aiInstance) {
    // In our environment, process.env.GEMINI_API_KEY is the standard way to access the key
    // But in client-side Vite, we prefer import.meta.env
    let apiKey = '';
    try {
      // @ts-ignore
      apiKey = (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) || 
               (import.meta.env?.VITE_GEMINI_API_KEY) || 
               (import.meta.env?.GEMINI_API_KEY) || 
               '';
    } catch (e) {
      // fallback
    }
    
    if (!apiKey) {
      console.warn("GEMINI_API_KEY not found in environment. AI features will fail.");
    }
    aiInstance = new GoogleGenAI({ apiKey: apiKey || "" });
  }
  return aiInstance;
};

async function callGemini(prompt: string, options: { systemInstruction?: string } = {}) {
  const ai = getAI();
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", // Optimal for SOC tasks
      contents: prompt,
      config: {
        systemInstruction: options.systemInstruction || "You are a senior SOC analyst for KastronSec.",
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("Empty response from Gemini AI");
    }

    // Return parsed JSON if possible
    try {
      return JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch (e) {
      return text;
    }
  } catch (error: any) {
    console.error("Gemini SDK Error:", error);
    // Graceful fallback for missing API key or other SDK errors
    if (error?.message?.includes("API key")) {
      throw new Error("AI features require a GEMINI_API_KEY. Please configure it in Settings.");
    }
    throw error;
  }
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
    return await callGemini(prompt, { systemInstruction });
  } catch (error) {
    console.error("Gemini Report Error:", error);
    throw error;
  }
}

export async function generateAINarrative(prompt: string, systemInstruction?: string): Promise<any> {
  try {
    return await callGemini(prompt, { systemInstruction });
  } catch (error) {
    console.error("AI Narrative Error:", error);
    throw error;
  }
}
