import { CreateAppointmentUseCase } from '@/modules/dental-management/application/use-cases/appointments/create-appointment-use-case';
import { type Appointment } from '@/modules/dental-management/domain/entities/Appointment';
import { AppointmentRepository } from '@/modules/dental-management/infrastructure/repositories/appointment-repository';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { appointmentConfig } from '../../config/appointment-config';

type CreateAppointmentMutationContext = {
  previousAppointments: [string[], ApiResponse<PaginatedApiResponse<Appointment[]>> | undefined][];
};

export const useCreateAppointment = (): UseMutationResult<
  ApiResponse<Appointment>,
  Error,
  Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>,
  CreateAppointmentMutationContext
> => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Appointment>,
    Error,
    Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>,
    CreateAppointmentMutationContext
  >({
    mutationFn: (appointment) => {
      const appointmentRepository = new AppointmentRepository();
      const createAppointmentUseCase = new CreateAppointmentUseCase(appointmentRepository);
      return createAppointmentUseCase.execute(appointment);
    },
    mutationKey: [appointmentConfig.queryKey, 'create'],
    onError: (_, __, context) => {
      if (context?.previousAppointments) {
        for (const [queryKey, data] of context.previousAppointments) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onMutate: async (newAppointment) => {
      const queryKeyPrefix = [appointmentConfig.queryKey];
      await queryClient.cancelQueries({ queryKey: queryKeyPrefix });
      const previousAppointments = queryClient.getQueriesData<
        ApiResponse<PaginatedApiResponse<Appointment[]>>
      >({
        queryKey: queryKeyPrefix,
      }) as [string[], ApiResponse<PaginatedApiResponse<Appointment[]>> | undefined][];
      const targetQueryKey = [appointmentConfig.queryKey, 1, 10, '', JSON.stringify({})];
      queryClient.setQueriesData<ApiResponse<PaginatedApiResponse<Appointment[]>>>(
        { queryKey: targetQueryKey },
        (old) => {
          if (!old?.data?.data) return old;
          const optimisticAppointment: Appointment = {
            ...newAppointment,
            createdAt: new Date().toISOString(),
            id: -Date.now(),
            updatedAt: new Date().toISOString(),
          };
          return {
            ...old,
            data: {
              ...old.data,
              data: [optimisticAppointment, ...old.data.data],
              meta: {
                ...old.data.meta,
                to: old.data.meta.to + 1,
                total: old.data.meta.total + 1,
              },
            },
          };
        }
      );
      return { previousAppointments };
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        exact: false,
        queryKey: [appointmentConfig.queryKey],
      });
    },
  });
};
