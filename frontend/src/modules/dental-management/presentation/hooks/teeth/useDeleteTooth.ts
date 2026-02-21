import { DeleteToothUseCase } from '@/modules/dental-management/application/use-cases/teeth/delete-tooth-use-case';
import { ToothRepository } from '@/modules/dental-management/infrastructure/repositories/tooth-repository';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { type Tooth } from '../../../domain/entities/Tooth';
import { toothConfig } from '../../config/tooth-config';

type DeleteToothMutationContext = {
  previousTeeth: [string[], ApiResponse<PaginatedApiResponse<Tooth[]>> | undefined][];
  previousTooth?: ApiResponse<Tooth>;
};

export const useDeleteTooth = (): UseMutationResult<
  ApiResponse<null>,
  Error,
  string | number,
  DeleteToothMutationContext
> => {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<null>, Error, string | number, DeleteToothMutationContext>({
    mutationFn: (id) => {
      const toothRepository = new ToothRepository();
      const deleteToothUseCase = new DeleteToothUseCase(toothRepository);
      return deleteToothUseCase.execute(id);
    },
    mutationKey: [toothConfig.queryKey, 'delete'],
    onError: (_, id, context) => {
      if (context?.previousTeeth) {
        for (const [queryKey, data] of context.previousTeeth) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      if (context?.previousTooth) {
        queryClient.setQueryData([toothConfig.singleQueryKey, id], context.previousTooth);
      }
    },
    onMutate: async (id) => {
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

      return { previousTooth, previousTeeth };
    },
    onSettled: (_, __, id) => {
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
