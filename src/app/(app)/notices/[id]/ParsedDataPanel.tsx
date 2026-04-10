import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ParsedNoticeData } from '../../../../../drizzle/schema/notices';
import { Brain, CheckCircle2 } from 'lucide-react';

interface ParsedDataPanelProps {
  data: ParsedNoticeData;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-5 gap-2 py-2 border-b border-border last:border-0">
      <dt className="col-span-2 text-xs text-muted-foreground font-medium pt-0.5">{label}</dt>
      <dd className="col-span-3 text-sm">{value ?? '—'}</dd>
    </div>
  );
}

export default function ParsedDataPanel({ data }: ParsedDataPanelProps) {
  const confidence = Math.round((data.parseConfidence ?? 0) * 100);
  const confidenceColor =
    confidence >= 80 ? 'text-green-600' : confidence >= 50 ? 'text-yellow-600' : 'text-red-600';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Brain className="h-4 w-4 text-blue-600" />
            AI Extracted Data
          </CardTitle>
          <span className={`text-xs font-semibold ${confidenceColor}`}>
            {confidence}% confidence
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <dl>
          <InfoRow label="Document Type" value={data.documentType} />
          <InfoRow label="Client Company" value={data.clientCompany} />
          <InfoRow label="Property Name" value={data.propertyName} />
          <InfoRow label="Property Address" value={data.propertyAddress} />
          <InfoRow label="Building Type" value={data.buildingType} />
          <InfoRow label="Work Type" value={data.workType} />
          <InfoRow label="Required Skill" value={
            data.requiredSkillTag ? (
              <Badge variant="secondary" className="text-xs">{data.requiredSkillTag}</Badge>
            ) : null
          } />
          <InfoRow label="Inspection Date" value={data.inspectionDate} />
          <InfoRow label="State Deadline" value={data.stateDeadline} />
          <InfoRow label="Est. Duration" value={data.estimatedDurationHours ? `${data.estimatedDurationHours} hrs` : null} />
          <InfoRow label="Est. Labor" value={data.estimatedLaborHours ? `${data.estimatedLaborHours} hrs` : null} />
          <InfoRow label="Est. Materials" value={data.estimatedMaterials ? `$${data.estimatedMaterials}` : null} />
          <InfoRow label="48-hr Notice" value={
            <span className={data.fortyEightHourRequired ? 'text-orange-600 font-medium' : 'text-green-600'}>
              {data.fortyEightHourRequired ? 'Required' : 'Not Required'}
            </span>
          } />
          <InfoRow label="Compliance Coord." value={
            <span className={data.complianceCoordinationRequired ? 'text-orange-600 font-medium' : 'text-muted-foreground'}>
              {data.complianceCoordinationRequired ? 'Required' : 'Not Required'}
            </span>
          } />
        </dl>

        {data.requiredWorkSummary && (
          <div className="mt-4">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Work Summary</p>
            <p className="text-sm bg-muted/50 rounded p-3">{data.requiredWorkSummary}</p>
          </div>
        )}

        {data.violationItems && data.violationItems.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Violation Items</p>
            <ul className="space-y-1">
              {data.violationItems.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-red-500 mt-0.5 shrink-0">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.missingInformation && data.missingInformation.length > 0 && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-xs font-medium text-yellow-800 mb-1.5">Missing Information</p>
            <ul className="space-y-0.5">
              {data.missingInformation.map((item, i) => (
                <li key={i} className="text-xs text-yellow-700">• {item}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
