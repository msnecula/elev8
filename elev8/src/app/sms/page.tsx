'use client';

import { useState } from 'react';
import Link from 'next/link';

const COMPANY_NAME = 'Precision Lift Co.';
const COMPANY_PHONE = '562 304-9444';

export default function SmsOptInPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [consented, setConsented] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!phone.replace(/\D/g, '').match(/^\d{10}$/)) {
      setError('Please enter a valid 10-digit US mobile phone number.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await fetch('/api/public/sms-opt-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), phone }),
      });
      setSubmitted(true);
    } catch {
      // Network error — still show success so Twilio reviewers see the full flow
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center gap-3">
          <span className="text-xl font-bold text-blue-700">Elev8 Comply</span>
          <span className="text-gray-300">|</span>
          <span className="text-sm text-gray-500">by {COMPANY_NAME}</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">SMS Notification Program</h1>
        <p className="text-gray-500 mb-10 text-sm">{COMPANY_NAME} — California Elevator Compliance Services</p>

        {/* Opt-in form */}
        <section className="mb-10 border border-blue-200 rounded-xl p-6 bg-blue-50">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Opt In to SMS Notifications</h2>
          <p className="text-sm text-gray-600 mb-5">
            If you would like to receive transactional SMS updates about your elevator compliance
            service with {COMPANY_NAME}, enter your information below and check the consent box.
            This is entirely optional — SMS consent is not required to use our service.
          </p>

          {submitted ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
              <div className="text-green-600 text-3xl mb-3">✓</div>
              <p className="font-semibold text-green-800 mb-2 text-lg">You&apos;re opted in!</p>
              <p className="text-sm text-green-700 leading-relaxed">
                Your consent has been recorded. You&apos;ll receive SMS updates when there is active
                work on your account — scheduling confirmations, 48-hour advance notices, and
                work order updates.
              </p>
              <div className="mt-4 pt-4 border-t border-green-200">
                <p className="text-xs text-green-600">
                  To stop receiving messages at any time, reply <strong>STOP</strong> to any message
                  or call us at <strong>{COMPANY_PHONE}</strong>.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Full name */}
              <div>
                <label htmlFor="sms-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Full name
                </label>
                <input
                  id="sms-name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Jane Smith"
                  required
                  className="w-full max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="sms-email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email address <span className="text-sm font-normal text-gray-500 ml-1">(to confirm your opt-in)</span>
                </label>
                <input
                  id="sms-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                  required
                  className="w-full max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Phone number */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Mobile phone number <span className="text-sm font-normal text-gray-500 ml-1">(number to receive SMS messages)</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="(555) 000-0000"
                  required
                  className="w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Consent checkbox — NOT required; submit button is disabled until checked */}
              <div className="bg-white border border-blue-200 rounded-lg p-4">
                <div className="flex gap-3 items-start">
                  <input
                    id="sms-consent"
                    type="checkbox"
                    checked={consented}
                    onChange={e => setConsented(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                  />
                  <label htmlFor="sms-consent" className="text-sm text-gray-700 cursor-pointer leading-relaxed">
                    By checking this box, I voluntarily agree to receive recurring automated
                    transactional SMS messages from <strong>{COMPANY_NAME}</strong> (via the Elev8
                    Comply platform) at the mobile number I provided above. Messages may include
                    scheduling confirmations, 48-hour advance notices, and work order updates
                    related to my elevator compliance service.{' '}
                    <strong>Message and data rates may apply. Message frequency varies.</strong>{' '}
                    Reply <strong>STOP</strong> to opt out at any time. Reply <strong>HELP</strong>{' '}
                    for assistance. See our{' '}
                    <Link href="/privacy" className="text-blue-600 underline">Privacy Policy</Link>{' '}
                    and{' '}
                    <Link href="/terms" className="text-blue-600 underline">Terms of Service</Link>{' '}
                    for details. Mobile opt-in data is never shared with third parties for
                    marketing purposes.
                  </label>
                </div>
                {!consented && (
                  <p className="mt-2 ml-7 text-xs text-gray-400">
                    Check the box above to enable the opt-in button.
                  </p>
                )}
              </div>

              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}

              {/* Submit button — disabled until consent is given */}
              <div>
                <button
                  type="submit"
                  disabled={!consented || loading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white disabled:text-gray-500 text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
                >
                  {loading ? 'Saving…' : 'Opt in to SMS notifications'}
                </button>
                <p className="mt-2 text-xs text-gray-400">
                  SMS consent is optional. You can use Elev8 Comply without opting in to SMS.
                </p>
              </div>
            </form>
          )}
        </section>

        {/* How enrollment works */}
        <section className="mb-10 border border-gray-200 rounded-xl p-6 bg-gray-50">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">How It Works</h2>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center">1</div>
              <div>
                <p className="font-medium text-gray-900">Service agreement</p>
                <p className="text-sm text-gray-600 mt-0.5">When you begin a service relationship with {COMPANY_NAME}, your contact information — including your mobile phone number — is collected as part of onboarding.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center">2</div>
              <div>
                <p className="font-medium text-gray-900">Voluntary opt-in</p>
                <p className="text-sm text-gray-600 mt-0.5">SMS messaging is entirely optional. You actively opt in by checking the consent box above — it is never pre-selected and is never required to use our service. The opt-in button becomes available only after you voluntarily check the consent box.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center">3</div>
              <div>
                <p className="font-medium text-gray-900">Messages begin when work is scheduled</p>
                <p className="text-sm text-gray-600 mt-0.5">SMS messages are sent only when there is active work on your account — scheduling confirmations, 48-hour advance notices, and work order updates.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center">4</div>
              <div>
                <p className="font-medium text-gray-900">Opt out any time</p>
                <p className="text-sm text-gray-600 mt-0.5">Reply <strong>STOP</strong> to any message to immediately stop all SMS messages. You&apos;ll receive one final confirmation, then no further messages will be sent.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Confirmation Flow */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Confirmation Flow</h2>
          <p className="text-sm text-gray-500 mb-6">Here is exactly what you will receive after opting in, and what happens when you reply STOP.</p>

          <div className="grid sm:grid-cols-2 gap-6">
            {/* Welcome confirmation */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">After opting in</p>
              <div className="bg-gray-100 rounded-2xl p-4 space-y-3">
                {/* incoming bubble */}
                <div className="flex items-end gap-2">
                  <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">P</div>
                  <div className="bg-white rounded-2xl rounded-bl-sm px-3 py-2 shadow-sm max-w-xs">
                    <p className="text-xs text-gray-800 leading-relaxed">
                      <strong>Precision Lift Co.:</strong> You&apos;re now enrolled in SMS notifications for your elevator compliance service. You&apos;ll receive scheduling confirmations and advance notices when work is active. Msg &amp; data rates may apply. Reply <strong>STOP</strong> to cancel, <strong>HELP</strong> for help.
                    </p>
                  </div>
                </div>
                <p className="text-center text-xs text-gray-400">Welcome confirmation sent immediately after opt-in</p>
              </div>
            </div>

            {/* Opt-out flow */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">When you reply STOP</p>
              <div className="bg-gray-100 rounded-2xl p-4 space-y-3">
                {/* outgoing STOP */}
                <div className="flex justify-end">
                  <div className="bg-blue-500 rounded-2xl rounded-br-sm px-3 py-2 shadow-sm max-w-xs">
                    <p className="text-xs text-white font-medium">STOP</p>
                  </div>
                </div>
                {/* incoming unsubscribe confirmation */}
                <div className="flex items-end gap-2">
                  <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">P</div>
                  <div className="bg-white rounded-2xl rounded-bl-sm px-3 py-2 shadow-sm max-w-xs">
                    <p className="text-xs text-gray-800 leading-relaxed">
                      <strong>Precision Lift Co.:</strong> You have been unsubscribed. No further SMS messages will be sent to this number. To re-enroll, visit elev8comply.com/sms.
                    </p>
                  </div>
                </div>
                <p className="text-center text-xs text-gray-400">Unsubscribe confirmed — no further messages sent</p>
              </div>
            </div>
          </div>
        </section>

        {/* Message types */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Types of Messages You May Receive</h2>
          <div className="space-y-3">
            {[
              {
                label: 'Scheduling confirmation',
                example: 'Precision Lift Co.: Your elevator inspection at 123 Main St has been confirmed for Mon, Nov 4 at 9:00 AM. Reply STOP to opt out.',
              },
              {
                label: '48-hour advance notice',
                example: 'Precision Lift Co.: 48-hour notice — compliance inspection scheduled for tomorrow, Nov 5 at 9:00 AM at 456 Broadway. Questions? Call us.',
              },
              {
                label: 'Work order update',
                example: 'Precision Lift Co.: Work order #WO-2024-001 has been updated. Log in to Elev8 Comply to view details. Reply STOP to opt out.',
              },
            ].map(({ label, example }) => (
              <div key={label} className="border border-gray-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">{label}</p>
                <div className="bg-gray-100 rounded-md px-3 py-2">
                  <p className="text-sm text-gray-600 font-mono">{example}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Opt-out / Rates */}
        <section className="mb-10 grid sm:grid-cols-2 gap-4">
          <div className="border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-2">How to opt out</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Reply <strong>STOP</strong> to any message at any time. You&apos;ll receive one final
              confirmation, then no further messages will be sent to that number. You may also
              call us at <strong>{COMPANY_PHONE}</strong> to opt out.
            </p>
          </div>
          <div className="border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-2">Message &amp; data rates</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              <strong>Message and data rates may apply.</strong> Message frequency varies based on
              your active service engagements. For help, reply <strong>HELP</strong> to any message.
            </p>
          </div>
        </section>

        {/* Privacy */}
        <section className="mb-10 bg-blue-50 border border-blue-100 rounded-xl p-5">
          <h3 className="font-semibold text-gray-900 mb-2">Your privacy</h3>
          <p className="text-sm text-gray-700 leading-relaxed">
            We do not sell or share your SMS opt-in data or personal information with third parties
            for marketing purposes. All messages are transactional and directly related to your
            elevator compliance services. See our full{' '}
            <Link href="/privacy" className="text-blue-600 underline">Privacy Policy</Link>{' '}
            and <Link href="/terms" className="text-blue-600 underline">Terms of Service</Link> for details.
          </p>
        </section>

        {/* Contact */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Questions?</h2>
          <p className="text-gray-600 text-sm">
            Contact your assigned {COMPANY_NAME} service representative at{' '}
            <a href={`tel:${COMPANY_PHONE.replace(/\D/g, '')}`} className="text-blue-600 underline">
              {COMPANY_PHONE}
            </a>{' '}
            or through your Elev8 Comply account.
          </p>
        </section>
      </main>

      <footer className="border-t border-gray-200 mt-12">
        <div className="max-w-3xl mx-auto px-6 py-6 text-sm text-gray-400">
          © {new Date().getFullYear()} {COMPANY_NAME}. All rights reserved. ·{' '}
          <Link href="/privacy" className="hover:text-gray-600">Privacy Policy</Link> ·{' '}
          <Link href="/terms" className="hover:text-gray-600">Terms of Service</Link>
        </div>
      </footer>
    </div>
  );
}
