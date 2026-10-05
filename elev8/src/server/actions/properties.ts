'use server';

import { requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import { properties, accounts } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/types/api';

const propertySchema = z.object({
  accountId: z.string().uuid('Account is required'),
  name: z.string().min(1, 'Property name is required').max(200),
  address: z.string().min(1, 'Address is required').max(300),
  city: z.string().min(1, 'City is required').max(100),
  state: z.string().min(2).max(2).default('CA'),
  zip: z.string().max(10).optional(),
  buildingType: z.enum(['commercial', 'residential', 'mixed_use', 'industrial', 'government']).default('commercial'),
  elevatorCount: z.coerce.number().int().min(0).max(999).default(1),
  notes: z.string().max(1000).optional(),
});

export async function createProperty(
  input: z.infer<typeof propertySchema>,
): Promise<ActionResult<{ id: string }>> {
  await requireRole('admin');

  const parsed = propertySchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Invalid input',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const [property] = await db.insert(properties).values(parsed.data).returning({ id: properties.id });

  revalidatePath('/properties');
  return { success: true, data: { id: property.id } };
}

export async function updateProperty(
  id: string,
  input: z.infer<typeof propertySchema>,
): Promise<ActionResult<void>> {
  await requireRole('admin');

  const parsed = propertySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }

  await db.update(properties)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(properties.id, id));

  revalidatePath('/properties');
  return { success: true, data: undefined };
}

export async function deleteProperty(id: string): Promise<ActionResult<void>> {
  await requireRole('admin');

  // Check if property has any notices or jobs linked to it
  const property = await db.query.properties.findFirst({
    where: eq(properties.id, id),
    columns: { id: true, name: true },
  });

  if (!property) return { success: false, error: 'Property not found' };

  await db.delete(properties).where(eq(properties.id, id));

  revalidatePath('/properties');
  return { success: true, data: undefined };
}

// ─── CSV Import ───────────────────────────────────────────────────────────────

export type CSVPropertyRow = {
  accountName: string;
  propertyName: string;
  address: string;
  city: string;
  state?: string;
  zip?: string;
  buildingType?: string;
  elevatorCount?: string;
};

export async function importPropertiesFromCSV(
  rows: CSVPropertyRow[],
): Promise<ActionResult<{ created: number; skipped: number; errors: string[] }>> {
  await requireRole('admin');

  if (rows.length === 0) return { success: false, error: 'No rows to import' };
  if (rows.length > 500) return { success: false, error: 'Maximum 500 properties per import' };

  // Get all accounts for matching
  const allAccounts = await db.select({ id: accounts.id, name: accounts.name }).from(accounts);
  const accountMap = new Map(allAccounts.map(a => [a.name.toLowerCase().trim(), a.id]));

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // +2 for header + 1-based

    if (!row.accountName?.trim()) {
      errors.push(`Row ${rowNum}: Missing account name`);
      skipped++;
      continue;
    }
    if (!row.propertyName?.trim()) {
      errors.push(`Row ${rowNum}: Missing property name`);
      skipped++;
      continue;
    }
    if (!row.address?.trim()) {
      errors.push(`Row ${rowNum}: Missing address`);
      skipped++;
      continue;
    }
    if (!row.city?.trim()) {
      errors.push(`Row ${rowNum}: Missing city`);
      skipped++;
      continue;
    }

    // Match account by name (case-insensitive)
    const accountId = accountMap.get(row.accountName.toLowerCase().trim());
    if (!accountId) {
      errors.push(`Row ${rowNum}: Account "${row.accountName}" not found — create the account first`);
      skipped++;
      continue;
    }

    // Normalize building type
    const rawType = row.buildingType?.toLowerCase().trim() ?? 'commercial';
    const buildingType = (
      ['commercial', 'residential', 'mixed_use', 'industrial', 'government'].includes(rawType)
        ? rawType
        : rawType.includes('res') ? 'residential'
        : rawType.includes('mix') ? 'mixed_use'
        : rawType.includes('ind') ? 'industrial'
        : rawType.includes('gov') ? 'government'
        : 'commercial'
    ) as 'commercial' | 'residential' | 'mixed_use' | 'industrial' | 'government';

    const elevatorCount = parseInt(row.elevatorCount ?? '1', 10);

    try {
      await db.insert(properties).values({
        accountId,
        name: row.propertyName.trim(),
        address: row.address.trim(),
        city: row.city.trim(),
        state: row.state?.trim().toUpperCase().slice(0, 2) || 'CA',
        zip: row.zip?.trim() || null,
        buildingType,
        elevatorCount: isNaN(elevatorCount) ? 1 : Math.max(0, Math.min(999, elevatorCount)),
      });
      created++;
    } catch (err) {
      errors.push(`Row ${rowNum}: Failed to create — ${err instanceof Error ? err.message : 'Unknown error'}`);
      skipped++;
    }
  }

  revalidatePath('/properties');
  return { success: true, data: { created, skipped, errors } };
}
