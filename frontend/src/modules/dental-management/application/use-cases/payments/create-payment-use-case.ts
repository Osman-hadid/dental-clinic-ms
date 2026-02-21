import { type Payment } from '@/modules/dental-management/domain/entities/Payment';
import { type PaymentRepositoryInterface } from '@/modules/dental-management/domain/interfaces/PaymentRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';

export class CreatePaymentUseCase {
  constructor(private readonly paymentRepository: PaymentRepositoryInterface) {}

  async execute(
    payment: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ApiResponse<Payment>> {
    return await this.paymentRepository.createPayment(payment);
  }
}
