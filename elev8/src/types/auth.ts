export type UserRole =
  | 'admin'
  | 'reviewer'
  | 'dispatcher'
  | 'technician'
  | 'client';

export type SessionUser = {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
  accountId: string | null;
};

export type UserProfile = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  accountId: string | null;
  phone: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};
