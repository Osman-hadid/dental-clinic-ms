import { JSX } from 'react';
import { cn } from '@/lib/utilities';

type LoadingStateProps = {
  className?: string;
  compact?: boolean;
  description?: string;
  fullPage?: boolean;
  title?: string;
};

export const LoadingState = ({
  className,
  compact = false,
  description = 'Preparing data and interface details.',
  fullPage = false,
  title = 'Loading',
}: LoadingStateProps): JSX.Element => {
  const content = (
    <div
      className={cn(
        'relative overflow-hidden rounded-[1.75rem] border border-border/70 bg-card shadow-sm',
        compact ? 'p-4' : 'p-5 md:p-6',
        className
      )}
    >
      <div className="absolute inset-x-6 top-0 h-px bg-border/60" />
      <div className="relative flex flex-col items-center gap-4 text-center">
        <div className={cn('sourire-cube-loader', compact ? 'sourire-cube-loader--compact' : 'sourire-cube-loader--regular')}>
          <div className="sourire-cube-loader__shadow" aria-hidden="true" />
          <div className="sourire-cube-loader__box" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <p className={cn('font-semibold tracking-[0.34em] uppercase text-foreground/80', compact ? 'text-[0.58rem]' : 'text-[0.72rem]')}>
            Sourire
          </p>
        </div>

        <div className="min-w-0 w-full space-y-3">
          <div className="space-y-1">
            <p className={cn('font-semibold tracking-tight text-foreground', compact ? 'text-sm' : 'text-base')}>
              {title}
            </p>
            <p className={cn('text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>
              {description}
            </p>
          </div>

          <div className="mx-auto w-full max-w-sm space-y-2">
            <div className="h-2 rounded-full bg-muted animate-pulse" style={{ width: compact ? '78%' : '86%' }} />
            <div className="h-2 rounded-full bg-muted/80 animate-pulse [animation-delay:120ms]" style={{ width: compact ? '58%' : '68%' }} />
            {!compact ? (
              <div className="h-2 rounded-full bg-muted/70 animate-pulse [animation-delay:220ms]" style={{ width: '42%' }} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  if (!fullPage) {
    return content;
  }

  return (
    <div className="flex min-h-[calc(100svh-5rem)] items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        {content}
      </div>
    </div>
  );
};
