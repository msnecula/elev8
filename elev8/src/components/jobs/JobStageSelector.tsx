'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/lib/toast';
import { advanceJobStage } from '@/server/actions/jobs';
import { JOB_STAGE_LABELS } from '@/lib/constants';

const STAGES = Object.keys(JOB_STAGE_LABELS) as Array<keyof typeof JOB_STAGE_LABELS>;

export default function JobStageSelector({ jobId, currentStage }: { jobId: string; currentStage: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleChange(stage: string) {
    if (stage === currentStage) return;
    startTransition(async () => {
      const result = await advanceJobStage(jobId, stage);
      if (result.success) {
        toast.success('Stage updated');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Select value={currentStage} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger className="w-[180px] h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STAGES.map((stage) => (
          <SelectItem key={stage} value={stage} className="text-xs">
            {JOB_STAGE_LABELS[stage]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
