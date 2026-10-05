import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import { jobs, accounts, properties, proposalTemplates } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import PageHeader from '@/components/shared/PageHeader';
import NewProposalForm from './NewProposalForm';

export const metadata: Metadata = { title: 'New Proposal' };

export default async function NewProposalPage({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string }>
}) {
  const params = await searchParams;
  await requireRole('admin', 'reviewer');

  if (!params.jobId) redirect('/jobs');

  const jobResult = await db
    .select({
      job: jobs,
      account: { name: accounts.name },
      property: { name: properties.name },
    })
    .from(jobs)
    .leftJoin(accounts, eq(jobs.accountId, accounts.id))
    .leftJoin(properties, eq(jobs.propertyId, properties.id))
    .where(eq(jobs.id, params.jobId))
    .limit(1);

  if (!jobResult[0]) redirect('/jobs');
  const { job, account, property } = jobResult[0];

  const templates = await db
    .select({ id: proposalTemplates.id, name: proposalTemplates.name })
    .from(proposalTemplates)
    .where(eq(proposalTemplates.isActive, true));

  return (
    <div>
      <PageHeader
        title="New Proposal"
        description={`${account?.name ?? ''} — ${job.title ?? property?.name ?? 'Job'}`}
      />
      <NewProposalForm
        jobId={job.id}
        jobTitle={job.title ?? ''}
        templates={templates}
      />
    </div>
  );
}
