import { GetVisitTreatmentUseCase } from '@/modules/dental-management/application/use-cases/visit-treatments/get-visit-treatment-use-case';
import { type VisitTreatment } from '@/modules/dental-management/domain/entities/VisitTreatment';
import { VisitTreatmentRepository } from '@/modules/dental-management/infrastructure/repositories/visit-treatment-repository';
import { type ApiResponse } from '@/types/ApiResponse';
import { useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { visitTreatmentConfig } from '../../config/visit-treatment-config';

export const useGetVisitTreatment = (
  id: string | number,
  options: { enabled?: boolean } = {}
): UseQueryResult<ApiResponse<VisitTreatment>, unknown> => {
  const queryClient = useQueryClient();

  return useQuery<ApiResponse<VisitTreatment>>({
    enabled:
      !!id &&
      (options.enabled ?? true) &&
      !queryClient.isMutating({
        predicate: (mutation) =>
          mutation.options.mutationKey?.[0] === visitTreatmentConfig.queryKey &&
          ['create', 'update', 'delete'].includes(mutation.options.mutationKey?.[1] as string),
      }),
    gcTime: 10 * 60 * 1000,
    queryFn: () => {
      const visitTreatmentRepository = new VisitTreatmentRepository();
      const getVisitTreatmentUseCase = new GetVisitTreatmentUseCase(visitTreatmentRepository);
      return getVisitTreatmentUseCase.execute(id);
    },
    queryKey: [visitTreatmentConfig.singleQueryKey, id],
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });
};
