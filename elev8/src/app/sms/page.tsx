import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SMS Notifications | Elev8 Comply',
};

export default function SmsOptInPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center gap-3">
          <span className="text-xl font-bold text-blue-700">Elev8 Comply</span>
          <span className="text-gray-300">|</span>
          <span className="text-sm text-gray-500">by Precision Lift Co.</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">SMS Notification Program</h1>
        <p className="text-gray-500 mb-10 text-sm">Precision Lift Co. — California Elevator Compliance Services</p>

        {/* What is it */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">About SMS Notifications</h2>
          <p className="text-gray-700 leading-relaxed">
            Precision Lift Co. sends transactional SMS notifications to property managers and building contacts
            who have an active elevator compliance service relationship with us. Messages are sent through the
            Elev8 Comply platform and are directly related to your scheduled work.
          </p>
        </section>

        {/* How enrollment works */}
        <section className="mb-10 border border-gray-200 rounded-xl p-6 bg-gray-50">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">How Enrollment Works</h2>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center">1</div>
              <div>
                <p className="font-medium text-gray-900">Service agreement</p>
                <p className="text-sm text-gray-600 mt-0.5">When you begin a service relationship with Precision Lift Co., your contact information — including your mobile phone number — is collected as part of the service onboarding process.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center">2</div>
              <div>
                <p className="font-medium text-gray-900">Consent to receive messages</p>
                <p className="text-sm text-gray-600 mt-0.5">By providing your mobile number to Precision Lift Co. for service coordination, you consent to receive transactional SMS messages related to your elevator compliance jobs. You are informed of this at the time your number is collected.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center">3</div>
              <div>
                <p className="font-medium text-gray-900">Messages begin when work is scheduled</p>
                <p className="text-sm text-gray-600 mt-0.5">SMS messages are sent only when there is active work on your account — scheduling confirmations, 48-hour advance notices, and work order updates.</p>
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
              Reply <strong>STOP</strong> to any message at any time to stop receiving SMS from Precision Lift Co.
              You'll receive one final confirmation, then no further messages will be sent to that number.
            </p>
          </div>
          <div className="border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-2">Message &amp; data rates</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              <strong>Message and data rates may apply.</strong> Message frequency varies based on your active
              service engagements. For help, reply <strong>HELP</strong> to any message.
            </p>
          </div>
        </section>

        {/* Privacy */}
        <section className="mb-10 bg-blue-50 border border-blue-100 rounded-xl p-5">
          <h3 className="font-semibold text-gray-900 mb-2">Your privacy</h3>
          <p className="text-sm text-gray-700 leading-relaxed">
            We do not sell or share your SMS opt-in data or personal information with third parties for marketing purposes.
            All messages are transactional and directly related to your elevator compliance services.
            See our full <a href="/privacy" className="text-blue-600 underline">Privacy Policy</a> and{' '}
            <a href="/terms" className="text-blue-600 underline">Terms of Service</a> for details.
          </p>
        </section>

        {/* Contact */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Questions?</h2>
          <p className="text-gray-600 text-sm">
            Contact your assigned Precision Lift Co. service representative or reach out through your
            Elev8 Comply account.
          </p>
        </section>
      </main>

      <footer className="border-t border-gray-200 mt-12">
        <div className="max-w-3xl mx-auto px-6 py-6 text-sm text-gray-400">
          © {new Date().getFullYear()} Precision Lift Co. All rights reserved. ·{' '}
          <a href="/privacy" className="hover:text-gray-600">Privacy Policy</a> ·{' '}
          <a href="/terms" className="hover:text-gray-600">Terms of Service</a>
        </div>
      </footer>
    </div>
  );
}
