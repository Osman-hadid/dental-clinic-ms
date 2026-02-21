import { CreateVisitTreatmentUseCase } from '@/modules/dental-management/application/use-cases/visit-treatments/create-visit-treatment-use-case';
import { type VisitTreatment } from '@/modules/dental-management/domain/entities/VisitTreatment';
import { VisitTreatmentRepository } from '@/modules/dental-management/infrastructure/repositories/visit-treatment-repository';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { visitTreatmentConfig } from '../../config/visit-treatment-config';

type CreateVisitTreatmentMutationContext = {
  previousVisitTreatments: [
    string[],
    ApiResponse<PaginatedApiResponse<VisitTreatment[]>> | undefined,
  ][];
};

export const useCreateVisitTreatment = (): UseMutationResult<
  ApiResponse<VisitTreatment>,
  Error,
  Omit<VisitTreatment, 'id' | 'createdAt' | 'updatedAt'>,
  CreateVisitTreatmentMutationContext
> => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<VisitTreatment>,
    Error,
    Omit<VisitTreatment, 'id' | 'createdAt' | 'updatedAt'>,
    CreateVisitTreatmentMutationContext
  >({
    mutationFn: (visitTreatment) => {
      const visitTreatmentRepository = new VisitTreatmentRepository();
      const createVisitTreatmentUseCase = new CreateVisitTreatmentUseCase(visitTreatmentRepository);
      return createVisitTreatmentUseCase.execute(visitTreatment);
    },
    mutationKey: [visitTreatmentConfig.queryKey, 'create'],
    onError: (_, __, context) => {
      if (context?.previousVisitTreatments) {
        for (const [queryKey, data] of context.previousVisitTreatments) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onMutate: async (newVisitTreatment) => {
      const queryKeyPrefix = [visitTreatmentConfig.queryKey];
      await queryClient.cancelQueries({ queryKey: queryKeyPrefix });
      const previousVisitTreatments = queryClient.getQueriesData<
        ApiResponse<PaginatedApiResponse<VisitTreatment[]>>
      >({
        queryKey: queryKeyPrefix,
      }) as [string[], ApiResponse<PaginatedApiResponse<VisitTreatment[]>> | undefined][];
      const targetQueryKey = [visitTreatmentConfig.queryKey, 1, 10, '', JSON.stringify({})];
      queryClient.setQueriesData<ApiResponse<PaginatedApiResponse<VisitTreatment[]>>>(
        { queryKey: targetQueryKey },
        (old) => {
          if (!old?.data?.data) return old;
          const optimisticVisitTreatment: VisitTreatment = {
            ...newVisitTreatment,
            createdAt: new Date().toISOString(),
            id: -Date.now(),
            updatedAt: new Date().toISOString(),
          };
          return {
            ...old,
            data: {
              ...old.data,
              data: [optimisticVisitTreatment, ...old.data.data],
              meta: {
                ...old.data.meta,
                to: old.data.meta.to + 1,
                total: old.data.meta.total + 1,
              },
            },
          };
        }
      );
      return { previousVisitTreatments };
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        exact: false,
        queryKey: [visitTreatmentConfig.queryKey],
      });
    },
  });
};
