import { GetTreatmentUseCase } from '@/modules/dental-management/application/use-cases/treatments/get-treatment-use-case';
import { type Treatment } from '@/modules/dental-management/domain/entities/Treatment';
import { TreatmentRepository } from '@/modules/dental-management/infrastructure/repositories/treatment-repository';
import { type ApiResponse } from '@/types/ApiResponse';
import { useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { treatmentConfig } from '../../config/treatment-config';

export const useGetTreatment = (
  id: string | number,
  options: { enabled?: boolean } = {}
): UseQueryResult<ApiResponse<Treatment>, unknown> => {
  const queryClient = useQueryClient();

  return useQuery<ApiResponse<Treatment>>({
    enabled:
      !!id &&
      (options.enabled ?? true) &&
      !queryClient.isMutating({
        predicate: (mutation) =>
          mutation.options.mutationKey?.[0] === treatmentConfig.queryKey &&
          ['create', 'update', 'delete'].includes(mutation.options.mutationKey?.[1] as string),
      }),
    gcTime: 10 * 60 * 1000,
    queryFn: () => {
      const treatmentRepository = new TreatmentRepository();
      const getTreatmentUseCase = new GetTreatmentUseCase(treatmentRepository);
      return getTreatmentUseCase.execute(id);
    },
    queryKey: [treatmentConfig.singleQueryKey, id],
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });
};
