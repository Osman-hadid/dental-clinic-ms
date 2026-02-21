import { UpdateAppointmentUseCase } from '@/modules/dental-management/application/use-cases/appointments/update-appointment-use-case';
import { type Appointment } from '@/modules/dental-management/domain/entities/Appointment';
import { AppointmentRepository } from '@/modules/dental-management/infrastructure/repositories/appointment-repository';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { appointmentConfig } from '../../config/appointment-config';

type UpdateAppointmentMutationContext = {
  previousAppointments: [string[], ApiResponse<PaginatedApiResponse<Appointment[]>> | undefined][];
  previousAppointment?: ApiResponse<Appointment>;
};

type UpdateAppointmentVariables = {
  id: string | number;
  data: Partial<Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>>;
};

export const useUpdateAppointment = (): UseMutationResult<
  ApiResponse<Appointment>,
  Error,
  UpdateAppointmentVariables,
  UpdateAppointmentMutationContext
> => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Appointment>,
    Error,
    { id: string | number; data: Partial<Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>> },
    UpdateAppointmentMutationContext
  >({
    mutationFn: ({ data, id }) => {
      const appointmentRepository = new AppointmentRepository();
      const updateAppointmentUseCase = new UpdateAppointmentUseCase(appointmentRepository);
      return updateAppointmentUseCase.execute(id, data);
    },
    mutationKey: [appointmentConfig.queryKey, 'update'],
    onError: (_, { id }, context) => {
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
    onMutate: async ({ data, id }) => {
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
              data: old.data.data.map((item) =>
                item.id === id ? { ...item, ...data, updatedAt: new Date().toISOString() } : item
              ),
            },
          };
        }
      );

      queryClient.setQueryData<ApiResponse<Appointment>>(singleQueryKey, (old) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: { ...old.data, ...data, updatedAt: new Date().toISOString() },
        };
      });

      return { previousAppointment, previousAppointments };
    },
    onSettled: (_, __, { id }) => {
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
