import { type Payment } from '@/modules/dental-management/domain/entities/Payment';
import { type PaymentRepositoryInterface } from '@/modules/dental-management/domain/interfaces/PaymentRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';

export class UpdatePaymentUseCase {
  constructor(private readonly paymentRepository: PaymentRepositoryInterface) {}

  async execute(
    id: string | number,
    payment: Partial<Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<ApiResponse<Payment>> {
    return await this.paymentRepository.updatePayment(id, payment);
  }
}
