import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/openai', () => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
  OPENAI_MODEL: 'gpt-4o',
}));

import { generateProposalWithAI } from '@/server/services/proposalGenerator';
import { openai } from '@/lib/openai';

const MOCK_PROPOSAL = {
  title: 'Proposal — Elevator Compliance — Test Building',
  body: 'Dear Test Client,\n\nWe have reviewed the violations and propose the following work.\n\nBest regards,\nElev8 Comply',
  lineItems: [
    { id: 'li-1', description: 'Safety inspection', quantity: 1, unit: 'each', unitPrice: 450, total: 450 },
    { id: 'li-2', description: 'Labor', quantity: 4, unit: 'hrs', unitPrice: 155, total: 620 },
  ],
  totalAmount: 1070,
};

const TEST_INPUT = {
  clientName: 'Test Client',
  propertyName: 'Test Building',
  propertyAddress: '123 Main St, Los Angeles CA 90001',
  buildingType: 'commercial',
  requiredWorkSummary: 'Annual inspection and safety test',
  detailedScope: 'Full inspection of elevator unit #1',
  violationItems: ['Annual inspection overdue'],
  workType: 'Annual inspection',
  requiredSkillTag: 'hydraulic',
  estimatedDurationHours: 4,
  estimatedLaborHours: 4,
  estimatedMaterials: null,
  fortyEightHourRequired: false,
  complianceCoordinationRequired: false,
};

describe('generateProposalWithAI', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns proposal data for valid input', async () => {
    vi.mocked(openai.chat.completions.create).mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(MOCK_PROPOSAL) } }],
    } as never);

    const { data, error } = await generateProposalWithAI(TEST_INPUT);

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data?.title).toBe(MOCK_PROPOSAL.title);
    expect(data?.lineItems).toHaveLength(2);
  });

  it('recalculates totals from quantity * unitPrice', async () => {
    const withWrongTotals = {
      ...MOCK_PROPOSAL,
      lineItems: [
        { id: 'li-1', description: 'Labor', quantity: 4, unit: 'hrs', unitPrice: 155, total: 999 }, // wrong total
      ],
      totalAmount: 999,
    };

    vi.mocked(openai.chat.completions.create).mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(withWrongTotals) } }],
    } as never);

    const { data, error } = await generateProposalWithAI(TEST_INPUT);

    expect(error).toBeNull();
    // total should be recalculated as 4 * 155 = 620
    expect(data?.lineItems[0].total).toBe(620);
    expect(data?.totalAmount).toBe(620);
  });

  it('returns error for empty response', async () => {
    vi.mocked(openai.chat.completions.create).mockResolvedValueOnce({
      choices: [{ message: { content: null } }],
    } as never);

    const { data, error } = await generateProposalWithAI(TEST_INPUT);

    expect(data).toBeNull();
    expect(error).toContain('empty response');
  });

  it('returns error for invalid JSON', async () => {
    vi.mocked(openai.chat.completions.create).mockResolvedValueOnce({
      choices: [{ message: { content: 'not json' } }],
    } as never);

    const { data, error } = await generateProposalWithAI(TEST_INPUT);

    expect(data).toBeNull();
    expect(error).toContain('invalid JSON');
  });

  it('returns error for missing required fields', async () => {
    vi.mocked(openai.chat.completions.create).mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ title: '' }) } }],
    } as never);

    const { data, error } = await generateProposalWithAI(TEST_INPUT);

    expect(data).toBeNull();
    expect(error).toContain('missing required fields');
  });
});
