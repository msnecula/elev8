import 'server-only';
import { db } from '@/server/db/client';
import { users } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Determines the reviewer to assign to a job based on business rules:
 * 1. If urgency is critical  → assign to admin
 * 2. If building type is commercial → assign to commercial reviewer (role=reviewer)
 * 3. Otherwise → assign to first available reviewer
 *
 * Returns null if no reviewer is found (caller should handle gracefully).
 */
export async function assignReviewer(
  urgency: string,
  buildingType: string | null | undefined,
): Promise<string | null> {
  // Rule 1: Critical urgency → find an admin
  if (urgency === 'critical') {
    const admin = await db.query.users.findFirst({
      where: and(eq(users.role, 'admin'), eq(users.isActive, true)),
      columns: { id: true },
    });
    if (admin) return admin.id;
  }

  // Rule 2 & 3: Find a reviewer (commercial/residential distinction is noted
  // in future iterations; for now all reviewers are pooled)
  const reviewer = await db.query.users.findFirst({
    where: and(eq(users.role, 'reviewer'), eq(users.isActive, true)),
    columns: { id: true },
  });

  if (reviewer) return reviewer.id;

  // Fallback: if no reviewer exists, assign to admin
  const fallbackAdmin = await db.query.users.findFirst({
    where: and(eq(users.role, 'admin'), eq(users.isActive, true)),
    columns: { id: true },
  });

  return fallbackAdmin?.id ?? null;
}
