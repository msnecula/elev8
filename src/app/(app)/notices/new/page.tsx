import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import { accounts, properties } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import PageHeader from '@/components/shared/PageHeader';
import NoticeUploadForm from '@/components/notices/NoticeUploadForm';

export const metadata: Metadata = { title: 'New Notice' };

export default async function NewNoticePage() {
  await requireRole('admin', 'reviewer', 'dispatcher');

  const [allAccounts, allProperties] = await Promise.all([
    db.select({ id: accounts.id, name: accounts.name })
      .from(accounts)
      .where(eq(accounts.isActive, true))
      .orderBy(accounts.name),
    db.select({ id: properties.id, name: properties.name, accountId: properties.accountId })
      .from(properties)
      .orderBy(properties.name),
  ]);

  return (
    <div>
      <PageHeader
        title="New Notice"
        description="Upload an Order to Comply PDF and run AI extraction"
      />
      <NoticeUploadForm accounts={allAccounts} properties={allProperties} />
    </div>
  );
}
