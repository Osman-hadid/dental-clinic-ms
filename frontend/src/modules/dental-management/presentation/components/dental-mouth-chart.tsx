'use client';

import { JSX } from 'react';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utilities';
import { CircleDot, MousePointer2 } from 'lucide-react';

type MouthTooth = {
  color?: string;
  condition?: string;
  label: string;
  number: string;
};

type DentalMouthChartProps = {
  disabled?: boolean;
  lowerTeeth: MouthTooth[];
  onSelect: (toothNumber: string) => void;
  selectedToothNumber: string;
  upperTeeth: MouthTooth[];
};

const getToothKind = (number: string): 'incisor' | 'canine' | 'premolar' | 'molar' => {
  const position = Number(number[1]);
  if (position <= 2) return 'incisor';
  if (position === 3) return 'canine';
  if (position <= 5) return 'premolar';
  return 'molar';
};

const getArchOffset = (index: number, arch: 'lower' | 'upper'): string => {
  const distance = Math.min(index, 15 - index);
  const offset = distance === 0 ? 3 : distance === 1 ? 2 : distance === 2 ? 1 : 0;
  if (!offset) return '';
  if (arch === 'upper')
    return offset === 3 ? 'translate-y-3' : offset === 2 ? 'translate-y-2' : 'translate-y-1';
  return offset === 3 ? '-translate-y-3' : offset === 2 ? '-translate-y-2' : '-translate-y-1';
};

