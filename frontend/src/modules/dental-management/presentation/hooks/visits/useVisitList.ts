import { ListVisitsUseCase } from '@/modules/dental-management/application/use-cases/visits/list-visits-use-case';
import { type Visit } from '@/modules/dental-management/domain/entities/Visit';
import { VisitRepository } from '@/modules/dental-management/infrastructure/repositories/visit-repository';
import {
  type ApiErrorDetail,
  type ApiResponse,
  type PaginatedApiResponse,
  type PaginationLinks,
  type PaginationMeta,
} from '@/types/ApiResponse';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { visitConfig } from '../../config/visit-config';

export type VisitListResponse = {
  entities: Visit[];
  pagination?: PaginationMeta;
  links?: PaginationLinks;
  isFetching: boolean;
  error: ApiErrorDetail | null;
  message: string;
  refetch: () => Promise<void>;
};

export const useVisitList = (
  page: number = 1,
  perPage: number = 10,
  search: string = '',
  searchFields: string[] = visitConfig.searchFields?.map((field) => field.value) || [],
  relations: string[] = visitConfig.relations ?? [],
  filters: Record<string, string[]> = {}
): VisitListResponse => {
  const queryClient = useQueryClient();
  const queryKey = [
    visitConfig.queryKey,
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
  } = useQuery<ApiResponse<PaginatedApiResponse<Visit[]>>>({
    enabled: !queryClient.isMutating({
      predicate: (mutation) =>
        mutation.options.mutationKey?.[0] === visitConfig.queryKey &&
        ['create', 'update', 'delete'].includes(mutation.options.mutationKey?.[1] as string),
    }),
    gcTime: 10 * 60 * 1000,
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const visitRepository = new VisitRepository();
      const listVisitsUseCase = new ListVisitsUseCase(visitRepository);
      const response = await listVisitsUseCase.execute(
        search,
        searchFields,
        relations,
        filters,
        page,
        perPage
      );
      if (response.error) {
        toast.error(response.error.message || 'Failed to fetch Visits', {
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
          code: error.name || 'VISIT_LIST_ERROR',
          details: null,
          message: error.message || 'Failed to fetch Visits',
        }
      : (data?.error ?? null),
    isFetching,
    links: data?.data?.links,
    message: data?.message ?? error?.message ?? 'Visits fetched successfully',
    pagination: data?.data?.meta,
    refetch,
  };
};
