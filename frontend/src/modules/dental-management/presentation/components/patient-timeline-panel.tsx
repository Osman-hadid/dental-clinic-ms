import { JSX, KeyboardEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CalendarDays,
  ClipboardCheck,
  FileText,
  HeartPulse,
  Stethoscope,
  Wallet,
} from 'lucide-react';

export type PatientTimelineItemTone = 'danger' | 'default' | 'info' | 'safe' | 'warning';

export type PatientTimelineItem = {
  actionLabel?: string;
  amountLabel?: string;
  badge?: string;
  description?: string;
  href?: string;
  id: string;
  kind: 'appointment' | 'invoice' | 'payment' | 'prescription' | 'task' | 'treatment' | 'visit';
  occurredAt: string;
  subtitle?: string;
  title: string;
  tone?: PatientTimelineItemTone;
  visitId?: string;
};

type Props = {
  isLoading: boolean;
  items: PatientTimelineItem[];
  onOpenVisit: (visitId: string) => void;
  stats: {
    appointments: number;
    events: number;
    payments: number;
    tasks: number;
    visits: number;
  };
};

const toneClasses: Record<PatientTimelineItemTone, string> = {
  danger: 'border-rose-200 bg-rose-50 text-rose-700',
  default: 'border-border bg-background text-foreground',
  info: 'border-sky-200 bg-sky-50 text-sky-700',
  safe: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
};

const kindMeta = {
  appointment: { icon: CalendarDays, label: 'Appointment' },
  invoice: { icon: Wallet, label: 'Invoice' },
  payment: { icon: Wallet, label: 'Payment' },
  prescription: { icon: FileText, label: 'Prescription' },
  task: { icon: ClipboardCheck, label: 'Task' },
  treatment: { icon: Stethoscope, label: 'Treatment' },
  visit: { icon: HeartPulse, label: 'Visit' },
} as const;

const formatDateTime = (value: string): string => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  const hasTime = value.includes('T') || value.includes(':');

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    ...(hasTime ? { timeStyle: 'short' } : {}),
  }).format(parsed);
};

