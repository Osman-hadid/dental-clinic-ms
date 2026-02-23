export type ModuleRegistryEntry = {
  repository: () => Promise<any>;
  listUseCase: () => Promise<any>;
  labelKey: string;
  valueKey: string;
};

export const moduleRegistry: Record<string, ModuleRegistryEntry> = {
  modules: {
    labelKey: 'name',
    listUseCase: () =>
      import('@/modules/settings/application/use-cases/modules/list-modules-use-case'),
    repository: () => import('@/modules/settings/infrastructure/repositories/module-repository'),
    valueKey: 'id',
  },

  roles: {
    labelKey: 'displayName',
    listUseCase: () =>
      import('@/modules/user-management/application/use-cases/roles/list-roles-use-case'),
    repository: () =>
      import('@/modules/user-management/infrastructure/repositories/role-repository'),
    valueKey: 'id',
  },

  patients: {
    labelKey: 'patientCode',
    listUseCase: () =>
      import('@/modules/dental-management/application/use-cases/patients/list-patients-use-case'),
    repository: () => import('@/modules/dental-management/infrastructure/repositories/patient-repository'),
    valueKey: 'id',
  },

  staff: {
    labelKey: 'fullName',
    listUseCase: () =>
      import('@/modules/dental-management/application/use-cases/staff/list-staff-use-case'),
    repository: () => import('@/modules/dental-management/infrastructure/repositories/staff-repository'),
    valueKey: 'id',
  },

  appointments: {
    labelKey: 'tag',
    listUseCase: () =>
      import('@/modules/dental-management/application/use-cases/appointments/list-appointments-use-case'),
    repository: () =>
      import('@/modules/dental-management/infrastructure/repositories/appointment-repository'),
    valueKey: 'id',
  },

  visits: {
    labelKey: 'tag',
    listUseCase: () =>
      import('@/modules/dental-management/application/use-cases/visits/list-visits-use-case'),
    repository: () => import('@/modules/dental-management/infrastructure/repositories/visit-repository'),
    valueKey: 'id',
  },

  teeth: {
    labelKey: 'toothNumber',
    listUseCase: () => import('@/modules/dental-management/application/use-cases/teeth/list-teeth-use-case'),
    repository: () => import('@/modules/dental-management/infrastructure/repositories/tooth-repository'),
    valueKey: 'id',
  },

  treatments: {
    labelKey: 'name',
    listUseCase: () =>
      import('@/modules/dental-management/application/use-cases/treatments/list-treatments-use-case'),
    repository: () =>
      import('@/modules/dental-management/infrastructure/repositories/treatment-repository'),
    valueKey: 'id',
  },

  visitTreatments: {
    labelKey: 'id',
    listUseCase: () =>
      import(
        '@/modules/dental-management/application/use-cases/visit-treatments/list-visit-treatments-use-case'
      ),
    repository: () =>
      import('@/modules/dental-management/infrastructure/repositories/visit-treatment-repository'),
    valueKey: 'id',
  },

  invoices: {
    labelKey: 'id',
    listUseCase: () =>
      import('@/modules/dental-management/application/use-cases/invoices/list-invoices-use-case'),
    repository: () => import('@/modules/dental-management/infrastructure/repositories/invoice-repository'),
    valueKey: 'id',
  },

  payments: {
    labelKey: 'id',
    listUseCase: () =>
      import('@/modules/dental-management/application/use-cases/payments/list-payments-use-case'),
    repository: () => import('@/modules/dental-management/infrastructure/repositories/payment-repository'),
    valueKey: 'id',
  },
};
