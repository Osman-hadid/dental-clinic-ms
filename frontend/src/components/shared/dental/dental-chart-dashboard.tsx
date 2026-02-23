'use client';

import { JSX, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utilities';
import { Eraser, Paintbrush } from 'lucide-react';

type ConditionKey =
  | 'caries'
  | 'surgery'
  | 'implant'
  | 'gingivitis'
  | 'periodontitis'
  | 'removal'
  | 'periostitis';

type ConditionMeta = {
  color: string;
  label: string;
};

const CONDITIONS: Record<ConditionKey, ConditionMeta> = {
  caries: { color: '#4ade80', label: 'Caries' },
  gingivitis: { color: '#f87171', label: 'Gingivitis' },
  implant: { color: '#c084fc', label: 'Implant' },
  periostitis: { color: '#8b5e3c', label: 'Periostitis' },
  periodontitis: { color: '#67e8f9', label: 'Periodontitis' },
  removal: { color: '#cbd5e1', label: 'Removal' },
  surgery: { color: '#f9a8d4', label: 'Surgery' },
};

const UPPER_ARCH = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'];
const LOWER_ARCH = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'];
const ALL_TEETH = [...UPPER_ARCH, ...LOWER_ARCH];

const DEFAULT_CONDITIONS: Record<string, ConditionKey | null> = {
  '14': 'caries',
  '25': 'implant',
  '26': 'surgery',
  '33': 'implant',
  '35': 'periodontitis',
  '46': 'caries',
  '48': 'gingivitis',
};

const getToothRegion = (toothId: string): 'Maxilla' | 'Mandible' => {
  const firstDigit = Number(toothId[0]);
  return firstDigit <= 2 ? 'Maxilla' : 'Mandible';
};

const buildInitialState = (): Record<string, ConditionKey | null> => {
  const initial: Record<string, ConditionKey | null> = {};

  for (const toothId of ALL_TEETH) {
    initial[toothId] = DEFAULT_CONDITIONS[toothId] ?? null;
  }

  return initial;
};

type ArchRowProps = {
  label: string;
  selectedToothId: string;
  toothConditions: Record<string, ConditionKey | null>;
  toothIds: string[];
  onSelectTooth: (toothId: string) => void;
};

const ArchRow = ({
  label,
  onSelectTooth,
  selectedToothId,
  toothConditions,
  toothIds,
}: ArchRowProps): JSX.Element => {
  return (
    <div className="rounded-xl border bg-muted/30 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="grid grid-cols-8 gap-2 sm:grid-cols-16">
        {toothIds.map((toothId) => {
          const condition = toothConditions[toothId];
          const isSelected = selectedToothId === toothId;

          return (
            <button
              key={toothId}
              type="button"
              onClick={() => {
                onSelectTooth(toothId);
              }}
              className={cn(
                'relative h-12 min-w-0 rounded-lg border text-[10px] font-medium transition hover:scale-[1.03] active:scale-[0.98]',
                isSelected ? 'ring-2 ring-offset-1' : ''
              )}
              style={{
                backgroundColor: condition ? `${CONDITIONS[condition].color}33` : '#FFFFFF',
                borderColor: condition ? CONDITIONS[condition].color : '#d4d4d8',
                color: '#1f2937',
                boxShadow: isSelected ? `0 0 0 2px ${condition ? CONDITIONS[condition].color : '#94a3b8'}` : 'none',
              }}
              aria-label={`Tooth ${toothId}`}
            >
              <span className="absolute left-1 top-1 text-[9px] leading-none">{toothId}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const DentalChartDashboard = (): JSX.Element => {
  const [activeCondition, setActiveCondition] = useState<ConditionKey>('implant');
  const [selectedToothId, setSelectedToothId] = useState<string>('25');
  const [toothConditions, setToothConditions] = useState<Record<string, ConditionKey | null>>(
    buildInitialState
  );

  const selectedCondition = toothConditions[selectedToothId];
  const selectedRegion = getToothRegion(selectedToothId);

  const conditionStats = useMemo(() => {
    const total = ALL_TEETH.length;

    return (Object.keys(CONDITIONS) as ConditionKey[]).map((key) => {
      const count = Object.values(toothConditions).filter((condition) => condition === key).length;
      return {
        count,
        key,
        percent: Math.round((count / total) * 100),
      };
    });
  }, [toothConditions]);

  const paintTooth = (toothId: string): void => {
    setSelectedToothId(toothId);
    setToothConditions((previous) => ({
      ...previous,
      [toothId]: activeCondition,
    }));
  };

  const clearSelectedTooth = (): void => {
    setToothConditions((previous) => ({
      ...previous,
      [selectedToothId]: null,
    }));
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
      <Card className="py-4">
        <CardHeader className="px-4">
          <CardTitle>Dental Chart</CardTitle>
          <CardDescription>Select a condition color, then click a tooth.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-background p-2">
            {(Object.keys(CONDITIONS) as ConditionKey[]).map((conditionKey) => {
              const condition = CONDITIONS[conditionKey];
              const isActive = conditionKey === activeCondition;
              return (
                <Button
                  key={conditionKey}
                  type="button"
                  variant={isActive ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setActiveCondition(conditionKey);
                  }}
                  className="gap-2"
                >
                  <span
                    className="size-2.5 rounded-full border"
                    style={{ backgroundColor: condition.color, borderColor: condition.color }}
                  />
                  {condition.label}
                </Button>
              );
            })}
            <Button type="button" variant="outline" size="sm" onClick={clearSelectedTooth} className="ml-auto gap-2">
              <Eraser className="size-4" />
              Clear Selected
            </Button>
          </div>

          <ArchRow
            label="Maxilla"
            selectedToothId={selectedToothId}
            toothConditions={toothConditions}
            toothIds={UPPER_ARCH}
            onSelectTooth={paintTooth}
          />
          <ArchRow
            label="Mandible"
            selectedToothId={selectedToothId}
            toothConditions={toothConditions}
            toothIds={LOWER_ARCH}
            onSelectTooth={paintTooth}
          />

          <div className="grid gap-3 rounded-xl border bg-background p-4 sm:grid-cols-2 lg:grid-cols-4">
            {conditionStats.map(({ count, key, percent }) => (
              <div key={key}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium">{CONDITIONS[key].label}</span>
                  <span>{percent}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      backgroundColor: CONDITIONS[key].color,
                      width: `${percent}%`,
                    }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{count} teeth</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="py-4">
        <CardHeader className="px-4">
          <CardTitle>Selected</CardTitle>
          <CardDescription>Tooth details and current issue.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4">
          <div className="rounded-lg border bg-background p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">
                {selectedRegion} {selectedToothId}
              </p>
              {selectedCondition ? (
                <Badge style={{ backgroundColor: CONDITIONS[selectedCondition].color, color: '#111827' }}>
                  {CONDITIONS[selectedCondition].label}
                </Badge>
              ) : (
                <Badge variant="outline">Healthy</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Last manipulation: {new Date().toLocaleDateString()}</p>
          </div>

          <div className="space-y-2 rounded-lg border bg-background p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Doctor</span>
              <span className="font-medium">Dr. Jeeves Wooster</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Planned action</span>
              <span className="font-medium">{selectedCondition ? CONDITIONS[selectedCondition].label : 'Monitoring'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Material</span>
              <span className="font-medium">Nobel Replace Tapered</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Session</span>
              <span className="font-medium">#1</span>
            </div>
          </div>

          <div className="rounded-lg border bg-background p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Paintbrush className="size-4" />
              Paint mode
            </p>
            <p className="text-xs text-muted-foreground">
              Active condition: <span className="font-medium">{CONDITIONS[activeCondition].label}</span>. Click any tooth to apply this color.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
