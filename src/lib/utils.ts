import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, isPast, isWithinInterval } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(
  date: Date | string | null | undefined,
  pattern = 'MMM d, yyyy',
): string {
  if (!date) return '—';
  try {
    return format(new Date(date), pattern);
  } catch {
    return '—';
  }
}

export function formatDateTime(date: Date | string | null | undefined): string {
  return formatDate(date, 'MMM d, yyyy h:mm a');
}

export function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return '—';
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return '—';
  }
}

export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(amount));
}

export function isWithinHours(
  date: Date | string | null | undefined,
  hours: number,
): boolean {
  if (!date) return false;
  const target = new Date(date);
  const now = new Date();
  return isWithinInterval(target, {
    start: now,
    end: new Date(now.getTime() + hours * 60 * 60 * 1000),
  });
}

export function isOverdue(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  return isPast(new Date(date));
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

export function toTitleCase(str: string): string {
  return str
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/\b\w/g, (l) => l.toUpperCase())
    .trim();
}

export function generateJobTitle(propertyName: string, workType: string): string {
  return `${toTitleCase(workType)} – ${propertyName}`;
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
