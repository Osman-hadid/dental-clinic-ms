import { ListPatientsUseCase } from '@/modules/dental-management/application/use-cases/patients/list-patients-use-case';
import { type Patient } from '@/modules/dental-management/domain/entities/Patient';
import { PatientRepository } from '@/modules/dental-management/infrastructure/repositories/patient-repository';
import {
  type ApiErrorDetail,
  type ApiResponse,
  type PaginatedApiResponse,
  type PaginationLinks,
  type PaginationMeta,
} from '@/types/ApiResponse';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { patientConfig } from '../../config/patient-config';

export type PatientListResponse = {
  entities: Patient[];
  pagination?: PaginationMeta;
  links?: PaginationLinks;
  isFetching: boolean;
  error: ApiErrorDetail | null;
  message: string;
  refetch: () => Promise<void>;
};

export const usePatientList = (
  page: number = 1,
  perPage: number = 10,
  search: string = '',
  searchFields: string[] = patientConfig.searchFields?.map((field) => field.value) || [],
  relations: string[] = patientConfig.relations ?? [],
  filters: Record<string, string[]> = {}
): PatientListResponse => {
  const queryClient = useQueryClient();
  const queryKey = [
    patientConfig.queryKey,
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
  } = useQuery<ApiResponse<PaginatedApiResponse<Patient[]>>>({
    enabled: !queryClient.isMutating({
      predicate: (mutation) =>
        mutation.options.mutationKey?.[0] === patientConfig.queryKey &&
        ['create', 'update', 'delete'].includes(mutation.options.mutationKey?.[1] as string),
    }),
    gcTime: 10 * 60 * 1000,
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const patientRepository = new PatientRepository();
      const listPatientsUseCase = new ListPatientsUseCase(patientRepository);
      const response = await listPatientsUseCase.execute(
        search,
        searchFields,
        relations,
        filters,
        page,
        perPage
      );
      if (response.error) {
        toast.error(response.error.message || 'Failed to fetch Patients', {
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
          code: error.name || 'PATIENT_LIST_ERROR',
          details: null,
          message: error.message || 'Failed to fetch Patients',
        }
      : (data?.error ?? null),
    isFetching,
    links: data?.data?.links,
    message: data?.message ?? error?.message ?? 'Patients fetched successfully',
    pagination: data?.data?.meta,
    refetch,
  };
};
