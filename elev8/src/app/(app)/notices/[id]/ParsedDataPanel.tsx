import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertTriangle, Building2, Wrench, Calendar, Bell,
  ClipboardList, CheckCircle2, Clock, User, Package,
} from 'lucide-react';
import type { ParsedNoticeData, ActionPlanStep } from '@/server/services/noticeParser';

interface ParsedDataPanelProps {
  data: ParsedNoticeData;
  confidence: number;
}

const PRIORITY_STYLES = {
  critical: 'bg-red-100 border-red-300 text-red-800',
  high: 'bg-orange-100 border-orange-300 text-orange-800',
  medium: 'bg-yellow-100 border-yellow-300 text-yellow-800',
};

const PRIORITY_BADGE = {
  critical: 'bg-red-500 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-white',
};

const PARTY_LABELS = {
  technician: 'Field Technician',
  inspector: 'Safety Inspector',
  dispatcher: 'Dispatch Team',
  building_manager: 'Building Manager',
};

export default function ParsedDataPanel({ data, confidence }: ParsedDataPanelProps) {
  return (
    <div className="space-y-5">
      {/* Confidence */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>AI Confidence</span>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full ${confidence >= 0.8 ? 'bg-green-500' : confidence >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${Math.round(confidence * 100)}%` }}
            />
          </div>
          <span className="font-medium">{Math.round(confidence * 100)}%</span>
        </div>
      </div>

      {/* Property & Equipment */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-600" />
            Property & Equipment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 text-sm">
          <Row label="Property" value={data.propertyName} />
          <Row label="Address" value={data.propertyAddress} />
          <Row label="Building Type" value={data.buildingType} capitalize />
          <Row label="Elevator Type" value={data.elevatorType} capitalize />
          {data.equipmentId && <Row label="Equipment ID" value={data.equipmentId} />}
          {data.serialNumber && <Row label="Serial Number" value={data.serialNumber} />}
          {data.floorsServed && <Row label="Floors Served" value={data.floorsServed} />}
          {data.unitsAffected > 0 && <Row label="Units Affected" value={String(data.unitsAffected)} />}
        </CardContent>
      </Card>

      {/* Four Key Compliance Items */}
      <Card className="border-orange-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            Key Compliance Requirements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {/* 1. Safety Tests */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              1. Safety Tests Required
            </p>
            {data.safetyTestsRequired.length > 0 ? (
              <ul className="space-y-1">
                {data.safetyTestsRequired.map((test, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-orange-600 mt-0.5 shrink-0" />
                    <span>{test}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-muted-foreground">None specified</p>}
          </div>

          {/* 2. Advance Notification */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              2. Advance Written Notification
            </p>
            {data.advanceNotificationRequired ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Bell className="h-3.5 w-3.5 text-red-600 shrink-0" />
                  <span className="font-medium text-red-800">
                    {data.advanceNotificationHours
                      ? `${data.advanceNotificationHours}-hour advance notice REQUIRED`
                      : 'Advance notice REQUIRED'}
                  </span>
                </div>
                {data.advanceNotificationRecipients.length > 0 && (
                  <ul className="ml-5 space-y-0.5 text-xs text-muted-foreground">
                    {data.advanceNotificationRecipients.map((r, i) => (
                      <li key={i}>• Notify: {r}</li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">Not required</p>
            )}
          </div>

          {/* 3. Compliance Deadline */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              3. Compliance Deadline
            </p>
            {data.complianceDeadline ? (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-red-600 shrink-0" />
                <span className="font-bold text-red-800 text-base">
                  {new Date(data.complianceDeadline + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                  })}
                </span>
              </div>
            ) : (
              <p className="text-muted-foreground">Not specified in document</p>
            )}
          </div>

          {/* 4. Additional Maintenance */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              4. Additional Maintenance Requirements
            </p>
            {data.additionalMaintenanceRequirements.length > 0 ? (
              <ul className="space-y-1">
                {data.additionalMaintenanceRequirements.map((req, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Wrench className="h-3.5 w-3.5 text-blue-600 mt-0.5 shrink-0" />
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">No additional requirements noted</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Plan */}
      <Card className="border-blue-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-blue-600" />
            Action Plan for Dispatch & Technician
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.actionPlan.length === 0 ? (
            <p className="text-sm text-muted-foreground">No action plan generated</p>
          ) : (
            data.actionPlan.map((step) => (
              <ActionPlanCard key={step.stepNumber} step={step} />
            ))
          )}
        </CardContent>
      </Card>

      {/* Violations */}
      {data.violationItems.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Violation Items</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {data.violationItems.map((v, i) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
                  <span>{v}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Missing info */}
      {data.missingInformation.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs space-y-1">
          <p className="font-semibold text-amber-800">Information not found in document:</p>
          {data.missingInformation.map((m, i) => (
            <p key={i} className="text-amber-700">• {m}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionPlanCard({ step }: { step: ActionPlanStep }) {
  return (
    <div className={`rounded-lg border p-3.5 space-y-2 ${PRIORITY_STYLES[step.priority]}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex-shrink-0 h-6 w-6 rounded-full bg-white/60 flex items-center justify-center text-xs font-bold">
            {step.stepNumber}
          </span>
          <span className="font-semibold text-sm">{step.title}</span>
        </div>
        <Badge className={`text-xs shrink-0 ${PRIORITY_BADGE[step.priority]}`}>
          {step.priority.toUpperCase()}
        </Badge>
      </div>

      {/* Description */}
      <p className="text-sm leading-relaxed pl-8">{step.description}</p>

      {/* Meta */}
      <div className="flex flex-wrap gap-3 pl-8 text-xs opacity-80">
        <span className="flex items-center gap-1">
          <User className="h-3 w-3" />
          {PARTY_LABELS[step.responsibleParty]}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {step.estimatedTime}
        </span>
        {step.deadline && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Due: {new Date(step.deadline + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}
        {step.requiresNotification && (
          <span className="flex items-center gap-1 font-semibold">
            <Bell className="h-3 w-3" />
            Notification Required
          </span>
        )}
      </div>

      {/* Materials */}
      {step.materialsNeeded.length > 0 && (
        <div className="pl-8">
          <p className="text-xs font-medium flex items-center gap-1 mb-1">
            <Package className="h-3 w-3" />
            Materials/Parts Needed:
          </p>
          <div className="flex flex-wrap gap-1">
            {step.materialsNeeded.map((m, i) => (
              <span key={i} className="text-xs bg-white/50 rounded px-1.5 py-0.5">{m}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, capitalize }: { label: string; value: string; capitalize?: boolean }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-5 gap-2">
      <dt className="col-span-2 text-xs text-muted-foreground font-medium">{label}</dt>
      <dd className={`col-span-3 text-sm ${capitalize ? 'capitalize' : ''}`}>{value}</dd>
    </div>
  );
}
