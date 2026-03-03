'use client';

import * as React from 'react';
import { JSX } from 'react';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';
import { LucideIcon } from 'lucide-react';

export const TeamSwitcher = ({
  teams,
}: Readonly<{ teams: { name: string; logo: LucideIcon; plan: string }[] }>): JSX.Element | null => {
  const [activeTeam] = React.useState(teams[0]);
  const router = useRouter();
  const locale = useLocale();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  const handleClick = React.useCallback(() => {
    router.push(`/${locale}`);
  }, [locale, router]);

  if (!activeTeam) {
    return null;
  }

  return (
    <SidebarMenu className="items-center">
      <SidebarMenuItem className="flex w-full justify-center">
        <SidebarMenuButton
          size={isCollapsed ? 'default' : 'lg'}
          onClick={handleClick}
          className={`data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground relative justify-center gap-0 overflow-hidden rounded-2xl px-2 ${
            isCollapsed
              ? 'mx-auto h-14 w-14 p-0 group-data-[collapsible=icon]:size-14!'
              : 'h-24'
          }`}
          tooltip={isCollapsed ? activeTeam.name : undefined}
        >
          {isCollapsed ? (
            <div className="relative size-12">
              <Image
                src="/logo.png"
                alt="logo"
                width={48}
                height={48}
                priority
                sizes="48px"
                className="absolute top-1/2 left-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 object-contain object-center"
              />
            </div>
          ) : (
            <div className="relative h-20 w-full">
              <Image
                src="/logo.png"
                alt="logo"
                width={260}
                height={80}
                priority
                sizes="260px"
                className="absolute top-1/2 left-1/2 h-20 w-auto max-w-[250px] -translate-x-1/2 -translate-y-1/2 object-contain object-center"
              />
            </div>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};
