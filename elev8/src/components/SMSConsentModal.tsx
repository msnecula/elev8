'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, X } from 'lucide-react';
import { SMS_PROGRAM_SUMMARY } from '@/lib/smsProgram';

const SESSION_DISMISSED_KEY = 'sms_consent_dismissed';

interface SMSConsentModalProps {
  /** Pre-fill from user profile if available */
  defaultPhone?: string;
  /** Called after successful opt-in so the parent can hide the modal */
  onConsented: () => void;
  /** Called after the user chooses "No thanks", so the parent stops asking */
  onDeclined: () => void;
}

export default function SMSConsentModal({ defaultPhone = '', onConsented, onDeclined }: SMSConsentModalProps) {
  const [visible, setVisible] = useState(false);
  const [phone, setPhone] = useState(defaultPhone);
  const [consented, setConsented] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Delay showing the modal by 800ms so the page has time to paint first.
  // Also check sessionStorage — if the user already dismissed this session,
  // don't show it again until they sign out and back in.
  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(SESSION_DISMISSED_KEY) === '1';
    } catch { /* ignore — storage may be blocked */ }

    if (dismissed) return;

    const t = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(t);
  }, []);

  function handleDismiss() {
    try {
      sessionStorage.setItem(SESSION_DISMISSED_KEY, '1');
    } catch { /* ignore */ }
    setVisible(false);
  }

  // Declining is a first-class answer (A2P 10DLC): it's recorded so we stop asking.
  async function handleDecline() {
    setVisible(false);
    try {
      await fetch('/api/user/sms-consent', { method: 'DELETE' });
    } catch { /* not critical — worst case we ask again next session */ }
    onDeclined();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!consented) {
      setError('Please check the consent box to continue.');
      return;
    }
    const digits = phone.replace(/\D/g, '');
    if (!digits.match(/^\d{10}$/)) {
      setError('Please enter a valid 10-digit US mobile number.');
      return;
    }

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
        setError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      onConsented();
      setVisible(false);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!visible) return null;

  return (
    /* Full-screen overlay */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sms-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleDismiss}
        aria-hidden="true"
      />

      {/* Card */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 sm:p-8">
        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Remind me later"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Icon + heading */}
        <div className="flex items-start gap-4 mb-5">
          <div className="flex-shrink-0 h-11 w-11 rounded-xl bg-blue-100 flex items-center justify-center">
            <MessageSquare className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 id="sms-modal-title" className="text-lg font-bold text-slate-900 leading-snug">
              Stay ahead of your inspections
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Optional: get a text about your account. You can skip this — everything also comes by email.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Phone */}
          <div>
            <label htmlFor="modal-phone" className="block text-sm font-medium text-slate-700 mb-1">
              Mobile phone number <span className="text-slate-400 font-normal">(only if you opt in)</span>
            </label>
            <input
              id="modal-phone"
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="(555) 000-0000"
              required
              autoFocus
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Consent checkbox — NOT pre-checked (CTIA requirement) */}
          <div className="flex gap-3 items-start">
            <input
              id="modal-consent"
              type="checkbox"
              checked={consented}
              onChange={e => setConsented(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0"
            />
            <label htmlFor="modal-consent" className="text-xs text-slate-600 cursor-pointer leading-relaxed">
              By checking this box, I consent to receive recurring automated transactional SMS
              messages from <strong>Precision Lift Co.</strong> (via Elev8 Comply) at the number
              above: {SMS_PROGRAM_SUMMARY}. <strong>Msg &amp; data rates may apply. Frequency varies.</strong> Reply{' '}
              <strong>STOP</strong> to opt out · <strong>HELP</strong> for assistance. See our{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-700">
                Privacy Policy
              </a>{' '}
              and{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-700">
                Terms
              </a>
              . Opt-in data is never shared with third parties for marketing.
            </label>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
            >
              {loading ? 'Saving…' : 'Opt in to SMS'}
            </button>
            <button
              type="button"
              onClick={handleDecline}
              className="flex-1 sm:flex-none text-sm text-slate-600 hover:text-slate-800 px-4 py-2.5 rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors"
            >
              No thanks
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="flex-1 sm:flex-none text-sm text-slate-500 hover:text-slate-700 px-4 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              Remind me later
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
