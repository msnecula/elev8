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
  "documentType": "string",
  "clientCompany": "string",
  "propertyName": "string",
  "propertyAddress": "string",
  "buildingType": "commercial | residential | mixed_use | industrial | government",
  "inspectionDate": "YYYY-MM-DD or null",
  "stateDeadline": "YYYY-MM-DD or null",
  "requiredWorkSummary": "string",
  "detailedScope": "string",
  "violationItems": ["array of strings"],
  "workType": "string",
  "requiredSkillTag": "hydraulic | traction | mrl | escalator | dumbwaiter | residential | commercial",
  "estimatedDurationHours": number or null,
  "estimatedLaborHours": number or null,
  "estimatedMaterials": number or null,
  "urgency": "low | medium | high | critical",
  "fortyEightHourRequired": boolean,
  "complianceCoordinationRequired": boolean,
  "missingInformation": ["array of strings"],
  "parseConfidence": number 0-1
}`;

  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.1,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are an expert at analyzing elevator compliance documents. Return ONLY valid JSON.' },
        { role: 'user', content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return { data: null, error: 'OpenAI returned empty response' };

    let parsed: ParsedNoticeData;
    try { parsed = JSON.parse(content); }
    catch { return { data: null, error: 'OpenAI returned invalid JSON' }; }

    if (!Array.isArray(parsed.violationItems)) parsed.violationItems = [];
    if (!Array.isArray(parsed.missingInformation)) parsed.missingInformation = [];

    return { data: parsed, error: null };
  } catch (err) {
    return { data: null, error: `OpenAI error: ${err instanceof Error ? err.message : 'Unknown'}` };
  }
}
