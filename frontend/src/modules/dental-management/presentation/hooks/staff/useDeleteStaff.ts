import { DeleteStaffUseCase } from '@/modules/dental-management/application/use-cases/staff/delete-staff-use-case';
import { StaffRepository } from '@/modules/dental-management/infrastructure/repositories/staff-repository';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { type Staff } from '../../../domain/entities/Staff';
import { staffConfig } from '../../config/staff-config';

type DeleteStaffMutationContext = {
  previousStaffList: [string[], ApiResponse<PaginatedApiResponse<Staff[]>> | undefined][];
  previousStaff?: ApiResponse<Staff>;
};

export const useDeleteStaff = (): UseMutationResult<
  ApiResponse<null>,
  Error,
  string | number,
  DeleteStaffMutationContext
> => {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<null>, Error, string | number, DeleteStaffMutationContext>({
    mutationFn: (id) => {
      const staffRepository = new StaffRepository();
      const deleteStaffUseCase = new DeleteStaffUseCase(staffRepository);
      return deleteStaffUseCase.execute(id);
    },
    mutationKey: [staffConfig.queryKey, 'delete'],
    onError: (_, id, context) => {
      if (context?.previousStaffList) {
        for (const [queryKey, data] of context.previousStaffList) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      if (context?.previousStaff) {
        queryClient.setQueryData([staffConfig.singleQueryKey, id], context.previousStaff);
      }
    },
    onMutate: async (id) => {
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
              data: old.data.data.filter((item) => item.id !== id),
              meta: {
                ...old.data.meta,
                to: old.data.meta.to - 1,
                total: old.data.meta.total - 1,
              },
            },
          };
        }
      );

      queryClient.removeQueries({ queryKey: singleQueryKey });

      return { previousStaff, previousStaffList };
    },
    onSettled: (_, __, id) => {
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
