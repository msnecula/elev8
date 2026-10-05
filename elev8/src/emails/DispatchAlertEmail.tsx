import { BaseEmail, EmailHeading, EmailText, EmailButton, EmailDivider } from './BaseEmail';

interface DispatchAlertEmailProps {
  technicianName: string;
  jobTitle: string;
  propertyName: string;
  propertyAddress: string;
  scheduledDate: string;
  scheduledTimeRange: string;
  contactName: string;
  contactPhone: string;
  buildingAccessNotes: string;
  requiredScope: string;
  violationItems: string[];
  specialInstructions: string;
  workOrderUrl: string;
}

export function DispatchAlertEmail({
  technicianName,
  jobTitle,
  propertyName,
  propertyAddress,
  scheduledDate,
  scheduledTimeRange,
  contactName,
  contactPhone,
  buildingAccessNotes,
  requiredScope,
  violationItems,
  specialInstructions,
  workOrderUrl,
}: DispatchAlertEmailProps) {
  return (
    <BaseEmail preview={`Dispatch: ${jobTitle} on ${scheduledDate}`}>
      <EmailHeading>Work Order Dispatched</EmailHeading>

      <EmailText>Hi {technicianName},</EmailText>

      <EmailText>
        You have been dispatched for the following job. Please review the details
        and confirm your status in the app.
      </EmailText>

      <EmailDivider />

      <EmailText>
        <strong>Job:</strong> {jobTitle}{'\n'}
        <strong>Date:</strong> {scheduledDate}{'\n'}
        <strong>Time:</strong> {scheduledTimeRange}
      </EmailText>

      <EmailText>
        <strong>Property:</strong> {propertyName}{'\n'}
        <strong>Address:</strong> {propertyAddress}{'\n'}
        <strong>On-Site Contact:</strong> {contactName} — {contactPhone}
        {buildingAccessNotes ? `\n\n${'Building Access: '}${buildingAccessNotes}` : ''}
      </EmailText>

      <EmailDivider />

      <EmailText>
        <strong>Scope of Work:</strong>{'\n'}{requiredScope}
      </EmailText>

      {violationItems.length > 0 && (
        <EmailText>
          <strong>Violation Items:</strong>{'\n'}
          {violationItems.map(v => `• ${v}`).join('\n')}
        </EmailText>
      )}

      {specialInstructions && (
        <EmailText>
          <strong>Special Instructions:</strong>{'\n'}{specialInstructions}
        </EmailText>
      )}

      <EmailButton href={workOrderUrl}>View Full Dispatch Packet</EmailButton>
    </BaseEmail>
  );
}

export default DispatchAlertEmail;
