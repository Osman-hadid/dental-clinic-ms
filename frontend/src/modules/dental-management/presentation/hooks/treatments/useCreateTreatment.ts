import { CreateTreatmentUseCase } from '@/modules/dental-management/application/use-cases/treatments/create-treatment-use-case';
import { type Treatment } from '@/modules/dental-management/domain/entities/Treatment';
import { TreatmentRepository } from '@/modules/dental-management/infrastructure/repositories/treatment-repository';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { treatmentConfig } from '../../config/treatment-config';

type CreateTreatmentMutationContext = {
  previousTreatments: [string[], ApiResponse<PaginatedApiResponse<Treatment[]>> | undefined][];
};

export const useCreateTreatment = (): UseMutationResult<
  ApiResponse<Treatment>,
  Error,
  Omit<Treatment, 'id' | 'createdAt' | 'updatedAt'>,
  CreateTreatmentMutationContext
> => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Treatment>,
    Error,
    Omit<Treatment, 'id' | 'createdAt' | 'updatedAt'>,
    CreateTreatmentMutationContext
  >({
    mutationFn: (treatment) => {
      const treatmentRepository = new TreatmentRepository();
      const createTreatmentUseCase = new CreateTreatmentUseCase(treatmentRepository);
      return createTreatmentUseCase.execute(treatment);
    },
    mutationKey: [treatmentConfig.queryKey, 'create'],
    onError: (_, __, context) => {
      if (context?.previousTreatments) {
        for (const [queryKey, data] of context.previousTreatments) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onMutate: async (newTreatment) => {
      const queryKeyPrefix = [treatmentConfig.queryKey];
      await queryClient.cancelQueries({ queryKey: queryKeyPrefix });
      const previousTreatments = queryClient.getQueriesData<
        ApiResponse<PaginatedApiResponse<Treatment[]>>
      >({
        queryKey: queryKeyPrefix,
      }) as [string[], ApiResponse<PaginatedApiResponse<Treatment[]>> | undefined][];
      const targetQueryKey = [treatmentConfig.queryKey, 1, 10, '', JSON.stringify({})];
      queryClient.setQueriesData<ApiResponse<PaginatedApiResponse<Treatment[]>>>(
        { queryKey: targetQueryKey },
        (old) => {
          if (!old?.data?.data) return old;
          const optimisticTreatment: Treatment = {
            ...newTreatment,
            createdAt: new Date().toISOString(),
            id: -Date.now(),
            updatedAt: new Date().toISOString(),
          };
          return {
            ...old,
            data: {
              ...old.data,
              data: [optimisticTreatment, ...old.data.data],
              meta: {
                ...old.data.meta,
                to: old.data.meta.to + 1,
                total: old.data.meta.total + 1,
              },
            },
          };
        }
      );
      return { previousTreatments };
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        exact: false,
        queryKey: [treatmentConfig.queryKey],
      });
    },
  });
};
