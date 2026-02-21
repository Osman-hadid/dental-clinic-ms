import { ListStaffUseCase } from '@/modules/dental-management/application/use-cases/staff/list-staff-use-case';
import { type Staff } from '@/modules/dental-management/domain/entities/Staff';
import { StaffRepository } from '@/modules/dental-management/infrastructure/repositories/staff-repository';
import {
  type ApiErrorDetail,
  type ApiResponse,
  type PaginatedApiResponse,
  type PaginationLinks,
  type PaginationMeta,
} from '@/types/ApiResponse';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { staffConfig } from '../../config/staff-config';

export type StaffListResponse = {
  entities: Staff[];
  pagination?: PaginationMeta;
  links?: PaginationLinks;
  isFetching: boolean;
  error: ApiErrorDetail | null;
  message: string;
  refetch: () => Promise<void>;
};

export const useStaffList = (
  page: number = 1,
  perPage: number = 10,
  search: string = '',
  searchFields: string[] = staffConfig.searchFields?.map((field) => field.value) || [],
  relations: string[] = staffConfig.relations ?? [],
  filters: Record<string, string[]> = {}
): StaffListResponse => {
  const queryClient = useQueryClient();
  const queryKey = [
    staffConfig.queryKey,
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
  } = useQuery<ApiResponse<PaginatedApiResponse<Staff[]>>>({
    enabled: !queryClient.isMutating({
      predicate: (mutation) =>
        mutation.options.mutationKey?.[0] === staffConfig.queryKey &&
        ['create', 'update', 'delete'].includes(mutation.options.mutationKey?.[1] as string),
    }),
    gcTime: 10 * 60 * 1000,
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const staffRepository = new StaffRepository();
      const listStaffUseCase = new ListStaffUseCase(staffRepository);
      const response = await listStaffUseCase.execute(
        search,
        searchFields,
        relations,
        filters,
        page,
        perPage
      );
      if (response.error) {
        toast.error(response.error.message || 'Failed to fetch Staff', {
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
          code: error.name || 'STAFF_LIST_ERROR',
          details: null,
          message: error.message || 'Failed to fetch Staff',
        }
      : (data?.error ?? null),
    isFetching,
    links: data?.data?.links,
    message: data?.message ?? error?.message ?? 'Staff fetched successfully',
    pagination: data?.data?.meta,
    refetch,
  };
};
