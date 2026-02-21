import { GetPaymentUseCase } from '@/modules/dental-management/application/use-cases/payments/get-payment-use-case';
import { type Payment } from '@/modules/dental-management/domain/entities/Payment';
import { PaymentRepository } from '@/modules/dental-management/infrastructure/repositories/payment-repository';
import { type ApiResponse } from '@/types/ApiResponse';
import { useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { paymentConfig } from '../../config/payment-config';

export const useGetPayment = (
  id: string | number,
  options: { enabled?: boolean } = {}
): UseQueryResult<ApiResponse<Payment>, unknown> => {
  const queryClient = useQueryClient();

  return useQuery<ApiResponse<Payment>>({
    enabled:
      !!id &&
      (options.enabled ?? true) &&
      !queryClient.isMutating({
        predicate: (mutation) =>
          mutation.options.mutationKey?.[0] === paymentConfig.queryKey &&
          ['create', 'update', 'delete'].includes(mutation.options.mutationKey?.[1] as string),
      }),
    gcTime: 10 * 60 * 1000,
    queryFn: () => {
      const paymentRepository = new PaymentRepository();
      const getPaymentUseCase = new GetPaymentUseCase(paymentRepository);
      return getPaymentUseCase.execute(id);
    },
    queryKey: [paymentConfig.singleQueryKey, id],
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });
};
