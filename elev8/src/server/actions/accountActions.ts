'use server';

import { requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import { accounts } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/types/api';

const accountSchema = z.object({
  name: z.string().min(1, 'Account name is required').max(200),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
  address: z.string().max(300).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(2).optional(),
  zip: z.string().max(10).optional(),
});

export async function createAccount(
  input: z.infer<typeof accountSchema>,
): Promise<ActionResult<{ id: string }>> {
  await requireRole('admin');

  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input', fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const [account] = await db.insert(accounts).values({
    ...parsed.data,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    address: parsed.data.address || null,
    city: parsed.data.city || null,
    state: parsed.data.state || null,
    zip: parsed.data.zip || null,
  }).returning({ id: accounts.id });

  revalidatePath('/properties');
  return { success: true, data: { id: account.id } };
}

export async function updateAccount(
  id: string,
  input: z.infer<typeof accountSchema>,
): Promise<ActionResult<void>> {
  await requireRole('admin');

  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input' };

  await db.update(accounts).set({
    ...parsed.data,
    email: parsed.data.email || null,
    updatedAt: new Date(),
  }).where(eq(accounts.id, id));

  revalidatePath('/properties');
  return { success: true, data: undefined };
}
