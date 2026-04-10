'use server';

import { requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import { jobs } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { updateJobSchema, addJobNoteSchema } from '@/lib/validations/job';
import { z } from 'zod';
import { logJobActivity } from '@/server/services/activityLogger';
import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/types/api';

export async function updateJob(
  input: z.infer<typeof updateJobSchema>,
): Promise<ActionResult<void>> {
  const user = await requireRole('admin', 'reviewer', 'dispatcher');

  const parsed = updateJobSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Invalid input',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { id, stage, ...rest } = parsed.data;

  const currentJob = await db.query.jobs.findFirst({
    where: eq(jobs.id, id),
    columns: { stage: true },
  });

  await db.update(jobs)
    .set({ ...rest, ...(stage ? { stage } : {}), updatedAt: new Date() })
    .where(eq(jobs.id, id));

  if (stage && currentJob && stage !== currentJob.stage) {
    await logJobActivity(id, 'job_stage_changed',
      `Stage changed: ${currentJob.stage} → ${stage}`, user.id, { from: currentJob.stage, to: stage });
  } else {
    await logJobActivity(id, 'note_added', 'Job details updated', user.id);
  }

  revalidatePath(`/jobs/${id}`);
  revalidatePath('/jobs');
  return { success: true, data: undefined };
}

export async function addJobNote(
  input: z.infer<typeof addJobNoteSchema>,
): Promise<ActionResult<void>> {
  const user = await requireRole('admin', 'reviewer', 'dispatcher');

  const parsed = addJobNoteSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input' };

  const { jobId, note } = parsed.data;
  const job = await db.query.jobs.findFirst({ where: eq(jobs.id, jobId), columns: { internalNotes: true } });

  const existing = job?.internalNotes ?? '';
  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
  const updatedNotes = existing ? `${existing}\n\n[${timestamp}] ${note}` : `[${timestamp}] ${note}`;

  await db.update(jobs).set({ internalNotes: updatedNotes, updatedAt: new Date() }).where(eq(jobs.id, jobId));
  await logJobActivity(jobId, 'note_added', `Note added: ${note.slice(0, 80)}`, user.id);
  revalidatePath(`/jobs/${jobId}`);
  return { success: true, data: undefined };
}

export async function advanceJobStage(jobId: string, stage: string): Promise<ActionResult<void>> {
  return updateJob({ id: jobId, stage: stage as NonNullable<z.infer<typeof updateJobSchema>['stage']> });
}
