'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { TeamSwitcher } from '@/components/team-switcher';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar';
import { useCan } from '@/hooks/useCan';
import { useAuthStore } from '@/modules/auth/application/stores/auth-store';
import { BookOpen, GalleryVerticalEnd, LayoutDashboard, LucideIcon, Stethoscope, Users } from 'lucide-react';

export type SidebarSubItem = {
  key: string;
  newTab?: boolean;
  url: string;
  title?: string;
  permission?: string;
};

export type SidebarItem = {
  icon: LucideIcon;
  isActive?: boolean;
  items?: SidebarSubItem[];
  key: string;
  url: string;
  title?: string;
  permission?: string;
};

const staticNavItems: SidebarItem[] = [
  {
    icon: LayoutDashboard,
    isActive: true,
    items: [{ key: 'overview', url: '/dashboard' }],
    key: 'dashboard',
    url: '/dashboard',
  },
  {
    icon: Users,
    items: [
      { key: 'users', url: '/user-management/users' },
      { key: 'roles', url: '/user-management/roles' },
      { key: 'permissions', url: '/user-management/permissions' },
    ],
    key: 'userManagement',
    url: '/user-management',
  },
  {
    icon: Stethoscope,
    items: [
      { key: 'patients', url: '/dental-management/patients' },
      { key: 'staff', url: '/dental-management/staff' },
      { key: 'appointments', url: '/dental-management/appointments' },
      { key: 'visits', url: '/dental-management/visits' },
      { key: 'teeth', url: '/dental-management/teeth' },
      { key: 'treatments', url: '/dental-management/treatments' },
      { key: 'visitTreatments', url: '/dental-management/visit-treatments' },
      { key: 'invoices', url: '/dental-management/invoices' },
      { key: 'payments', url: '/dental-management/payments' },
      { key: 'aiImaging', newTab: true, url: '/dental-management/ai-imaging' },
    ],
    key: 'dentalManagement',
    url: '/dental-management',
  },
  {
    icon: BookOpen,
    items: [
      { key: 'users', url: '#' },
      { key: 'permissions', url: '#' },
      { key: 'settings', url: '#' },
    ],
    key: 'documentation',
    url: '/docs',
  },
];

export const AppSidebar = (props: React.ComponentProps<typeof Sidebar>): React.JSX.Element => {
  const [dynamicNavItems, setDynamicNavItems] = React.useState<SidebarItem[]>([]);

  React.useEffect(() => {
    import('@/generated/sidebar-items')
      .then((mod) => {
        setDynamicNavItems(mod.default ?? mod);
      })
      .catch(() => {
        setDynamicNavItems([]);
      });
  }, []);

  const navItems: SidebarItem[] = React.useMemo(() => {
    const staticKeys = new Set(staticNavItems.map((item) => item.key));

    return [...staticNavItems, ...dynamicNavItems.filter((item) => !staticKeys.has(item.key))];
  }, [dynamicNavItems]);

  const user = useAuthStore((state) => state.user);
  const t = useTranslations('sidebar');
  const { can } = useCan();

  const visibleNavItems = navItems
    .map((module) => {
      if (module.permission && !can(module.permission)) {
        return null;
      }

      const visibleItems = module.items?.filter((item) => {
        return !item.permission || can(item.permission);
      });

      if (!visibleItems || visibleItems.length === 0) {
        return null;
      }

      return {
        ...module,
        items: visibleItems,
      };
    })
    .filter(Boolean) as SidebarItem[];

  const localizedNavItems = visibleNavItems.map((item) => ({
    ...item,
    items: item.items?.map((subItem) => ({
      ...subItem,
      title: t(`${item.key}.${subItem.key}`, { defaultValue: subItem.key }),
    })),
    title: t(`${item.key}.title`, { defaultValue: item.key }),
  }));

  return (
    <Sidebar collapsible="icon" className="border-e-0 border-s border-s-border" {...props}>
      <SidebarHeader>
        <TeamSwitcher
          teams={[
            {
              logo: GalleryVerticalEnd,
              name: t('name', { defaultValue: 'CPAMIS' }),
              plan: 'Enterprise',
            },
          ]}
        />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={localizedNavItems} />
      </SidebarContent>
      <SidebarFooter>{user && <NavUser user={user} />}</SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};
