import { z } from 'zod';

export const createWorkOrderSchema = z.object({
  jobId: z.string().uuid(),
  schedulingRequestId: z.string().uuid().optional(),
  scheduledStart: z.string().datetime(),
  scheduledEnd: z.string().datetime(),
  region: z.string().min(1, 'Region is required'),
  requiredSkillTag: z.string().min(1, 'Skill tag is required'),
  dispatchNotes: z.string().optional(),
  fortyEightHourNoticeRequired: z.boolean().default(false),
});

export const assignTechnicianSchema = z.object({
  workOrderId: z.string().uuid(),
  technicianId: z.string().uuid(),
});

export const updateWorkOrderStatusSchema = z.object({
  workOrderId: z.string().uuid(),
  status: z.enum([
    'draft', 'assigned', 'dispatched', 'ready',
    'en_route', 'on_site', 'completed', 'held', 'cancelled',
  ]),
  completionNotes: z.string().optional(),
  completionPhotos: z.array(z.string()).optional(),
});

export const completeWorkOrderSchema = z.object({
  workOrderId: z.string().uuid(),
  completionNotes: z.string().min(1, 'Completion notes are required'),
  completionPhotos: z.array(z.string()).default([]),
});

export const markFortyEightHourSentSchema = z.object({
  workOrderId: z.string().uuid(),
});

export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>;
export type AssignTechnicianInput = z.infer<typeof assignTechnicianSchema>;
export type UpdateWorkOrderStatusInput = z.infer<typeof updateWorkOrderStatusSchema>;
export type CompleteWorkOrderInput = z.infer<typeof completeWorkOrderSchema>;
