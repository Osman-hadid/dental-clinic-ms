import { UpdateVisitUseCase } from '@/modules/dental-management/application/use-cases/visits/update-visit-use-case';
import { type Visit } from '@/modules/dental-management/domain/entities/Visit';
import { VisitRepository } from '@/modules/dental-management/infrastructure/repositories/visit-repository';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { visitConfig } from '../../config/visit-config';

type UpdateVisitMutationContext = {
  previousVisits: [string[], ApiResponse<PaginatedApiResponse<Visit[]>> | undefined][];
  previousVisit?: ApiResponse<Visit>;
};

type UpdateVisitVariables = {
  id: string | number;
  data: Partial<Omit<Visit, 'id' | 'createdAt' | 'updatedAt'>>;
};

export const useUpdateVisit = (): UseMutationResult<
  ApiResponse<Visit>,
  Error,
  UpdateVisitVariables,
  UpdateVisitMutationContext
> => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Visit>,
    Error,
    { id: string | number; data: Partial<Omit<Visit, 'id' | 'createdAt' | 'updatedAt'>> },
    UpdateVisitMutationContext
  >({
    mutationFn: ({ data, id }) => {
      const visitRepository = new VisitRepository();
      const updateVisitUseCase = new UpdateVisitUseCase(visitRepository);
      return updateVisitUseCase.execute(id, data);
    },
    mutationKey: [visitConfig.queryKey, 'update'],
    onError: (_, { id }, context) => {
      if (context?.previousVisits) {
        for (const [queryKey, data] of context.previousVisits) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      if (context?.previousVisit) {
        queryClient.setQueryData([visitConfig.singleQueryKey, id], context.previousVisit);
      }
    },
    onMutate: async ({ data, id }) => {
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
              data: old.data.data.map((item) =>
                item.id === id ? { ...item, ...data, updatedAt: new Date().toISOString() } : item
              ),
            },
          };
        }
      );

      queryClient.setQueryData<ApiResponse<Visit>>(singleQueryKey, (old) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: { ...old.data, ...data, updatedAt: new Date().toISOString() },
        };
      });

      return { previousVisit, previousVisits };
    },
    onSettled: (_, __, { id }) => {
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
