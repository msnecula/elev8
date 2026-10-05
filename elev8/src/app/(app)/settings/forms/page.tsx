import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import { getUploadedTemplates } from '@/server/actions/formTemplates';
import { FORM_TEMPLATE_INFO } from '@/server/services/formTemplateService';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import FormTemplateUploader from './FormTemplateUploader';

export const metadata: Metadata = { title: 'Form Templates' };

export default async function FormTemplatesPage() {
  await requireRole('admin');

  const templatesResult = await getUploadedTemplates();
  const templates = templatesResult.success ? templatesResult.data : {};

  const formTypes = Object.keys(FORM_TEMPLATE_INFO) as Array<keyof typeof FORM_TEMPLATE_INFO>;

  const uploadedCount = formTypes.filter(t => templates[t]?.uploaded).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Official Cal/OSHA Form Templates"
        description="Upload the official PDF forms from the California DIR website. These are used to auto-fill compliance documents."
      />

      {/* Status summary */}
      <div className={`rounded-lg border p-4 ${
        uploadedCount === formTypes.length
          ? 'border-green-200 bg-green-50'
          : uploadedCount === 0
          ? 'border-red-200 bg-red-50'
          : 'border-amber-200 bg-amber-50'
      }`}>
        <div className="flex items-center gap-2">
          {uploadedCount === formTypes.length
            ? <CheckCircle2 className="h-5 w-5 text-green-600" />
            : <AlertCircle className="h-5 w-5 text-amber-600" />}
          <p className={`font-semibold text-sm ${
            uploadedCount === formTypes.length ? 'text-green-800' : 'text-amber-800'
          }`}>
            {uploadedCount} of {formTypes.length} official forms uploaded
          </p>
        </div>
        {uploadedCount < formTypes.length && (
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
          <p>1. Click <strong>"Download from Cal/OSHA"</strong> next to any form to get the official PDF from the state website.</p>
          <p>2. Upload that PDF here using the <strong>"Upload Official Form"</strong> button.</p>
          <p>3. The system stores the official form and auto-fills it with data from Preliminary Orders when generating documents.</p>
          <p>4. When Cal/OSHA releases a new form version, simply download the new version and re-upload — all future documents will use the updated form automatically.</p>
          <p className="font-medium">⚠ Only use PDFs downloaded directly from dir.ca.gov — do not upload modified or recreated forms.</p>
        </CardContent>
      </Card>

      {/* Form list */}
      <div className="space-y-4">
        {formTypes.map(formType => {
          const info = FORM_TEMPLATE_INFO[formType];
          const status = templates[formType];
          const isUploaded = status?.uploaded ?? false;

          return (
            <Card key={formType} className={isUploaded ? 'border-green-200' : 'border-border'}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm font-semibold">{info.label}</CardTitle>
                      {isUploaded ? (
                        <Badge className="bg-green-100 text-green-700 border-green-200 border text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />Uploaded
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50">
                          <AlertCircle className="h-3 w-3 mr-1" />Not Uploaded
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="mt-1 text-xs">{info.description}</CardDescription>
                    <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                      <p><span className="font-medium">Filed with:</span> {info.filedWith}</p>
                      <p><span className="font-medium">Filed when:</span> {info.filedWhen}</p>
                      {isUploaded && status?.updatedAt && (
                        <p className="text-green-700">
                          Last updated: {new Date(status.updatedAt).toLocaleDateString('en-US', {
                            month: 'long', day: 'numeric', year: 'numeric',
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <a
                    href={info.officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Download from Cal/OSHA (dir.ca.gov)
                  </a>
                  <FormTemplateUploader formType={formType} isUploaded={isUploaded} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
