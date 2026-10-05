'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/lib/toast';
import { assignTechnician, findMatchingTechnicians } from '@/server/actions/dispatch';
import { Loader2, User, CheckCircle2, Star } from 'lucide-react';

interface TechnicianPickerProps {
  workOrderId: string;
  requiredSkillTag: string;
  region: string;
  currentTechnicianId?: string | null;
}

type TechMatch = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  skillTags: string[];
  regions: string[];
  isAvailable: boolean;
  matchScore: number;
};

export default function TechnicianPicker({
  workOrderId, requiredSkillTag, region, currentTechnicianId,
}: TechnicianPickerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [techs, setTechs] = useState<TechMatch[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);

  async function loadTechnicians() {
    setLoading(true);
    const result = await findMatchingTechnicians(requiredSkillTag, region);
    if (result.success) {
      setTechs(result.data);
    } else {
      toast.error('Could not load technicians');
    }
    setLoading(false);
  }

  function handleAssign(techId: string, techName: string) {
    setAssigning(techId);
    startTransition(async () => {
      const result = await assignTechnician({ workOrderId, technicianId: techId });
      if (result.success) {
        toast.success(`${techName} assigned — SMS notification sent`);
        router.refresh();
      } else {
        toast.error(result.error);
        setAssigning(null);
      }
    });
  }

  if (techs === null) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Find technicians matching <strong>{requiredSkillTag}</strong> in <strong>{region}</strong>.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={loadTechnicians}
          disabled={loading}
        >
          {loading
            ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Loading…</>
            : <><User className="h-4 w-4 mr-1.5" />Find Technicians</>}
        </Button>
      </div>
    );
  }

  if (techs.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No active technicians found.{' '}
        <button onClick={loadTechnicians} className="text-blue-600 hover:underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
          {techs.length} technician{techs.length !== 1 ? 's' : ''} found
        </p>
        <button onClick={loadTechnicians} className="text-xs text-blue-600 hover:underline">
          Refresh
        </button>
      </div>

      {techs.map(tech => {
        const isCurrent = tech.id === currentTechnicianId;
        const hasSkill = tech.skillTags.includes(requiredSkillTag);
        const hasRegion = tech.regions.includes(region);
        const isTopMatch = tech.matchScore >= 4;

        return (
          <div
            key={tech.id}
            className={`rounded-lg border p-3 space-y-2 transition-colors ${
              isCurrent ? 'border-green-300 bg-green-50' : 'border-border hover:bg-muted/30'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{tech.fullName}</span>
                  {isCurrent && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                  {isTopMatch && !isCurrent && (
                    <span className="flex items-center gap-0.5 text-xs text-amber-600 font-medium">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      Best match
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{tech.email}</p>
                {tech.phone && <p className="text-xs text-muted-foreground">{tech.phone}</p>}
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs font-semibold text-muted-foreground mb-1">
                  Score: {tech.matchScore}/5
                </div>
                {!isCurrent && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending || !tech.isAvailable}
                    onClick={() => handleAssign(tech.id, tech.fullName)}
                    className="h-7 text-xs"
                  >
                    {assigning === tech.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : 'Assign'}
                  </Button>
                )}
              </div>
            </div>

            {/* Match indicators */}
            <div className="flex flex-wrap gap-1">
              <Badge
                variant="secondary"
                className={`text-xs ${hasSkill ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}
              >
                {hasSkill ? '✓' : '✗'} {requiredSkillTag}
              </Badge>
              <Badge
                variant="secondary"
                className={`text-xs ${hasRegion ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}
              >
                {hasRegion ? '✓' : '✗'} {region}
              </Badge>
              <Badge
                variant="secondary"
                className={`text-xs ${tech.isAvailable ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-600'}`}
              >
                {tech.isAvailable ? 'Available' : 'Unavailable'}
              </Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
}
