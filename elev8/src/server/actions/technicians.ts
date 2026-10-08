'use server';

import { requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import { technicians } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/types/api';

// ── Update a technician's CCCM License number ─────────────────────────────────

export async function updateTechnicianCccmLicense(
  technicianId: string,
  cccmLicense: string,
): Promise<ActionResult<null>> {
  await requireRole('admin', 'dispatcher');

  if (!technicianId) {
    return { success: false, error: 'Technician ID is required' };
  }

  const trimmed = cccmLicense.trim();

  await db
    .update(technicians)
    .set({ cccmLicense: trimmed || null, updatedAt: new Date() })
    .where(eq(technicians.id, technicianId));

  revalidatePath('/settings/technicians');

  return { success: true, data: null };
}
