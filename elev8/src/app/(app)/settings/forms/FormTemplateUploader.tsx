'use client';

// FormTemplateUploader — owns ALL data fetching for this page.
//
// WHY FETCH INSTEAD OF SERVER ACTIONS:
//
// Next.js 15 server action protocol: every POST to a server action generates
// an RSC re-render of the current route as part of the response — even without
// revalidatePath, even without startTransition. On /settings/forms, that
// re-render was hitting React 19's "Maximum array nesting exceeded" limit
// because the RSC serializer was hitting nesting too deep (layout chain +
// 11-item mapped JSX + sub-components).
//
// The error appeared in the RSC client (resolveErrorDev) with NO user-code
// frames because the nesting limit is hit during server-side RSC generation,
// before user code runs.
//
// FIX: Replace every server action call with fetch() to plain API routes.
// fetch() returns pure JSON — zero RSC, zero nesting, no protocol overhead.
//
//   uploadFormTemplate(...)  →  POST /api/form-templates/upload
//   getUploadedTemplates()   →  GET  /api/form-templates/status

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/lib/toast';
import { FORM_TEMPLATE_INFO, FORM_TYPES } from '@/lib/formTemplateInfo';
import type { FormTemplateType } from '@/lib/formTemplateInfo';
import {
  Upload, Loader2, RefreshCw, ExternalLink,
  CheckCircle2, AlertCircle,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type UploadStatus = Record<FormTemplateType, { uploaded: boolean; updatedAt?: string }>;

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function apiUpload(
  formType: FormTemplateType,
  base64: string,
  fileName: string,
): Promise<{ success: true; data: { fields: Array<{ name: string; type: string; value: string }>; isXfa: boolean; fingerprint: string } } | { success: false; error: string }> {
  const res = await fetch('/api/form-templates/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ formType, base64, fileName }),
  });
  return res.json();
}

async function apiGetStatus(): Promise<{ success: true; data: UploadStatus } | { success: false; error: string }> {
  const res = await fetch('/api/form-templates/status');
  return res.json();
}

// ---------------------------------------------------------------------------
// UploadButton — per-form upload control (not exported)
// ---------------------------------------------------------------------------

interface UploadButtonProps {
  formType: FormTemplateType;
  isUploaded: boolean;
  onUploaded: () => void; // called after a successful upload so parent can refresh
}

