import { BaseEmail, EmailHeading, EmailText, EmailButton, EmailInfoBox } from './BaseEmail';

interface ApprovalConfirmEmailProps {
  clientName: string;
  jobTitle: string;
  propertyName: string;
  totalAmount: string;
  jobUrl: string;
  nextStep: 'scheduling' | 'will_contact';
}

export function ApprovalConfirmEmail({
  clientName,
  jobTitle,
  propertyName,
  totalAmount,
  jobUrl,
  nextStep,
}: ApprovalConfirmEmailProps) {
  return (
    <BaseEmail preview={`Proposal approved — ${jobTitle}`}>
      <EmailHeading>Proposal Approved ✓</EmailHeading>

      <EmailText>Dear {clientName},</EmailText>

      <EmailText>
        Thank you for approving the proposal for <strong>{propertyName}</strong>.
        We are ready to move forward.
      </EmailText>

      <EmailText>
        <strong>Approved amount:</strong> {totalAmount}
      </EmailText>

      {nextStep === 'scheduling' ? (
        <EmailInfoBox variant="success">
          You can now request scheduling through your client portal. Please submit
          your preferred work dates and our dispatcher will confirm a time.
        </EmailInfoBox>
      ) : (
        <EmailInfoBox variant="success">
          Our team will be in touch shortly to coordinate scheduling.
        </EmailInfoBox>
      )}

      <EmailButton href={jobUrl}>View Job Status</EmailButton>
    </BaseEmail>
  );
}

export default ApprovalConfirmEmail;
