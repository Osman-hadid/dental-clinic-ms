import { GetPatientUseCase } from '@/modules/dental-management/application/use-cases/patients/get-patient-use-case';
import { type Patient } from '@/modules/dental-management/domain/entities/Patient';
import { PatientRepository } from '@/modules/dental-management/infrastructure/repositories/patient-repository';
import { type ApiResponse } from '@/types/ApiResponse';
import { useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { patientConfig } from '../../config/patient-config';

export const useGetPatient = (
  id: string | number,
  options: { enabled?: boolean; relations?: string[] } = {}
): UseQueryResult<ApiResponse<Patient>, unknown> => {
  const queryClient = useQueryClient();
  const relations = Array.isArray(options.relations) ? options.relations : [];

  return useQuery<ApiResponse<Patient>>({
    enabled:
      !!id &&
      (options.enabled ?? true) &&
      !queryClient.isMutating({
        predicate: (mutation) =>
          mutation.options.mutationKey?.[0] === patientConfig.queryKey &&
          ['create', 'update', 'delete'].includes(mutation.options.mutationKey?.[1] as string),
      }),
    gcTime: 10 * 60 * 1000,
    queryFn: () => {
      const patientRepository = new PatientRepository();
      const getPatientUseCase = new GetPatientUseCase(patientRepository);
      return getPatientUseCase.execute(id, relations);
    },
    queryKey: [patientConfig.singleQueryKey, id, relations.join(',')],
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });
};
