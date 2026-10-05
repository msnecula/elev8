import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { db } from '@/server/db/client';
import { properties } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import PageHeader from '@/components/shared/PageHeader';
import ClientNoticeUploadForm from '@/components/notices/ClientNoticeUploadForm';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Upload Notice' };

export default async function ClientNewNoticePage() {
  const user = await requireUser();
  if (!user.accountId) redirect('/client');

  const myProperties = await db
    .select({ id: properties.id, name: properties.name, address: properties.address })
    .from(properties)
    .where(eq(properties.accountId, user.accountId))
    .orderBy(properties.name);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Upload Notice"
        description="Submit an Order to Comply notice for our team to review"
      />
      <div className="rounded-lg border border-border bg-card p-6">
        <ClientNoticeUploadForm accountId={user.accountId} properties={myProperties} />
      </div>
    </div>
  );
}
