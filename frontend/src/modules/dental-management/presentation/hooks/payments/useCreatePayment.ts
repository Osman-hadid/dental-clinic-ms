import { CreatePaymentUseCase } from '@/modules/dental-management/application/use-cases/payments/create-payment-use-case';
import { type Payment } from '@/modules/dental-management/domain/entities/Payment';
import { PaymentRepository } from '@/modules/dental-management/infrastructure/repositories/payment-repository';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { paymentConfig } from '../../config/payment-config';

type CreatePaymentMutationContext = {
  previousPayments: [string[], ApiResponse<PaginatedApiResponse<Payment[]>> | undefined][];
};

export const useCreatePayment = (): UseMutationResult<
  ApiResponse<Payment>,
  Error,
  Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>,
  CreatePaymentMutationContext
> => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Payment>,
    Error,
    Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>,
    CreatePaymentMutationContext
  >({
    mutationFn: (payment) => {
      const paymentRepository = new PaymentRepository();
      const createPaymentUseCase = new CreatePaymentUseCase(paymentRepository);
      return createPaymentUseCase.execute(payment);
    },
    mutationKey: [paymentConfig.queryKey, 'create'],
    onError: (_, __, context) => {
      if (context?.previousPayments) {
        for (const [queryKey, data] of context.previousPayments) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onMutate: async (newPayment) => {
      const queryKeyPrefix = [paymentConfig.queryKey];
      await queryClient.cancelQueries({ queryKey: queryKeyPrefix });
      const previousPayments = queryClient.getQueriesData<
        ApiResponse<PaginatedApiResponse<Payment[]>>
      >({
        queryKey: queryKeyPrefix,
      }) as [string[], ApiResponse<PaginatedApiResponse<Payment[]>> | undefined][];
      const targetQueryKey = [paymentConfig.queryKey, 1, 10, '', JSON.stringify({})];
      queryClient.setQueriesData<ApiResponse<PaginatedApiResponse<Payment[]>>>(
        { queryKey: targetQueryKey },
        (old) => {
          if (!old?.data?.data) return old;
          const optimisticPayment: Payment = {
            ...newPayment,
            createdAt: new Date().toISOString(),
            id: -Date.now(),
            updatedAt: new Date().toISOString(),
          };
          return {
            ...old,
            data: {
              ...old.data,
              data: [optimisticPayment, ...old.data.data],
              meta: {
                ...old.data.meta,
                to: old.data.meta.to + 1,
                total: old.data.meta.total + 1,
              },
            },
          };
        }
      );
      return { previousPayments };
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        exact: false,
        queryKey: [paymentConfig.queryKey],
      });
    },
  });
};
