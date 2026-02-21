import { ListAppointmentsUseCase } from '@/modules/dental-management/application/use-cases/appointments/list-appointments-use-case';
import { type Appointment } from '@/modules/dental-management/domain/entities/Appointment';
import { AppointmentRepository } from '@/modules/dental-management/infrastructure/repositories/appointment-repository';
import {
  type ApiErrorDetail,
  type ApiResponse,
  type PaginatedApiResponse,
  type PaginationLinks,
  type PaginationMeta,
} from '@/types/ApiResponse';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { appointmentConfig } from '../../config/appointment-config';

export type AppointmentListResponse = {
  entities: Appointment[];
  pagination?: PaginationMeta;
  links?: PaginationLinks;
  isFetching: boolean;
  error: ApiErrorDetail | null;
  message: string;
  refetch: () => Promise<void>;
};

export const useAppointmentList = (
  page: number = 1,
  perPage: number = 10,
  search: string = '',
  searchFields: string[] = appointmentConfig.searchFields?.map((field) => field.value) || [],
  relations: string[] = appointmentConfig.relations ?? [],
  filters: Record<string, string[]> = {}
): AppointmentListResponse => {
  const queryClient = useQueryClient();
  const queryKey = [
    appointmentConfig.queryKey,
    page,
    perPage,
    search,
    searchFields.join(','),
    relations,
    JSON.stringify(filters),
  ] as const;

  const {
    data,
    error,
    isFetching,
    refetch: queryRefetch,
  } = useQuery<ApiResponse<PaginatedApiResponse<Appointment[]>>>({
    enabled: !queryClient.isMutating({
      predicate: (mutation) =>
        mutation.options.mutationKey?.[0] === appointmentConfig.queryKey &&
        ['create', 'update', 'delete'].includes(mutation.options.mutationKey?.[1] as string),
    }),
    gcTime: 10 * 60 * 1000,
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const appointmentRepository = new AppointmentRepository();
      const listAppointmentsUseCase = new ListAppointmentsUseCase(appointmentRepository);
      const response = await listAppointmentsUseCase.execute(
        search,
        searchFields,
        relations,
        filters,
        page,
        perPage
      );
      if (response.error) {
        toast.error(response.error.message || 'Failed to fetch Appointments', {
          position: 'top-center',
          style: {
            background: '#ef4444',
            border: '1px solid #e5e7eb',
            color: '#ffffff',
          },
        });
      }
      return response;
    },
    queryKey,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });

  const refetch = async (): Promise<void> => {
    await queryRefetch();
  };

  return {
    entities: data?.data?.data ?? [],
    error: error
      ? {
          code: error.name || 'APPOINTMENT_LIST_ERROR',
          details: null,
          message: error.message || 'Failed to fetch Appointments',
        }
      : (data?.error ?? null),
    isFetching,
    links: data?.data?.links,
    message: data?.message ?? error?.message ?? 'Appointments fetched successfully',
    pagination: data?.data?.meta,
    refetch,
  };
};
