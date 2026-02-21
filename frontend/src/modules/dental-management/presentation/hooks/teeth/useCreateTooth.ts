import { CreateToothUseCase } from '@/modules/dental-management/application/use-cases/teeth/create-tooth-use-case';
import { type Tooth } from '@/modules/dental-management/domain/entities/Tooth';
import { ToothRepository } from '@/modules/dental-management/infrastructure/repositories/tooth-repository';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { toothConfig } from '../../config/tooth-config';

type CreateToothMutationContext = {
  previousTeeth: [string[], ApiResponse<PaginatedApiResponse<Tooth[]>> | undefined][];
};

export const useCreateTooth = (): UseMutationResult<
  ApiResponse<Tooth>,
  Error,
  Omit<Tooth, 'id' | 'createdAt' | 'updatedAt'>,
  CreateToothMutationContext
> => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Tooth>,
    Error,
    Omit<Tooth, 'id' | 'createdAt' | 'updatedAt'>,
    CreateToothMutationContext
  >({
    mutationFn: (tooth) => {
      const toothRepository = new ToothRepository();
      const createToothUseCase = new CreateToothUseCase(toothRepository);
      return createToothUseCase.execute(tooth);
    },
    mutationKey: [toothConfig.queryKey, 'create'],
    onError: (_, __, context) => {
      if (context?.previousTeeth) {
        for (const [queryKey, data] of context.previousTeeth) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onMutate: async (newTooth) => {
      const queryKeyPrefix = [toothConfig.queryKey];
      await queryClient.cancelQueries({ queryKey: queryKeyPrefix });
      const previousTeeth = queryClient.getQueriesData<ApiResponse<PaginatedApiResponse<Tooth[]>>>({
        queryKey: queryKeyPrefix,
      }) as [string[], ApiResponse<PaginatedApiResponse<Tooth[]>> | undefined][];
      const targetQueryKey = [toothConfig.queryKey, 1, 10, '', JSON.stringify({})];
      queryClient.setQueriesData<ApiResponse<PaginatedApiResponse<Tooth[]>>>(
        { queryKey: targetQueryKey },
        (old) => {
          if (!old?.data?.data) return old;
          const optimisticTooth: Tooth = {
            ...newTooth,
            createdAt: new Date().toISOString(),
            id: -Date.now(),
            updatedAt: new Date().toISOString(),
          };
          return {
            ...old,
            data: {
              ...old.data,
              data: [optimisticTooth, ...old.data.data],
              meta: {
                ...old.data.meta,
                to: old.data.meta.to + 1,
                total: old.data.meta.total + 1,
              },
            },
          };
        }
      );
      return { previousTeeth };
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        exact: false,
        queryKey: [toothConfig.queryKey],
      });
    },
  });
};
