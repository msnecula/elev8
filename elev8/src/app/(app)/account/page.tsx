import type { Metadata } from 'next';
import { eq } from 'drizzle-orm';
import { requireUser } from '@/lib/auth';
import { db } from '@/server/db/client';
import { technicians, users } from '@/drizzle/schema';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ROLE_LABELS } from '@/lib/constants';
import ProfileForm from '@/components/account/ProfileForm';
import PasswordForm from '@/components/account/PasswordForm';
import LicensesForm from '@/components/account/LicensesForm';
import SMSConsentPanel from '@/components/account/SMSConsentPanel';

export const metadata: Metadata = { title: 'My Account' };

export default async function AccountPage() {
  const user = await requireUser();

  const [row, tech] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, user.id),
      columns: {
        fullName: true, email: true, phone: true,
        smsConsentGiven: true, smsConsentGivenAt: true, smsPhone: true, smsConsentRevokedAt: true,
      },
    }),
    user.role === 'technician'
      ? db.query.technicians.findFirst({
          where: eq(technicians.userId, user.id),
          columns: { cccmLicense: true, qeiNumber: true },
        })
      : undefined,
  ]);

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="My Account" description="Your profile, password and notification settings.">
        <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            fullName={row?.fullName ?? user.fullName}
            email={row?.email ?? user.email}
            phone={row?.phone ?? null}
          />
        </CardContent>
      </Card>

      {user.role === 'technician' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">License Numbers</CardTitle>
            <CardDescription>
              These fill in automatically on Cal/OSHA forms (EU-632, DOSH-100, EU-630) for jobs you&apos;re assigned to.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LicensesForm cccmLicense={tech?.cccmLicense ?? null} qeiNumber={tech?.qeiNumber ?? null} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Password</CardTitle>
          <CardDescription>Choose a new password of at least 8 characters.</CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>

      <SMSConsentPanel
        smsConsentGiven={row?.smsConsentGiven ?? false}
        smsPhone={row?.smsPhone ?? null}
        smsConsentGivenAt={row?.smsConsentGivenAt?.toISOString() ?? null}
        smsConsentRevokedAt={row?.smsConsentRevokedAt?.toISOString() ?? null}
        defaultPhone={row?.phone ?? undefined}
      />
    </div>
  );
}
