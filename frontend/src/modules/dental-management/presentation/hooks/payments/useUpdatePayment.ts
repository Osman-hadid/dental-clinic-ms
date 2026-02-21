import { UpdatePaymentUseCase } from '@/modules/dental-management/application/use-cases/payments/update-payment-use-case';
import { type Payment } from '@/modules/dental-management/domain/entities/Payment';
import { PaymentRepository } from '@/modules/dental-management/infrastructure/repositories/payment-repository';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { useMutation, UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { paymentConfig } from '../../config/payment-config';

type UpdatePaymentMutationContext = {
  previousPayments: [string[], ApiResponse<PaginatedApiResponse<Payment[]>> | undefined][];
  previousPayment?: ApiResponse<Payment>;
};

type UpdatePaymentVariables = {
  id: string | number;
  data: Partial<Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>>;
};

export const useUpdatePayment = (): UseMutationResult<
  ApiResponse<Payment>,
  Error,
  UpdatePaymentVariables,
  UpdatePaymentMutationContext
> => {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<Payment>,
    Error,
    { id: string | number; data: Partial<Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>> },
    UpdatePaymentMutationContext
  >({
    mutationFn: ({ data, id }) => {
      const paymentRepository = new PaymentRepository();
      const updatePaymentUseCase = new UpdatePaymentUseCase(paymentRepository);
      return updatePaymentUseCase.execute(id, data);
    },
    mutationKey: [paymentConfig.queryKey, 'update'],
    onError: (_, { id }, context) => {
      if (context?.previousPayments) {
        for (const [queryKey, data] of context.previousPayments) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      if (context?.previousPayment) {
        queryClient.setQueryData([paymentConfig.singleQueryKey, id], context.previousPayment);
      }
    },
    onMutate: async ({ data, id }) => {
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
              data: old.data.data.map((item) =>
                item.id === id ? { ...item, ...data, updatedAt: new Date().toISOString() } : item
              ),
            },
          };
        }
      );

      queryClient.setQueryData<ApiResponse<Payment>>(singleQueryKey, (old) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: { ...old.data, ...data, updatedAt: new Date().toISOString() },
        };
      });

      return { previousPayment, previousPayments };
    },
    onSettled: (_, __, { id }) => {
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
