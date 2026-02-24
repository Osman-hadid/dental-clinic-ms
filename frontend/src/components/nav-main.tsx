'use client';

import * as React from 'react';
import { useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utilities';
import { ChevronRight, type LucideIcon } from 'lucide-react';

export const NavMain = ({
  items,
}: {
  readonly items: {
    title: string;
    url: string;
    icon?: LucideIcon;
    items?: {
      title: string;
      newTab?: boolean;
      url: string;
    }[];
  }[];
}): React.ReactElement => {
  const pathname = usePathname();
  const locale = useLocale();
  const isRtl = ['dr', 'ps'].includes(locale);
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const [hoveredExpandedItem, setHoveredExpandedItem] = React.useState<string | null>(null);
  const [hoveredCollapsedItem, setHoveredCollapsedItem] = React.useState<string | null>(null);
  const closeTimerRef = React.useRef<number | null>(null);

  const cleanPathname = pathname.replace(/^\/[a-z]{2}/, '').split('?')[0];
  const clearCloseTimer = React.useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    return () => {
      clearCloseTimer();
    };
  }, [clearCloseTimer]);

  if (isCollapsed) {
    return (
      <SidebarGroup className="px-1 py-2">
        <SidebarMenu className="items-center gap-2.5">
          {items.map((item) => {
            const targetUrl = item.items?.[0]?.url || item.url;
            const hasDropdown = (item.items?.length ?? 0) > 1;
            const isParentActive =
              cleanPathname === targetUrl ||
              cleanPathname.startsWith(targetUrl) ||
              item.items?.some(
                (subItem) => cleanPathname === subItem.url || cleanPathname.startsWith(subItem.url)
              );

            if (hasDropdown) {
              return (
                <SidebarMenuItem key={item.url}>
                  <DropdownMenu
                    open={hoveredCollapsedItem === item.url}
                    onOpenChange={(open) => {
                      if (!open) {
                        setHoveredCollapsedItem((current) => (current === item.url ? null : current));
                      }
                    }}
                    modal={false}
                  >
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuButton
                        asChild
                        isActive={!!isParentActive}
                        onMouseEnter={() => {
                          clearCloseTimer();
                          setHoveredCollapsedItem(item.url);
                        }}
                        onMouseLeave={() => {
                          clearCloseTimer();
                          closeTimerRef.current = window.setTimeout(() => {
                            setHoveredCollapsedItem((current) =>
                              current === item.url ? null : current
                            );
                          }, 130);
                        }}
                        className={cn(
                          'mx-auto h-11 w-11 justify-center rounded-full border border-transparent p-0 shadow-xs [&>svg]:size-5 [&>svg]:stroke-[1.8]',
                          'hover:border-white/55 hover:bg-white/45 hover:text-sidebar-foreground hover:backdrop-blur-md',
                          'data-[active=true]:border-sidebar-primary/50 data-[active=true]:bg-sidebar-primary/25 data-[active=true]:text-sidebar-foreground data-[active=true]:shadow-sm'
                        )}
                      >
                        <button type="button" className="flex h-full w-full items-center justify-center">
                          {item.icon ? <item.icon className="size-5" /> : null}
                          <span className="sr-only">{item.title}</span>
                        </button>
                      </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      side="right"
                      align="start"
                      sideOffset={12}
                      className="bg-sidebar/95 min-w-48 rounded-xl border-sidebar-border/80 p-1.5 backdrop-blur-md"
                      onMouseEnter={() => {
                        clearCloseTimer();
                        setHoveredCollapsedItem(item.url);
                      }}
                      onMouseLeave={() => {
                        setHoveredCollapsedItem((current) => (current === item.url ? null : current));
                      }}
                    >
                      {item.items?.map((subItem) => {
                        const isActive =
                          cleanPathname === subItem.url || cleanPathname.startsWith(subItem.url);

                        return (
                          <DropdownMenuItem
                            key={subItem.url}
                            asChild
                            className={cn(
                              'cursor-pointer rounded-lg px-2.5 py-2 text-sm',
                              isActive && 'bg-sidebar-primary/25 text-foreground'
                            )}
                          >
                            <Link
                              href={subItem.url}
                              rel={subItem.newTab ? 'noopener noreferrer' : undefined}
                              target={subItem.newTab ? '_blank' : undefined}
                              className="w-full"
                            >
                              {subItem.title}
                            </Link>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              );
            }

            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  isActive={!!isParentActive}
                  className={cn(
                    'mx-auto h-11 w-11 justify-center rounded-full border border-transparent p-0 shadow-xs [&>svg]:size-5 [&>svg]:stroke-[1.8]',
                    'hover:border-white/55 hover:bg-white/45 hover:text-sidebar-foreground hover:backdrop-blur-md',
                    'data-[active=true]:border-sidebar-primary/50 data-[active=true]:bg-sidebar-primary/25 data-[active=true]:text-sidebar-foreground data-[active=true]:shadow-sm'
                  )}
                >
                  <Link href={targetUrl} className="flex h-full w-full items-center justify-center">
                    {item.icon ? <item.icon className="size-5" /> : null}
                    <span className="sr-only">{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroup>
    );
  }

  return (
    <SidebarGroup className="px-2 py-2">
      <SidebarMenu className="gap-1.5">
        {items.map((item) => {
          const hasDropdown = (item.items?.length ?? 0) > 0;
          const isParentActive =
            pathname === item.url ||
            item.items?.some(
              (subItem) => cleanPathname === subItem.url || cleanPathname.startsWith(subItem.url)
            );
          const isOpen = isParentActive || hoveredExpandedItem === item.url;

          return (
            <Collapsible
              key={item.url}
              asChild
              open={isOpen}
              onOpenChange={(open) => {
                if (isParentActive) {
                  return;
                }

                setHoveredExpandedItem((current) => {
                  if (open) {
                    return item.url;
                  }

                  return current === item.url ? null : current;
                });
              }}
              className="group/collapsible"
            >
              <SidebarMenuItem
                onMouseEnter={() => {
                  if (hasDropdown) {
                    setHoveredExpandedItem(item.url);
                  }
                }}
                onMouseLeave={() => {
                  if (!isParentActive && hasDropdown) {
                    setHoveredExpandedItem((current) => (current === item.url ? null : current));
                  }
                }}
              >
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={!!isParentActive}
                    className="h-10 rounded-xl border border-transparent px-3 text-[13px] [&>svg]:size-4 [&>svg]:stroke-[1.8] data-[active=true]:border-sidebar-primary/40 data-[active=true]:bg-sidebar-primary/20 data-[active=true]:shadow-sm"
                  >
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                    <ChevronRight
                      className={cn(
                        'ms-auto !size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90',
                        isRtl && 'rotate-180'
                      )}
                    />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.items?.map((subItem) => {
                      const isActive =
                        cleanPathname === subItem.url || cleanPathname.startsWith(subItem.url);

                      return (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton asChild>
                            <Link
                              href={subItem.url}
                              rel={subItem.newTab ? 'noopener noreferrer' : undefined}
                              target={subItem.newTab ? '_blank' : undefined}
                              className={cn(
                                'block rounded-lg border border-transparent px-3 py-2 text-sm transition-colors hover:border-white/50 hover:bg-white/40 hover:text-foreground hover:backdrop-blur-md',
                                isActive && 'bg-sidebar-primary/25 font-medium text-foreground'
                              )}
                            >
                              {subItem.title}
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      );
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
};
