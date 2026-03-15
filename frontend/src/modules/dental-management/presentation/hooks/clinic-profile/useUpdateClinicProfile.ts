import { UpdateClinicProfileUseCase } from '@/modules/dental-management/application/use-cases/clinic-profile/update-clinic-profile-use-case';
import { type ClinicProfile } from '@/modules/dental-management/domain/entities/ClinicProfile';
import { ClinicProfileRepository } from '@/modules/dental-management/infrastructure/repositories/clinic-profile-repository';
import { type ApiResponse } from '@/types/ApiResponse';
import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { clinicProfileConfig } from '../../config/clinic-profile-config';

type UpdateClinicProfileVariables = Partial<ClinicProfile> & { logoPath?: File | string | null };

export const useUpdateClinicProfile = (): UseMutationResult<
  ApiResponse<ClinicProfile>,
  Error,
  UpdateClinicProfileVariables
> => {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<ClinicProfile>, Error, UpdateClinicProfileVariables>({
    mutationFn: (payload) => {
      const repository = new ClinicProfileRepository();
      const updateClinicProfileUseCase = new UpdateClinicProfileUseCase(repository);
      return updateClinicProfileUseCase.execute(payload);
    },
    mutationKey: [clinicProfileConfig.queryKey, 'update'],
    onSuccess: (response) => {
      if (response.success) {
        queryClient.setQueryData([clinicProfileConfig.queryKey], response);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [clinicProfileConfig.queryKey] });
    },
  });
};
