// GET /api/form-templates/status
//
// Plain Next.js Route Handler — returns JSON only, zero RSC pipeline.
//
// WHY NOT A SERVER ACTION: see upload/route.ts for the full explanation.
// Short version: server actions always trigger RSC re-renders which hit
// "Maximum array nesting exceeded" on /settings/forms.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

const BUCKET = 'form-templates';
const FORM_TYPES = [
  'eu632','eu787','eu776a','eu776b','dosh100',
  'eu215','eu237','eu471','firelog','suspension','eu943',
];

export async function GET(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !['admin', 'dispatcher'].includes(user.role)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { createServiceClient } = await import('@/lib/supabase/server');
  const supabase = createServiceClient();

  const { data: files, error } = await supabase.storage
    .from(BUCKET)
    .list('', { limit: 50 });

  if (error) {
    return NextResponse.json({ success: false, error: `Storage list failed: ${error.message}` }, { status: 500 });
  }

  const result: Record<string, { uploaded: boolean; updatedAt?: string }> = {};
  for (const formType of FORM_TYPES) {
    const file = files?.find(f => f.name === `${formType}.pdf`);
    result[formType] = {
      uploaded: !!file,
      updatedAt: file?.updated_at ?? undefined,
    };
  }

  return NextResponse.json({ success: true, data: result });
}
