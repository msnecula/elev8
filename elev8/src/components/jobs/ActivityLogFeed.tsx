import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { timeAgo } from '@/lib/utils';
import { ActivitySquare } from 'lucide-react';
import type { ActivityLog } from '../../../drizzle/schema/activity_logs';

type LogEntry = ActivityLog & { actorName?: string | null };

export default function ActivityLogFeed({ logs }: { logs: LogEntry[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ActivitySquare className="h-4 w-4 text-muted-foreground" />
          Activity Log
        </CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-xs text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <ol className="relative border-l border-border ml-2 space-y-4">
            {logs.map((log) => (
              <li key={log.id} className="ml-4">
                {/* Timeline dot */}
                <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-background bg-blue-400" />
                <div>
                  <p className="text-sm text-foreground">{log.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {log.actorName ? `${log.actorName} · ` : 'System · '}
                    {timeAgo(log.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
