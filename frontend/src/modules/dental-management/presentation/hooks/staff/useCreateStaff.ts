import { CreateStaffUseCase } from '@/modules/dental-management/application/use-cases/staff/create-staff-use-case';
import { type Staff } from '@/modules/dental-management/domain/entities/Staff';
import { StaffRepository } from '@/modules/dental-management/infrastructure/repositories/staff-repository';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { staffConfig } from '../../config/staff-config';

type CreateStaffMutationContext = {
  previousStaff: [string[], ApiResponse<PaginatedApiResponse<Staff[]>> | undefined][];
};

export const useCreateStaff = (): UseMutationResult<
  ApiResponse<Staff>,
  Error,
  Omit<Staff, 'id' | 'createdAt' | 'updatedAt'>,
  CreateStaffMutationContext
> => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Staff>,
    Error,
    Omit<Staff, 'id' | 'createdAt' | 'updatedAt'>,
    CreateStaffMutationContext
  >({
    mutationFn: (staff) => {
      const staffRepository = new StaffRepository();
      const createStaffUseCase = new CreateStaffUseCase(staffRepository);
      return createStaffUseCase.execute(staff);
    },
    mutationKey: [staffConfig.queryKey, 'create'],
    onError: (_, __, context) => {
      if (context?.previousStaff) {
        for (const [queryKey, data] of context.previousStaff) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onMutate: async (newStaff) => {
      const queryKeyPrefix = [staffConfig.queryKey];
      await queryClient.cancelQueries({ queryKey: queryKeyPrefix });
      const previousStaff = queryClient.getQueriesData<ApiResponse<PaginatedApiResponse<Staff[]>>>({
        queryKey: queryKeyPrefix,
      }) as [string[], ApiResponse<PaginatedApiResponse<Staff[]>> | undefined][];
      const targetQueryKey = [staffConfig.queryKey, 1, 10, '', JSON.stringify({})];
      queryClient.setQueriesData<ApiResponse<PaginatedApiResponse<Staff[]>>>(
        { queryKey: targetQueryKey },
        (old) => {
          if (!old?.data?.data) return old;
          const optimisticStaff: Staff = {
            ...newStaff,
            createdAt: new Date().toISOString(),
            id: -Date.now(),
            updatedAt: new Date().toISOString(),
          };
          return {
            ...old,
            data: {
              ...old.data,
              data: [optimisticStaff, ...old.data.data],
              meta: {
                ...old.data.meta,
                to: old.data.meta.to + 1,
                total: old.data.meta.total + 1,
              },
            },
          };
        }
      );
      return { previousStaff };
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        exact: false,
        queryKey: [staffConfig.queryKey],
      });
    },
  });
};
