import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { db } from '@/server/db/client';
import { technicians } from '@/drizzle/schema';
import { asc } from 'drizzle-orm';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldCheck } from 'lucide-react';
import TechnicianCccmRow from './TechnicianCccmRow';

export const metadata: Metadata = { title: 'Technician Licenses' };

export default async function TechnicianLicensesPage() {
  await requireRole('admin', 'dispatcher');

  const techs = await db
    .select({
      id: technicians.id,
      fullName: technicians.fullName,
      email: technicians.email,
      cccmLicense: technicians.cccmLicense,
      isActive: technicians.isActive,
    })
    .from(technicians)
    .orderBy(asc(technicians.fullName));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Technician Licenses"
        description="Manage CCCM (Certified Competent Conveyance Mechanic) license numbers for each mechanic. These appear on EU-632 forms."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            CCCM License Numbers
          </CardTitle>
          <CardDescription>
            Each California-licensed elevator mechanic is issued a unique CCCM number by the state.
            Enter each technician&apos;s number here — it will auto-populate on EU-632 forms when that
            technician is assigned to the job.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {techs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No technicians found. Technician profiles are created when a user with the Technician role logs in.
            </p>
          ) : (
            <>
              {/* Header row */}
              <div className="flex items-center gap-4 pb-2 border-b border-border mb-1">
                <p className="flex-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Technician
                </p>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-36 text-right pr-10">
                  CCCM License #
                </p>
              </div>

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
    </div>
  );
}
