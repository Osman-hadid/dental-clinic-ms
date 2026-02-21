import { GetVisitUseCase } from '@/modules/dental-management/application/use-cases/visits/get-visit-use-case';
import { type Visit } from '@/modules/dental-management/domain/entities/Visit';
import { VisitRepository } from '@/modules/dental-management/infrastructure/repositories/visit-repository';
import { type ApiResponse } from '@/types/ApiResponse';
import { useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { visitConfig } from '../../config/visit-config';

export const useGetVisit = (
  id: string | number,
  options: { enabled?: boolean } = {}
): UseQueryResult<ApiResponse<Visit>, unknown> => {
  const queryClient = useQueryClient();

  return useQuery<ApiResponse<Visit>>({
    enabled:
      !!id &&
      (options.enabled ?? true) &&
      !queryClient.isMutating({
        predicate: (mutation) =>
          mutation.options.mutationKey?.[0] === visitConfig.queryKey &&
          ['create', 'update', 'delete'].includes(mutation.options.mutationKey?.[1] as string),
      }),
    gcTime: 10 * 60 * 1000,
    queryFn: () => {
      const visitRepository = new VisitRepository();
      const getVisitUseCase = new GetVisitUseCase(visitRepository);
      return getVisitUseCase.execute(id);
    },
    queryKey: [visitConfig.singleQueryKey, id],
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });
};
