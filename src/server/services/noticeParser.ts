import 'server-only';
import { openai, OPENAI_MODEL } from '@/lib/openai';

export type ParsedNoticeData = {
  documentType: string;
  clientCompany: string;
  propertyName: string;
  propertyAddress: string;
  buildingType: string;
  inspectionDate: string | null;
  stateDeadline: string | null;
  requiredWorkSummary: string;
  detailedScope: string;
  violationItems: string[];
  workType: string;
  requiredSkillTag: string;
  estimatedDurationHours: number | null;
  estimatedLaborHours: number | null;
  estimatedMaterials: number | null;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  fortyEightHourRequired: boolean;
  complianceCoordinationRequired: boolean;
  missingInformation: string[];
  parseConfidence: number;
};

const SYSTEM_PROMPT = `You are an expert at analyzing elevator compliance documents in California.
Extract all relevant information from Order to Comply notices, CAL/OSHA inspection reports, and similar compliance documents.
Return ONLY valid JSON — no markdown, no explanation, no text outside the JSON object.`;

export async function parseNoticeWithAI(rawText: string): Promise<{
  data: ParsedNoticeData | null;
  error: string | null;
}> {
  if (!rawText || rawText.trim().length < 50) {
    return { data: null, error: 'Insufficient text to parse' };
  }

  const prompt = `Analyze this elevator compliance document and extract all information.

DOCUMENT TEXT:
${rawText.slice(0, 8000)}

Return a JSON object with exactly these fields:
{
  "documentType": "string (e.g. Order to Comply, CAL/OSHA Notice, Inspection Report)",
  "clientCompany": "string (property owner or management company name)",
  "propertyName": "string (building or property name)",
  "propertyAddress": "string (full address)",
  "buildingType": "string — one of: commercial, residential, mixed_use, industrial, government",
  "inspectionDate": "string YYYY-MM-DD or null",
  "stateDeadline": "string YYYY-MM-DD or null",
  "requiredWorkSummary": "string (1-2 sentence summary of required work)",
  "detailedScope": "string (detailed description of all work required)",
  "violationItems": ["array of specific violation strings"],
  "workType": "string (e.g. Annual inspection, Safety test, Repair)",
  "requiredSkillTag": "string — one of: hydraulic, traction, mrl, escalator, dumbwaiter, residential, commercial",
  "estimatedDurationHours": number or null,
  "estimatedLaborHours": number or null,
  "estimatedMaterials": number or null,
  "urgency": "low | medium | high | critical",
  "fortyEightHourRequired": boolean,
  "complianceCoordinationRequired": boolean,
  "missingInformation": ["list any important info that was unclear or missing"],
  "parseConfidence": number between 0 and 1
}

Urgency rules: critical = deadline within 30 days or elevator out of service, high = 31-60 days, medium = 61-90 days, low = 90+ days.
fortyEightHourRequired: true for most commercial elevator work in California.
complianceCoordinationRequired: true if a third-party compliance company needs to be notified.`;

  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.1,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return { data: null, error: 'OpenAI returned empty response' };

    let parsed: ParsedNoticeData;
    try {
      parsed = JSON.parse(content);
    } catch {
      return { data: null, error: 'OpenAI returned invalid JSON' };
    }

    if (!Array.isArray(parsed.violationItems)) parsed.violationItems = [];
    if (!Array.isArray(parsed.missingInformation)) parsed.missingInformation = [];

    return { data: parsed, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { data: null, error: `OpenAI error: ${message}` };
  }
}
