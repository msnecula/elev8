import { z } from 'zod';

export const updateJobSchema = z.object({
  id: z.string().uuid(),
  stage: z
    .enum([
      'notice_received',
      'under_review',
      'proposal_drafted',
      'proposal_sent',
      'approved',
      'scheduled',
      'dispatched',
      'in_progress',
      'completed',
      'cancelled',
      'on_hold',
    ])
    .optional(),
  urgency: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  assignedReviewerId: z.string().uuid().optional().nullable(),
  nextActionDate: z.string().optional().nullable(),
  internalNotes: z.string().max(10000).optional(),
  riskFlags: z.array(z.string()).optional(),
  requiredSkillTag: z.string().optional(),
});

export const addJobNoteSchema = z.object({
  jobId: z.string().uuid(),
  note: z.string().min(1).max(5000),
});

export type UpdateJobInput = z.infer<typeof updateJobSchema>;
export type AddJobNoteInput = z.infer<typeof addJobNoteSchema>;
