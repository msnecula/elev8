import type { Metadata } from 'next';
import Link from 'next/link';
import {
  APP_NAME,
  APP_URL,
  COMPANY_NAME,
  COMPANY_PHONE,
  COMPANY_ADDRESS,
  COMPANY_CITY,
  COMPANY_STATE,
  COMPANY_ZIP,
} from '@/lib/constants';
import ScrollEnabler from '@/components/ScrollEnabler';

export const metadata: Metadata = {
  title: `Terms of Service | ${APP_NAME}`,
  description: `Terms of Service and SMS Messaging Terms for ${APP_NAME} by ${COMPANY_NAME}`,
};

const EFFECTIVE_DATE = 'October 1, 2026';
const CONTACT_EMAIL = 'info@precisionliftco.com';

export default function TermsPage() {
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
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-slate-500 mb-8">Effective Date: {EFFECTIVE_DATE}</p>

        <div className="prose prose-slate max-w-none space-y-8 text-slate-700 text-[15px] leading-relaxed">

          {/* Introduction */}
          <section>
            <p>
              These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the {APP_NAME} platform
              (&ldquo;Platform&rdquo;) operated by {COMPANY_NAME} (&ldquo;Company,&rdquo; &ldquo;we,&rdquo;
              &ldquo;us,&rdquo; or &ldquo;our&rdquo;). By accessing or using the Platform, you agree to be bound
              by these Terms. If you do not agree, do not use the Platform.
            </p>
          </section>

          {/* 1. Description of Service */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">1. Description of Service</h2>
            <p className="mb-3">
              {APP_NAME} is a California elevator compliance management platform used by {COMPANY_NAME} and
              authorized elevator contractors to manage Cal/OSHA elevator inspection and repair compliance
              obligations. The Platform enables:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Tracking and managing Cal/OSHA elevator compliance notices and deadlines.</li>
              <li>Generating and delivering repair proposals and compliance documentation.</li>
              <li>Dispatching technicians and managing work orders.</li>
              <li>
                Sending transactional SMS notifications to property managers and authorized building contacts
                regarding scheduled elevator inspection and repair visits.
              </li>
              <li>Providing a client portal for property managers to review job status and documents.</li>
            </ul>
            <p className="mt-3">
              The Platform is available at <strong>{APP_URL}</strong>.
            </p>
          </section>

          {/* 2. SMS Messaging Terms */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4 border-l-4 border-blue-600 pl-3">
              2. SMS Messaging Terms
            </h2>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-5">
              <p className="font-semibold text-blue-900 mb-2">Important — SMS Consent &amp; Opt-Out</p>
              <p className="text-blue-800">
                By providing a phone number to {COMPANY_NAME} in connection with elevator compliance services,
                you consent to receive automated transactional SMS messages from {COMPANY_NAME} via the
                {' '}{APP_NAME} platform. <strong>Mobile opt-in information and SMS consent are never shared
                with third parties or affiliates for marketing or promotional purposes.</strong>
              </p>
            </div>

            <h3 className="text-base font-semibold text-slate-900 mb-2">2.1 Who Receives SMS Messages</h3>
            <p className="mb-4">
              SMS messages are sent only to property managers, building owners, and authorized building contacts
              who have an active elevator compliance service relationship with {COMPANY_NAME} and have provided
              their phone number as part of that service engagement. Recipients are not members of the general
              public; they are parties with an existing business relationship related to elevator compliance work
              at their property.
            </p>

            <h3 className="text-base font-semibold text-slate-900 mb-2">2.2 How Consent Is Obtained</h3>
            <p className="mb-4">
              Consent is obtained when a property manager or authorized building contact provides their phone
              number directly to {COMPANY_NAME} staff as part of establishing or maintaining a service
              relationship for elevator compliance work. By providing a phone number for elevator compliance
              services, the recipient acknowledges that they may receive automated advance-notice SMS messages
              related to scheduled elevator inspection or repair visits at their property. The opt-in disclosure
              is also displayed on the {APP_NAME} login page at <strong>{APP_URL}/login</strong>.
            </p>

            <h3 className="text-base font-semibold text-slate-900 mb-2">2.3 Types of Messages Sent</h3>
            <p className="mb-3">
              All SMS messages sent through the {APP_NAME} platform are <strong>transactional</strong> in nature.
              No marketing, promotional, or advertising messages are sent. Message types include:
            </p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>
                <strong>Scheduling Confirmations:</strong> Confirmation of an upcoming elevator inspection or
                repair appointment, including date, time window, and work description.
              </li>
              <li>
                <strong>48-Hour Advance Notices:</strong> Legally required advance notice to property managers
                of a scheduled elevator inspection or repair visit, sent approximately 48 hours prior to the
                visit as required under California elevator safety regulations.
              </li>
              <li>
                <strong>Work Order Status Updates:</strong> Notification that a work order has been updated;
                recipients are directed to log in to the client portal for details.
              </li>
              <li>
                <strong>Appointment Reminders:</strong> Reminders of upcoming scheduled visits.
              </li>
            </ul>

            <h3 className="text-base font-semibold text-slate-900 mb-2">2.4 Message Frequency</h3>
            <p className="mb-4">
              Message frequency varies based on the number of active elevator compliance jobs at the recipient&rsquo;s
              property. Recipients typically receive one (1) SMS message per scheduled visit, sent approximately
              48 hours in advance. Additional messages may be sent if appointments are rescheduled or if there
              are compliance-related updates requiring notification.
            </p>

            <h3 className="text-base font-semibold text-slate-900 mb-2">2.5 Message and Data Rates</h3>
            <p className="mb-4">
              Standard message and data rates may apply. Contact your wireless carrier for details regarding
              your plan&rsquo;s messaging rates.
            </p>

            <h3 className="text-base font-semibold text-slate-900 mb-2">2.6 Opt-Out Instructions</h3>
            <p className="mb-4">
              To opt out of SMS messages at any time, reply <strong>STOP</strong> (or CANCEL, QUIT, OPTOUT,
              UNSUBSCRIBE, STOPALL, REVOKE, or END) to any message you receive from us. After opting out, you
              will receive one (1) confirmation message and no further SMS messages will be sent to that number.
              You may also opt out by contacting us directly at{' '}
              <a href={`tel:${COMPANY_PHONE.replace(/\D/g, '')}`} className="text-blue-600 hover:underline">
                {COMPANY_PHONE}
              </a>{' '}
              or{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 hover:underline">
                {CONTACT_EMAIL}
              </a>.
            </p>
            <p className="mb-4">
              <strong>Note:</strong> Opting out of SMS may mean you do not receive legally required 48-hour
              advance notices of scheduled elevator visits. In that case, {COMPANY_NAME} will use alternative
              contact methods (email or phone call) to fulfill its notification obligations.
            </p>

            <h3 className="text-base font-semibold text-slate-900 mb-2">2.7 Opt-In Instructions</h3>
            <p className="mb-4">
              If you have previously opted out and wish to re-enroll, reply <strong>START</strong> (or YES or
              UNSTOP) to any message from us, or contact us directly using the information in Section 10 below.
            </p>

            <h3 className="text-base font-semibold text-slate-900 mb-2">2.8 Help</h3>
            <p className="mb-4">
              Reply <strong>HELP</strong> (or INFO) to any SMS message to receive contact information and
              instructions. You may also contact us at{' '}
              <a href={`tel:${COMPANY_PHONE.replace(/\D/g, '')}`} className="text-blue-600 hover:underline">
                {COMPANY_PHONE}
              </a>{' '}
              or{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 hover:underline">
                {CONTACT_EMAIL}
              </a>.
            </p>

            <h3 className="text-base font-semibold text-slate-900 mb-2">2.9 No Sharing of SMS Consent Data</h3>
            <p className="mb-4">
              Mobile opt-in information, phone numbers, and SMS messaging consent data collected through the
              {' '}{APP_NAME} platform are <strong>not shared with third parties or affiliates for marketing
              or promotional purposes</strong>. This data is used solely to deliver the transactional
              notifications described in these Terms.
            </p>
          </section>

          {/* 3. Eligibility and Account Access */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">3. Eligibility and Account Access</h2>
            <p className="mb-3">
              Access to the {APP_NAME} platform is restricted to:
            </p>
            <ul className="list-disc pl-6 space-y-2 mb-3">
              <li>Employees, contractors, and authorized staff of {COMPANY_NAME}.</li>
              <li>Property managers, building owners, and authorized contacts with active elevator compliance
              service engagements with {COMPANY_NAME} who are granted client portal access.</li>
            </ul>
            <p>
              Accounts are created by {COMPANY_NAME} administrators and may not be self-registered. You are
              responsible for maintaining the confidentiality of your login credentials and for all activity
              that occurs under your account. Notify us immediately if you suspect unauthorized access.
            </p>
          </section>

          {/* 4. Acceptable Use */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">4. Acceptable Use</h2>
            <p className="mb-3">You agree not to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Use the Platform for any purpose other than elevator compliance management and related business operations.</li>
              <li>Attempt to gain unauthorized access to any part of the Platform or its underlying systems.</li>
              <li>Interfere with or disrupt the Platform&rsquo;s operation or servers.</li>
              <li>Upload or transmit malicious code, viruses, or harmful data.</li>
              <li>Use the Platform to send unsolicited commercial messages or for any purpose prohibited by applicable law.</li>
              <li>Share your account credentials with unauthorized individuals.</li>
            </ul>
          </section>

          {/* 5. Intellectual Property */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">5. Intellectual Property</h2>
            <p>
              The {APP_NAME} platform, including its software, design, and content, is owned by or licensed to
              {' '}{COMPANY_NAME} and is protected by applicable intellectual property laws. You are granted a
              limited, non-exclusive, non-transferable license to access and use the Platform solely for the
              purposes described in these Terms. You may not copy, modify, distribute, or reverse-engineer any
              part of the Platform without written permission.
            </p>
          </section>

          {/* 6. Data and Privacy */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">6. Data and Privacy</h2>
            <p>
              Your use of the Platform is subject to our{' '}
              <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>,
              which is incorporated into these Terms by reference. The Privacy Policy describes how we collect,
              use, and protect personal information, including phone numbers and SMS consent data.
            </p>
          </section>

          {/* 7. Disclaimers */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">7. Disclaimers</h2>
            <p className="mb-3">
              THE PLATFORM IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES
              OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
              PURPOSE, OR NON-INFRINGEMENT.
            </p>
            <p>
              {COMPANY_NAME} does not warrant that the Platform will be uninterrupted, error-free, or free of
              security vulnerabilities. Compliance with Cal/OSHA elevator regulations remains the responsibility
              of the licensed elevator contractor; the Platform is a tool to assist with, not a guarantee of,
              regulatory compliance.
            </p>
          </section>

          {/* 8. Limitation of Liability */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">8. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, {COMPANY_NAME.toUpperCase()} SHALL NOT BE LIABLE FOR ANY
              INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF OR
              INABILITY TO USE THE PLATFORM, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL
              LIABILITY FOR ANY CLAIM ARISING FROM THESE TERMS OR YOUR USE OF THE PLATFORM SHALL NOT EXCEED
              THE AMOUNT PAID BY YOU TO {COMPANY_NAME.toUpperCase()} IN THE TWELVE (12) MONTHS PRECEDING THE
              CLAIM, OR ONE HUNDRED DOLLARS ($100), WHICHEVER IS GREATER.
            </p>
          </section>

          {/* 9. Governing Law */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">9. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the State of California, without regard to conflict of
              law principles. Any disputes arising from these Terms or your use of the Platform shall be
              resolved in the state or federal courts located in Los Angeles County, California, and you
              consent to the personal jurisdiction of such courts.
            </p>
          </section>

          {/* 10. Changes to These Terms */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">10. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. We will post the revised Terms on this page with an
              updated Effective Date. Material changes will be communicated to registered users by email at
              least 14 days before taking effect. Continued use of the Platform after the effective date
              constitutes acceptance of the revised Terms.
            </p>
          </section>

          {/* 11. Contact */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">11. Contact Us</h2>
            <p className="mb-2">
              For questions about these Terms, to opt out of SMS messages, or to submit a privacy request:
            </p>
            <address className="not-italic bg-slate-100 rounded-lg p-4 text-sm">
              <strong>{COMPANY_NAME}</strong><br />
              {COMPANY_ADDRESS}<br />
              {COMPANY_CITY}, {COMPANY_STATE} {COMPANY_ZIP}<br />
              Phone:{' '}
              <a href={`tel:${COMPANY_PHONE.replace(/\D/g, '')}`} className="text-blue-600 hover:underline">
                {COMPANY_PHONE}
              </a><br />
              Email:{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 hover:underline">
                {CONTACT_EMAIL}
              </a>
            </address>
          </section>

        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-3xl mx-auto px-6 py-4 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} {COMPANY_NAME}. All rights reserved.{' '}
          <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
          {' '}·{' '}
          <Link href="/login" className="hover:underline">Sign In</Link>
        </div>
      </footer>
    </div>
  );
}
