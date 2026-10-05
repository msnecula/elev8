import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | Elev8 Comply',
};

export default function TermsOfServicePage() {
  const lastUpdated = 'October 1, 2024';

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

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: {lastUpdated}</p>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Agreement to Terms</h2>
            <p>
              These Terms of Service ("Terms") govern your use of the Elev8 Comply platform operated by
              Precision Lift Co. ("we," "us," or "our"). By accessing or using Elev8 Comply, you agree to be
              bound by these Terms. If you do not agree, do not use our services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Description of Services</h2>
            <p>
              Elev8 Comply is a compliance management platform that enables Precision Lift Co. to manage California
              elevator compliance notices, proposals, scheduling, dispatch, and work orders for commercial property owners,
              property managers, and related parties. Access is provided as part of an active service relationship with
              Precision Lift Co.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Account Access</h2>
            <p>
              Access to Elev8 Comply is granted by Precision Lift Co. to authorized contacts associated with an active
              service account. You are responsible for maintaining the confidentiality of your login credentials and for
              all activities that occur under your account. Notify us immediately of any unauthorized use.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Acceptable Use</h2>
            <p>You agree to use Elev8 Comply only for lawful purposes and in connection with your elevator compliance
            services. You may not:</p>
            <ul className="list-disc list-inside space-y-2 mt-3">
              <li>Use the platform to transmit unauthorized or unlawful content;</li>
              <li>Attempt to gain unauthorized access to any part of the system;</li>
              <li>Interfere with or disrupt the platform's operation; or</li>
              <li>Use the platform for any purpose unrelated to your elevator compliance services.</li>
            </ul>
          </section>

          {/* ── SMS TERMS SECTION (required by Twilio A2P) ── */}
          <section className="border border-gray-200 rounded-lg p-6 bg-gray-50">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. SMS Terms</h2>
            <p>
              By providing your mobile phone number to Precision Lift Co. and consenting to receive text messages,
              you agree to the following SMS terms:
            </p>

            <h3 className="text-base font-semibold text-gray-900 mt-4 mb-2">Message Types</h3>
            <p>
              Precision Lift Co. will send you transactional SMS messages related to your elevator compliance services,
              including:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-sm">
              <li>Work scheduling confirmations and appointment reminders;</li>
              <li>48-hour advance notices required by California elevator regulations;</li>
              <li>Work order status updates; and</li>
              <li>Other service-related notifications directly related to your active engagements.</li>
            </ul>

            <h3 className="text-base font-semibold text-gray-900 mt-4 mb-2">Message Frequency</h3>
            <p>
              Message frequency varies based on your active service engagements with Precision Lift Co.
              You may receive multiple messages per month during periods of active work.
            </p>

            <h3 className="text-base font-semibold text-gray-900 mt-4 mb-2">Rates</h3>
            <p className="font-medium">
              Message and data rates may apply. Standard carrier rates for SMS and data apply to all messages sent
              and received.
            </p>

            <h3 className="text-base font-semibold text-gray-900 mt-4 mb-2">Opt-Out</h3>
            <p>
              You may opt out of SMS messages at any time by replying <strong>STOP</strong> to any message from
              Precision Lift Co. After opting out, you will receive a single confirmation message and no further
              SMS messages will be sent. Note that opting out of SMS does not affect your service account or
              email communications.
            </p>

            <h3 className="text-base font-semibold text-gray-900 mt-4 mb-2">Help</h3>
            <p>
              For help with SMS messages, reply <strong>HELP</strong> to any message or contact your assigned
              Precision Lift Co. service representative directly.
            </p>

            <h3 className="text-base font-semibold text-gray-900 mt-4 mb-2">Privacy</h3>
            <p>
              We do not sell or share your SMS opt-in data or personal information with third parties for
              marketing purposes. See our{' '}
              <a href="/privacy" className="text-blue-600 underline">Privacy Policy</a> for full details.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Intellectual Property</h2>
            <p>
              The Elev8 Comply platform, including its design, software, and content, is the property of
              Precision Lift Co. and is protected by applicable intellectual property laws. You may not copy,
              modify, distribute, or reverse-engineer any part of the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Compliance Data</h2>
            <p>
              Compliance records, notices, and documentation generated through Elev8 Comply are provided for
              informational purposes to support your elevator compliance obligations. Precision Lift Co. is responsible
              for the accuracy of service records within its scope of work. You remain responsible for ensuring
              compliance with all applicable California elevator regulations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Precision Lift Co. shall not be liable for any indirect,
              incidental, special, consequential, or punitive damages arising from your use of Elev8 Comply.
              Our total liability shall not exceed the amount paid by you for services in the three months
              preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the State of California, without regard to conflict of
              law principles. Any disputes shall be resolved in the courts of California.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Changes to These Terms</h2>
            <p>
              Precision Lift Co. may update these Terms from time to time. Continued use of Elev8 Comply after
              changes are posted constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Contact</h2>
            <p>
              Questions about these Terms? Contact us through your assigned Precision Lift Co. service representative
              or via the Elev8 Comply platform.
            </p>
            <div className="mt-3 p-4 bg-gray-50 rounded-lg text-sm border border-gray-200">
              <p className="font-semibold">Precision Lift Co.</p>
              <p>California, United States</p>
            </div>
          </section>

        </div>
      </main>

      <footer className="border-t border-gray-200 mt-12">
        <div className="max-w-3xl mx-auto px-6 py-6 text-sm text-gray-400">
          © {new Date().getFullYear()} Precision Lift Co. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
