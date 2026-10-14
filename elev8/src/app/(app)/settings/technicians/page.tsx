import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import { technicians } from '@/drizzle/schema';
import { asc } from 'drizzle-orm';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldCheck, ClipboardCheck } from 'lucide-react';
import TechnicianCccmRow from './TechnicianCccmRow';
import TechnicianQeiRow from './TechnicianQeiRow';

export const metadata: Metadata = { title: 'Technician Licenses' };

export default async function TechnicianLicensesPage() {
  await requireRole('admin', 'dispatcher');

  const techs = await db
    .select({
      id: technicians.id,
      fullName: technicians.fullName,
      email: technicians.email,
      cccmLicense: technicians.cccmLicense,
      qeiNumber: technicians.qeiNumber,
      isActive: technicians.isActive,
    })
    .from(technicians)
    .orderBy(asc(technicians.fullName));

  const emptyState = (
    <p className="text-sm text-muted-foreground py-4 text-center">
      No technicians found. Technician profiles are created when a user with the Technician role logs in.
    </p>
  );

  const columnHeader = (label: string) => (
    <div className="flex items-center gap-4 pb-2 border-b border-border mb-1">
      <p className="flex-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Technician
      </p>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-36 text-right pr-10">
        {label}
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Technician Licenses"
        description="Manage CCCM license numbers and QEI numbers for each technician. These auto-populate on Cal/OSHA forms when the technician is assigned to a job."
      />

      {/* CCCM Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            CCCM License Numbers
          </CardTitle>
          <CardDescription>
            Each California-licensed elevator mechanic is issued a unique CCCM (Certified Competent
            Conveyance Mechanic) number by the state. These auto-populate on EU-632 forms when the
            technician is assigned to a job.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {techs.length === 0 ? emptyState : (
            <>
              {columnHeader('CCCM License #')}
              {techs.map((tech) => (
                <TechnicianCccmRow
                  key={tech.id}
                  technicianId={tech.id}
                  fullName={tech.fullName}
                  email={tech.email}
                  cccmLicense={tech.cccmLicense}
                  isActive={tech.isActive}
                />
              ))}
            </>
          )}
        </CardContent>
      </Card>

      {/* QEI Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            QEI Numbers
          </CardTitle>
          <CardDescription>
            QEI (Qualified Elevator Inspector) is a national certification under the ASME QEI-1
            standard, issued to individual inspectors by ANAB-accredited organizations such as NAESA
            International — not by the state. Only enter a number for technicians who hold a current
            QEI certification. These auto-populate on DOSH-100, EU-630, and EU-632 forms when the
            technician is assigned to a job.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {techs.length === 0 ? emptyState : (
            <>
              {columnHeader('QEI Number')}
              {techs.map((tech) => (
                <TechnicianQeiRow
                  key={tech.id}
                  technicianId={tech.id}
                  fullName={tech.fullName}
                  email={tech.email}
                  qeiNumber={tech.qeiNumber}
                  isActive={tech.isActive}
                />
              ))}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
