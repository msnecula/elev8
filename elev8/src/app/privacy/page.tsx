import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | Elev8 Comply',
};

export default function PrivacyPolicyPage() {
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: {lastUpdated}</p>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Introduction</h2>
            <p>
              Precision Lift Co. ("we," "us," or "our") operates the Elev8 Comply platform, a California elevator compliance
              management application. This Privacy Policy describes how we collect, use, and protect your personal information
              when you use our services.
            </p>
            <p className="mt-2">
              By using Elev8 Comply, you agree to the collection and use of information in accordance with this policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Information We Collect</h2>
            <p>We collect the following types of information:</p>
            <ul className="list-disc list-inside space-y-2 mt-3">
              <li><strong>Contact information:</strong> Name, email address, phone number, and company/organization name provided during account setup or service engagement.</li>
              <li><strong>Property information:</strong> Building addresses and related elevator compliance records associated with your service account.</li>
              <li><strong>Service records:</strong> Job details, inspection history, proposals, work orders, and compliance notices related to your elevator equipment.</li>
              <li><strong>Communication records:</strong> Records of notifications and messages sent to you in connection with your service account.</li>
              <li><strong>Usage data:</strong> Log data and analytics related to your use of the Elev8 Comply platform.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc list-inside space-y-2 mt-3">
              <li>Manage and coordinate your elevator compliance services;</li>
              <li>Send you scheduling confirmations, appointment reminders, and compliance notifications via email and SMS;</li>
              <li>Send 48-hour advance notices required by California elevator regulations;</li>
              <li>Generate proposals, work orders, and compliance documentation;</li>
              <li>Communicate with you about your active service engagements;</li>
              <li>Maintain records required for regulatory compliance; and</li>
              <li>Improve and maintain the Elev8 Comply platform.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. SMS Communications</h2>
            <p>
              By providing your phone number to Precision Lift Co. and consenting to receive SMS messages, you agree to receive
              transactional text messages related to your elevator compliance services, including scheduling confirmations,
              48-hour advance notices, work order updates, and appointment reminders.
            </p>
            <p className="mt-3 font-medium text-gray-900">
              We do not sell or share your SMS opt-in data or personal information with third parties for marketing purposes.
            </p>
            <p className="mt-3">
              Message and data rates may apply. Message frequency varies based on your active service engagements.
              You may opt out at any time by replying STOP to any SMS message. For help, reply HELP or contact us directly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Information Sharing</h2>
            <p>
              We do not sell, trade, or otherwise transfer your personal information to third parties for marketing or advertising
              purposes. We may share information with trusted service providers who assist in operating our platform
              (such as cloud hosting, email, and SMS delivery services), subject to confidentiality agreements. We may also
              disclose information when required by law or to protect our legal rights.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your personal information against unauthorized access,
              alteration, disclosure, or destruction. Your data is stored on secure servers and access is restricted to
              authorized personnel only.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Data Retention</h2>
            <p>
              We retain your personal information for as long as your service relationship with Precision Lift Co. is active
              and as required to comply with our legal obligations, resolve disputes, and enforce our agreements. Compliance
              records may be retained for the periods required by California elevator regulations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc list-inside space-y-2 mt-3">
              <li>Request access to the personal information we hold about you;</li>
              <li>Request correction of inaccurate or incomplete information;</li>
              <li>Request deletion of your personal information, subject to legal retention requirements;</li>
              <li>Opt out of SMS communications at any time by replying STOP; and</li>
              <li>Contact us with any privacy-related concerns.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material changes by posting the
              new policy on this page with an updated date. Your continued use of Elev8 Comply after changes constitutes
              acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or our data practices, please contact us:
            </p>
            <div className="mt-3 p-4 bg-gray-50 rounded-lg text-sm">
              <p className="font-semibold">Precision Lift Co.</p>
              <p>California, United States</p>
              <p className="mt-1">
                Via the Elev8 Comply platform or through your assigned service representative.
              </p>
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
