import { BaseEmail, EmailHeading, EmailText, EmailButton, EmailInfoBox, EmailDivider } from './BaseEmail';
import { COMPANY_NAME, COMPANY_PHONE } from '@/lib/constants';

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
        Need to reschedule or have a question? Call {COMPANY_NAME} at{' '}
        <a href={`tel:${COMPANY_PHONE.replace(/\D/g, '')}`} style={{ color: '#2563eb' }}>{COMPANY_PHONE}</a>{' '}
        as soon as possible. Use the button below to see the latest job details.
      </EmailText>

      <EmailButton href={jobUrl}>View Job Details</EmailButton>
    </BaseEmail>
  );
}

export default SchedulingEmail;
