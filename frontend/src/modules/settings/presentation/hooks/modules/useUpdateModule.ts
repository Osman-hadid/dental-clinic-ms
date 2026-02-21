import { UpdateModuleUseCase } from '@/modules/settings/application/use-cases/modules/update-module-use-case';
import { type Module } from '@/modules/settings/domain/entities/Module';
import { ModuleRepository } from '@/modules/settings/infrastructure/repositories/module-repository';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { moduleConfig } from '../../config/module-config';

type UpdateModuleMutationContext = {
  previousModules: [string[], ApiResponse<PaginatedApiResponse<Module[]>> | undefined][];
  previousModule?: ApiResponse<Module>;
};

type UpdateModuleVariables = {
  id: string | number;
  data: Partial<Omit<Module, 'id' | 'createdAt' | 'updatedAt'>>;
};

export const useUpdateModule = (): UseMutationResult<
  ApiResponse<Module>,
  Error,
  UpdateModuleVariables,
  UpdateModuleMutationContext
> => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Module>,
    Error,
    { id: string | number; data: Partial<Omit<Module, 'id' | 'createdAt' | 'updatedAt'>> },
    UpdateModuleMutationContext
  >({
    mutationFn: ({ data, id }) => {
      const moduleRepository = new ModuleRepository();
      const updateModuleUseCase = new UpdateModuleUseCase(moduleRepository);
      return updateModuleUseCase.execute(id, data);
    },
    mutationKey: [moduleConfig.queryKey, 'update'],
    onError: (_, { id }, context) => {
      if (context?.previousModules) {
        for (const [queryKey, data] of context.previousModules) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      if (context?.previousModule) {
        queryClient.setQueryData([moduleConfig.singleQueryKey, id], context.previousModule);
      }
    },
    onMutate: async ({ data, id }) => {
      const listQueryKey = [moduleConfig.queryKey];
      const singleQueryKey = [moduleConfig.singleQueryKey, id];
      await queryClient.cancelQueries({ queryKey: listQueryKey });
      await queryClient.cancelQueries({ queryKey: singleQueryKey });

      const previousModules = queryClient.getQueriesData<
        ApiResponse<PaginatedApiResponse<Module[]>>
      >({
        queryKey: listQueryKey,
      }) as [string[], ApiResponse<PaginatedApiResponse<Module[]>> | undefined][];

      const previousModule = queryClient.getQueryData<ApiResponse<Module>>(singleQueryKey);

      queryClient.setQueriesData<ApiResponse<PaginatedApiResponse<Module[]>>>(
        { queryKey: listQueryKey },
        (old) => {
          if (!old?.data?.data) return old;
          return {
            ...old,
            data: {
              ...old.data,
              data: old.data.data.map((item) =>
                item.id === id ? { ...item, ...data, updatedAt: new Date().toISOString() } : item
              ),
            },
          };
        }
      );

      queryClient.setQueryData<ApiResponse<Module>>(singleQueryKey, (old) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: { ...old.data, ...data, updatedAt: new Date().toISOString() },
        };
      });

      return { previousModule, previousModules };
    },
    onSettled: (_, __, { id }) => {
      queryClient.invalidateQueries({
        exact: false,
        queryKey: [moduleConfig.queryKey],
      });
      queryClient.invalidateQueries({
        exact: true,
        queryKey: [moduleConfig.singleQueryKey, id],
      });
    },
  });
};
