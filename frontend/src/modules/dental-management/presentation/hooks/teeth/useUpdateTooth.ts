import { UpdateToothUseCase } from '@/modules/dental-management/application/use-cases/teeth/update-tooth-use-case';
import { type Tooth } from '@/modules/dental-management/domain/entities/Tooth';
import { ToothRepository } from '@/modules/dental-management/infrastructure/repositories/tooth-repository';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { toothConfig } from '../../config/tooth-config';

type UpdateToothMutationContext = {
  previousTeeth: [string[], ApiResponse<PaginatedApiResponse<Tooth[]>> | undefined][];
  previousTooth?: ApiResponse<Tooth>;
};

type UpdateToothVariables = {
  id: string | number;
  data: Partial<Omit<Tooth, 'id' | 'createdAt' | 'updatedAt'>>;
};

export const useUpdateTooth = (): UseMutationResult<
  ApiResponse<Tooth>,
  Error,
  UpdateToothVariables,
  UpdateToothMutationContext
> => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Tooth>,
    Error,
    { id: string | number; data: Partial<Omit<Tooth, 'id' | 'createdAt' | 'updatedAt'>> },
    UpdateToothMutationContext
  >({
    mutationFn: ({ data, id }) => {
      const toothRepository = new ToothRepository();
      const updateToothUseCase = new UpdateToothUseCase(toothRepository);
      return updateToothUseCase.execute(id, data);
    },
    mutationKey: [toothConfig.queryKey, 'update'],
    onError: (_, { id }, context) => {
      if (context?.previousTeeth) {
        for (const [queryKey, data] of context.previousTeeth) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      if (context?.previousTooth) {
        queryClient.setQueryData([toothConfig.singleQueryKey, id], context.previousTooth);
      }
    },
    onMutate: async ({ data, id }) => {
      const listQueryKey = [toothConfig.queryKey];
      const singleQueryKey = [toothConfig.singleQueryKey, id];
      await queryClient.cancelQueries({ queryKey: listQueryKey });
      await queryClient.cancelQueries({ queryKey: singleQueryKey });

      const previousTeeth = queryClient.getQueriesData<ApiResponse<PaginatedApiResponse<Tooth[]>>>({
        queryKey: listQueryKey,
      }) as [string[], ApiResponse<PaginatedApiResponse<Tooth[]>> | undefined][];

      const previousTooth = queryClient.getQueryData<ApiResponse<Tooth>>(singleQueryKey);

      queryClient.setQueriesData<ApiResponse<PaginatedApiResponse<Tooth[]>>>(
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

      queryClient.setQueryData<ApiResponse<Tooth>>(singleQueryKey, (old) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: { ...old.data, ...data, updatedAt: new Date().toISOString() },
        };
      });

      return { previousTooth, previousTeeth };
    },
    onSettled: (_, __, { id }) => {
      queryClient.invalidateQueries({
        exact: false,
        queryKey: [toothConfig.queryKey],
      });
      queryClient.invalidateQueries({
        exact: true,
        queryKey: [toothConfig.singleQueryKey, id],
      });
    },
  });
};
