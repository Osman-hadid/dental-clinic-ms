import { GetAppointmentUseCase } from '@/modules/dental-management/application/use-cases/appointments/get-appointment-use-case';
import { type Appointment } from '@/modules/dental-management/domain/entities/Appointment';
import { AppointmentRepository } from '@/modules/dental-management/infrastructure/repositories/appointment-repository';
import { type ApiResponse } from '@/types/ApiResponse';
import { useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { appointmentConfig } from '../../config/appointment-config';

export const useGetAppointment = (
  id: string | number,
  options: { enabled?: boolean } = {}
): UseQueryResult<ApiResponse<Appointment>, unknown> => {
  const queryClient = useQueryClient();

  return useQuery<ApiResponse<Appointment>>({
    enabled:
      !!id &&
      (options.enabled ?? true) &&
      !queryClient.isMutating({
        predicate: (mutation) =>
          mutation.options.mutationKey?.[0] === appointmentConfig.queryKey &&
          ['create', 'update', 'delete'].includes(mutation.options.mutationKey?.[1] as string),
      }),
    gcTime: 10 * 60 * 1000,
    queryFn: () => {
      const appointmentRepository = new AppointmentRepository();
      const getAppointmentUseCase = new GetAppointmentUseCase(appointmentRepository);
      return getAppointmentUseCase.execute(id);
    },
    queryKey: [appointmentConfig.singleQueryKey, id],
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });
};
