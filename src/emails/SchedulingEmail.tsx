import { BaseEmail, EmailHeading, EmailText, EmailButton, EmailInfoBox, EmailDivider } from './BaseEmail';

interface SchedulingEmailProps {
  clientName: string;
  jobTitle: string;
  propertyName: string;
  confirmedDate: string;
  confirmedTimeRange: string;
  buildingAccessNotes?: string;
  complianceCoordinationRequired: boolean;
  fortyEightHourRequired: boolean;
  jobUrl: string;
}

export function SchedulingEmail({
  clientName,
  jobTitle,
  propertyName,
  confirmedDate,
  confirmedTimeRange,
  buildingAccessNotes,
  complianceCoordinationRequired,
  fortyEightHourRequired,
  jobUrl,
}: SchedulingEmailProps) {
  return (
    <BaseEmail preview={`Work date confirmed — ${confirmedDate}`}>
      <EmailHeading>Work Date Confirmed</EmailHeading>

      <EmailText>Dear {clientName},</EmailText>

      <EmailText>
        Your elevator compliance work at <strong>{propertyName}</strong> has been scheduled.
      </EmailText>

      <EmailDivider />

      <EmailText>
        <strong>Date:</strong> {confirmedDate}
        {'\n'}
        <strong>Time:</strong> {confirmedTimeRange}
        {buildingAccessNotes ? `\n\n${'Building Access: ' + buildingAccessNotes}` : ''}
      </EmailText>

      <EmailDivider />

      {complianceCoordinationRequired && (
        <EmailInfoBox variant="info">
          This job requires coordination with your elevator compliance company.
          Our team will handle this notification on your behalf.
        </EmailInfoBox>
      )}

      {fortyEightHourRequired && (
        <EmailInfoBox variant="info">
          California regulations require 48-hour advance notice before elevator work begins.
          We will send this notice to the appropriate parties automatically.
        </EmailInfoBox>
      )}

      <EmailText>
        If you need to reschedule or have any questions, please contact us as soon as possible.
      </EmailText>

      <EmailButton href={jobUrl}>View Job Details</EmailButton>
    </BaseEmail>
  );
}

export default SchedulingEmail;
