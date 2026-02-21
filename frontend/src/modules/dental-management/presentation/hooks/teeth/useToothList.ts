import { ListTeethUseCase } from '@/modules/dental-management/application/use-cases/teeth/list-teeth-use-case';
import { type Tooth } from '@/modules/dental-management/domain/entities/Tooth';
import { ToothRepository } from '@/modules/dental-management/infrastructure/repositories/tooth-repository';
import {
  type ApiErrorDetail,
  type ApiResponse,
  type PaginatedApiResponse,
  type PaginationLinks,
  type PaginationMeta,
} from '@/types/ApiResponse';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { toothConfig } from '../../config/tooth-config';

export type ToothListResponse = {
  entities: Tooth[];
  pagination?: PaginationMeta;
  links?: PaginationLinks;
  isFetching: boolean;
  error: ApiErrorDetail | null;
  message: string;
  refetch: () => Promise<void>;
};

export const useToothList = (
  page: number = 1,
  perPage: number = 10,
  search: string = '',
  searchFields: string[] = toothConfig.searchFields?.map((field) => field.value) || [],
  relations: string[] = toothConfig.relations ?? [],
  filters: Record<string, string[]> = {}
): ToothListResponse => {
  const queryClient = useQueryClient();
  const queryKey = [
    toothConfig.queryKey,
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
  } = useQuery<ApiResponse<PaginatedApiResponse<Tooth[]>>>({
    enabled: !queryClient.isMutating({
      predicate: (mutation) =>
        mutation.options.mutationKey?.[0] === toothConfig.queryKey &&
        ['create', 'update', 'delete'].includes(mutation.options.mutationKey?.[1] as string),
    }),
    gcTime: 10 * 60 * 1000,
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const toothRepository = new ToothRepository();
      const listTeethUseCase = new ListTeethUseCase(toothRepository);
      const response = await listTeethUseCase.execute(
        search,
        searchFields,
        relations,
        filters,
        page,
        perPage
      );
      if (response.error) {
        toast.error(response.error.message || 'Failed to fetch Teeth', {
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
          code: error.name || 'TOOTH_LIST_ERROR',
          details: null,
          message: error.message || 'Failed to fetch Teeth',
        }
      : (data?.error ?? null),
    isFetching,
    links: data?.data?.links,
    message: data?.message ?? error?.message ?? 'Teeth fetched successfully',
    pagination: data?.data?.meta,
    refetch,
  };
};
