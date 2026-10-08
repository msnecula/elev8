import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth';
import FormTemplateUploaderWrapper from './FormTemplateUploaderWrapper';

export const metadata: Metadata = { title: 'Form Templates' };

// page.tsx emits ZERO server-rendered JSX — just a module reference.
//
// WHY: The RSC wire format for this route was hitting React 19's
// "Maximum array nesting exceeded" limit.  Every piece of server JSX
// (PageHeader, wrapping divs) adds nesting levels to that payload.
// PageHeader is now inside FormsContent (a 'use client' file loaded
// with ssr:false), so the server emits only a module reference for it —
// no rendered JSX, no extra nesting.
export default async function FormTemplatesPage() {
  await requireRole('admin');
  return <FormTemplateUploaderWrapper />;
}
