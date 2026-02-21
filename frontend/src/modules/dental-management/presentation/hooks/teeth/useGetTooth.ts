import { GetToothUseCase } from '@/modules/dental-management/application/use-cases/teeth/get-tooth-use-case';
import { type Tooth } from '@/modules/dental-management/domain/entities/Tooth';
import { ToothRepository } from '@/modules/dental-management/infrastructure/repositories/tooth-repository';
import { type ApiResponse } from '@/types/ApiResponse';
import { useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { toothConfig } from '../../config/tooth-config';

export const useGetTooth = (
  id: string | number,
  options: { enabled?: boolean } = {}
): UseQueryResult<ApiResponse<Tooth>, unknown> => {
  const queryClient = useQueryClient();

  return useQuery<ApiResponse<Tooth>>({
    enabled:
      !!id &&
      (options.enabled ?? true) &&
      !queryClient.isMutating({
        predicate: (mutation) =>
          mutation.options.mutationKey?.[0] === toothConfig.queryKey &&
          ['create', 'update', 'delete'].includes(mutation.options.mutationKey?.[1] as string),
      }),
    gcTime: 10 * 60 * 1000,
    queryFn: () => {
      const toothRepository = new ToothRepository();
      const getToothUseCase = new GetToothUseCase(toothRepository);
      return getToothUseCase.execute(id);
    },
    queryKey: [toothConfig.singleQueryKey, id],
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });
};
