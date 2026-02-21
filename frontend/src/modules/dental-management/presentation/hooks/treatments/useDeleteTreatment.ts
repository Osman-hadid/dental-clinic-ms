import { DeleteTreatmentUseCase } from '@/modules/dental-management/application/use-cases/treatments/delete-treatment-use-case';
import { TreatmentRepository } from '@/modules/dental-management/infrastructure/repositories/treatment-repository';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { type Treatment } from '../../../domain/entities/Treatment';
import { treatmentConfig } from '../../config/treatment-config';

type DeleteTreatmentMutationContext = {
  previousTreatments: [string[], ApiResponse<PaginatedApiResponse<Treatment[]>> | undefined][];
  previousTreatment?: ApiResponse<Treatment>;
};

export const useDeleteTreatment = (): UseMutationResult<
  ApiResponse<null>,
  Error,
  string | number,
  DeleteTreatmentMutationContext
> => {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<null>, Error, string | number, DeleteTreatmentMutationContext>({
    mutationFn: (id) => {
      const treatmentRepository = new TreatmentRepository();
      const deleteTreatmentUseCase = new DeleteTreatmentUseCase(treatmentRepository);
      return deleteTreatmentUseCase.execute(id);
    },
    mutationKey: [treatmentConfig.queryKey, 'delete'],
    onError: (_, id, context) => {
      if (context?.previousTreatments) {
        for (const [queryKey, data] of context.previousTreatments) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      if (context?.previousTreatment) {
        queryClient.setQueryData([treatmentConfig.singleQueryKey, id], context.previousTreatment);
      }
    },
    onMutate: async (id) => {
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

      return { previousTreatment, previousTreatments };
    },
    onSettled: (_, __, id) => {
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
