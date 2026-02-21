import { CreateVisitUseCase } from '@/modules/dental-management/application/use-cases/visits/create-visit-use-case';
import { type Visit } from '@/modules/dental-management/domain/entities/Visit';
import { VisitRepository } from '@/modules/dental-management/infrastructure/repositories/visit-repository';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { visitConfig } from '../../config/visit-config';

type CreateVisitMutationContext = {
  previousVisits: [string[], ApiResponse<PaginatedApiResponse<Visit[]>> | undefined][];
};

export const useCreateVisit = (): UseMutationResult<
  ApiResponse<Visit>,
  Error,
  Omit<Visit, 'id' | 'createdAt' | 'updatedAt'>,
  CreateVisitMutationContext
> => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Visit>,
    Error,
    Omit<Visit, 'id' | 'createdAt' | 'updatedAt'>,
    CreateVisitMutationContext
  >({
    mutationFn: (visit) => {
      const visitRepository = new VisitRepository();
      const createVisitUseCase = new CreateVisitUseCase(visitRepository);
      return createVisitUseCase.execute(visit);
    },
    mutationKey: [visitConfig.queryKey, 'create'],
    onError: (_, __, context) => {
      if (context?.previousVisits) {
        for (const [queryKey, data] of context.previousVisits) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onMutate: async (newVisit) => {
      const queryKeyPrefix = [visitConfig.queryKey];
      await queryClient.cancelQueries({ queryKey: queryKeyPrefix });
      const previousVisits = queryClient.getQueriesData<ApiResponse<PaginatedApiResponse<Visit[]>>>(
        {
          queryKey: queryKeyPrefix,
        }
      ) as [string[], ApiResponse<PaginatedApiResponse<Visit[]>> | undefined][];
      const targetQueryKey = [visitConfig.queryKey, 1, 10, '', JSON.stringify({})];
      queryClient.setQueriesData<ApiResponse<PaginatedApiResponse<Visit[]>>>(
        { queryKey: targetQueryKey },
        (old) => {
          if (!old?.data?.data) return old;
          const optimisticVisit: Visit = {
            ...newVisit,
            createdAt: new Date().toISOString(),
            id: -Date.now(),
            updatedAt: new Date().toISOString(),
          };
          return {
            ...old,
            data: {
              ...old.data,
              data: [optimisticVisit, ...old.data.data],
              meta: {
                ...old.data.meta,
                to: old.data.meta.to + 1,
                total: old.data.meta.total + 1,
              },
            },
          };
        }
      );
      return { previousVisits };
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        exact: false,
        queryKey: [visitConfig.queryKey],
      });
    },
  });
};
