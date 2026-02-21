import { UpdatePatientUseCase } from '@/modules/dental-management/application/use-cases/patients/update-patient-use-case';
import { type Patient } from '@/modules/dental-management/domain/entities/Patient';
import { PatientRepository } from '@/modules/dental-management/infrastructure/repositories/patient-repository';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { patientConfig } from '../../config/patient-config';

type UpdatePatientMutationContext = {
  previousPatients: [string[], ApiResponse<PaginatedApiResponse<Patient[]>> | undefined][];
  previousPatient?: ApiResponse<Patient>;
};

type UpdatePatientVariables = {
  id: string | number;
  data: Partial<Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>>;
};

export const useUpdatePatient = (): UseMutationResult<
  ApiResponse<Patient>,
  Error,
  UpdatePatientVariables,
  UpdatePatientMutationContext
> => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Patient>,
    Error,
    { id: string | number; data: Partial<Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>> },
    UpdatePatientMutationContext
  >({
    mutationFn: ({ data, id }) => {
      const patientRepository = new PatientRepository();
      const updatePatientUseCase = new UpdatePatientUseCase(patientRepository);
      return updatePatientUseCase.execute(id, data);
    },
    mutationKey: [patientConfig.queryKey, 'update'],
    onError: (_, { id }, context) => {
      if (context?.previousPatients) {
        for (const [queryKey, data] of context.previousPatients) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      if (context?.previousPatient) {
        queryClient.setQueryData([patientConfig.singleQueryKey, id], context.previousPatient);
      }
    },
    onMutate: async ({ data, id }) => {
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
              data: old.data.data.map((item) =>
                item.id === id ? { ...item, ...data, updatedAt: new Date().toISOString() } : item
              ),
            },
          };
        }
      );

      queryClient.setQueryData<ApiResponse<Patient>>(singleQueryKey, (old) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: { ...old.data, ...data, updatedAt: new Date().toISOString() },
        };
      });

      return { previousPatient, previousPatients };
    },
    onSettled: (_, __, { id }) => {
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
