import { DeletePatientUseCase } from '@/modules/dental-management/application/use-cases/patients/delete-patient-use-case';
import { PatientRepository } from '@/modules/dental-management/infrastructure/repositories/patient-repository';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { type Patient } from '../../../domain/entities/Patient';
import { patientConfig } from '../../config/patient-config';

type DeletePatientMutationContext = {
  previousPatients: [string[], ApiResponse<PaginatedApiResponse<Patient[]>> | undefined][];
  previousPatient?: ApiResponse<Patient>;
};

export const useDeletePatient = (): UseMutationResult<
  ApiResponse<null>,
  Error,
  string | number,
  DeletePatientMutationContext
> => {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<null>, Error, string | number, DeletePatientMutationContext>({
    mutationFn: (id) => {
      const patientRepository = new PatientRepository();
      const deletePatientUseCase = new DeletePatientUseCase(patientRepository);
      return deletePatientUseCase.execute(id);
    },
    mutationKey: [patientConfig.queryKey, 'delete'],
    onError: (_, id, context) => {
      if (context?.previousPatients) {
        for (const [queryKey, data] of context.previousPatients) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      if (context?.previousPatient) {
        queryClient.setQueryData([patientConfig.singleQueryKey, id], context.previousPatient);
      }
    },
    onMutate: async (id) => {
      const listQueryKey = [patientConfig.queryKey];
      const singleQueryKey = [patientConfig.singleQueryKey, id];
      await queryClient.cancelQueries({ queryKey: listQueryKey });
      await queryClient.cancelQueries({ queryKey: singleQueryKey });

      const previousPatients = queryClient.getQueriesData<
        ApiResponse<PaginatedApiResponse<Patient[]>>
      >({
        queryKey: listQueryKey,
      }) as [string[], ApiResponse<PaginatedApiResponse<Patient[]>> | undefined][];

      const previousPatient = queryClient.getQueryData<ApiResponse<Patient>>(singleQueryKey);

      queryClient.setQueriesData<ApiResponse<PaginatedApiResponse<Patient[]>>>(
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

      return { previousPatient, previousPatients };
    },
    onSettled: (_, __, id) => {
      queryClient.invalidateQueries({
        exact: false,
        queryKey: [patientConfig.queryKey],
      });
      queryClient.invalidateQueries({
        exact: true,
        queryKey: [patientConfig.singleQueryKey, id],
      });
    },
  });
};
