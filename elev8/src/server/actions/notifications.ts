'use server';

import { requireRole } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { db } from '@/server/db/client';
import { users, accounts } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { sendInviteEmail } from '@/server/services/notificationService';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/types/api';
import { APP_URL } from '@/lib/constants';

const inviteSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2),
  accountId: z.string().uuid(),
  phone: z.string().optional(),
});

export async function inviteClient(
  input: z.infer<typeof inviteSchema>,
): Promise<ActionResult<{ userId: string }>> {
  await requireRole('admin');

  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid input' };

  const { email, fullName, accountId, phone } = parsed.data;

  const account = await db.query.accounts.findFirst({
    where: eq(accounts.id, accountId),
    columns: { name: true },
  });
  if (!account) return { success: false, error: 'Account not found' };

  const supabase = createServiceClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: 'client', account_id: accountId },
  });

  if (error) {
    if (error.message.includes('already registered')) {
      return { success: false, error: 'A user with this email already exists' };
    }
    return { success: false, error: error.message };
  }

  if (phone) {
    await db.update(users).set({ phone }).where(eq(users.id, data.user.id));
  }

  // Generate a magic link for first login
  const { data: linkData } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${APP_URL}/api/auth/callback?next=/client` },
  });

  const inviteUrl = linkData?.properties?.action_link ?? `${APP_URL}/login`;

  await sendInviteEmail({
    to: email,
    inviteeName: fullName,
    accountName: account.name,
    inviteUrl,
  });

  revalidatePath('/settings');
  return { success: true, data: { userId: data.user.id } };
}
