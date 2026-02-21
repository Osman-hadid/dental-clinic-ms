import { CreatePatientUseCase } from '@/modules/dental-management/application/use-cases/patients/create-patient-use-case';
import { type Patient } from '@/modules/dental-management/domain/entities/Patient';
import { PatientRepository } from '@/modules/dental-management/infrastructure/repositories/patient-repository';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { patientConfig } from '../../config/patient-config';

type CreatePatientMutationContext = {
  previousPatients: [string[], ApiResponse<PaginatedApiResponse<Patient[]>> | undefined][];
};

export const useCreatePatient = (): UseMutationResult<
  ApiResponse<Patient>,
  Error,
  Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>,
  CreatePatientMutationContext
> => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Patient>,
    Error,
    Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>,
    CreatePatientMutationContext
  >({
    mutationFn: (patient) => {
      const patientRepository = new PatientRepository();
      const createPatientUseCase = new CreatePatientUseCase(patientRepository);
      return createPatientUseCase.execute(patient);
    },
    mutationKey: [patientConfig.queryKey, 'create'],
    onError: (_, __, context) => {
      if (context?.previousPatients) {
        for (const [queryKey, data] of context.previousPatients) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onMutate: async (newPatient) => {
      const queryKeyPrefix = [patientConfig.queryKey];
      await queryClient.cancelQueries({ queryKey: queryKeyPrefix });
      const previousPatients = queryClient.getQueriesData<
        ApiResponse<PaginatedApiResponse<Patient[]>>
      >({
        queryKey: queryKeyPrefix,
      }) as [string[], ApiResponse<PaginatedApiResponse<Patient[]>> | undefined][];
      const targetQueryKey = [patientConfig.queryKey, 1, 10, '', JSON.stringify({})];
      queryClient.setQueriesData<ApiResponse<PaginatedApiResponse<Patient[]>>>(
        { queryKey: targetQueryKey },
        (old) => {
          if (!old?.data?.data) return old;
          const optimisticPatient: Patient = {
            ...newPatient,
            createdAt: new Date().toISOString(),
            id: -Date.now(),
            updatedAt: new Date().toISOString(),
          };
          return {
            ...old,
            data: {
              ...old.data,
              data: [optimisticPatient, ...old.data.data],
              meta: {
                ...old.data.meta,
                to: old.data.meta.to + 1,
                total: old.data.meta.total + 1,
              },
            },
          };
        }
      );
      return { previousPatients };
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        exact: false,
        queryKey: [patientConfig.queryKey],
      });
    },
  });
};
