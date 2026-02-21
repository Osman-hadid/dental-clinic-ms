import { GetModuleUseCase } from '@/modules/settings/application/use-cases/modules/get-module-use-case';
import { type Module } from '@/modules/settings/domain/entities/Module';
import { ModuleRepository } from '@/modules/settings/infrastructure/repositories/module-repository';
import { type ApiResponse } from '@/types/ApiResponse';
import { useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { moduleConfig } from '../../config/module-config';

export const useGetModule = (
  id: string | number,
  options: { enabled?: boolean } = {}
): UseQueryResult<ApiResponse<Module>, unknown> => {
  const queryClient = useQueryClient();

  return useQuery<ApiResponse<Module>>({
    enabled:
      !!id &&
      (options.enabled ?? true) &&
      !queryClient.isMutating({
        predicate: (mutation) =>
          mutation.options.mutationKey?.[0] === moduleConfig.queryKey &&
          ['create', 'update', 'delete'].includes(mutation.options.mutationKey?.[1] as string),
      }),
    gcTime: 10 * 60 * 1000,
    queryFn: () => {
      const moduleRepository = new ModuleRepository();
      const getModuleUseCase = new GetModuleUseCase(moduleRepository);
      return getModuleUseCase.execute(id);
    },
    queryKey: [moduleConfig.singleQueryKey, id],
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });
};
