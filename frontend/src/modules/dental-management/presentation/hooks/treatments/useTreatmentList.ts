import { ListTreatmentsUseCase } from '@/modules/dental-management/application/use-cases/treatments/list-treatments-use-case';
import { type Treatment } from '@/modules/dental-management/domain/entities/Treatment';
import { TreatmentRepository } from '@/modules/dental-management/infrastructure/repositories/treatment-repository';
import {
  type ApiErrorDetail,
  type ApiResponse,
  type PaginatedApiResponse,
  type PaginationLinks,
  type PaginationMeta,
} from '@/types/ApiResponse';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { treatmentConfig } from '../../config/treatment-config';

export type TreatmentListResponse = {
  entities: Treatment[];
  pagination?: PaginationMeta;
  links?: PaginationLinks;
  isFetching: boolean;
  error: ApiErrorDetail | null;
  message: string;
  refetch: () => Promise<void>;
};

export const useTreatmentList = (
  page: number = 1,
  perPage: number = 10,
  search: string = '',
  searchFields: string[] = treatmentConfig.searchFields?.map((field) => field.value) || [],
  relations: string[] = treatmentConfig.relations ?? [],
  filters: Record<string, string[]> = {}
): TreatmentListResponse => {
  const queryClient = useQueryClient();
  const queryKey = [
    treatmentConfig.queryKey,
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
  } = useQuery<ApiResponse<PaginatedApiResponse<Treatment[]>>>({
    enabled: !queryClient.isMutating({
      predicate: (mutation) =>
        mutation.options.mutationKey?.[0] === treatmentConfig.queryKey &&
        ['create', 'update', 'delete'].includes(mutation.options.mutationKey?.[1] as string),
    }),
    gcTime: 10 * 60 * 1000,
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const treatmentRepository = new TreatmentRepository();
      const listTreatmentsUseCase = new ListTreatmentsUseCase(treatmentRepository);
      const response = await listTreatmentsUseCase.execute(
        search,
        searchFields,
        relations,
        filters,
        page,
        perPage
      );
      if (response.error) {
        toast.error(response.error.message || 'Failed to fetch Treatments', {
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
          code: error.name || 'TREATMENT_LIST_ERROR',
          details: null,
          message: error.message || 'Failed to fetch Treatments',
        }
      : (data?.error ?? null),
    isFetching,
    links: data?.data?.links,
    message: data?.message ?? error?.message ?? 'Treatments fetched successfully',
    pagination: data?.data?.meta,
    refetch,
  };
};
