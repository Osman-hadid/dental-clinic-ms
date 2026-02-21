import { UpdateTreatmentUseCase } from '@/modules/dental-management/application/use-cases/treatments/update-treatment-use-case';
import { type Treatment } from '@/modules/dental-management/domain/entities/Treatment';
import { TreatmentRepository } from '@/modules/dental-management/infrastructure/repositories/treatment-repository';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { treatmentConfig } from '../../config/treatment-config';

type UpdateTreatmentMutationContext = {
  previousTreatments: [string[], ApiResponse<PaginatedApiResponse<Treatment[]>> | undefined][];
  previousTreatment?: ApiResponse<Treatment>;
};

type UpdateTreatmentVariables = {
  id: string | number;
  data: Partial<Omit<Treatment, 'id' | 'createdAt' | 'updatedAt'>>;
};

export const useUpdateTreatment = (): UseMutationResult<
  ApiResponse<Treatment>,
  Error,
  UpdateTreatmentVariables,
  UpdateTreatmentMutationContext
> => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Treatment>,
    Error,
    { id: string | number; data: Partial<Omit<Treatment, 'id' | 'createdAt' | 'updatedAt'>> },
    UpdateTreatmentMutationContext
  >({
    mutationFn: ({ data, id }) => {
      const treatmentRepository = new TreatmentRepository();
      const updateTreatmentUseCase = new UpdateTreatmentUseCase(treatmentRepository);
      return updateTreatmentUseCase.execute(id, data);
    },
    mutationKey: [treatmentConfig.queryKey, 'update'],
    onError: (_, { id }, context) => {
      if (context?.previousTreatments) {
        for (const [queryKey, data] of context.previousTreatments) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      if (context?.previousTreatment) {
        queryClient.setQueryData([treatmentConfig.singleQueryKey, id], context.previousTreatment);
      }
    },
    onMutate: async ({ data, id }) => {
      const listQueryKey = [treatmentConfig.queryKey];
      const singleQueryKey = [treatmentConfig.singleQueryKey, id];
      await queryClient.cancelQueries({ queryKey: listQueryKey });
      await queryClient.cancelQueries({ queryKey: singleQueryKey });

      const previousTreatments = queryClient.getQueriesData<
        ApiResponse<PaginatedApiResponse<Treatment[]>>
      >({
        queryKey: listQueryKey,
      }) as [string[], ApiResponse<PaginatedApiResponse<Treatment[]>> | undefined][];

      const previousTreatment = queryClient.getQueryData<ApiResponse<Treatment>>(singleQueryKey);

      queryClient.setQueriesData<ApiResponse<PaginatedApiResponse<Treatment[]>>>(
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

      queryClient.setQueryData<ApiResponse<Treatment>>(singleQueryKey, (old) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: { ...old.data, ...data, updatedAt: new Date().toISOString() },
        };
      });

      return { previousTreatment, previousTreatments };
    },
    onSettled: (_, __, { id }) => {
      queryClient.invalidateQueries({
        exact: false,
        queryKey: [treatmentConfig.queryKey],
      });
      queryClient.invalidateQueries({
        exact: true,
        queryKey: [treatmentConfig.singleQueryKey, id],
      });
    },
  });
};
