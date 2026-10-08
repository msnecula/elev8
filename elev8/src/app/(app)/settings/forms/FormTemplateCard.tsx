'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import FormTemplateUploader from './FormTemplateUploader';
import type { FormTemplateType } from '@/server/services/formTemplateService';

// This MUST be a client component ('use client') to act as an RSC boundary.
// Server components still inline their JSX into the RSC wire format as nested
// arrays — 11 cards × 6+ nesting levels hits React's "Maximum array nesting"
// limit. Client components are encoded as opaque element references, which
// breaks the nesting chain.

interface FormTemplateInfo {
  label: string;
  description: string;
  filedWith: string;
  filedWhen: string;
  officialUrl: string;
}

interface FormTemplateCardProps {
  formType: FormTemplateType;
  info: FormTemplateInfo;
  status: { uploaded: boolean; updatedAt?: string } | undefined;
  isUploaded: boolean;
}

export default function FormTemplateCard({
  formType,
  info,
  status,
  isUploaded,
}: FormTemplateCardProps) {
  return (
    <Card className={isUploaded ? 'border-green-200' : 'border-border'}>
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
}
