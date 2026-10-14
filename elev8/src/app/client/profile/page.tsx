import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { db } from '@/server/db/client';
import { users } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import SMSConsentPanel from '@/components/account/SMSConsentPanel';
import ProfileForm from '@/components/account/ProfileForm';
import PasswordForm from '@/components/account/PasswordForm';

export const metadata: Metadata = { title: 'My Profile' };

export default async function ClientProfilePage() {
  const user = await requireUser();

  // Base row — columns that always exist (no migration dependency)
  const baseRow = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { fullName: true, email: true, phone: true },
  });

  // SMS consent columns require migration 05 (05_sms_consent.sql).
  // Default to safe values so the profile page renders even if migration is pending.
  let smsConsentGiven = false;
  let smsConsentGivenAt: Date | null = null;
  let smsPhone: string | null = null;
  let smsConsentRevokedAt: Date | null = null;
  try {
    const smsRow = await db.query.users.findFirst({
      where: eq(users.id, user.id),
      columns: {
        smsConsentGiven: true,
        smsConsentGivenAt: true,
        smsPhone: true,
        smsConsentRevokedAt: true,
      },
    });
    if (smsRow) {
      smsConsentGiven = smsRow.smsConsentGiven;
      smsConsentGivenAt = smsRow.smsConsentGivenAt;
      smsPhone = smsRow.smsPhone;
      smsConsentRevokedAt = smsRow.smsConsentRevokedAt;
    }
  } catch {
    // Migration 05 not yet applied — SMS panel renders with empty defaults
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your account preferences and notification settings.</p>
      </div>

      {/* Account info */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h2 className="text-base font-semibold text-slate-800">Account Information</h2>
        <ProfileForm
          fullName={baseRow?.fullName || user.fullName}
          email={baseRow?.email ?? user.email}
          phone={baseRow?.phone ?? null}
        />
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Password</h2>
          <p className="text-sm text-slate-500 mt-1">Choose a new password of at least 8 characters.</p>
        </div>
        <PasswordForm />
      </section>

      {/* SMS consent panel — client component handles opt-in / revoke */}
      <SMSConsentPanel
        smsConsentGiven={smsConsentGiven}
        smsPhone={smsPhone}
        smsConsentGivenAt={smsConsentGivenAt?.toISOString() ?? null}
        smsConsentRevokedAt={smsConsentRevokedAt?.toISOString() ?? null}
        defaultPhone={baseRow?.phone ?? undefined}
      />
    </div>
  );
}
