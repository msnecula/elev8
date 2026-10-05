import 'server-only';
import { openai, OPENAI_MODEL } from '@/lib/openai';
import type { ProposalLineItem } from '../../../drizzle/schema/proposals';

export type ProposalDraftInput = {
  clientName: string;
  propertyName: string;
  propertyAddress: string;
  buildingType: string;
  requiredWorkSummary: string;
  detailedScope: string;
  violationItems: string[];
  workType: string;
  requiredSkillTag: string;
  estimatedDurationHours: number | null;
  estimatedLaborHours: number | null;
  estimatedMaterials: number | null;
  fortyEightHourRequired: boolean;
  complianceCoordinationRequired: boolean;
  templateBody?: string;
};

export type ProposalDraftOutput = {
  title: string;
  body: string;
  lineItems: ProposalLineItem[];
  totalAmount: number;
};

const SYSTEM_PROMPT = `You are a professional proposal writer for an elevator repair and compliance company in California.
Write clear, professional proposals that address the specific violations and required work.
Be direct, specific, and reassuring. Never use generic filler text.
Return ONLY valid JSON matching the schema — no markdown, no prose outside the JSON.`;

/**
 * Generates a complete proposal draft using GPT-4o.
 * Returns a structured proposal with title, body, line items, and total.
 */
export async function generateProposalWithAI(
  input: ProposalDraftInput,
): Promise<{ data: ProposalDraftOutput | null; error: string | null }> {
  const prompt = `Generate a professional elevator compliance proposal with these details:

Client: ${input.clientName}
Property: ${input.propertyName} — ${input.propertyAddress}
Building Type: ${input.buildingType}
Work Type: ${input.workType}
Required Skill: ${input.requiredSkillTag}

Violations to address:
${input.violationItems.map(v => `- ${v}`).join('\n')}

Work Summary: ${input.requiredWorkSummary}
Detailed Scope: ${input.detailedScope}

Estimated Duration: ${input.estimatedDurationHours ?? 'TBD'} hours
Estimated Labor: ${input.estimatedLaborHours ?? 'TBD'} hours  
Estimated Materials: $${input.estimatedMaterials ?? 'TBD'}

Special Requirements:
- 48-hour advance notice required: ${input.fortyEightHourRequired ? 'YES' : 'No'}
- Compliance coordination required: ${input.complianceCoordinationRequired ? 'YES' : 'No'}

${input.templateBody ? `Use this template as a guide for tone and structure:\n${input.templateBody}` : ''}

Return JSON with exactly this structure:
{
  "title": "Proposal title string",
  "body": "Full proposal letter text with greeting, scope, compliance notes, and closing",
  "lineItems": [
    {
      "id": "li-1",
      "description": "Line item description",
      "quantity": 1,
      "unit": "each",
      "unitPrice": 450,
      "total": 450
    }
  ],
  "totalAmount": 1920
}

Rules for line items:
- Use realistic California elevator contractor rates (~$145-165/hr labor)
- Separate parts/materials from labor
- Include inspection/certification fees if applicable
- Each line item must have a unique id (li-1, li-2, etc.)
- total = quantity * unitPrice
- totalAmount = sum of all line item totals`;

  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return { data: null, error: 'OpenAI returned empty response' };

    let parsed: ProposalDraftOutput;
    try {
      parsed = JSON.parse(content);
    } catch {
      return { data: null, error: 'OpenAI returned invalid JSON' };
    }

    if (!parsed.title || !parsed.body || !Array.isArray(parsed.lineItems)) {
      return { data: null, error: 'AI response missing required fields' };
    }

    // Recalculate totals to ensure accuracy
    parsed.lineItems = parsed.lineItems.map(item => ({
      ...item,
      total: Math.round(item.quantity * item.unitPrice * 100) / 100,
    }));
    parsed.totalAmount = parsed.lineItems.reduce((sum, item) => sum + item.total, 0);
    parsed.totalAmount = Math.round(parsed.totalAmount * 100) / 100;

    return { data: parsed, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown OpenAI error';
    return { data: null, error: `OpenAI error: ${message}` };
  }
}
