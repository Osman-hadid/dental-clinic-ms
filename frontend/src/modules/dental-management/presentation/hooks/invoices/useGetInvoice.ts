import { GetInvoiceUseCase } from '@/modules/dental-management/application/use-cases/invoices/get-invoice-use-case';
import { type Invoice } from '@/modules/dental-management/domain/entities/Invoice';
import { InvoiceRepository } from '@/modules/dental-management/infrastructure/repositories/invoice-repository';
import { type ApiResponse } from '@/types/ApiResponse';
import { useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { invoiceConfig } from '../../config/invoice-config';

export const useGetInvoice = (
  id: string | number,
  options: { enabled?: boolean } = {}
): UseQueryResult<ApiResponse<Invoice>, unknown> => {
  const queryClient = useQueryClient();

  return useQuery<ApiResponse<Invoice>>({
    enabled:
      !!id &&
      (options.enabled ?? true) &&
      !queryClient.isMutating({
        predicate: (mutation) =>
          mutation.options.mutationKey?.[0] === invoiceConfig.queryKey &&
          ['create', 'update', 'delete'].includes(mutation.options.mutationKey?.[1] as string),
      }),
    gcTime: 10 * 60 * 1000,
    queryFn: () => {
      const invoiceRepository = new InvoiceRepository();
      const getInvoiceUseCase = new GetInvoiceUseCase(invoiceRepository);
      return getInvoiceUseCase.execute(id);
    },
    queryKey: [invoiceConfig.singleQueryKey, id],
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });
};
