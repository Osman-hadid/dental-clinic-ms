import { DeleteVisitTreatmentUseCase } from '@/modules/dental-management/application/use-cases/visit-treatments/delete-visit-treatment-use-case';
import { VisitTreatmentRepository } from '@/modules/dental-management/infrastructure/repositories/visit-treatment-repository';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { type VisitTreatment } from '../../../domain/entities/VisitTreatment';
import { visitTreatmentConfig } from '../../config/visit-treatment-config';

type DeleteVisitTreatmentMutationContext = {
  previousVisitTreatments: [
    string[],
    ApiResponse<PaginatedApiResponse<VisitTreatment[]>> | undefined,
  ][];
  previousVisitTreatment?: ApiResponse<VisitTreatment>;
};

export const useDeleteVisitTreatment = (): UseMutationResult<
  ApiResponse<null>,
  Error,
  string | number,
  DeleteVisitTreatmentMutationContext
> => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<null>,
    Error,
    string | number,
    DeleteVisitTreatmentMutationContext
  >({
    mutationFn: (id) => {
      const visitTreatmentRepository = new VisitTreatmentRepository();
      const deleteVisitTreatmentUseCase = new DeleteVisitTreatmentUseCase(visitTreatmentRepository);
      return deleteVisitTreatmentUseCase.execute(id);
    },
    mutationKey: [visitTreatmentConfig.queryKey, 'delete'],
    onError: (_, id, context) => {
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
    onMutate: async (id) => {
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

      return { previousVisitTreatment, previousVisitTreatments };
    },
    onSettled: (_, __, id) => {
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
