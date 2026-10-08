import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_NAME, COMPANY_NAME, COMPANY_PHONE, COMPANY_ADDRESS, COMPANY_CITY, COMPANY_STATE, COMPANY_ZIP } from '@/lib/constants';
import ScrollEnabler from './ScrollEnabler';

export const metadata: Metadata = {
  title: `Privacy Policy | ${APP_NAME}`,
  description: 'Privacy Policy and SMS Messaging Terms for Elev8 Comply',
};

const EFFECTIVE_DATE = 'October 1, 2026';
const CONTACT_EMAIL = 'info@precisionliftco.com';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <ScrollEnabler />
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/login" className="inline-flex items-center gap-2 text-slate-800 hover:text-slate-600">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7M3 7l9-4 9 4M3 7h18" />
              </svg>
            </div>
            <span className="font-bold text-slate-800">{APP_NAME}</span>
          </Link>
          <Link href="/login" className="text-sm text-blue-600 hover:underline">← Back to Login</Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-slate-500 mb-8">Effective Date: {EFFECTIVE_DATE}</p>

        <div className="prose prose-slate max-w-none space-y-8 text-slate-700 text-[15px] leading-relaxed">

          <section>
            <p>
              This Privacy Policy describes how {COMPANY_NAME} (&ldquo;Company,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;)
              collects, uses, and protects information in connection with the {APP_NAME} platform (&ldquo;Platform&rdquo;). By
              accessing or using the Platform, you agree to the practices described in this Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">1. Information We Collect</h2>
            <p className="mb-3">We collect the following categories of information:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Account Information:</strong> Name, email address, job title, and role when you register or are invited to the Platform.</li>
              <li><strong>Business Contact Information:</strong> Property manager names, phone numbers, and email addresses provided in connection with elevator compliance jobs.</li>
              <li><strong>Job and Compliance Data:</strong> Cal/OSHA notice details, property addresses, elevator identification numbers, repair proposals, work orders, and related compliance documents.</li>
              <li><strong>Usage Data:</strong> Log data, IP addresses, browser type, and pages visited, collected automatically when you use the Platform.</li>
              <li><strong>Communications:</strong> Records of SMS messages sent through the Platform and email correspondence processed through the intake system.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">2. How We Use Your Information</h2>
            <p className="mb-3">We use collected information to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Manage elevator compliance jobs and track Cal/OSHA regulatory deadlines.</li>
              <li>Send advance notice SMS messages to property managers prior to scheduled elevator repair or inspection visits, as required by California law.</li>
              <li>Generate and deliver repair proposals and compliance documents.</li>
              <li>Provide access to the client portal for property managers to review job status and approve proposals.</li>
              <li>Operate, maintain, and improve the Platform.</li>
              <li>Comply with applicable laws and regulations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4 border-l-4 border-blue-600 pl-3">
              3. SMS Messaging &amp; Consent
            </h2>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-4">
              <p className="font-semibold text-blue-900 mb-2">Important Notice Regarding SMS Messages</p>
              <p className="text-blue-800">
                <strong>Mobile opt-in information and SMS messaging consent are not shared with third parties
                or affiliates for marketing or promotional purposes.</strong> Phone numbers collected through
                this Platform are used solely to send regulatory advance-notice SMS messages required under
                California elevator safety law.
              </p>
            </div>

            <h3 className="text-base font-semibold text-slate-900 mb-2">How Consent Is Obtained</h3>
            <p className="mb-4">
              Property managers and authorized building contacts provide their phone numbers directly to
              {COMPANY_NAME} staff as part of establishing a service relationship for elevator compliance work.
              By providing a phone number in connection with elevator compliance services, recipients consent
              to receive automated SMS advance-notice messages from {COMPANY_NAME} related to scheduled
              elevator repair or inspection visits at their property.
            </p>

            <h3 className="text-base font-semibold text-slate-900 mb-2">Message Frequency</h3>
            <p className="mb-4">
              Message frequency varies based on the number of elevator compliance jobs active at your
              property. Recipients typically receive one (1) SMS message per scheduled visit, sent
              approximately 48 hours before the scheduled date, as required by California law.
            </p>

            <h3 className="text-base font-semibold text-slate-900 mb-2">Message Content</h3>
            <p className="mb-4">
              SMS messages sent through this Platform are limited to operational advance notices containing:
              the scheduled visit date and time window, a description of the work to be performed, the
              name of the contractor, and contact information. No marketing or promotional messages are
              sent through this system.
            </p>

            <h3 className="text-base font-semibold text-slate-900 mb-2">Opt-Out</h3>
            <p className="mb-4">
              To opt out of SMS advance notices, reply <strong>STOP</strong> to any message you receive,
              or contact us directly at{' '}
              <a href={`tel:${COMPANY_PHONE.replace(/\D/g, '')}`} className="text-blue-600 hover:underline">
                {COMPANY_PHONE}
              </a>
              {' '}or{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 hover:underline">{CONTACT_EMAIL}</a>.
              After opting out, you will receive one confirmation message and no further SMS messages will be
              sent to that number. Note that opting out of SMS may mean you do not receive legally required
              advance notice of scheduled visits; {COMPANY_NAME} will use alternative contact methods in
              that case.
            </p>

            <h3 className="text-base font-semibold text-slate-900 mb-2">Help</h3>
            <p className="mb-4">
              Reply <strong>HELP</strong> to any SMS message for contact information. Standard message and
              data rates may apply. Contact your wireless carrier for details.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">4. Information Sharing</h2>
            <p className="mb-3">
              We do not sell or rent your personal information. We do not share mobile phone numbers or
              SMS consent data with third parties or affiliates for marketing or promotional purposes.
            </p>
            <p className="mb-3">We may share information with:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Service Providers:</strong> Third-party vendors that help us operate the Platform, including cloud hosting (Vercel), database services (Supabase), SMS delivery (Twilio), and email delivery (Resend). These providers are contractually prohibited from using your data for their own purposes.</li>
              <li><strong>Legal Requirements:</strong> When required by law, court order, or to protect the rights and safety of our users or the public.</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets, with notice provided to affected users.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">5. Data Security</h2>
            <p>
              We implement industry-standard technical and organizational measures to protect your information,
              including encrypted data transmission (TLS), access controls by user role, and regular security
              reviews. No method of transmission over the internet is 100% secure; we cannot guarantee
              absolute security but will promptly notify affected users of any confirmed breach.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">6. Data Retention</h2>
            <p>
              We retain job records, compliance documents, and associated contact information for a minimum
              of five (5) years to meet Cal/OSHA recordkeeping requirements. Account data for former users
              is retained for one (1) year following account deactivation and then deleted unless retention
              is required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">7. California Privacy Rights</h2>
            <p className="mb-3">
              California residents may have additional rights under the California Consumer Privacy Act
              (CCPA), including the right to know what personal information is collected, the right to
              request deletion, and the right to opt out of the sale of personal information. We do not
              sell personal information.
            </p>
            <p>
              To exercise your rights or submit a privacy request, contact us using the information in
              Section 9 below.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">8. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will post the revised policy on this
              page with an updated Effective Date. Material changes will be communicated to registered users
              by email at least 14 days before taking effect.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">9. Contact Us</h2>
            <p className="mb-2">For questions about this Privacy Policy or to submit a privacy request:</p>
            <address className="not-italic bg-slate-100 rounded-lg p-4 text-sm">
              <strong>{COMPANY_NAME}</strong><br />
              {COMPANY_ADDRESS}<br />
              {COMPANY_CITY}, {COMPANY_STATE} {COMPANY_ZIP}<br />
              Phone: <a href={`tel:${COMPANY_PHONE.replace(/\D/g, '')}`} className="text-blue-600 hover:underline">{COMPANY_PHONE}</a><br />
              Email: <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 hover:underline">{CONTACT_EMAIL}</a>
            </address>
          </section>

        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-3xl mx-auto px-6 py-4 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} {COMPANY_NAME}. All rights reserved.{' '}
          <Link href="/login" className="hover:underline">Sign In</Link>
        </div>
      </footer>
    </div>
  );
}
