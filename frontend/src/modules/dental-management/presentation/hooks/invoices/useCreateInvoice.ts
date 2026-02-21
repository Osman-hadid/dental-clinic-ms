import { CreateInvoiceUseCase } from '@/modules/dental-management/application/use-cases/invoices/create-invoice-use-case';
import { type Invoice } from '@/modules/dental-management/domain/entities/Invoice';
import { InvoiceRepository } from '@/modules/dental-management/infrastructure/repositories/invoice-repository';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { invoiceConfig } from '../../config/invoice-config';

type CreateInvoiceMutationContext = {
  previousInvoices: [string[], ApiResponse<PaginatedApiResponse<Invoice[]>> | undefined][];
};

export const useCreateInvoice = (): UseMutationResult<
  ApiResponse<Invoice>,
  Error,
  Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>,
  CreateInvoiceMutationContext
> => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Invoice>,
    Error,
    Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>,
    CreateInvoiceMutationContext
  >({
    mutationFn: (invoice) => {
      const invoiceRepository = new InvoiceRepository();
      const createInvoiceUseCase = new CreateInvoiceUseCase(invoiceRepository);
      return createInvoiceUseCase.execute(invoice);
    },
    mutationKey: [invoiceConfig.queryKey, 'create'],
    onError: (_, __, context) => {
      if (context?.previousInvoices) {
        for (const [queryKey, data] of context.previousInvoices) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onMutate: async (newInvoice) => {
      const queryKeyPrefix = [invoiceConfig.queryKey];
      await queryClient.cancelQueries({ queryKey: queryKeyPrefix });
      const previousInvoices = queryClient.getQueriesData<
        ApiResponse<PaginatedApiResponse<Invoice[]>>
      >({
        queryKey: queryKeyPrefix,
      }) as [string[], ApiResponse<PaginatedApiResponse<Invoice[]>> | undefined][];
      const targetQueryKey = [invoiceConfig.queryKey, 1, 10, '', JSON.stringify({})];
      queryClient.setQueriesData<ApiResponse<PaginatedApiResponse<Invoice[]>>>(
        { queryKey: targetQueryKey },
        (old) => {
          if (!old?.data?.data) return old;
          const optimisticInvoice: Invoice = {
            ...newInvoice,
            createdAt: new Date().toISOString(),
            id: -Date.now(),
            updatedAt: new Date().toISOString(),
          };
          return {
            ...old,
            data: {
              ...old.data,
              data: [optimisticInvoice, ...old.data.data],
              meta: {
                ...old.data.meta,
                to: old.data.meta.to + 1,
                total: old.data.meta.total + 1,
              },
            },
          };
        }
      );
      return { previousInvoices };
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        exact: false,
        queryKey: [invoiceConfig.queryKey],
      });
    },
  });
};
