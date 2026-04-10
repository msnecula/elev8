import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { db } from '@/server/db/client';
import {
  workOrders, jobs, accounts, properties, technicians, users,
} from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';
import {
  AlertTriangle, User, MapPin, Wrench, Camera, ChevronLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import WorkOrderActions from './WorkOrderActions';
import TechnicianPicker from '@/components/dispatch/TechnicianPicker';
import FortyEightHourPanel from '@/components/dispatch/FortyEightHourPanel';
import DispatchButton from './DispatchButton';

export const metadata: Metadata = { title: 'Work Order' };

export default async function WorkOrderDetailPage({ params }: { params: { id: string } }) {
  const currentUser = await requireUser();

  const rows = await db
    .select({
      wo: workOrders,
      job: {
        id: jobs.id, title: jobs.title, urgency: jobs.urgency,
        accountId: jobs.accountId, fortyEightHourRequired: jobs.fortyEightHourRequired,
        complianceCoordinationRequired: jobs.complianceCoordinationRequired,
      },
      account: { name: accounts.name, phone: accounts.phone },
      property: {
        name: properties.name, address: properties.address,
        city: properties.city, state: properties.state,
      },
      technician: {
        id: technicians.id, fullName: technicians.fullName,
        phone: technicians.phone, email: technicians.email,
        skillTags: technicians.skillTags, regions: technicians.regions,
        userId: technicians.userId,
      },
      createdBy: { fullName: users.fullName },
    })
    .from(workOrders)
    .leftJoin(jobs, eq(workOrders.jobId, jobs.id))
    .leftJoin(accounts, eq(jobs.accountId, accounts.id))
    .leftJoin(properties, eq(jobs.propertyId, properties.id))
    .leftJoin(technicians, eq(workOrders.assignedTechnicianId, technicians.id))
    .leftJoin(users, eq(workOrders.createdBy, users.id))
    .where(eq(workOrders.id, params.id))
    .limit(1);

  if (!rows[0]) notFound();
  const { wo, job, account, property, technician, createdBy } = rows[0];

  // Technician can only see their own assigned work orders
  if (currentUser.role === 'technician') {
    if (!technician || technician.userId !== currentUser.id) notFound();
  }

  const isOverdue = wo.fortyEightHourStatus === 'overdue';
  const isPending48h = wo.fortyEightHourStatus === 'pending';
  const deadline48h = wo.fortyEightHourDeadline;
  const nearDeadline = deadline48h && new Date(deadline48h) <= new Date(Date.now() + 24 * 60 * 60 * 1000);

  const isDispatcher = ['admin', 'dispatcher'].includes(currentUser.role);
  const isTechnician = currentUser.role === 'technician';

  let packet: Record<string, unknown> | null = null;
  if (wo.dispatchPacket) {
    try { packet = JSON.parse(wo.dispatchPacket as string); } catch { /* ignore */ }
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div>
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground -ml-2">
          <Link href={isDispatcher ? '/work-orders' : '/technician'}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            {isDispatcher ? 'Work Orders' : 'My Work'}
          </Link>
        </Button>
      </div>

      <PageHeader title={job?.title ?? 'Work Order'} description={account?.name ?? ''}>
        <div className="flex items-center gap-2">
          <StatusBadge variant="work_order_status" value={wo.status} />
          {job?.urgency && <StatusBadge variant="urgency" value={job.urgency} />}
        </div>
      </PageHeader>

      {/* 48-hour alert banner */}
      {(isOverdue || (isPending48h && nearDeadline)) && (
        <div className={`flex items-start gap-3 p-4 rounded-lg border ${
          isOverdue ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-300'
        }`}>
          <AlertTriangle className={`h-5 w-5 shrink-0 mt-0.5 ${
            isOverdue ? 'text-red-600' : 'text-amber-600'
          }`} />
          <div>
            <p className={`text-sm font-semibold ${
              isOverdue ? 'text-red-800' : 'text-amber-800'
            }`}>
              {isOverdue ? '48-Hour Notice OVERDUE — Dispatch is HELD' : '48-Hour Notice deadline approaching'}
            </p>
            {deadline48h && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Deadline: {formatDate(deadline48h, 'EEEE, MMM d, yyyy \'at\' h:mm a')}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Technician status actions */}
          <WorkOrderActions
            workOrderId={wo.id}
            currentStatus={wo.status}
            fortyEightHourStatus={wo.fortyEightHourStatus}
            fortyEightHourRequired={wo.fortyEightHourNoticeRequired}
            userRole={currentUser.role}
            technicianId={wo.assignedTechnicianId}
            currentUserId={currentUser.id}
          />

          {/* Dispatch controls (dispatcher/admin only) */}
          {isDispatcher && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Dispatch Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Technician assignment */}
                <div>
                  <p className="text-sm font-medium mb-2">Technician Assignment</p>
                  {technician ? (
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-green-200 bg-green-50">
                      <User className="h-4 w-4 text-green-600" />
                      <div>
                        <p className="text-sm font-medium">{technician.fullName}</p>
                        {technician.phone && <p className="text-xs text-muted-foreground">{technician.phone}</p>}
                      </div>
                      <span className="ml-auto text-xs text-green-700 font-medium">Assigned</span>
                    </div>
                  ) : null}
                  {wo.status === 'draft' && (
                    <div className="mt-3">
                      <TechnicianPicker
                        workOrderId={wo.id}
                        requiredSkillTag={wo.requiredSkillTag ?? ''}
                        region={wo.region ?? ''}
                        currentTechnicianId={wo.assignedTechnicianId}
                      />
                    </div>
                  )}
                </div>

                {/* Dispatch button */}
                {wo.status === 'assigned' && (
                  <DispatchButton
                    workOrderId={wo.id}
                    fortyEightHourRequired={wo.fortyEightHourNoticeRequired}
                    fortyEightHourStatus={wo.fortyEightHourStatus}
                  />
                )}
              </CardContent>
            </Card>
          )}

          {/* 48-hour notice panel (dispatcher only) */}
          {isDispatcher && wo.fortyEightHourNoticeRequired && (
            <Card className={isOverdue ? 'border-red-200' : isPending48h && nearDeadline ? 'border-amber-200' : ''}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">48-Hour Notice</CardTitle>
              </CardHeader>
              <CardContent>
                <FortyEightHourPanel
                  workOrderId={wo.id}
                  required={wo.fortyEightHourNoticeRequired}
                  status={wo.fortyEightHourStatus}
                  deadline={wo.fortyEightHourDeadline}
                  sentAt={wo.fortyEightHourSentAt}
                  scheduledStart={wo.scheduledStart}
                />
              </CardContent>
            </Card>
          )}

          {/* Dispatch packet */}
          {packet && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Dispatch Packet</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-2.5 text-sm">
                  {Object.entries(packet).map(([k, v]) => {
                    if (!v || (Array.isArray(v) && v.length === 0)) return null;
                    const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
                    return (
                      <div key={k} className="grid grid-cols-5 gap-2">
                        <dt className="col-span-2 text-xs text-muted-foreground font-medium">{label}</dt>
                        <dd className="col-span-3">
                          {Array.isArray(v) ? (
                            <ul className="space-y-0.5">
                              {(v as string[]).map((item, i) => (
                                <li key={i} className="text-xs">• {item}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-sm">{String(v)}</span>
                          )}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </CardContent>
            </Card>
          )}

          {/* Completion */}
          {wo.completionNotes && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-green-800">Completion Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{wo.completionNotes}</p>
                {wo.completedAt && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Completed: {formatDate(wo.completedAt, 'MMM d, yyyy h:mm a')}
                  </p>
                )}
                {wo.completionPhotos && (wo.completionPhotos as string[]).length > 0 && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <Camera className="h-3.5 w-3.5" />
                    {(wo.completionPhotos as string[]).length} photo(s) attached
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Dispatch notes */}
          {wo.dispatchNotes && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Dispatch Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{wo.dispatchNotes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Property
                </p>
                <p className="font-medium">{property?.name ?? '—'}</p>
                {property?.address && (
                  <p className="text-xs text-muted-foreground">
                    {property.address}, {property.city}, {property.state}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Wrench className="h-3 w-3" /> Skill Required
                </p>
                <p className="capitalize">{wo.requiredSkillTag ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Region</p>
                <p>{wo.region ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Scheduled Start</p>
                <p className="font-medium">
                  {wo.scheduledStart
                    ? formatDate(wo.scheduledStart, 'EEEE, MMM d, yyyy')
                    : '—'}
                </p>
                {wo.scheduledStart && (
                  <p className="text-xs text-muted-foreground">
                    {formatDate(wo.scheduledStart, 'h:mm a')}
                    {wo.scheduledEnd && ` – ${formatDate(wo.scheduledEnd, 'h:mm a')}`}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Created By</p>
                <p>{createdBy?.fullName ?? 'System'}</p>
              </div>
              {job && (
                <div>
                  <p className="text-xs text-muted-foreground">Linked Job</p>
                  <Link href={`/jobs/${job.id}`} className="text-blue-600 hover:underline text-sm">
                    {job.title ?? 'View Job'}
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Technician card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Technician
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {technician ? (
                <div className="space-y-1">
                  <p className="font-medium">{technician.fullName}</p>
                  {technician.phone && <p className="text-xs text-muted-foreground">{technician.phone}</p>}
                  {technician.email && <p className="text-xs text-muted-foreground">{technician.email}</p>}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {(technician.skillTags as string[]).map(s => (
                      <span key={s} className="text-xs bg-blue-100 text-blue-700 rounded px-1.5 py-0.5 capitalize">{s}</span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-amber-600 font-medium">No technician assigned yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
