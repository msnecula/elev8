import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import { APP_NAME } from '@/lib/constants';

interface BaseEmailProps {
  preview: string;
  children: React.ReactNode;
  footerNote?: string;
}

const brandBlue = '#2563eb';
const borderColor = '#e5e7eb';
const textColor = '#111827';
const mutedColor = '#6b7280';

export function BaseEmail({ preview, children, footerNote }: BaseEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: '#f9fafb', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', margin: 0, padding: '40px 0' }}>
        <Container style={{ maxWidth: '560px', margin: '0 auto', backgroundColor: '#ffffff', borderRadius: '8px', border: `1px solid ${borderColor}`, overflow: 'hidden' }}>
          {/* Header */}
          <Section style={{ backgroundColor: brandBlue, padding: '24px 32px' }}>
            <Text style={{ color: '#ffffff', fontSize: '18px', fontWeight: '700', margin: 0 }}>
              {APP_NAME}
            </Text>
          </Section>

          {/* Content */}
          <Section style={{ padding: '32px 32px 24px' }}>
            {children}
          </Section>

          {/* Footer */}
          <Section style={{ borderTop: `1px solid ${borderColor}`, padding: '16px 32px', backgroundColor: '#f9fafb' }}>
            {footerNote && (
              <Text style={{ fontSize: '12px', color: mutedColor, margin: '0 0 8px 0' }}>
                {footerNote}
              </Text>
            )}
            <Text style={{ fontSize: '12px', color: mutedColor, margin: 0 }}>
              This email was sent by {APP_NAME}. Please do not reply directly to this email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Re-usable email primitives
export function EmailHeading({ children }: { children: React.ReactNode }) {
  return (
    <Heading style={{ fontSize: '20px', fontWeight: '700', color: textColor, margin: '0 0 16px 0' }}>
      {children}
    </Heading>
  );
}

export function EmailText({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <Text style={{ fontSize: '15px', lineHeight: '1.6', color: textColor, margin: '0 0 16px 0', ...style }}>
      {children}
    </Text>
  );
}

export function EmailDivider() {
  return <Hr style={{ borderColor, margin: '24px 0' }} />;
}

export function EmailButton({ href, children }: { href: string; children: string }) {
  return (
    <Section style={{ textAlign: 'center', margin: '24px 0' }}>
      <Link
        href={href}
        style={{
          backgroundColor: brandBlue,
          color: '#ffffff',
          padding: '12px 28px',
          borderRadius: '6px',
          fontSize: '15px',
          fontWeight: '600',
          textDecoration: 'none',
          display: 'inline-block',
        }}
      >
        {children}
      </Link>
    </Section>
  );
}

export function EmailInfoBox({
  children,
  variant = 'info',
}: {
  children: React.ReactNode;
  variant?: 'info' | 'warning' | 'success' | 'danger';
}) {
  const styles = {
    info:    { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' },
    warning: { bg: '#fffbeb', border: '#fcd34d', text: '#92400e' },
    success: { bg: '#f0fdf4', border: '#86efac', text: '#166534' },
    danger:  { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b' },
  }[variant];

  return (
    <Section style={{
      backgroundColor: styles.bg,
      border: `1px solid ${styles.border}`,
      borderRadius: '6px',
      padding: '12px 16px',
      margin: '0 0 16px 0',
    }}>
      <Text style={{ fontSize: '14px', color: styles.text, margin: 0, lineHeight: '1.5' }}>
        {children}
      </Text>
    </Section>
  );
}
