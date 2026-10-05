import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import { notices, accounts, properties } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import EU632Form from './EU632Form';
import type { ParsedNoticeData } from '@/server/services/noticeParser';

export const metadata: Metadata = { title: 'Generate EU-632' };

export default async function EU632Page({
  searchParams,
}: {
  searchParams: Promise<{ noticeId?: string }>;
}) {
  const { noticeId } = await searchParams;
  await requireRole('admin', 'dispatcher');

  if (!noticeId) redirect('/documents');

  const result = await db
    .select({
      notice: notices,
      account: { name: accounts.name, phone: accounts.phone },
      property: { name: properties.name, address: properties.address, city: properties.city, state: properties.state, zip: properties.zip },
    })
    .from(notices)
    .leftJoin(accounts, eq(notices.accountId, accounts.id))
    .leftJoin(properties, eq(notices.propertyId, properties.id))
    .where(eq(notices.id, noticeId))
    .limit(1);

  if (!result[0]) redirect('/documents');
  const { notice, account, property } = result[0];

  const parsed = notice.parsedData as unknown as ParsedNoticeData | null;

  // Pre-build requirements from the parsed action plan
  const prefilledRequirements = parsed?.violationItems?.map((v, i) => ({
    reqNumber: String(i + 1),
    solution: '',
    cccmNumber: '',
    violation: v,
  })) ?? [];

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Generate EU-632"
        description="Notice of Conveyance Compliance — filed with Cal/OSHA after violations are corrected"
      />

      {/* Pre-filled info */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Pre-Filled from Preliminary Order</CardTitle>
        </CardHeader>
        <CardContent className="text-sm grid grid-cols-2 gap-3">
          <div><p className="text-xs text-muted-foreground">Property</p><p className="font-medium">{parsed?.propertyName || account?.name}</p></div>
          <div><p className="text-xs text-muted-foreground">Address</p><p>{parsed?.propertyAddress || property?.address}</p></div>
          <div><p className="text-xs text-muted-foreground">State ID / Conveyance #</p><p className="font-bold text-blue-700">{parsed?.equipmentId || '—'}</p></div>
          <div><p className="text-xs text-muted-foreground">Inspection Date</p><p>{parsed?.inspectionDate || '—'}</p></div>
          <div><p className="text-xs text-muted-foreground">Violations Found</p><p>{parsed?.violationItems?.length ?? 0} items</p></div>
          <div><p className="text-xs text-muted-foreground">Compliance Deadline</p><p className="text-red-700 font-medium">{parsed?.complianceDeadline || 'Not specified'}</p></div>
        </CardContent>
      </Card>

      {/* The form */}
      <EU632Form
        noticeId={noticeId}
        parsedData={parsed}
        prefilledRequirements={prefilledRequirements}
      />
    </div>
  );
}
