'use client';

import * as React from 'react';
import { JSX } from 'react';
import { useTheme } from 'next-themes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utilities';
import { LaptopMinimal, MoonStar, Palette, SunMedium } from 'lucide-react';

const themeOptions = [
  {
    description: 'Bright, clean surfaces for daytime work.',
    icon: SunMedium,
    label: 'Light',
    value: 'light',
  },
  {
    description: 'Low-glare contrast tuned for long sessions.',
    icon: MoonStar,
    label: 'Dark',
    value: 'dark',
  },
  {
    description: 'Automatically match your device appearance.',
    icon: LaptopMinimal,
    label: 'System',
    value: 'system',
  },
] as const;

export const ThemeToggle = (): JSX.Element => {
  const { resolvedTheme, setTheme, theme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme = mounted ? (theme ?? 'system') : 'system';
  const currentLabel =
    themeOptions.find((option) => option.value === currentTheme)?.label ?? 'System';
  const currentResolvedTheme = mounted ? resolvedTheme : undefined;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-10 items-center gap-2 rounded-full border border-border/60 bg-card/72 px-3 text-sm font-medium text-foreground shadow-sm backdrop-blur-md transition-colors hover:bg-accent/80 hover:text-accent-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          aria-label="Change theme"
        >
          <Palette className="size-4 text-primary" />
          <span className="hidden sm:inline">Theme</span>
          <span className="hidden text-muted-foreground md:inline">{currentLabel}</span>
          <span
            className={cn(
              'size-2 rounded-full transition-colors',
              currentResolvedTheme === 'dark'
                ? 'bg-sky-400'
                : currentResolvedTheme === 'light'
                  ? 'bg-amber-400'
                  : 'bg-muted-foreground/50'
            )}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-72 rounded-2xl border-border/70 bg-popover/95 p-2 shadow-xl backdrop-blur-xl"
      >
        <DropdownMenuLabel className="px-3 py-2">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-popover-foreground">Appearance</p>
            <p className="text-xs font-normal text-muted-foreground">
              Choose the workspace tone that fits your environment.
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={currentTheme} onValueChange={setTheme}>
          {themeOptions.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className="rounded-xl px-3 py-3 data-[state=checked]:bg-accent/80"
            >
              <option.icon className="mt-0.5 size-4 text-primary" />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-popover-foreground">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </div>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
