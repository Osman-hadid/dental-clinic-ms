import { DeleteVisitUseCase } from '@/modules/dental-management/application/use-cases/visits/delete-visit-use-case';
import { VisitRepository } from '@/modules/dental-management/infrastructure/repositories/visit-repository';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { type Visit } from '../../../domain/entities/Visit';
import { visitConfig } from '../../config/visit-config';

type DeleteVisitMutationContext = {
  previousVisits: [string[], ApiResponse<PaginatedApiResponse<Visit[]>> | undefined][];
  previousVisit?: ApiResponse<Visit>;
};

export const useDeleteVisit = (): UseMutationResult<
  ApiResponse<null>,
  Error,
  string | number,
  DeleteVisitMutationContext
> => {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<null>, Error, string | number, DeleteVisitMutationContext>({
    mutationFn: (id) => {
      const visitRepository = new VisitRepository();
      const deleteVisitUseCase = new DeleteVisitUseCase(visitRepository);
      return deleteVisitUseCase.execute(id);
    },
    mutationKey: [visitConfig.queryKey, 'delete'],
    onError: (_, id, context) => {
      if (context?.previousVisits) {
        for (const [queryKey, data] of context.previousVisits) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      if (context?.previousVisit) {
        queryClient.setQueryData([visitConfig.singleQueryKey, id], context.previousVisit);
      }
    },
    onMutate: async (id) => {
      const listQueryKey = [visitConfig.queryKey];
      const singleQueryKey = [visitConfig.singleQueryKey, id];
      await queryClient.cancelQueries({ queryKey: listQueryKey });
      await queryClient.cancelQueries({ queryKey: singleQueryKey });

      const previousVisits = queryClient.getQueriesData<ApiResponse<PaginatedApiResponse<Visit[]>>>(
        {
          queryKey: listQueryKey,
        }
      ) as [string[], ApiResponse<PaginatedApiResponse<Visit[]>> | undefined][];

      const previousVisit = queryClient.getQueryData<ApiResponse<Visit>>(singleQueryKey);

      queryClient.setQueriesData<ApiResponse<PaginatedApiResponse<Visit[]>>>(
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

      return { previousVisit, previousVisits };
    },
    onSettled: (_, __, id) => {
      queryClient.invalidateQueries({
        exact: false,
        queryKey: [visitConfig.queryKey],
      });
      queryClient.invalidateQueries({
        exact: true,
        queryKey: [visitConfig.singleQueryKey, id],
      });
    },
  });
};
