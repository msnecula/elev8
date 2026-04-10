import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { db } from '@/server/db/client';
import { proposals, jobs, accounts, properties, proposalTemplates, users } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ProposalEditor from './ProposalEditor';
import ProposalActions from './ProposalActions';

export const metadata: Metadata = { title: 'Proposal' };

export default async function ProposalDetailPage({ params }: { params: { id: string } }) {
  const currentUser = await requireUser();
  if (currentUser.role === 'client') redirect(`/client/proposals/${params.id}`);

  const result = await db
    .select({
      proposal: proposals,
      job: { id: jobs.id, title: jobs.title, stage: jobs.stage, accountId: jobs.accountId },
      account: { name: accounts.name },
      property: { name: properties.name, city: properties.city },
      draftedBy: { fullName: users.fullName },
    })
    .from(proposals)
    .leftJoin(jobs, eq(proposals.jobId, jobs.id))
    .leftJoin(accounts, eq(jobs.accountId, accounts.id))
    .leftJoin(properties, eq(jobs.propertyId, properties.id))
    .leftJoin(users, eq(proposals.draftedBy, users.id))
    .where(eq(proposals.id, params.id))
    .limit(1);

  if (!result[0]) notFound();
  const { proposal, job, account, property, draftedBy } = result[0];

  const templates = await db
    .select({ id: proposalTemplates.id, name: proposalTemplates.name })
    .from(proposalTemplates)
    .where(eq(proposalTemplates.isActive, true));

  const lineItems = (proposal.lineItems as Array<{ id: string; description: string; quantity: number; unit: string; unitPrice: number; total: number }>) ?? [];
  const canEdit = ['admin', 'reviewer'].includes(currentUser.role) && ['draft', 'revision_requested'].includes(proposal.status);

  return (
    <div className="space-y-6">
      <PageHeader title={proposal.title} description={`${account?.name ?? ''} ${property ? `· ${property.name}, ${property.city}` : ''}`}>
        <div className="flex items-center gap-2">
          <StatusBadge variant="proposal_status" value={proposal.status} />
          <span className="text-xs text-muted-foreground">v{proposal.version}</span>
        </div>
      </PageHeader>

      {proposal.status === 'revision_requested' && proposal.revisionNotes && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
          <p className="text-sm font-semibold text-orange-800">Client requested changes:</p>
          <p className="text-sm text-orange-700 mt-1">{proposal.revisionNotes}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {canEdit ? (
            <ProposalEditor
              proposalId={proposal.id}
              jobId={proposal.jobId}
              initialTitle={proposal.title}
              initialBody={proposal.body}
              initialLineItems={lineItems}
              initialTotal={Number(proposal.totalAmount ?? 0)}
              templates={templates}
              templateId={proposal.templateId ?? undefined}
            />
          ) : (
            <>
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Proposal Letter</CardTitle></CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed">{proposal.body}</div>
                </CardContent>
              </Card>
              {lineItems.length > 0 && (
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Pricing</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/40 border-b border-border">
                          {['Description','Qty','Unit','Unit Price','Total'].map(h => (
                            <th key={h} className={`px-4 py-2.5 text-xs font-semibold text-muted-foreground ${h !== 'Description' && h !== 'Unit' ? 'text-right' : 'text-left'}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {lineItems.map(item => (
                          <tr key={item.id} className="border-b border-border last:border-0">
                            <td className="px-4 py-2.5">{item.description}</td>
                            <td className="px-4 py-2.5 text-right">{item.quantity}</td>
                            <td className="px-4 py-2.5 text-muted-foreground">{item.unit}</td>
                            <td className="px-4 py-2.5 text-right">{formatCurrency(item.unitPrice)}</td>
                            <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(item.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-muted/20 border-t border-border">
                          <td colSpan={4} className="px-4 py-3 text-right text-sm font-semibold">Total</td>
                          <td className="px-4 py-3 text-right text-base font-bold">{formatCurrency(proposal.totalAmount)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        <div className="space-y-4">
          <ProposalActions proposalId={proposal.id} status={proposal.status} userRole={currentUser.role} jobId={proposal.jobId} />
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Job</p><a href={`/jobs/${job?.id}`} className="text-blue-600 hover:underline">{job?.title ?? 'View Job'}</a></div>
              <div><p className="text-xs text-muted-foreground">Drafted By</p><p>{draftedBy?.fullName ?? '—'}</p></div>
              <div><p className="text-xs text-muted-foreground">Version</p><p>v{proposal.version}</p></div>
              <div><p className="text-xs text-muted-foreground">Created</p><p>{formatDate(proposal.createdAt)}</p></div>
              {proposal.sentAt && <div><p className="text-xs text-muted-foreground">Sent</p><p>{formatDate(proposal.sentAt)}</p></div>}
              {proposal.approvedAt && <div><p className="text-xs text-muted-foreground">Approved</p><p className="text-green-600 font-medium">{formatDate(proposal.approvedAt)}</p></div>}
              {proposal.expiresAt && <div><p className="text-xs text-muted-foreground">Expires</p><p className={new Date(proposal.expiresAt) < new Date() ? 'text-red-600' : ''}>{formatDate(proposal.expiresAt)}</p></div>}
              {proposal.totalAmount && <div><p className="text-xs text-muted-foreground">Total</p><p className="text-lg font-bold">{formatCurrency(proposal.totalAmount)}</p></div>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
