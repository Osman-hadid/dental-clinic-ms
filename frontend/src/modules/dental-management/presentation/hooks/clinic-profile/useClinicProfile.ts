import { GetClinicProfileUseCase } from '@/modules/dental-management/application/use-cases/clinic-profile/get-clinic-profile-use-case';
import { type ClinicProfile } from '@/modules/dental-management/domain/entities/ClinicProfile';
import { ClinicProfileRepository } from '@/modules/dental-management/infrastructure/repositories/clinic-profile-repository';
import { type ApiResponse } from '@/types/ApiResponse';
import { useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { clinicProfileConfig } from '../../config/clinic-profile-config';

export const useClinicProfile = (): UseQueryResult<ApiResponse<ClinicProfile | null>, unknown> => {
  const queryClient = useQueryClient();

  return useQuery<ApiResponse<ClinicProfile | null>>({
    enabled: !queryClient.isMutating({
      predicate: (mutation) =>
        mutation.options.mutationKey?.[0] === clinicProfileConfig.queryKey &&
        mutation.options.mutationKey?.[1] === 'update',
    }),
    gcTime: 10 * 60 * 1000,
    queryFn: () => {
      const clinicProfileRepository = new ClinicProfileRepository();
      const getClinicProfileUseCase = new GetClinicProfileUseCase(clinicProfileRepository);
      return getClinicProfileUseCase.execute();
    },
    queryKey: [clinicProfileConfig.queryKey],
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });
};
