'use client';

import { useState } from 'react';
import { MessageSquare, CheckCircle2, XCircle } from 'lucide-react';
import { SMS_PROGRAM_SUMMARY } from '@/lib/smsProgram';

interface SMSConsentPanelProps {
  smsConsentGiven: boolean;
  smsPhone: string | null;
  smsConsentGivenAt: string | null;
  smsConsentRevokedAt: string | null;
  defaultPhone?: string;
}

function fmt(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles',
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

export default function SMSConsentPanel({
  smsConsentGiven: initialConsent,
  smsPhone: initialPhone,
  smsConsentGivenAt,
  smsConsentRevokedAt,
  defaultPhone = '',
}: SMSConsentPanelProps) {
  const [consentGiven, setConsentGiven] = useState(initialConsent);
  const [smsPhone, setSmsPhone] = useState(initialPhone);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [revokedAt, setRevokedAt] = useState(smsConsentRevokedAt);
  const [givenAt, setGivenAt] = useState(smsConsentGivenAt);

  // Opt-in form state (shown when not consented)
  const [showOptIn, setShowOptIn] = useState(false);
  const [phone, setPhone] = useState(defaultPhone);
  const [checked, setChecked] = useState(false);

  async function handleRevoke() {
    if (!confirm('Are you sure you want to stop receiving SMS notifications from Precision Lift Co.? You can opt back in at any time.')) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/user/sms-consent', { method: 'DELETE' });
      if (!res.ok) throw new Error('Request failed');
      setConsentGiven(false);
      setRevokedAt(new Date().toISOString());
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleOptIn(e: React.FormEvent) {
    e.preventDefault();
    if (!checked) { setError('Please check the consent box to continue.'); return; }
    const digits = phone.replace(/\D/g, '');
    if (!digits.match(/^\d{10}$/)) { setError('Please enter a valid 10-digit US mobile number.'); return; }

    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/user/sms-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: digits }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Request failed');
      }
      setConsentGiven(true);
      setSmsPhone(`+1${digits}`);
      setGivenAt(new Date().toISOString());
      setRevokedAt(null);
      setShowOptIn(false);
      setChecked(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
          <MessageSquare className="h-4.5 w-4.5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-800">SMS Notifications</h2>
          <p className="text-xs text-slate-500">Optional text alerts from Precision Lift Co. — everything also comes by email.</p>
        </div>
      </div>

      {consentGiven ? (
        /* === OPTED IN STATE === */
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            <div className="text-sm">
              <span className="font-medium">SMS opt-in active</span>
              {smsPhone && <span className="text-green-600 ml-2">({smsPhone})</span>}
              {givenAt && <span className="text-green-600 ml-1">· opted in {fmt(givenAt)}</span>}
            </div>
          </div>

          <p className="text-sm text-slate-600">
            You&apos;re receiving transactional SMS messages when work is scheduled on your account.
            Message and data rates may apply. Reply <strong>STOP</strong> to any message to opt out, or
            use the button below.
          </p>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={handleRevoke}
            disabled={loading}
            className="text-sm text-red-600 hover:text-red-700 border border-red-200 hover:bg-red-50 px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
          >
            {loading ? 'Revoking…' : 'Revoke SMS consent'}
          </button>
        </div>
      ) : (
        /* === NOT OPTED IN STATE === */
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
            <XCircle className="h-4 w-4 flex-shrink-0 text-slate-400" />
            <div className="text-sm">
              <span className="font-medium text-slate-700">SMS notifications off</span>
              {revokedAt && <span className="text-slate-500 ml-2">· revoked {fmt(revokedAt)}</span>}
            </div>
          </div>

          <p className="text-sm text-slate-600">
            You are not enrolled in SMS notifications. Opting in is optional: you&apos;ll get a confirmation
            text, then only the alerts for your role ({SMS_PROGRAM_SUMMARY}).
          </p>

          {!showOptIn ? (
            <button
              onClick={() => setShowOptIn(true)}
              className="text-sm text-blue-600 hover:text-blue-700 border border-blue-200 hover:bg-blue-50 px-4 py-2 rounded-lg transition-colors"
            >
              Opt in to SMS notifications
            </button>
          ) : (
            <form onSubmit={handleOptIn} className="space-y-4 border border-slate-200 rounded-lg p-4 bg-slate-50">
              <div>
                <label htmlFor="profile-phone" className="block text-sm font-medium text-slate-700 mb-1">
                  Mobile phone number <span className="text-red-500">*</span>
                </label>
                <input
                  id="profile-phone"
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="(555) 000-0000"
                  required
                  autoFocus
                  className="w-full max-w-xs border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              {/* Consent checkbox — NOT pre-checked (CTIA requirement) */}
              <div className="flex gap-3 items-start">
                <input
                  id="profile-consent"
                  type="checkbox"
                  checked={checked}
                  onChange={e => setChecked(e.target.checked)}
                  required
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                />
                <label htmlFor="profile-consent" className="text-xs text-slate-600 cursor-pointer leading-relaxed">
                  By checking this box, I consent to receive recurring automated transactional SMS
                  messages from <strong>Precision Lift Co.</strong> (via Elev8 Comply) at the number
                  above. <strong>Msg &amp; data rates may apply. Frequency varies.</strong> Reply{' '}
                  <strong>STOP</strong> to opt out · <strong>HELP</strong> for help. See our{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Privacy Policy</a>{' '}
                  and{' '}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Terms</a>.{' '}
                  Opt-in data is never shared with third parties for marketing.
                </label>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  {loading ? 'Saving…' : 'Opt in'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowOptIn(false); setError(''); }}
                  className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2 rounded-lg border border-slate-200 hover:bg-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
