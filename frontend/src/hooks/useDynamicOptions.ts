import React from 'react';
import { resolveModule } from '@/modules/common/registry/resolve-module';
import type { FilterOption, OptionsSource } from '@/types/EntityModuleConfig';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

const instanceCache = new Map<string, any>();

type Result = {
  data: FilterOption[];
  isLoading: boolean;
  error: Error | null;
};

export const useDynamicOptions = (source?: OptionsSource): Result => {
  const relation = React.useMemo(() => {
    return source?.type === 'relation' ? (source as { relation: string }).relation : null;
  }, [source]);

  const query = useQuery<FilterOption[], Error>({
    enabled: !!relation,
    gcTime: 15 * 60 * 1000,
    queryFn: async () => {
      if (!relation) {
        return [];
      }

      const registry = resolveModule(relation);
      if (!registry) {
        throw new Error(`Module registry not found: ${relation}`);
      }

      const {
        labelKey = 'name' as string,
        listUseCase: loadListUseCase,
        repository: loadRepository,
        valueKey = 'id' as string,
      } = registry;

      if (!loadListUseCase || !loadRepository) {
        throw new Error(`Registry for ${relation} does not expose repository/listUseCase`);
      }

      let useCaseInstance = instanceCache.get(relation);

      if (!useCaseInstance) {
        const [repoMod, useCaseMod] = await Promise.all([loadRepository(), loadListUseCase()]);

        const resolveExport = (mod: any): any => {
          if (!mod) return undefined;
          if (mod.default) return mod.default;

          const entries = Object.values(mod);
          return entries.length > 0 ? entries[0] : undefined;
        };

        const RepositoryClass = resolveExport(repoMod);
        const UseCaseClass = resolveExport(useCaseMod);

        if (!RepositoryClass || !UseCaseClass) {
          throw new Error(`Failed to resolve repository/usecase classes for ${relation}`);
        }

        const repository = new RepositoryClass();
        useCaseInstance = new UseCaseClass(repository);

        instanceCache.set(relation, useCaseInstance);
      }

      const result = await useCaseInstance.execute('', [], [], {}, 1, 100);

      const items = result?.data?.data ?? result?.data ?? result ?? [];

      if (!Array.isArray(items)) {
        console.warn(`[useDynamicOptions] expected array, got:`, items);
        return [];
      }

      const getValue = (obj: any, path: string): any => {
        if (!path || typeof path !== 'string') {
          return undefined;
        }

        if (path.includes('.')) {
          const keys = path.split('.');
          return keys.reduce((o, key) => o?.[key], obj);
        }

        return obj?.[path];
      };

      return items.map((item: any) => ({
        label: String(getValue(item, labelKey) ?? ''),
        value: String(getValue(item, valueKey) ?? ''),
      }));
    },
    queryKey: ['dynamic-options', relation ?? 'none'],

    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    retry: 1,
    staleTime: 10 * 60 * 1000,
  });

  React.useEffect(() => {
    if (query.error && relation) {
      toast.error(query.error.message ?? `Failed to load ${relation}`, {
        id: `dynamic-options-${relation}`,
        position: 'top-center',
      });
    }
  }, [query.error, relation]);

  if (!relation) {
    return { data: [], error: null, isLoading: false };
  }

  return {
    data: query.data ?? [],
    error: query.error ?? null,
    isLoading: query.isLoading,
  };
};
