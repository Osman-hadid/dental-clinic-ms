'use client';

import React, { JSX } from 'react';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Sparkles } from 'lucide-react';

const LOCALE_SWITCHER_ENABLED = false;

type BreadcrumbItemType = {
  id: string;
  label: string;
  href?: string;
  isCurrent?: boolean;
  hideOnMobile?: boolean;
};

type HeaderProps = {
  breadcrumbs: BreadcrumbItemType[];
  showLocaleSwitcher?: boolean;
};

export const Header = ({
  breadcrumbs,
  showLocaleSwitcher = true,
}: Readonly<HeaderProps>): JSX.Element => {
  return (
    <header className="sticky top-0 z-30 flex h-[4.5rem] shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-background/82 px-1 shadow-[0_8px_32px_-28px_rgba(17,63,61,0.65)] backdrop-blur-xl transition-[width,height] ease-linear supports-[backdrop-filter]:bg-background/68 group-has-data-[collapsible=icon]/sidebar-wrapper:h-14">
      <div className="flex min-w-0 items-center gap-2 px-4">
        <SidebarTrigger className="rounded-xl border border-border/60 bg-card/80 shadow-xs hover:bg-accent/80" />
        <div className="hidden items-center gap-2 border-e border-border/70 pe-4 lg:flex">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="size-4" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-tight">Sourire</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
              Dental Studio
            </p>
          </div>
        </div>
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((item, index) => {
              let content: React.ReactNode;

              if (item.isCurrent) {
                content = <BreadcrumbPage>{item.label}</BreadcrumbPage>;
              } else if (item.href) {
                content = <BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink>;
              } else {
                content = item.label;
              }

              return [
                <BreadcrumbItem
                  key={`${item.id}-item`}
                  className={item.hideOnMobile ? 'hidden md:block' : ''}
                >
                  {content}
                </BreadcrumbItem>,
                index < breadcrumbs.length - 1 && (
                  <BreadcrumbSeparator
                    key={`${item.id}-sep`}
                    className={item.hideOnMobile ? 'hidden md:block' : ''}
                  />
                ),
              ];
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="flex items-center gap-2 px-4">
        <div className="hidden items-center gap-2 rounded-full border border-emerald-200/70 bg-emerald-50/80 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300 sm:flex">
          <span className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.14)]" />
          Clinic online
        </div>
        <ThemeToggle />
        {LOCALE_SWITCHER_ENABLED && showLocaleSwitcher && <LocaleSwitcher />}
      </div>
    </header>
  );
};
