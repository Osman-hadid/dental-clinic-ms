import { DeleteModuleUseCase } from '@/modules/settings/application/use-cases/modules/delete-module-use-case';
import { ModuleRepository } from '@/modules/settings/infrastructure/repositories/module-repository';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { type Module } from '../../../domain/entities/Module';
import { moduleConfig } from '../../config/module-config';

type DeleteModuleMutationContext = {
  previousModules: [string[], ApiResponse<PaginatedApiResponse<Module[]>> | undefined][];
  previousModule?: ApiResponse<Module>;
};

export const useDeleteModule = (): UseMutationResult<
  ApiResponse<null>,
  Error,
  string | number,
  DeleteModuleMutationContext
> => {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<null>, Error, string | number, DeleteModuleMutationContext>({
    mutationFn: (id) => {
      const moduleRepository = new ModuleRepository();
      const deleteModuleUseCase = new DeleteModuleUseCase(moduleRepository);
      return deleteModuleUseCase.execute(id);
    },
    mutationKey: [moduleConfig.queryKey, 'delete'],
    onError: (_, id, context) => {
      if (context?.previousModules) {
        for (const [queryKey, data] of context.previousModules) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      if (context?.previousModule) {
        queryClient.setQueryData([moduleConfig.singleQueryKey, id], context.previousModule);
      }
    },
    onMutate: async (id) => {
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
              data: old.data.data.filter((item) => item.id !== id),
              meta: {
                ...old.data.meta,
                to: old.data.meta.to - 1,
                total: old.data.meta.total - 1,
              },
            },
          };
        }
      );

      queryClient.removeQueries({ queryKey: singleQueryKey });

      return { previousModule, previousModules };
    },
    onSettled: (_, __, id) => {
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
