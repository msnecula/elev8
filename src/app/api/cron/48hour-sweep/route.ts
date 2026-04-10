import { NextResponse } from 'next/server';
import { sweepFortyEightHourNotices } from '@/server/services/fortyEightHour';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await sweepFortyEightHourNotices();
    return NextResponse.json({
      success: true,
      marked_overdue: result.marked_overdue,
      alerts_sent: result.alerts_sent,
      errors: result.errors,
      ran_at: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