const withAlpha = (color: string, alpha: number): string => {
  const match = color.match(/^#([\da-f]{6})$/i);
  if (!match) return color;
  const value = Number.parseInt(match[1], 16);
  return `rgba(${value >> 16}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
};

const AnatomicTooth = ({
  arch,
  kind,
}: {
  arch: 'lower' | 'upper';
  kind: ReturnType<typeof getToothKind>;
}): JSX.Element => {
  const source = `/images/dental/teeth/${kind}-realistic-ui.png`;
  return (
    <span
      className={cn('relative block h-[4.8rem] w-full', arch === 'upper' && 'rotate-180')}
      aria-hidden="true"
    >
      <Image
        src={source}
        alt=""
        fill
        sizes="64px"
        className="object-contain drop-shadow-[0_3px_3px_rgba(76,58,26,0.2)]"
      />
    </span>
  );
};

export const DentalMouthChart = ({
  disabled = false,
  lowerTeeth,
  onSelect,
  selectedToothNumber,
  upperTeeth,
}: DentalMouthChartProps): JSX.Element => {
  const allTeeth = [...upperTeeth, ...lowerTeeth];
  const selectedTooth = allTeeth.find((tooth) => tooth.number === selectedToothNumber);
  const recordedConditions = allTeeth.reduce<{ color?: string; label: string }[]>(
    (conditions, tooth) => {
      if (tooth.condition && !conditions.some(({ label }) => label === tooth.condition)) {
        conditions.push({ color: tooth.color, label: tooth.condition });
      }
      return conditions;
    },
    []
  );

  const ToothButton = ({
    arch,
    index,
    tooth,
  }: {
    arch: 'lower' | 'upper';
    index: number;
    tooth: MouthTooth;
  }): JSX.Element => {
    const selected = selectedToothNumber === tooth.number;
    const kind = getToothKind(tooth.number);
    return (
      <button
        type="button"
        disabled={disabled}
        aria-pressed={selected}
        aria-label={`Tooth ${tooth.number}, ${tooth.label}, ${tooth.condition || 'No condition recorded'}`}
        title={`Tooth ${tooth.number} · ${tooth.label}`}
        onClick={() => {
          onSelect(tooth.number);
        }}
        className={cn(
          'group relative flex min-w-0 items-center justify-center rounded-xl border border-transparent outline-none transition-[background-color,border-color,box-shadow,transform] hover:-translate-y-0.5 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60',
          'h-20',
          getArchOffset(index, arch),
          selected && 'bg-primary/10 ring-2 ring-primary/70'
        )}
        style={
          tooth.color
            ? {
                backgroundColor: withAlpha(tooth.color, selected ? 0.12 : 0.055),
                borderColor: withAlpha(tooth.color, 0.45),
              }
            : undefined
        }
      >
        <AnatomicTooth arch={arch} kind={kind} />
        {tooth.color ? (
          <span
            className="absolute inset-x-[28%] bottom-1 z-20 h-1 rounded-full"
            style={{ backgroundColor: tooth.color }}
          />
        ) : null}
      </button>
    );
  };

  return (
    <div className="grid min-w-0 border-t bg-[#fbfcfb] dark:bg-background/30 lg:grid-cols-[12rem_minmax(0,1fr)]">
      <aside className="border-b bg-muted/25 p-4 lg:border-b-0 lg:border-e">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Diagnostic
        </p>
        <div className="mt-3 rounded-xl border bg-card p-3">
          {selectedTooth ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xl font-bold text-primary">{selectedTooth.number}</span>
                <Badge variant="outline">Selected</Badge>
              </div>
              <p className="mt-2 text-sm font-semibold">{selectedTooth.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {selectedTooth.condition || 'No condition recorded'}
              </p>
            </>
          ) : (
            <div className="py-2 text-center">
              <MousePointer2 className="mx-auto size-5 text-primary" />
              <p className="mt-2 text-xs font-medium">Select a tooth</p>
            </div>
          )}
        </div>
        <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Chart findings
        </p>
        <div className="mt-2 space-y-1.5">
          {recordedConditions.length > 0 ? (
            recordedConditions.map(({ color, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-lg border bg-card px-2.5 py-2 text-xs"
              >
                <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
                {label}
              </div>
            ))
          ) : (
            <p className="rounded-lg border border-dashed px-2.5 py-3 text-xs text-muted-foreground">
              No findings marked yet.
            </p>
          )}
        </div>
        <div className="mt-5 flex items-start gap-2 text-[11px] text-muted-foreground">
          <CircleDot className="mt-0.5 size-3.5 shrink-0" />
          <p>Color markers show recorded findings on each tooth.</p>
        </div>
      </aside>

      <div
        className="min-w-0 overflow-x-auto overscroll-x-contain p-4"
        role="region"
        aria-label="Interactive odontogram"
        tabIndex={0}
      >
        <div className="mx-auto min-w-[600px] max-w-[980px]" dir="ltr">
          <div className="mb-3 flex justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <span>Patient right</span>
            <span>Patient left</span>
          </div>
          <section className="rounded-2xl border border-border/80 bg-card p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between border-b border-border/60 px-2 pb-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-foreground">
                  Upper arch <span className="font-normal text-muted-foreground">· Maxillary</span>
                </p>
              </div>
              <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
                FDI
              </span>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 px-2 py-2">
              <div className="grid grid-cols-16 items-center gap-1">
                {upperTeeth.map((tooth, index) => (
                  <ToothButton
                    key={`upper-anatomic-${tooth.number}`}
                    arch="upper"
                    index={index}
                    tooth={tooth}
                  />
                ))}
              </div>
            </div>
          </section>
          <div className="my-3 grid grid-cols-16 gap-1 border-y bg-muted/35 py-2">
            {upperTeeth.map((tooth, index) => (
              <button
                key={`number-${tooth.number}`}
                type="button"
                onClick={() => {
                  onSelect(tooth.number);
                }}
                className={cn(
                  'relative text-xs font-semibold tabular-nums text-muted-foreground',
                  selectedToothNumber === tooth.number && 'text-primary'
                )}
              >
                <span>{tooth.number}</span>
                {index === 7 ? (
                  <span className="absolute -end-1.5 -top-2 h-8 border-e border-dashed border-primary/40" />
                ) : null}
              </button>
            ))}
          </div>
          <section className="mt-3 rounded-2xl border border-border/80 bg-card p-3 shadow-sm">
            <div className="rounded-xl border border-border/60 bg-muted/20 px-2 py-2">
              <div className="grid grid-cols-16 items-center gap-1">
                {lowerTeeth.map((tooth, index) => (
                  <ToothButton
                    key={`lower-anatomic-${tooth.number}`}
                    arch="lower"
                    index={index}
                    tooth={tooth}
                  />
                ))}
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-border/60 px-2 pt-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-foreground">
                  Lower arch <span className="font-normal text-muted-foreground">· Mandibular</span>
                </p>
              </div>
              <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
                FDI
              </span>
            </div>
          </section>
          <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
            <span className="h-px w-10 bg-border" />
            Permanent dentition · FDI numbering
            <span className="h-px w-10 bg-border" />
          </div>
        </div>
      </div>
    </div>
  );
};
