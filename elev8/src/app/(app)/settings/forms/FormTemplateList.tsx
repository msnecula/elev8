'use client';

// This client component owns the entire form-card list.
// The server page passes a flat array of plain objects — no nested JSX crosses the RSC boundary,
// which eliminates the "Maximum array nesting exceeded" wire-format error.

import { ExternalLink } from 'lucide-react';
import FormTemplateUploader from './FormTemplateUploader';
import type { FormTemplateType } from '@/server/services/formTemplateService';

interface FormItem {
  formType: FormTemplateType;
  label: string;
  description: string;
  filedWith: string;
  filedWhen: string;
  officialUrl: string;
  isUploaded: boolean;
  updatedAt?: string;
}

interface Props {
  items: FormItem[];
}

export default function FormTemplateList({ items }: Props) {
  return (
    <div className="rounded-lg border divide-y">
      {items.map(({ formType, label, description, filedWith, filedWhen, officialUrl, isUploaded, updatedAt }) => (
        <div key={formType} className="p-4">
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold">{label}</span>
                {isUploaded ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 text-xs font-medium">
                    ✓ Uploaded
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 border border-amber-300 px-2 py-0.5 text-xs font-medium">
                    Not Uploaded
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{description}</p>
              <div className="mt-1.5 text-xs text-muted-foreground space-y-0.5">
                <p><span className="font-medium">Filed with:</span> {filedWith}</p>
                <p><span className="font-medium">Filed when:</span> {filedWhen}</p>
                {isUploaded && updatedAt && (
                  <p className="text-green-700">
                    Last updated: {new Date(updatedAt).toLocaleDateString('en-US', {
                      month: 'long', day: 'numeric', year: 'numeric',
                    })}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <a
              href={officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 underline"
            >
              <ExternalLink className="h-3 w-3" />
              Download from Cal/OSHA (dir.ca.gov)
            </a>
            <FormTemplateUploader formType={formType} isUploaded={isUploaded} />
          </div>
        </div>
      ))}
    </div>
  );
}
