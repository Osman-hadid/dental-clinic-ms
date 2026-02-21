import { UpdateInvoiceUseCase } from '@/modules/dental-management/application/use-cases/invoices/update-invoice-use-case';
import { type Invoice } from '@/modules/dental-management/domain/entities/Invoice';
import { InvoiceRepository } from '@/modules/dental-management/infrastructure/repositories/invoice-repository';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { invoiceConfig } from '../../config/invoice-config';

type UpdateInvoiceMutationContext = {
  previousInvoices: [string[], ApiResponse<PaginatedApiResponse<Invoice[]>> | undefined][];
  previousInvoice?: ApiResponse<Invoice>;
};

type UpdateInvoiceVariables = {
  id: string | number;
  data: Partial<Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>>;
};

export const useUpdateInvoice = (): UseMutationResult<
  ApiResponse<Invoice>,
  Error,
  UpdateInvoiceVariables,
  UpdateInvoiceMutationContext
> => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Invoice>,
    Error,
    { id: string | number; data: Partial<Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>> },
    UpdateInvoiceMutationContext
  >({
    mutationFn: ({ data, id }) => {
      const invoiceRepository = new InvoiceRepository();
      const updateInvoiceUseCase = new UpdateInvoiceUseCase(invoiceRepository);
      return updateInvoiceUseCase.execute(id, data);
    },
    mutationKey: [invoiceConfig.queryKey, 'update'],
    onError: (_, { id }, context) => {
      if (context?.previousInvoices) {
        for (const [queryKey, data] of context.previousInvoices) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      if (context?.previousInvoice) {
        queryClient.setQueryData([invoiceConfig.singleQueryKey, id], context.previousInvoice);
      }
    },
    onMutate: async ({ data, id }) => {
      const listQueryKey = [invoiceConfig.queryKey];
      const singleQueryKey = [invoiceConfig.singleQueryKey, id];
      await queryClient.cancelQueries({ queryKey: listQueryKey });
      await queryClient.cancelQueries({ queryKey: singleQueryKey });

      const previousInvoices = queryClient.getQueriesData<
        ApiResponse<PaginatedApiResponse<Invoice[]>>
      >({
        queryKey: listQueryKey,
      }) as [string[], ApiResponse<PaginatedApiResponse<Invoice[]>> | undefined][];

      const previousInvoice = queryClient.getQueryData<ApiResponse<Invoice>>(singleQueryKey);

      queryClient.setQueriesData<ApiResponse<PaginatedApiResponse<Invoice[]>>>(
        { queryKey: listQueryKey },
        (old) => {
          if (!old?.data?.data) return old;
          return {
            ...old,
            data: {
              ...old.data,
              data: old.data.data.map((item) =>
                item.id === id ? { ...item, ...data, updatedAt: new Date().toISOString() } : item
              ),
            },
          };
        }
      );

      queryClient.setQueryData<ApiResponse<Invoice>>(singleQueryKey, (old) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: { ...old.data, ...data, updatedAt: new Date().toISOString() },
        };
      });

      return { previousInvoice, previousInvoices };
    },
    onSettled: (_, __, { id }) => {
      queryClient.invalidateQueries({
        exact: false,
        queryKey: [invoiceConfig.queryKey],
      });
      queryClient.invalidateQueries({
        exact: true,
        queryKey: [invoiceConfig.singleQueryKey, id],
      });
    },
  });
};
