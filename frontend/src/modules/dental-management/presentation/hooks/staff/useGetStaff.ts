import { GetStaffUseCase } from '@/modules/dental-management/application/use-cases/staff/get-staff-use-case';
import { type Staff } from '@/modules/dental-management/domain/entities/Staff';
import { StaffRepository } from '@/modules/dental-management/infrastructure/repositories/staff-repository';
import { type ApiResponse } from '@/types/ApiResponse';
import { useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { staffConfig } from '../../config/staff-config';

export const useGetStaff = (
  id: string | number,
  options: { enabled?: boolean } = {}
): UseQueryResult<ApiResponse<Staff>, unknown> => {
  const queryClient = useQueryClient();

  return useQuery<ApiResponse<Staff>>({
    enabled:
      !!id &&
      (options.enabled ?? true) &&
      !queryClient.isMutating({
        predicate: (mutation) =>
          mutation.options.mutationKey?.[0] === staffConfig.queryKey &&
          ['create', 'update', 'delete'].includes(mutation.options.mutationKey?.[1] as string),
      }),
    gcTime: 10 * 60 * 1000,
    queryFn: () => {
      const staffRepository = new StaffRepository();
      const getStaffUseCase = new GetStaffUseCase(staffRepository);
      return getStaffUseCase.execute(id);
    },
    queryKey: [staffConfig.singleQueryKey, id],
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });
};
