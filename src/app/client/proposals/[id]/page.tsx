import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { db } from '@/server/db/client';
import { proposals, jobs, accounts, properties } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ClientProposalActions from './ClientProposalActions';

export const metadata: Metadata = { title: 'Your Proposal' };

export default async function ClientProposalPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!user.accountId) notFound();

  const result = await db
    .select({
      proposal: proposals,
      job: { id: jobs.id, title: jobs.title, accountId: jobs.accountId },
      account: { name: accounts.name },
      property: { name: properties.name, city: properties.city },
    })
    .from(proposals)
    .leftJoin(jobs, eq(proposals.jobId, jobs.id))
    .leftJoin(accounts, eq(jobs.accountId, accounts.id))
    .leftJoin(properties, eq(jobs.propertyId, properties.id))
    .where(eq(proposals.id, params.id))
    .limit(1);

  if (!result[0]) notFound();
  const { proposal, job, account, property } = result[0];

  // Security: clients can only view proposals for their own account
  if (job?.accountId !== user.accountId) notFound();

  const lineItems = (proposal.lineItems as Array<{
    id: string; description: string; quantity: number;
    unit: string; unitPrice: number; total: number;
  }>) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={proposal.title}
        description={`${account?.name ?? ''} ${property ? `· ${property.name}, ${property.city}` : ''}`}
      >
        <StatusBadge variant="proposal_status" value={proposal.status} />
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Proposal letter */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Proposal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed">
                {proposal.body}
              </div>
            </CardContent>
          </Card>

          {/* Line items */}
          {lineItems.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Pricing Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Description</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">Qty</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Unit</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">Unit Price</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">Total</th>
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
                      <td colSpan={4} className="px-4 py-3 text-right font-semibold text-sm">Total</td>
                      <td className="px-4 py-3 text-right font-bold text-base">{formatCurrency(proposal.totalAmount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Client actions */}
          <ClientProposalActions
            proposalId={proposal.id}
            status={proposal.status}
          />

          {/* Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Job</p>
                <a href={`/client/jobs/${job?.id}`} className="text-blue-600 hover:underline">
                  {job?.title ?? 'View Job'}
                </a>
              </div>
              {proposal.sentAt && (
                <div>
                  <p className="text-xs text-muted-foreground">Sent</p>
                  <p>{formatDate(proposal.sentAt)}</p>
                </div>
              )}
              {proposal.expiresAt && (
                <div>
                  <p className="text-xs text-muted-foreground">Expires</p>
                  <p className={new Date(proposal.expiresAt) < new Date() ? 'text-red-600 font-medium' : ''}>
                    {formatDate(proposal.expiresAt)}
                  </p>
                </div>
              )}
              {proposal.totalAmount && (
                <div>
                  <p className="text-xs text-muted-foreground">Total Amount</p>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(proposal.totalAmount)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
