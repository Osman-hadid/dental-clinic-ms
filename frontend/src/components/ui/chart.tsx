'use client';

import * as React from 'react';
import { cn } from '@/lib/utilities';
import {
  Legend as RechartsLegend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';

export type ChartConfig = Record<
  string,
  {
    color?: string;
    label?: React.ReactNode;
  }
>;

type ChartContextValue = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextValue | null>(null);

const useChart = (): ChartContextValue => {
  const context = React.useContext(ChartContext);
  if (!context) {
    throw new Error('Chart components must be used inside ChartContainer.');
  }
  return context;
};

type ChartContainerProps = React.ComponentProps<'div'> & {
  config: ChartConfig;
};

const ChartContainer = React.forwardRef<HTMLDivElement, ChartContainerProps>(
  ({ children, className, config, style, ...props }, ref) => {
    const colorVariables = Object.entries(config).reduce<Record<string, string>>((accumulator, [key, value]) => {
      if (value.color) {
        accumulator[`--color-${key}`] = value.color;
      }
      return accumulator;
    }, {});

    return (
      <ChartContext.Provider value={{ config }}>
        <div
          ref={ref}
          className={cn(
            'flex min-h-[250px] w-full items-center justify-center text-xs [&_.recharts-pie-label-text]:fill-foreground [&_.recharts-sector]:outline-none',
            className
          )}
          style={{ ...(style ?? {}), ...(colorVariables as React.CSSProperties) }}
          {...props}
        >
          <ResponsiveContainer width="100%" height="100%">
            {children as React.ReactElement}
          </ResponsiveContainer>
        </div>
      </ChartContext.Provider>
    );
  }
);
ChartContainer.displayName = 'ChartContainer';

const ChartTooltip = RechartsTooltip;
const ChartLegend = RechartsLegend;

type ChartTooltipContentProps = React.ComponentProps<'div'> &
  {
    active?: boolean;
    hideLabel?: boolean;
    indicator?: 'dot' | 'line';
    label?: React.ReactNode;
    labelFormatter?: (value: unknown) => React.ReactNode;
    nameKey?: string;
    payload?: Array<any>;
  };

const ChartTooltipContent = React.forwardRef<HTMLDivElement, ChartTooltipContentProps>(
  ({ active, className, hideLabel = false, indicator = 'dot', label, labelFormatter, nameKey, payload }, ref) => {
    const { config } = useChart();

    if (!active || !payload?.length) {
      return null;
    }

    const first = payload[0];
    const firstPayload = (first?.payload ?? {}) as Record<string, unknown>;
    const firstKey = String(nameKey ? firstPayload[nameKey] ?? first?.name ?? '' : first?.name ?? first?.dataKey ?? '');
    const labelText = label ?? config[firstKey]?.label ?? firstKey;
    const renderedLabel = labelFormatter ? labelFormatter(labelText) : labelText;

    return (
      <div
        ref={ref}
        className={cn('grid min-w-36 gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs shadow-sm', className)}
      >
        {!hideLabel ? <div className="font-medium text-foreground">{renderedLabel}</div> : null}
        <div className="grid gap-1">
          {payload.map((item: any, index: number) => {
            const itemPayload = (item?.payload ?? {}) as Record<string, unknown>;
            const rawKey = String(nameKey ? itemPayload[nameKey] ?? item?.name ?? '' : item?.name ?? item?.dataKey ?? index);
            const cfg = config[rawKey] ?? config[String(item?.dataKey ?? '')];
            const color = String(item?.color ?? itemPayload.fill ?? cfg?.color ?? 'var(--muted-foreground)');
            const value = Number(item?.value ?? 0);

            return (
              <div key={`chart-tooltip-item-${index}`} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  {indicator === 'line' ? (
                    <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: color }} />
                  ) : (
                    <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
                  )}
                  <span>{cfg?.label ?? rawKey}</span>
                </div>
                <span className="font-medium text-foreground">{value.toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);
ChartTooltipContent.displayName = 'ChartTooltipContent';

type ChartLegendContentProps = React.ComponentProps<'div'> & {
  hideIcon?: boolean;
  payload?: Array<any>;
};

const ChartLegendContent = React.forwardRef<HTMLDivElement, ChartLegendContentProps>(
  ({ className, hideIcon = false, payload }, ref) => {
    const { config } = useChart();

    if (!payload?.length) {
      return null;
    }

    return (
      <div
        ref={ref}
        className={cn('flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground', className)}
      >
        {payload.map((item: any, index: number) => {
          const itemKey = String(item?.dataKey ?? item?.value ?? index);
          const cfg = config[itemKey];
          const color = String(item?.color ?? cfg?.color ?? 'var(--muted-foreground)');

          return (
            <div key={`chart-legend-item-${index}`} className="flex items-center gap-1.5">
              {hideIcon ? null : (
                <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
              )}
              <span>{String(cfg?.label ?? item?.value ?? itemKey)}</span>
            </div>
          );
        })}
      </div>
    );
  }
);
ChartLegendContent.displayName = 'ChartLegendContent';

export { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent };
