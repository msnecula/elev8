import { z } from 'zod';

export const USER_ROLES = ['admin', 'reviewer', 'dispatcher', 'technician', 'client'] as const;

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform(v => (v ? v : undefined));

// Shared by the admin "Add User" and "Edit User" forms.
export const adminUserSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Full name is required').max(255),
    email: z.string().trim().toLowerCase().email('Enter a valid email'),
    role: z.enum(USER_ROLES),
    phone: optionalText(50),
    accountId: z.string().uuid().optional().or(z.literal('').transform(() => undefined)),
    cccmLicense: optionalText(100),
    qeiNumber: optionalText(50),
  })
  .refine(v => v.role !== 'client' || !!v.accountId, {
    message: 'Clients must belong to a company account',
    path: ['accountId'],
  });

export type AdminUserInput = z.input<typeof adminUserSchema>;
export type AdminUserValues = z.output<typeof adminUserSchema>;

// What any signed-in user may change about themselves.
export const ownProfileSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required').max(255),
  phone: optionalText(50),
});

export const ownLicensesSchema = z.object({
  cccmLicense: optionalText(100),
  qeiNumber: optionalText(50),
});

export type OwnProfileInput = z.input<typeof ownProfileSchema>;
export type OwnLicensesInput = z.input<typeof ownLicensesSchema>;

export const passwordSchema = z
  .object({
    password: z.string().min(8, 'Use at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine(v => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// Only these one-time link types are accepted by /api/auth/confirm.
export const EMAIL_LINK_TYPES = ['invite', 'recovery'] as const;
export type EmailLinkType = (typeof EMAIL_LINK_TYPES)[number];

// Same-origin relative paths only, so a crafted link can't bounce users off-site.
export function safeNextPath(next: string | null | undefined, fallback = '/dashboard'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return fallback;
  return next;
}
