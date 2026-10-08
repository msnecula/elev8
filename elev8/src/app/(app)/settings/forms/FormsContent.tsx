'use client';

// FormsContent — loaded via dynamic(ssr:false) from FormTemplateUploaderWrapper.
//
// WHY THIS FILE EXISTS:
// page.tsx is a Server Component.  PageHeader was rendered there, adding server
// JSX to the RSC payload.  Moving PageHeader here (a 'use client' file loaded
// with ssr:false) means it NEVER appears in the RSC wire format — only a module
// reference is emitted, not the rendered JSX.  This removes several levels of
// array nesting from the RSC payload, helping avoid the "Maximum array nesting
// exceeded" crash that was happening on /settings/forms.

import PageHeader from '@/components/shared/PageHeader';
import FormTemplateUploader from './FormTemplateUploader';

export default function FormsContent() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Official Cal/OSHA Form Templates"
        description="Upload the official PDF forms from the California DIR website. These are used to auto-fill compliance documents."
      />
      <FormTemplateUploader />
    </div>
  );
}
