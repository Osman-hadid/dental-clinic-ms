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
};
