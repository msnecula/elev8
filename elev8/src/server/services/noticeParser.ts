import 'server-only';
import { openai, OPENAI_MODEL } from '@/lib/openai';

export type ActionPlanStep = {
  stepNumber: number;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium';
  responsibleParty: 'technician' | 'inspector' | 'dispatcher' | 'building_manager';
  estimatedTime: string;
  materialsNeeded: string[];
  deadline: string | null;
  requiresNotification: boolean;
};

export type ParsedNoticeData = {
  // Property & Equipment
  documentType: string;
  clientCompany: string;
  propertyName: string;
  propertyAddress: string;
  buildingType: string;
  elevatorType: string;
  equipmentId: string;
  serialNumber: string;
  floorsServed: string;
  unitsAffected: number;

  // Four Key Compliance Items
  safetyTestsRequired: string[];
  advanceNotificationRequired: boolean;
  advanceNotificationHours: number | null;
  advanceNotificationRecipients: string[];
  complianceDeadline: string | null;
  additionalMaintenanceRequirements: string[];

  // Action Plan for dispatch/technician
  actionPlan: ActionPlanStep[];

  // Summary fields (kept for backward compat)
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
  if (!rawText || rawText.trim().length < 20) {
    return { data: null, error: 'Insufficient text to parse' };
  }

  const prompt = `You are an expert elevator compliance analyst. Analyze this elevator compliance document (Preliminary Order to Comply or similar) and extract ALL required information.

DOCUMENT TEXT:
${rawText.slice(0, 12000)}

Return a JSON object with EXACTLY these fields:

{
  "documentType": "string (e.g. Preliminary Order to Comply, CAL/OSHA Notice, Annual Inspection Report)",
  "clientCompany": "string (property owner or management company name)",
  "propertyName": "string (building or property name)",
  "propertyAddress": "string (full street address including city, state, zip)",
  "buildingType": "commercial | residential | mixed_use | industrial | government",
  "elevatorType": "string (hydraulic | traction | mrl | escalator | dumbwaiter | platform lift)",
  "equipmentId": "string (equipment ID, permit number, or unit designation)",
  "serialNumber": "string (serial number if listed, else empty string)",
  "floorsServed": "string (e.g. 'Floors 1-10', 'B1 to 5')",
  "unitsAffected": number (how many elevator units are affected),

  "safetyTestsRequired": [
    "List each specific safety test required e.g. 'Category 1 Safety Test', 'Annual Inspection', 'Hydraulic Pressure Test'"
  ],
  "advanceNotificationRequired": boolean (true if 48-hr or advance written notice is required),
  "advanceNotificationHours": number or null (usually 48, sometimes 72 or 5 business days),
  "advanceNotificationRecipients": ["list of who must be notified e.g. 'DOSH Inspector', 'Building Owner', 'Compliance Company'"],
  "complianceDeadline": "YYYY-MM-DD or null",
  "additionalMaintenanceRequirements": [
    "Any other required work beyond tests e.g. 'Replace worn door gibs', 'Lubricate guide rails'"
  ],

  "actionPlan": [
    {
      "stepNumber": 1,
      "title": "Short action title (max 8 words)",
      "description": "Clear, specific instruction written for a field elevator technician. Include exact measurements, parts, or codes where applicable.",
      "priority": "critical | high | medium",
      "responsibleParty": "technician | inspector | dispatcher | building_manager",
      "estimatedTime": "e.g. '2 hours', '30 minutes', '1 day'",
      "materialsNeeded": ["list of specific parts or materials needed for this step"],
      "deadline": "YYYY-MM-DD or null",
      "requiresNotification": boolean
    }
  ],

  "requiredWorkSummary": "1-2 sentence summary of all required work",
  "detailedScope": "Full paragraph describing complete scope of work",
  "violationItems": ["Each specific violation with code reference if available"],
  "workType": "string (e.g. Annual Inspection, Safety Test, Corrective Maintenance)",
  "requiredSkillTag": "hydraulic | traction | mrl | escalator | dumbwaiter | residential | commercial",
  "estimatedDurationHours": number or null,
  "estimatedLaborHours": number or null,
  "estimatedMaterials": number or null (estimated parts cost in USD),
  "urgency": "critical | high | medium | low",
  "fortyEightHourRequired": boolean,
  "complianceCoordinationRequired": boolean,
  "missingInformation": ["Note any required info that was unclear or absent from the document"],
  "parseConfidence": number between 0 and 1
}

ACTION PLAN RULES:
- Write for a field elevator technician — clear, direct, no ambiguity
- Order steps logically: notifications first, then inspection/testing, then repairs, then certification
- Mark notification steps as requiresNotification: true
- Critical = must be done before any other work or has immediate safety risk
- High = required for compliance, time-sensitive
- Medium = required but not blocking other steps
- Include ALL specific tests listed in the document as separate steps
- If 48-hour notice required, that is Step 1 and is CRITICAL

URGENCY RULES:
- critical = deadline within 30 days OR elevator out of service OR immediate safety hazard
- high = 31-60 days to deadline
- medium = 61-90 days
- low = 90+ days`;

  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.1,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are an expert elevator compliance analyst. Return ONLY valid JSON with no additional text.' },
        { role: 'user', content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return { data: null, error: 'OpenAI returned empty response' };

    let parsed: ParsedNoticeData;
    try { parsed = JSON.parse(content); }
    catch { return { data: null, error: 'OpenAI returned invalid JSON' }; }

    // Ensure arrays
    if (!Array.isArray(parsed.violationItems)) parsed.violationItems = [];
    if (!Array.isArray(parsed.missingInformation)) parsed.missingInformation = [];
    if (!Array.isArray(parsed.safetyTestsRequired)) parsed.safetyTestsRequired = [];
    if (!Array.isArray(parsed.additionalMaintenanceRequirements)) parsed.additionalMaintenanceRequirements = [];
    if (!Array.isArray(parsed.advanceNotificationRecipients)) parsed.advanceNotificationRecipients = [];
    if (!Array.isArray(parsed.actionPlan)) parsed.actionPlan = [];

    // Ensure action plan steps are properly numbered
    parsed.actionPlan = parsed.actionPlan.map((step, i) => ({
      ...step,
      stepNumber: i + 1,
    }));

    return { data: parsed, error: null };
  } catch (err) {
    return { data: null, error: `OpenAI error: ${err instanceof Error ? err.message : 'Unknown'}` };
  }
}