function UploadButton({ formType, isUploaded, onUploaded }: UploadButtonProps) {
  // NOTE: deliberately NOT using useTransition here.
  //
  // React 19's startTransition(async fn) pattern = "action transition" —
  // React automatically triggers an RSC re-render as part of the transition
  // response.  That re-render is what was hitting the nesting limit.
  // We manage pending state manually with useState to stay completely outside
  // the RSC/server-action protocol.
  const [isPending, setIsPending] = useState(false);
  const [detectedFields, setDetectedFields] = useState<string[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Please select a PDF file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Maximum 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = (ev.target?.result as string).split(',')[1];
      if (!base64) { toast.error('Failed to read file'); return; }

      setIsPending(true);
      try {
        // Plain fetch — no RSC, no server action protocol, no nesting limit
        const result = await apiUpload(formType, base64, file.name);
        if (result.success) {
          const { fields, isXfa } = result.data;
          const fieldCount = fields.length;
          setDetectedFields(fields.map(f => f.name));
          const label = formType.toUpperCase();

          if (fieldCount > 0) {
            toast.success(`${label} uploaded — ${fieldCount} fillable field${fieldCount !== 1 ? 's' : ''} detected`);
          } else if (formType === 'dosh100') {
            toast.success(`${label} uploaded — editable fields will be generated at form-creation time`);
          } else if (isXfa) {
            toast.warning(
              `${label} uploaded, but this PDF uses XFA format which cannot be auto-filled. ` +
              `To fix: open the form in Chrome, print to PDF, and re-upload the saved file.`,
            );
          } else {
            toast.warning(
              `${label} uploaded (no fillable fields detected — verify this is the correct fillable PDF)`,
            );
          }

          onUploaded(); // parent refreshes its own state — no router.refresh() needed
        } else {
          toast.error(result.error);
        }
      } catch (err) {
        toast.error(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setIsPending(false);
      }
    };
    reader.readAsDataURL(file);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        className="sr-only"
        id={`upload-${formType}`}
        disabled={isPending}
      />
      <label htmlFor={`upload-${formType}`}>
        <Button
          asChild
          size="sm"
          variant={isUploaded ? 'outline' : 'default'}
          disabled={isPending}
          className="cursor-pointer"
        >
          <span>
            {isPending ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Uploading…</>
            ) : isUploaded ? (
              <><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Replace with New Version</>
            ) : (
              <><Upload className="h-3.5 w-3.5 mr-1.5" />Upload Official Form</>
            )}
          </span>
        </Button>
      </label>

      {detectedFields && detectedFields.length > 0 && (
        <details className="text-xs text-muted-foreground cursor-pointer">
          <summary className="hover:text-foreground">
            {detectedFields.length} fields detected
          </summary>
          <div className="mt-1 p-2 bg-muted rounded text-xs font-mono max-h-32 overflow-y-auto">
            {detectedFields.map(f => <div key={f}>{f}</div>)}
          </div>
        </details>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FormTemplateUploader — default export
//
// Receives NO props from the server component.  Loads its own data so the
// RSC payload for this page is as small as possible (just a module reference).
// ---------------------------------------------------------------------------

export default function FormTemplateUploader() {
  const [status, setStatus] = useState<UploadStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      // Plain fetch — no RSC, no server action protocol, no nesting limit
      const result = await apiGetStatus();
      if (result.success) {
        setStatus(result.data);
      } else {
        toast.error(`Failed to load templates: ${result.error}`);
      }
    } catch (err) {
      toast.error(`Failed to load templates: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Compute derived values
  const uploadedCount = status
    ? FORM_TYPES.filter(t => status[t]?.uploaded).length
    : 0;
  const totalCount = FORM_TYPES.length;
  const allUploaded = uploadedCount === totalCount;

  return (
    <div className="space-y-6">
      {/* Status summary */}
      <div className={`rounded-lg border p-4 ${
        isLoading
          ? 'border-gray-200 bg-gray-50'
          : allUploaded
          ? 'border-green-200 bg-green-50'
          : uploadedCount === 0
          ? 'border-red-200 bg-red-50'
          : 'border-amber-200 bg-amber-50'
      }`}>
        <div className="flex items-center gap-2">
          {isLoading ? (
            <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
          ) : allUploaded ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <AlertCircle className="h-5 w-5 text-amber-600" />
          )}
          <p className={`font-semibold text-sm ${
            isLoading ? 'text-gray-500' : allUploaded ? 'text-green-800' : 'text-amber-800'
          }`}>
            {isLoading ? 'Loading…' : `${uploadedCount} of ${totalCount} official forms uploaded`}
          </p>
        </div>
        {!isLoading && !allUploaded && (
          <p className="text-xs mt-1 ml-7 text-amber-700">
            Download the missing forms from the Cal/OSHA DIR website using the links below, then upload them here.
            The system will use these exact official forms when generating compliance documents.
          </p>
        )}
      </div>

      {/* Instructions */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-blue-800">How This Works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-800 space-y-1.5">
          <p>1. Click <strong>&ldquo;Download from Cal/OSHA&rdquo;</strong> next to any form to get the official PDF from the state website.</p>
          <p>2. Upload that PDF here using the <strong>&ldquo;Upload Official Form&rdquo;</strong> button.</p>
          <p>3. The system stores the official form and auto-fills it with data from Preliminary Orders when generating documents.</p>
          <p>4. When Cal/OSHA releases a new form version, simply download the new version and re-upload — all future documents will use the updated form automatically.</p>
          <p className="font-medium">⚠ Only use PDFs downloaded directly from dir.ca.gov — do not upload modified or recreated forms.</p>
        </CardContent>
      </Card>

      {/* Form list */}
      <div className="rounded-lg border divide-y">
        {FORM_TYPES.map(formType => {
          const { label, description, filedWith, filedWhen, officialUrl } = FORM_TEMPLATE_INFO[formType];
          const isUploaded = status?.[formType]?.uploaded ?? false;
          const updatedAt = status?.[formType]?.updatedAt;

          return (
            <div key={formType} className="p-4">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{label}</span>
                    {isLoading ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-500 border border-gray-200 px-2 py-0.5 text-xs font-medium">
                        <Loader2 className="h-3 w-3 animate-spin" /> Checking…
                      </span>
                    ) : isUploaded ? (
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
                <UploadButton
                  formType={formType}
                  isUploaded={isUploaded}
                  onUploaded={loadTemplates}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
