import { z } from 'zod';

const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export const noticeUploadSchema = z.object({
  propertyId: z.string().uuid().optional(),
  accountId: z.string().uuid('Account is required'),
  fileName: z.string().min(1, 'File name is required'),
  fileSize: z.number().max(25 * 1024 * 1024, 'File must be under 25 MB'),
  mimeType: z.string().refine(
    (val) => ACCEPTED_MIME_TYPES.includes(val as any) || val.startsWith('image/'),
    { message: 'Accepted formats: PDF, JPG, PNG, WebP, HEIC' },
  ),
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
