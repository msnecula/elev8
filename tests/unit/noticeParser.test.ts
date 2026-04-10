import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the openai module before importing the service
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

vi.mock('server-only', () => ({}));

import { parseNoticeWithAI } from '@/server/services/noticeParser';
import { openai } from '@/lib/openai';

const MOCK_PARSED: Record<string, unknown> = {
  documentType: 'Order to Comply',
  clientCompany: 'Test Properties LLC',
  propertyName: 'Test Building',
  propertyAddress: '123 Main St, Los Angeles CA 90001',
  buildingType: 'commercial',
  inspectionDate: '2025-05-01',
  stateDeadline: '2025-08-01',
  requiredWorkSummary: 'Replace worn cable guides and test safety brakes',
  detailedScope: 'Full inspection of traction elevator unit #1',
  violationItems: ['Worn cable guides', 'Safety brake test overdue'],
  workType: 'Maintenance and inspection',
  requiredSkillTag: 'traction',
  estimatedDurationHours: 6,
  estimatedLaborHours: 5,
  estimatedMaterials: 600,
  urgency: 'high',
  fortyEightHourRequired: true,
  complianceCoordinationRequired: false,
  missingInformation: [],
  parseConfidence: 0.88,
};

describe('parseNoticeWithAI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns parsed data for valid notice text', async () => {
    const mockCreate = vi.mocked(openai.chat.completions.create);
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(MOCK_PARSED) } }],
    } as never);

    const sampleText = 'ORDER TO COMPLY. Inspection overdue on traction elevator unit #1 at 123 Main St. Violation: worn cable guides. Deadline August 1, 2025.';
    const { data, error } = await parseNoticeWithAI(sampleText);

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data?.documentType).toBe('Order to Comply');
    expect(data?.urgency).toBe('high');
    expect(data?.fortyEightHourRequired).toBe(true);
    expect(data?.violationItems).toHaveLength(2);
    expect(data?.parseConfidence).toBe(0.88);
  });

  it('returns error when text is too short', async () => {
    const { data, error } = await parseNoticeWithAI('short');

    expect(data).toBeNull();
    expect(error).toContain('too short');
    expect(openai.chat.completions.create).not.toHaveBeenCalled();
  });

  it('returns error when OpenAI returns empty response', async () => {
    const mockCreate = vi.mocked(openai.chat.completions.create);
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: null } }],
    } as never);

    const { data, error } = await parseNoticeWithAI('A'.repeat(100));

    expect(data).toBeNull();
    expect(error).toContain('empty response');
  });

  it('returns error when OpenAI returns invalid JSON', async () => {
    const mockCreate = vi.mocked(openai.chat.completions.create);
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'not valid json {{{' } }],
    } as never);

    const { data, error } = await parseNoticeWithAI('A'.repeat(100));

    expect(data).toBeNull();
    expect(error).toContain('invalid JSON');
  });

  it('truncates very long text before sending to OpenAI', async () => {
    const mockCreate = vi.mocked(openai.chat.completions.create);
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(MOCK_PARSED) } }],
    } as never);

    const longText = 'A'.repeat(15000);
    await parseNoticeWithAI(longText);

    const callArgs = mockCreate.mock.calls[0][0] as { messages: Array<{ content: string }> };
    const userMessage = callArgs.messages.find(m => m.content.includes('truncated'));
    expect(userMessage).toBeDefined();
  });
});
