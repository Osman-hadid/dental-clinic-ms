import { SidebarItem } from '@/components/app-sidebar';
import { Folder } from 'lucide-react'; // NOSONAR

const sidebarItems: SidebarItem[] = [
  {
    icon: Folder,
    items: [
      {
        key: 'patients',
        permission: 'dental-management.patients.view',
        url: '/dental-management/patients',
      },
      { key: 'staff', permission: 'dental-management.staff.view', url: '/dental-management/staff' },
      {
        key: 'appointments',
        permission: 'dental-management.appointments.view',
        url: '/dental-management/appointments',
      },
      {
        key: 'visits',
        permission: 'dental-management.visits.view',
        url: '/dental-management/visits',
      },
      { key: 'teeth', permission: 'dental-management.teeth.view', url: '/dental-management/teeth' },
      {
        key: 'treatments',
        permission: 'dental-management.treatments.view',
        url: '/dental-management/treatments',
      },
      {
        key: 'visitTreatments',
        permission: 'dental-management.visit-treatments.view',
        url: '/dental-management/visit-treatments',
      },
      {
        key: 'invoices',
        permission: 'dental-management.invoices.view',
        url: '/dental-management/invoices',
      },
      {
        key: 'payments',
        permission: 'dental-management.payments.view',
        url: '/dental-management/payments',
      },
    ],
    key: 'dentalManagement',
    url: '/dental-management',
  },
];

export default sidebarItems;
