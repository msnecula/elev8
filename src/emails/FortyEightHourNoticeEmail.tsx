import { BaseEmail, EmailHeading, EmailText, EmailButton, EmailInfoBox } from './BaseEmail';

interface FortyEightHourAlertEmailProps {
  recipientName: string;
  jobTitle: string;
  propertyName: string;
  propertyAddress: string;
  scheduledDate: string;
  deadlineDate: string;
  isOverdue: boolean;
  workOrderUrl: string;
}

export function FortyEightHourAlertEmail({
  recipientName,
  jobTitle,
  propertyName,
  propertyAddress,
  scheduledDate,
  deadlineDate,
  isOverdue,
  workOrderUrl,
}: FortyEightHourAlertEmailProps) {
  return (
    <BaseEmail
      preview={isOverdue
        ? `OVERDUE: 48-hour notice — ${jobTitle}`
        : `ACTION REQUIRED: 48-hour notice deadline approaching — ${jobTitle}`}
    >
      <EmailHeading>
        {isOverdue ? '⚠ 48-Hour Notice OVERDUE' : '⏰ 48-Hour Notice Deadline Approaching'}
      </EmailHeading>

      <EmailText>Hi {recipientName},</EmailText>

      {isOverdue ? (
        <EmailInfoBox variant="danger">
          The 48-hour advance notice deadline for the job below has PASSED without
          the notice being sent. Dispatch is currently HELD. Mark the notice as sent
          before proceeding.
        </EmailInfoBox>
      ) : (
        <EmailInfoBox variant="warning">
          The 48-hour advance notice for the job below must be sent within 24 hours.
          Please send the notice and mark it as sent in the system.
        </EmailInfoBox>
      )}

      <EmailText>
        <strong>Job:</strong> {jobTitle}{'\n'}
        <strong>Property:</strong> {propertyName}{'\n'}
        <strong>Address:</strong> {propertyAddress}{'\n'}
        <strong>Scheduled Work Date:</strong> {scheduledDate}{'\n'}
        <strong>Notice Deadline:</strong> {deadlineDate}
      </EmailText>

      <EmailButton href={workOrderUrl}>
        {isOverdue ? 'View Work Order — Mark Notice Sent' : 'View Work Order'}
      </EmailButton>
    </BaseEmail>
  );
}

export default FortyEightHourAlertEmail;
