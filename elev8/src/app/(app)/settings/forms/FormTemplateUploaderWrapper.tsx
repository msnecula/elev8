'use client';

// next/dynamic with ssr:false is only permitted inside Client Components
// (Next.js 15 rejects it in Server Components at build time).
//
// Loading FormsContent (not FormTemplateUploader directly) with ssr:false
// means BOTH PageHeader AND FormTemplateUploader render entirely in the browser.
// The server emits only the loading placeholder — zero server JSX from either
// component — which keeps the RSC payload flat and avoids the "Maximum array
// nesting exceeded" crash on /settings/forms.
import dynamic from 'next/dynamic';

const FormsContent = dynamic(
  () => import('./FormsContent'),
  {
    ssr: false,
    loading: () => (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Loading forms…
      </div>
    ),
  }
);

export default function FormTemplateUploaderWrapper() {
  return <FormsContent />;
}
