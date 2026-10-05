import { z } from 'zod';

export const lineItemSchema = z.object({
  id: z.string(),
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().positive('Quantity must be positive'),
  unit: z.string().min(1, 'Unit is required'),
  unitPrice: z.number().nonnegative('Price cannot be negative'),
  total: z.number().nonnegative(),
});

export const createProposalSchema = z.object({
  jobId: z.string().uuid(),
  templateId: z.string().uuid().optional(),
  title: z.string().min(1, 'Title is required').max(500),
  body: z.string().min(10, 'Proposal body is required'),
  lineItems: z.array(lineItemSchema).default([]),
  totalAmount: z.number().nonnegative().default(0),
});

export const updateProposalSchema = createProposalSchema
  .partial()
  .extend({ id: z.string().uuid() });

export const approveProposalSchema = z.object({ proposalId: z.string().uuid() });
export const rejectProposalSchema = z.object({
  proposalId: z.string().uuid(),
  reason: z.string().optional(),
});
export const requestRevisionSchema = z.object({
  proposalId: z.string().uuid(),
  revisionNotes: z.string().min(10, 'Please describe the requested changes'),
});

export type CreateProposalInput = z.infer<typeof createProposalSchema>;
export type UpdateProposalInput = z.infer<typeof updateProposalSchema>;
export type ApproveProposalInput = z.infer<typeof approveProposalSchema>;
export type RejectProposalInput = z.infer<typeof rejectProposalSchema>;
export type RequestRevisionInput = z.infer<typeof requestRevisionSchema>;
