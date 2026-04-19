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
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border/50 bg-background/72 backdrop-blur-xl transition-[width,height] ease-linear supports-[backdrop-filter]:bg-background/56 group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex min-w-0 items-center gap-2 px-4">
        <SidebarTrigger className="rounded-full border border-border/60 bg-card/70 shadow-xs hover:bg-accent/80 md:hidden" />
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
        <ThemeToggle />
        {LOCALE_SWITCHER_ENABLED && showLocaleSwitcher && <LocaleSwitcher />}
      </div>
    </header>
  );
};
