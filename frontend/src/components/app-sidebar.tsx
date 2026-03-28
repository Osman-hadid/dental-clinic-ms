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
  Building2,
  BarChart3,
  Boxes,
  Brain,
  Calendar,
  CalendarDays,
  ClipboardList,
  GalleryVerticalEnd,
  HandCoins,
  HeartPulse,
  House,
  KeyRound,
  Landmark,
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
  section?: string;
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
    items: [{ key: 'overview', permission: 'page.dashboard', url: '/dashboard' }],
    key: 'dashboard',
    url: '/dashboard',
  },
  {
    icon: HeartPulse,
    items: [
      { key: 'patients', permission: 'page.dental-management.patients', section: 'Patients', url: '/dental-management/patients' },
      {
        key: 'patientQuestions',
        permission: 'page.dental-management.patient-questions',
        section: 'Patients',
        url: '/dental-management/patient-questions',
      },
      { key: 'appointments', permission: 'page.dental-management.appointments', section: 'Scheduling', url: '/dental-management/appointments' },
      {
        key: 'queue',
        permission: 'page.dental-management.appointments',
        section: 'Scheduling',
        title: 'Waiting Room',
        url: '/dental-management/queue',
      },
      { key: 'visits', permission: 'page.dental-management.visits', section: 'Scheduling', url: '/dental-management/visits' },
      // { key: 'teeth', url: '/dental-management/teeth' },
      { key: 'visitTreatments', permission: 'page.dental-management.visit-treatments', section: 'Clinical', url: '/dental-management/visit-treatments' },
      { key: 'treatments', permission: 'page.dental-management.treatments', section: 'Clinical', url: '/dental-management/treatments' },
      { key: 'implants', permission: 'page.dental-management.implants', section: 'Implants', url: '/dental-management/implants' },
      { key: 'implantsInProcess', permission: 'page.dental-management.implants-in-process', section: 'Implants', url: '/dental-management/implants/in-process' },
      { key: 'invoices', permission: 'page.dental-management.invoices', section: 'Billing', url: '/dental-management/invoices' },
      { key: 'payments', permission: 'page.dental-management.payments', section: 'Billing', url: '/dental-management/payments' },
      { key: 'staff', permission: 'page.dental-management.staff', section: 'People', url: '/dental-management/staff' },
      {
        key: 'shareholders',
        permission: 'page.dental-management.shareholders',
        section: 'People',
        url: '/dental-management/shareholders',
      },
      { key: 'aiImaging', newTab: true, permission: 'page.dental-management.ai-imaging', section: 'Tools', url: '/dental-management/ai-imaging' },
    ],
    key: 'dentalManagement',
    url: '/dental-management',
  },
  {
    icon: BarChart3,
    items: [
      { key: 'overview', permission: 'page.reports.overview', url: '/reports' },
      { key: 'debts', permission: 'page.reports.debts', url: '/reports/debts' },
      {
        key: 'financialControl',
        permission: 'page.reports.safe',
        title: 'Financial Control',
        url: '/reports/financial-control',
      },
      { key: 'dailyExpenses', permission: 'page.reports.daily-expenses', url: '/reports/daily-expenses' },
      { key: 'clinicalExpenses', permission: 'page.reports.clinical-expenses', url: '/reports/clinical-expenses' },
      { key: 'safe', permission: 'page.reports.safe', url: '/reports/safe' },
      { key: 'salaries', permission: 'page.reports.salaries', url: '/reports/salaries' },
      {
        key: 'shareholders',
        permission: 'page.reports.shareholders',
        url: '/reports/shareholders',
      },
    ],
    key: 'reports',
    url: '/reports',
  },
  {
    icon: Boxes,
    items: [{ key: 'inventory', permission: 'page.inventory-management', url: '/inventory-management' }],
    key: 'inventoryManagement',
    url: '/inventory-management',
  },
  {
    icon: Archive,
    items: [
      {
        key: 'backups',
        permission: 'page.dental-management.backups',
        url: '/dental-management/backups',
      },
    ],
    key: 'backupManagement',
    url: '/dental-management/backups',
  },
  {
    icon: Building2,
    items: [
      {
        key: 'clinicProfile',
        permission: 'page.dental-management.clinic-profile',
        url: '/dental-management/clinic-profile',
      },
    ],
    key: 'clinic',
    url: '/dental-management/clinic-profile',
  },
  {
    icon: ShieldUser,
    items: [
      { key: 'users', permission: 'page.user-management.users', url: '/user-management/users' },
      { key: 'roles', permission: 'page.user-management.roles', url: '/user-management/roles' },
      { key: 'permissions', permission: 'page.user-management.permissions', url: '/user-management/permissions' },
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
  clinicProfile: Smile,
  clinicalExpenses: ShoppingCart,
  dailyExpenses: CalendarDays,
  debts: HandCoins,
  implants: Stethoscope,
  implantsInProcess: ClipboardList,
  inventory: Archive,
  invoices: Receipt,
  financialControl: HandCoins,
  overview: ClipboardList,
  patientQuestions: ClipboardList,
  patients: User,
  payments: Wallet,
  queue: CalendarDays,
  permissions: KeyRound,
  roles: ShieldUser,
  safe: Shield,
  salaries: BadgeDollarSign,
  shareholders: Landmark,
  staff: Users,
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
        title: t.has(`${item.key}.${subItem.key}`) ? t(`${item.key}.${subItem.key}`) : (subItem.title ?? subItem.key),
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
