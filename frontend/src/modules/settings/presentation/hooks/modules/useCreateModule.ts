import { CreateModuleUseCase } from '@/modules/settings/application/use-cases/modules/create-module-use-case';
import { type Module } from '@/modules/settings/domain/entities/Module';
import { ModuleRepository } from '@/modules/settings/infrastructure/repositories/module-repository';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { moduleConfig } from '../../config/module-config';

type CreateModuleMutationContext = {
  previousModules: [string[], ApiResponse<PaginatedApiResponse<Module[]>> | undefined][];
};

export const useCreateModule = (): UseMutationResult<
  ApiResponse<Module>,
  Error,
  Omit<Module, 'id' | 'createdAt' | 'updatedAt'>,
  CreateModuleMutationContext
> => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Module>,
    Error,
    Omit<Module, 'id' | 'createdAt' | 'updatedAt'>,
    CreateModuleMutationContext
  >({
    mutationFn: (module) => {
      const moduleRepository = new ModuleRepository();
      const createModuleUseCase = new CreateModuleUseCase(moduleRepository);
      return createModuleUseCase.execute(module);
    },
    mutationKey: [moduleConfig.queryKey, 'create'],
    onError: (_, __, context) => {
      if (context?.previousModules) {
        for (const [queryKey, data] of context.previousModules) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onMutate: async (newModule) => {
      const queryKeyPrefix = [moduleConfig.queryKey];
      await queryClient.cancelQueries({ queryKey: queryKeyPrefix });
      const previousModules = queryClient.getQueriesData<
        ApiResponse<PaginatedApiResponse<Module[]>>
      >({
        queryKey: queryKeyPrefix,
      }) as [string[], ApiResponse<PaginatedApiResponse<Module[]>> | undefined][];
      const targetQueryKey = [moduleConfig.queryKey, 1, 10, '', JSON.stringify({})];
      queryClient.setQueriesData<ApiResponse<PaginatedApiResponse<Module[]>>>(
        { queryKey: targetQueryKey },
        (old) => {
          if (!old?.data?.data) return old;
          const optimisticModule: Module = {
            ...newModule,
            createdAt: new Date().toISOString(),
            id: -Date.now(),
            updatedAt: new Date().toISOString(),
          };
          return {
            ...old,
            data: {
              ...old.data,
              data: [optimisticModule, ...old.data.data],
              meta: {
                ...old.data.meta,
                to: old.data.meta.to + 1,
                total: old.data.meta.total + 1,
              },
            },
          };
        }
      );
      return { previousModules };
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        exact: false,
        queryKey: [moduleConfig.queryKey],
      });
    },
  });
};
