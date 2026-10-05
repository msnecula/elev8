import { Text, Section } from '@react-email/components';
import {
  BaseEmail, EmailHeading, EmailText, EmailButton,
  EmailDivider, EmailInfoBox,
} from './BaseEmail';

interface ProposalEmailProps {
  clientName: string;
  jobTitle: string;
  propertyName: string;
  proposalBody: string;
  totalAmount: string;
  proposalUrl: string;
  expiresDate: string;
  version: number;
}

export function ProposalEmail({
  clientName,
  jobTitle,
  propertyName,
  proposalBody,
  totalAmount,
  proposalUrl,
  expiresDate,
  version,
}: ProposalEmailProps) {
  return (
    <BaseEmail
      preview={`Proposal ready for your review — ${jobTitle}`}
      footerNote={`This proposal expires on ${expiresDate}.`}
    >
      <EmailHeading>Your Proposal is Ready</EmailHeading>

      <EmailText>Dear {clientName},</EmailText>

      <EmailText>
        We have prepared a proposal for elevator compliance work at{' '}
        <strong>{propertyName}</strong>. Please review the details below and
        approve or request changes at your convenience.
      </EmailText>

      {/* Proposal body */}
      <Section style={{
        backgroundColor: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: '6px',
        padding: '20px',
        margin: '0 0 24px 0',
      }}>
        <Text style={{
          fontSize: '14px',
          color: '#111827',
          lineHeight: '1.7',
          whiteSpace: 'pre-line',
          margin: 0,
        }}>
          {proposalBody}
        </Text>
      </Section>

      <EmailDivider />

      {/* Total */}
      <Section style={{ textAlign: 'right', margin: '0 0 24px 0' }}>
        <Text style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 4px 0' }}>
          Proposal Total
        </Text>
        <Text style={{ fontSize: '28px', fontWeight: '700', color: '#111827', margin: 0 }}>
          {totalAmount}
        </Text>
        {version > 1 && (
          <Text style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0 0' }}>
            Version {version}
          </Text>
        )}
      </Section>

      <EmailButton href={proposalUrl}>
        Review &amp; Approve Proposal
      </EmailButton>

      <EmailInfoBox variant="info">
        You can approve, request changes, or decline this proposal through the secure link above.
        This proposal expires on {expiresDate}.
      </EmailInfoBox>
    </BaseEmail>
  );
}

export default ProposalEmail;
