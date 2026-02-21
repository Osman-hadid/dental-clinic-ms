import { UpdateStaffUseCase } from '@/modules/dental-management/application/use-cases/staff/update-staff-use-case';
import { type Staff } from '@/modules/dental-management/domain/entities/Staff';
import { StaffRepository } from '@/modules/dental-management/infrastructure/repositories/staff-repository';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { staffConfig } from '../../config/staff-config';

type UpdateStaffMutationContext = {
  previousStaffList: [string[], ApiResponse<PaginatedApiResponse<Staff[]>> | undefined][];
  previousStaff?: ApiResponse<Staff>;
};

type UpdateStaffVariables = {
  id: string | number;
  data: Partial<Omit<Staff, 'id' | 'createdAt' | 'updatedAt'>>;
};

export const useUpdateStaff = (): UseMutationResult<
  ApiResponse<Staff>,
  Error,
  UpdateStaffVariables,
  UpdateStaffMutationContext
> => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Staff>,
    Error,
    { id: string | number; data: Partial<Omit<Staff, 'id' | 'createdAt' | 'updatedAt'>> },
    UpdateStaffMutationContext
  >({
    mutationFn: ({ data, id }) => {
      const staffRepository = new StaffRepository();
      const updateStaffUseCase = new UpdateStaffUseCase(staffRepository);
      return updateStaffUseCase.execute(id, data);
    },
    mutationKey: [staffConfig.queryKey, 'update'],
    onError: (_, { id }, context) => {
      if (context?.previousStaffList) {
        for (const [queryKey, data] of context.previousStaffList) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      if (context?.previousStaff) {
        queryClient.setQueryData([staffConfig.singleQueryKey, id], context.previousStaff);
      }
    },
    onMutate: async ({ data, id }) => {
      const listQueryKey = [staffConfig.queryKey];
      const singleQueryKey = [staffConfig.singleQueryKey, id];
      await queryClient.cancelQueries({ queryKey: listQueryKey });
      await queryClient.cancelQueries({ queryKey: singleQueryKey });

      const previousStaffList = queryClient.getQueriesData<ApiResponse<PaginatedApiResponse<Staff[]>>>({
        queryKey: listQueryKey,
      }) as [string[], ApiResponse<PaginatedApiResponse<Staff[]>> | undefined][];

      const previousStaff = queryClient.getQueryData<ApiResponse<Staff>>(singleQueryKey);

      queryClient.setQueriesData<ApiResponse<PaginatedApiResponse<Staff[]>>>(
        { queryKey: listQueryKey },
        (old) => {
          if (!old?.data?.data) return old;
          return {
            ...old,
            data: {
              ...old.data,
              data: old.data.data.map((item) =>
                item.id === id ? { ...item, ...data, updatedAt: new Date().toISOString() } : item
              ),
            },
          };
        }
      );

      queryClient.setQueryData<ApiResponse<Staff>>(singleQueryKey, (old) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: { ...old.data, ...data, updatedAt: new Date().toISOString() },
        };
      });

      return { previousStaff, previousStaffList };
    },
    onSettled: (_, __, { id }) => {
      queryClient.invalidateQueries({
        exact: false,
        queryKey: [staffConfig.queryKey],
      });
      queryClient.invalidateQueries({
        exact: true,
        queryKey: [staffConfig.singleQueryKey, id],
      });
    },
  });
};