export const PatientTimelinePanel = ({
  isLoading,
  items,
  onOpenVisit,
  stats,
}: Props): JSX.Element => {
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const router = useRouter();

  const openTimelineItem = (item: PatientTimelineItem): void => {
    if (item.href) {
      router.push(item.href);
      return;
    }
    if (item.visitId) {
      onOpenVisit(item.visitId);
    }
  };

  const handleTimelineItemKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    item: PatientTimelineItem
  ): void => {
    if (!item.href && !item.visitId) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openTimelineItem(item);
  };

  return (
  <Card className="min-w-0 w-full overflow-hidden border-border bg-card text-card-foreground">
    <CardHeader className="pb-2">
      <CardTitle className="flex items-center justify-between text-base">
        <span>Unified Timeline</span>
        <HeartPulse className="size-4 text-primary" />
      </CardTitle>
      <CardDescription>
        Follow appointments, chairside work, prescriptions, payments, and tasks in one chronological stream.
      </CardDescription>
    </CardHeader>
    <CardContent className="min-w-0 space-y-4 overflow-x-hidden">
      <div className="grid gap-2 rounded-lg border border-border/70 bg-muted/15 p-3 text-xs grid-cols-2">
        <p className="text-muted-foreground">
          Events
          <span className="mt-1 block text-sm font-semibold text-foreground">{stats.events}</span>
        </p>
        <p className="text-muted-foreground">
          Appointments
          <span className="mt-1 block text-sm font-semibold text-foreground">{stats.appointments}</span>
        </p>
        <p className="text-muted-foreground">
          Visits
          <span className="mt-1 block text-sm font-semibold text-foreground">{stats.visits}</span>
        </p>
        <p className="text-muted-foreground">
          Payments
          <span className="mt-1 block text-sm font-semibold text-foreground">{stats.payments}</span>
        </p>
        <p className="text-muted-foreground">
          Tasks
          <span className="mt-1 block text-sm font-semibold text-foreground">{stats.tasks}</span>
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading patient timeline...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No timeline activity recorded yet.</p>
      ) : (
        <div className="max-w-full overflow-hidden rounded-xl border border-border/70 bg-background/70 p-3 sm:p-4">
          <div className="w-full overflow-x-auto overflow-y-visible overscroll-x-contain pb-3">
            <div className="relative h-56 w-max min-w-full px-6 sm:px-8">
                <div className="absolute left-10 right-10 top-[6.1rem] h-1 rounded-full bg-border/80 sm:left-12 sm:right-12" />
                <div className="relative z-10 flex h-full items-start">
                  {items.map((item, index) => {
                    const meta = kindMeta[item.kind];
                    const Icon = meta.icon;
                    const tone = toneClasses[item.tone ?? 'default'];
                    const isActive = activeItemId === item.id;
                    const isInteractive = Boolean(item.href || item.visitId);

                    return (
                      <div
                        key={item.id}
                        className={`relative flex w-[7rem] shrink-0 flex-col items-center pt-24 sm:w-[8.25rem] ${isInteractive ? 'cursor-pointer' : ''}`}
                        onMouseEnter={() => {
                          setActiveItemId(item.id);
                        }}
                        onMouseLeave={() => {
                          setActiveItemId((current) => (current === item.id ? null : current));
                        }}
                        onFocus={() => {
                          setActiveItemId(item.id);
                        }}
                        onBlur={() => {
                          setActiveItemId((current) => (current === item.id ? null : current));
                        }}
                        onClick={() => {
                          openTimelineItem(item);
                        }}
                        onKeyDown={(event) => {
                          handleTimelineItemKeyDown(event, item);
                        }}
                        role={isInteractive ? 'button' : undefined}
                        tabIndex={isInteractive ? 0 : undefined}
                      >
                        <div
                          className={`absolute bottom-full left-1/2 z-20 w-64 max-w-[calc(100vw-4rem)] -translate-x-1/2 pb-3 transition-opacity duration-150 ${
                            isActive ? 'visible opacity-100 pointer-events-auto' : 'invisible opacity-0 pointer-events-none'
                          }`}
                        >
                          <div className={`rounded-xl border border-border/80 bg-background p-3 shadow-xl ${isInteractive ? 'transition hover:border-primary/40 hover:bg-accent/10' : ''}`}>
                            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                                    Step {index + 1}
                                  </span>
                                  <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(item.occurredAt)}</p>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
                                  {item.badge || meta.label}
                                </span>
                                {item.amountLabel ? (
                                  <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-semibold text-foreground">
                                    {item.amountLabel}
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            {item.subtitle ? (
                              <p className="text-xs font-medium text-foreground/80">{item.subtitle}</p>
                            ) : null}
                            {item.description ? (
                              <p className={`whitespace-pre-wrap text-xs text-muted-foreground ${item.subtitle ? 'mt-1.5' : ''}`}>
                                {item.description}
                              </p>
                            ) : null}

                            {item.href ? (
                              <p className="mt-3 text-[11px] font-semibold text-primary">
                                {item.actionLabel || 'Open details'}
                              </p>
                            ) : item.visitId ? (
                              <p className="mt-3 text-[11px] font-semibold text-primary">
                                Open Visit
                              </p>
                            ) : null}

                            <div className="absolute left-1/2 top-full h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-border bg-background" />
                          </div>
                        </div>

                        <div className={`relative z-10 flex size-11 items-center justify-center rounded-full border-[3px] shadow-sm transition-transform duration-150 ${isActive ? 'scale-110' : ''} ${tone}`}>
                          <Icon className="size-5" />
                        </div>
                        <p className="mt-3 text-center text-xs font-semibold text-foreground">{item.badge || meta.label}</p>
                        <p className="mt-1 max-w-32 text-center text-[10px] text-muted-foreground">
                          {formatDateTime(item.occurredAt)}
                        </p>
                      </div>
                    );
                  })}
                </div>
            </div>
          </div>
        </div>
      )}
    </CardContent>
  </Card>
  );
};
