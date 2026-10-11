import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { db } from '@/server/db/client';
import { users } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import SMSConsentPanel from './SMSConsentPanel';

export const metadata: Metadata = { title: 'My Profile' };

export default async function ClientProfilePage() {
  const user = await requireUser();

  const userRow = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: {
      fullName: true,
      email: true,
      phone: true,
      smsConsentGiven: true,
      smsConsentGivenAt: true,
      smsPhone: true,
      smsConsentRevokedAt: true,
    },
  });

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your account preferences and notification settings.</p>
      </div>

      {/* Account info */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h2 className="text-base font-semibold text-slate-800">Account Information</h2>
        <div className="grid gap-3">
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-sm text-slate-500">Name</span>
            <span className="text-sm font-medium text-slate-900">{userRow?.fullName || user.fullName}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-sm text-slate-500">Email</span>
            <span className="text-sm font-medium text-slate-900">{user.email}</span>
          </div>
          {userRow?.phone && (
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-500">Phone</span>
              <span className="text-sm font-medium text-slate-900">{userRow.phone}</span>
            </div>
          )}
        </div>
      </section>

      {/* SMS consent panel — client component handles opt-in / revoke */}
      <SMSConsentPanel
        smsConsentGiven={userRow?.smsConsentGiven ?? false}
        smsPhone={userRow?.smsPhone ?? null}
        smsConsentGivenAt={userRow?.smsConsentGivenAt?.toISOString() ?? null}
        smsConsentRevokedAt={userRow?.smsConsentRevokedAt?.toISOString() ?? null}
        defaultPhone={userRow?.phone ?? undefined}
      />
    </div>
  );
}
