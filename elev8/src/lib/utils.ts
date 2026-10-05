import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, isAfter, addHours } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a date/string with a date-fns format string */
export function formatDate(
  date: Date | string | null | undefined,
  fmt = 'MMM d, yyyy'
): string {
  if (!date) return '—';
  try {
    return format(new Date(date), fmt);
  } catch {
    return String(date);
  }
}

/** "3 hours ago" style relative time */
export function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return '—';
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return String(date);
  }
}

/** True if date is within N hours from now */
export function isWithinHours(
  date: Date | string | null | undefined,
  hours: number
): boolean {
  if (!date) return false;
  try {
    const d = new Date(date);
    const cutoff = addHours(new Date(), hours);
    return !isAfter(d, cutoff);
  } catch {
    return false;
  }
}

/** True if date is in the past */
export function isOverdue(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  try {
    return isAfter(new Date(), new Date(date));
  } catch {
    return false;
  }
}

/** Format bytes to human-readable string */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** Format a number as USD currency */
export function formatCurrency(
  amount: number | null | undefined,
  currency = 'USD'
): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Truncate a string with ellipsis */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 3)}...`;
}

/** Generate initials from a name */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/** Generate a job title from notice type and property info */
export function generateJobTitle(
  noticeType: string,
  propertyName?: string | null
): string {
  const type = noticeType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  if (propertyName) {
    return `${type} – ${propertyName}`;
  }
  return type;
}
