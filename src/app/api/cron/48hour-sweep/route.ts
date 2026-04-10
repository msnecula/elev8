import { NextResponse } from 'next/server';
import { sweepFortyEightHourNotices } from '@/server/services/fortyEightHour';

/**
 * GET /api/cron/48hour-sweep
 *
 * Triggered by Vercel Cron (or any scheduler) every 30 minutes.
 * Protected by CRON_SECRET in Authorization header.
 *
 * Vercel cron config (vercel.json):
 * {
 *   "crons": [{ "path": "/api/cron/48hour-sweep", "schedule": "*/30 * * * *" }]
 * }
 *
 * The Authorization header must match: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await sweepFortyEightHourNotices();

    console.log(
      `[48hr sweep] marked_overdue=${result.marked_overdue} alerts_sent=${result.alerts_sent} errors=${result.errors.length}`,
    );

    if (result.errors.length > 0) {
      console.error('[48hr sweep] Errors:', result.errors);
    }

    return NextResponse.json({
      success: true,
      marked_overdue: result.marked_overdue,
      alerts_sent: result.alerts_sent,
      errors: result.errors,
      ran_at: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[48hr sweep] Fatal error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
