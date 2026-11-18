import { JSX, type ReactNode } from 'react';
import { getIntlLocale } from '@/modules/common/utils/locale';

type MetricCardTone = 'danger' | 'default' | 'emerald' | 'safe';

const metricCardToneClasses: Record<
  MetricCardTone,
  { label: string; shell: string; value: string }
> = {
  danger: {
    label: 'text-rose-700',
    shell: 'border-rose-200 bg-rose-50/90 shadow-sm',
    value: 'text-rose-950',
  },
  default: {
    label: 'text-muted-foreground',
    shell: 'border bg-background/80',
    value: 'text-foreground',
  },
  emerald: {
    label: 'text-emerald-700',
    shell: 'border-emerald-200 bg-emerald-50/90 shadow-sm',
    value: 'text-emerald-950',
  },
  safe: {
    label: 'text-amber-700',
    shell: 'border-amber-200 bg-amber-50/90 shadow-sm',
    value: 'text-amber-950',
  },
};

export const MetricCard = ({
  emphasize = false,
  label,
  value,
  tone = 'default',
}: {
  emphasize?: boolean;
  label: string;
  tone?: MetricCardTone;
  value: number | string;
}): JSX.Element => {
  const toneClasses = metricCardToneClasses[tone];

  return (
    <div
      className={`rounded-2xl p-4 ${toneClasses.shell} ${emphasize ? 'ring-1 ring-current/10' : ''}`}
    >
      <p className={`text-xs font-medium ${toneClasses.label}`}>{label}</p>
      <p
        className={`${emphasize ? 'text-3xl md:text-[2rem]' : 'text-2xl'} font-semibold ${toneClasses.value}`}
      >
        {value}
      </p>
    </div>
  );
};

export const FilterLabel = ({ children }: { children: ReactNode }): JSX.Element => (
  <label className="text-sm font-medium text-foreground">{children}</label>
);

export const formatDateTime = (value: string, locale: string): string => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
};
