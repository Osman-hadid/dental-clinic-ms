import { ListInvoicesUseCase } from '@/modules/dental-management/application/use-cases/invoices/list-invoices-use-case';
import { type Invoice } from '@/modules/dental-management/domain/entities/Invoice';
import { InvoiceRepository } from '@/modules/dental-management/infrastructure/repositories/invoice-repository';
import {
  type ApiErrorDetail,
  type ApiResponse,
  type PaginatedApiResponse,
  type PaginationLinks,
  type PaginationMeta,
} from '@/types/ApiResponse';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { invoiceConfig } from '../../config/invoice-config';

export type InvoiceListResponse = {
  entities: Invoice[];
  pagination?: PaginationMeta;
  links?: PaginationLinks;
  isFetching: boolean;
  error: ApiErrorDetail | null;
  message: string;
  refetch: () => Promise<void>;
};

export const useInvoiceList = (
  page: number = 1,
  perPage: number = 10,
  search: string = '',
  searchFields: string[] = invoiceConfig.searchFields?.map((field) => field.value) || [],
  relations: string[] = invoiceConfig.relations ?? [],
  filters: Record<string, string[]> = {}
): InvoiceListResponse => {
  const queryClient = useQueryClient();
  const queryKey = [
    invoiceConfig.queryKey,
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
  } = useQuery<ApiResponse<PaginatedApiResponse<Invoice[]>>>({
    enabled: !queryClient.isMutating({
      predicate: (mutation) =>
        mutation.options.mutationKey?.[0] === invoiceConfig.queryKey &&
        ['create', 'update', 'delete'].includes(mutation.options.mutationKey?.[1] as string),
    }),
    gcTime: 10 * 60 * 1000,
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const invoiceRepository = new InvoiceRepository();
      const listInvoicesUseCase = new ListInvoicesUseCase(invoiceRepository);
      const response = await listInvoicesUseCase.execute(
        search,
        searchFields,
        relations,
        filters,
        page,
        perPage
      );
      if (response.error) {
        toast.error(response.error.message || 'Failed to fetch Invoices', {
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
          code: error.name || 'INVOICE_LIST_ERROR',
          details: null,
          message: error.message || 'Failed to fetch Invoices',
        }
      : (data?.error ?? null),
    isFetching,
    links: data?.data?.links,
    message: data?.message ?? error?.message ?? 'Invoices fetched successfully',
    pagination: data?.data?.meta,
    refetch,
  };
};
