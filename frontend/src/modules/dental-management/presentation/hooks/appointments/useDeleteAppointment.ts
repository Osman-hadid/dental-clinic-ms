import { DeleteAppointmentUseCase } from '@/modules/dental-management/application/use-cases/appointments/delete-appointment-use-case';
import { AppointmentRepository } from '@/modules/dental-management/infrastructure/repositories/appointment-repository';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { type Appointment } from '../../../domain/entities/Appointment';
import { appointmentConfig } from '../../config/appointment-config';

type DeleteAppointmentMutationContext = {
  previousAppointments: [string[], ApiResponse<PaginatedApiResponse<Appointment[]>> | undefined][];
  previousAppointment?: ApiResponse<Appointment>;
};

export const useDeleteAppointment = (): UseMutationResult<
  ApiResponse<null>,
  Error,
  string | number,
  DeleteAppointmentMutationContext
> => {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<null>, Error, string | number, DeleteAppointmentMutationContext>({
    mutationFn: (id) => {
      const appointmentRepository = new AppointmentRepository();
      const deleteAppointmentUseCase = new DeleteAppointmentUseCase(appointmentRepository);
      return deleteAppointmentUseCase.execute(id);
    },
    mutationKey: [appointmentConfig.queryKey, 'delete'],
    onError: (_, id, context) => {
      if (context?.previousAppointments) {
        for (const [queryKey, data] of context.previousAppointments) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      if (context?.previousAppointment) {
        queryClient.setQueryData(
          [appointmentConfig.singleQueryKey, id],
          context.previousAppointment
        );
      }
    },
    onMutate: async (id) => {
      const listQueryKey = [appointmentConfig.queryKey];
      const singleQueryKey = [appointmentConfig.singleQueryKey, id];
      await queryClient.cancelQueries({ queryKey: listQueryKey });
      await queryClient.cancelQueries({ queryKey: singleQueryKey });

      const previousAppointments = queryClient.getQueriesData<
        ApiResponse<PaginatedApiResponse<Appointment[]>>
      >({
        queryKey: listQueryKey,
      }) as [string[], ApiResponse<PaginatedApiResponse<Appointment[]>> | undefined][];

      const previousAppointment =
        queryClient.getQueryData<ApiResponse<Appointment>>(singleQueryKey);

      queryClient.setQueriesData<ApiResponse<PaginatedApiResponse<Appointment[]>>>(
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

      return { previousAppointment, previousAppointments };
    },
    onSettled: (_, __, id) => {
      queryClient.invalidateQueries({
        exact: false,
        queryKey: [appointmentConfig.queryKey],
      });
      queryClient.invalidateQueries({
        exact: true,
        queryKey: [appointmentConfig.singleQueryKey, id],
      });
    },
  });
};
