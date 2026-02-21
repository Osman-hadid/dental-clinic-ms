import { ListModulesUseCase } from '@/modules/settings/application/use-cases/modules/list-modules-use-case';
import { type Module } from '@/modules/settings/domain/entities/Module';
import { ModuleRepository } from '@/modules/settings/infrastructure/repositories/module-repository';
import {
  type ApiErrorDetail,
  type ApiResponse,
  type PaginatedApiResponse,
  type PaginationLinks,
  type PaginationMeta,
} from '@/types/ApiResponse';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { moduleConfig } from '../../config/module-config';

export type ModuleListResponse = {
  entities: Module[];
  pagination?: PaginationMeta;
  links?: PaginationLinks;
  isFetching: boolean;
  error: ApiErrorDetail | null;
  message: string;
  refetch: () => Promise<void>;
};

export const useModuleList = (
  page: number = 1,
  perPage: number = 10,
  search: string = '',
  searchFields: string[] = moduleConfig.searchFields?.map((field) => field.value) || [],
  relations: string[] = moduleConfig.relations ?? [],
  filters: Record<string, string[]> = {}
): ModuleListResponse => {
  const queryClient = useQueryClient();
  const queryKey = [
    moduleConfig.queryKey,
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
  } = useQuery<ApiResponse<PaginatedApiResponse<Module[]>>>({
    enabled: !queryClient.isMutating({
      predicate: (mutation) =>
        mutation.options.mutationKey?.[0] === moduleConfig.queryKey &&
        ['create', 'update', 'delete'].includes(mutation.options.mutationKey?.[1] as string),
    }),
    gcTime: 10 * 60 * 1000,
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const moduleRepository = new ModuleRepository();
      const listModulesUseCase = new ListModulesUseCase(moduleRepository);
      const response = await listModulesUseCase.execute(
        search,
        searchFields,
        relations,
        filters,
        page,
        perPage
      );
      if (response.error) {
        toast.error(response.error.message || 'Failed to fetch Modules', {
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
          code: error.name || 'MODULE_LIST_ERROR',
          details: null,
          message: error.message || 'Failed to fetch Modules',
        }
      : (data?.error ?? null),
    isFetching,
    links: data?.data?.links,
    message: data?.message ?? error?.message ?? 'Modules fetched successfully',
    pagination: data?.data?.meta,
    refetch,
  };
};
