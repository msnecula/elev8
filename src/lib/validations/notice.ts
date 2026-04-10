import { z } from 'zod';

export const noticeUploadSchema = z.object({
  propertyId: z.string().uuid().optional(),
  accountId: z.string().uuid('Account is required'),
  fileName: z.string().min(1, 'File name is required'),
  fileSize: z.number().max(20 * 1024 * 1024, 'File must be under 20 MB'),
  mimeType: z.literal('application/pdf', {
    errorMap: () => ({ message: 'Only PDF files are accepted' }),
  }),
  filePath: z.string().min(1, 'File path is required'),
});

export const updateNoticeSchema = z.object({
  id: z.string().uuid(),
  propertyId: z.string().uuid().optional().nullable(),
  assignedReviewerId: z.string().uuid().optional().nullable(),
  urgency: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  status: z
    .enum(['received', 'parsing', 'parsed', 'parse_failed', 'review_pending', 'reviewed'])
    .optional(),
});

export type NoticeUploadInput = z.infer<typeof noticeUploadSchema>;
export type UpdateNoticeInput = z.infer<typeof updateNoticeSchema>;
