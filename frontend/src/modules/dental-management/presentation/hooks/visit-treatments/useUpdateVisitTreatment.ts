import { UpdateVisitTreatmentUseCase } from '@/modules/dental-management/application/use-cases/visit-treatments/update-visit-treatment-use-case';
import { type VisitTreatment } from '@/modules/dental-management/domain/entities/VisitTreatment';
import { VisitTreatmentRepository } from '@/modules/dental-management/infrastructure/repositories/visit-treatment-repository';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { visitTreatmentConfig } from '../../config/visit-treatment-config';

type UpdateVisitTreatmentMutationContext = {
  previousVisitTreatments: [
    string[],
    ApiResponse<PaginatedApiResponse<VisitTreatment[]>> | undefined,
  ][];
  previousVisitTreatment?: ApiResponse<VisitTreatment>;
};

type UpdateVisitTreatmentVariables = {
  id: string | number;
  data: Partial<Omit<VisitTreatment, 'id' | 'createdAt' | 'updatedAt'>>;
};

export const useUpdateVisitTreatment = (): UseMutationResult<
  ApiResponse<VisitTreatment>,
  Error,
  UpdateVisitTreatmentVariables,
  UpdateVisitTreatmentMutationContext
> => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<VisitTreatment>,
    Error,
    { id: string | number; data: Partial<Omit<VisitTreatment, 'id' | 'createdAt' | 'updatedAt'>> },
    UpdateVisitTreatmentMutationContext
  >({
    mutationFn: ({ data, id }) => {
      const visitTreatmentRepository = new VisitTreatmentRepository();
      const updateVisitTreatmentUseCase = new UpdateVisitTreatmentUseCase(visitTreatmentRepository);
      return updateVisitTreatmentUseCase.execute(id, data);
    },
    mutationKey: [visitTreatmentConfig.queryKey, 'update'],
    onError: (_, { id }, context) => {
      if (context?.previousVisitTreatments) {
        for (const [queryKey, data] of context.previousVisitTreatments) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      if (context?.previousVisitTreatment) {
        queryClient.setQueryData(
          [visitTreatmentConfig.singleQueryKey, id],
          context.previousVisitTreatment
        );
      }
    },
    onMutate: async ({ data, id }) => {
      const listQueryKey = [visitTreatmentConfig.queryKey];
      const singleQueryKey = [visitTreatmentConfig.singleQueryKey, id];
      await queryClient.cancelQueries({ queryKey: listQueryKey });
      await queryClient.cancelQueries({ queryKey: singleQueryKey });

      const previousVisitTreatments = queryClient.getQueriesData<
        ApiResponse<PaginatedApiResponse<VisitTreatment[]>>
      >({
        queryKey: listQueryKey,
      }) as [string[], ApiResponse<PaginatedApiResponse<VisitTreatment[]>> | undefined][];

      const previousVisitTreatment =
        queryClient.getQueryData<ApiResponse<VisitTreatment>>(singleQueryKey);

      queryClient.setQueriesData<ApiResponse<PaginatedApiResponse<VisitTreatment[]>>>(
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

      queryClient.setQueryData<ApiResponse<VisitTreatment>>(singleQueryKey, (old) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: { ...old.data, ...data, updatedAt: new Date().toISOString() },
        };
      });

      return { previousVisitTreatment, previousVisitTreatments };
    },
    onSettled: (_, __, { id }) => {
      queryClient.invalidateQueries({
        exact: false,
        queryKey: [visitTreatmentConfig.queryKey],
      });
      queryClient.invalidateQueries({
        exact: true,
        queryKey: [visitTreatmentConfig.singleQueryKey, id],
      });
    },
  });
};
