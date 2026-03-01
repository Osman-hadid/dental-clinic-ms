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
import {
  Archive,
  BadgeDollarSign,
  BarChart3,
  Brain,
  Calendar,
  CalendarDays,
  ClipboardList,
  GalleryVerticalEnd,
  HandCoins,
  HeartPulse,
  House,
  IdCard,
  KeyRound,
  LucideIcon,
  Receipt,
  Shield,
  ShieldUser,
  ShoppingCart,
  Smile,
  Stethoscope,
  User,
  Users,
  Wallet,
} from 'lucide-react';

export type SidebarSubItem = {
  icon?: LucideIcon;
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
    icon: House,
    isActive: true,
    items: [{ key: 'overview', url: '/dashboard' }],
    key: 'dashboard',
    url: '/dashboard',
  },
  {
    icon: HeartPulse,
    items: [
      { key: 'patients', url: '/dental-management/patients' },
      { key: 'staff', url: '/dental-management/staff' },
      { key: 'staffProfiles', url: '/dental-management/staff-profiles' },
      { key: 'appointments', url: '/dental-management/appointments' },
      { key: 'visits', url: '/dental-management/visits' },
      { key: 'teeth', url: '/dental-management/teeth' },
      { key: 'treatments', url: '/dental-management/treatments' },
      { key: 'implants', url: '/dental-management/implants' },
      { key: 'implantsInProcess', url: '/dental-management/implants/in-process' },
      { key: 'visitTreatments', url: '/dental-management/visit-treatments' },
      { key: 'invoices', url: '/dental-management/invoices' },
      { key: 'payments', url: '/dental-management/payments' },
      { key: 'aiImaging', newTab: true, url: '/dental-management/ai-imaging' },
    ],
    key: 'dentalManagement',
    url: '/dental-management',
  },
  {
    icon: BarChart3,
    items: [
      { key: 'overview', url: '/reports' },
      { key: 'debts', permission: 'dental-management.debts.view', url: '/reports/debts' },
      { key: 'dailyExpenses', url: '/reports/daily-expenses' },
      { key: 'clinicalExpenses', url: '/reports/clinical-expenses' },
      { key: 'safe', url: '/reports/safe' },
      { key: 'salaries', url: '/reports/salaries' },
    ],
    key: 'reports',
    url: '/reports',
  },
  {
    icon: Archive,
    items: [{ key: 'backups', permission: 'dental-management.backups.view', url: '/dental-management/backups' }],
    key: 'backupManagement',
    url: '/dental-management/backups',
  },
  {
    icon: ShieldUser,
    items: [
      { key: 'users', url: '/user-management/users' },
      { key: 'roles', url: '/user-management/roles' },
      { key: 'permissions', url: '/user-management/permissions' },
    ],
    key: 'userManagement',
    url: '/user-management',
  },
  // {
  //   icon: ScrollText,
  //   items: [
  //     { key: 'users', url: '#' },
  //     { key: 'permissions', url: '#' },
  //     { key: 'settings', url: '#' },
  //   ],
  //   key: 'documentation',
  //   url: '/docs',
  // },
];

const sidebarSubItemIcons: Record<string, LucideIcon> = {
  aiImaging: Brain,
  appointments: Calendar,
  backups: Archive,
  clinicalExpenses: ShoppingCart,
  dailyExpenses: CalendarDays,
  debts: HandCoins,
  implants: Stethoscope,
  implantsInProcess: ClipboardList,
  invoices: Receipt,
  overview: ClipboardList,
  patients: User,
  payments: Wallet,
  permissions: KeyRound,
  roles: ShieldUser,
  safe: Shield,
  salaries: BadgeDollarSign,
  staff: Users,
  staffProfiles: IdCard,
  teeth: Smile,
  treatments: Stethoscope,
  users: Users,
  visits: ClipboardList,
  visitTreatments: ClipboardList,
};

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
      icon: subItem.icon ?? sidebarSubItemIcons[subItem.key],
      title: t.has(`${item.key}.${subItem.key}`) ? t(`${item.key}.${subItem.key}`) : subItem.key,
    })),
    title: t.has(`${item.key}.title`) ? t(`${item.key}.title`) : item.key,
  }));

  return (
    <Sidebar
      collapsible="icon"
      variant="floating"
      className="border-none [&_[data-slot=sidebar-inner]]:rounded-[1.9rem] [&_[data-slot=sidebar-inner]]:border [&_[data-slot=sidebar-inner]]:border-sidebar-border/80 [&_[data-slot=sidebar-inner]]:bg-sidebar/98 [&_[data-slot=sidebar-inner]]:ring-1 [&_[data-slot=sidebar-inner]]:ring-sidebar-border/35 [&_[data-slot=sidebar-inner]]:shadow-[0_14px_30px_-18px_rgba(21,75,169,0.34)]"
      {...props}
    >
      <SidebarHeader className="px-2.5 pt-4">
        <TeamSwitcher
          teams={[
            {
              logo: GalleryVerticalEnd,
              name: t('name', { defaultValue: 'Sourire' }),
              plan: 'Enterprise',
            },
          ]}
        />
      </SidebarHeader>
      <SidebarContent className="px-1.5">
        <NavMain items={localizedNavItems} />
      </SidebarContent>
      <SidebarFooter className="px-2.5 pb-4">{user && <NavUser user={user} />}</SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};
