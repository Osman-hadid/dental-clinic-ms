import { DeleteInvoiceUseCase } from '@/modules/dental-management/application/use-cases/invoices/delete-invoice-use-case';
import { InvoiceRepository } from '@/modules/dental-management/infrastructure/repositories/invoice-repository';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { type Invoice } from '../../../domain/entities/Invoice';
import { invoiceConfig } from '../../config/invoice-config';

type DeleteInvoiceMutationContext = {
  previousInvoices: [string[], ApiResponse<PaginatedApiResponse<Invoice[]>> | undefined][];
  previousInvoice?: ApiResponse<Invoice>;
};

export const useDeleteInvoice = (): UseMutationResult<
  ApiResponse<null>,
  Error,
  string | number,
  DeleteInvoiceMutationContext
> => {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<null>, Error, string | number, DeleteInvoiceMutationContext>({
    mutationFn: (id) => {
      const invoiceRepository = new InvoiceRepository();
      const deleteInvoiceUseCase = new DeleteInvoiceUseCase(invoiceRepository);
      return deleteInvoiceUseCase.execute(id);
    },
    mutationKey: [invoiceConfig.queryKey, 'delete'],
    onError: (_, id, context) => {
      if (context?.previousInvoices) {
        for (const [queryKey, data] of context.previousInvoices) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      if (context?.previousInvoice) {
        queryClient.setQueryData([invoiceConfig.singleQueryKey, id], context.previousInvoice);
      }
    },
    onMutate: async (id) => {
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
              data: old.data.data.filter((item) => item.id !== id),
              meta: {
                ...old.data.meta,
                to: old.data.meta.to - 1,
                total: old.data.meta.total - 1,
              },
            },
          };
        }
      );

      queryClient.removeQueries({ queryKey: singleQueryKey });

      return { previousInvoice, previousInvoices };
    },
    onSettled: (_, __, id) => {
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
