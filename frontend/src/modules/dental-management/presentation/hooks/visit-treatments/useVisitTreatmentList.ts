import { ListVisitTreatmentsUseCase } from '@/modules/dental-management/application/use-cases/visit-treatments/list-visit-treatments-use-case';
import { type VisitTreatment } from '@/modules/dental-management/domain/entities/VisitTreatment';
import { VisitTreatmentRepository } from '@/modules/dental-management/infrastructure/repositories/visit-treatment-repository';
import {
  type ApiErrorDetail,
  type ApiResponse,
  type PaginatedApiResponse,
  type PaginationLinks,
  type PaginationMeta,
} from '@/types/ApiResponse';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { visitTreatmentConfig } from '../../config/visit-treatment-config';

export type VisitTreatmentListResponse = {
  entities: VisitTreatment[];
  pagination?: PaginationMeta;
  links?: PaginationLinks;
  isFetching: boolean;
  error: ApiErrorDetail | null;
  message: string;
  refetch: () => Promise<void>;
};

export const useVisitTreatmentList = (
  page: number = 1,
  perPage: number = 10,
  search: string = '',
  searchFields: string[] = visitTreatmentConfig.searchFields?.map((field) => field.value) || [],
  relations: string[] = visitTreatmentConfig.relations ?? [],
  filters: Record<string, string[]> = {}
): VisitTreatmentListResponse => {
  const queryClient = useQueryClient();
  const queryKey = [
    visitTreatmentConfig.queryKey,
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
  } = useQuery<ApiResponse<PaginatedApiResponse<VisitTreatment[]>>>({
    enabled: !queryClient.isMutating({
      predicate: (mutation) =>
        mutation.options.mutationKey?.[0] === visitTreatmentConfig.queryKey &&
        ['create', 'update', 'delete'].includes(mutation.options.mutationKey?.[1] as string),
    }),
    gcTime: 10 * 60 * 1000,
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const visitTreatmentRepository = new VisitTreatmentRepository();
      const listVisitTreatmentsUseCase = new ListVisitTreatmentsUseCase(visitTreatmentRepository);
      const response = await listVisitTreatmentsUseCase.execute(
        search,
        searchFields,
        relations,
        filters,
        page,
        perPage
      );
      if (response.error) {
        toast.error(response.error.message || 'Failed to fetch Visit Treatments', {
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
          code: error.name || 'VISIT_TREATMENT_LIST_ERROR',
          details: null,
          message: error.message || 'Failed to fetch Visit Treatments',
        }
      : (data?.error ?? null),
    isFetching,
    links: data?.data?.links,
    message: data?.message ?? error?.message ?? 'Visit Treatments fetched successfully',
    pagination: data?.data?.meta,
    refetch,
  };
};
