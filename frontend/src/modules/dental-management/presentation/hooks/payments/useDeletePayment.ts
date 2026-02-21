import { DeletePaymentUseCase } from '@/modules/dental-management/application/use-cases/payments/delete-payment-use-case';
import { PaymentRepository } from '@/modules/dental-management/infrastructure/repositories/payment-repository';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { type Payment } from '../../../domain/entities/Payment';
import { paymentConfig } from '../../config/payment-config';

type DeletePaymentMutationContext = {
  previousPayments: [string[], ApiResponse<PaginatedApiResponse<Payment[]>> | undefined][];
  previousPayment?: ApiResponse<Payment>;
};

export const useDeletePayment = (): UseMutationResult<
  ApiResponse<null>,
  Error,
  string | number,
  DeletePaymentMutationContext
> => {
  const queryClient = useQueryClient();

  return useMutation<ApiResponse<null>, Error, string | number, DeletePaymentMutationContext>({
    mutationFn: (id) => {
      const paymentRepository = new PaymentRepository();
      const deletePaymentUseCase = new DeletePaymentUseCase(paymentRepository);
      return deletePaymentUseCase.execute(id);
    },
    mutationKey: [paymentConfig.queryKey, 'delete'],
    onError: (_, id, context) => {
      if (context?.previousPayments) {
        for (const [queryKey, data] of context.previousPayments) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      if (context?.previousPayment) {
        queryClient.setQueryData([paymentConfig.singleQueryKey, id], context.previousPayment);
      }
    },
    onMutate: async (id) => {
      const listQueryKey = [paymentConfig.queryKey];
      const singleQueryKey = [paymentConfig.singleQueryKey, id];
      await queryClient.cancelQueries({ queryKey: listQueryKey });
      await queryClient.cancelQueries({ queryKey: singleQueryKey });

      const previousPayments = queryClient.getQueriesData<
        ApiResponse<PaginatedApiResponse<Payment[]>>
      >({
        queryKey: listQueryKey,
      }) as [string[], ApiResponse<PaginatedApiResponse<Payment[]>> | undefined][];

      const previousPayment = queryClient.getQueryData<ApiResponse<Payment>>(singleQueryKey);

      queryClient.setQueriesData<ApiResponse<PaginatedApiResponse<Payment[]>>>(
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

      return { previousPayment, previousPayments };
    },
    onSettled: (_, __, id) => {
      queryClient.invalidateQueries({
        exact: false,
        queryKey: [paymentConfig.queryKey],
      });
      queryClient.invalidateQueries({
        exact: true,
        queryKey: [paymentConfig.singleQueryKey, id],
      });
    },
  });
};
