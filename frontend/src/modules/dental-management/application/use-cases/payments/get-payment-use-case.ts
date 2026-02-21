import { type Payment } from '@/modules/dental-management/domain/entities/Payment';
import { type PaymentRepositoryInterface } from '@/modules/dental-management/domain/interfaces/PaymentRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';

export class GetPaymentUseCase {
  constructor(private readonly paymentRepository: PaymentRepositoryInterface) {}

  async execute(id: string | number): Promise<ApiResponse<Payment>> {
    return this.paymentRepository.getPayment(id);
  }
}
