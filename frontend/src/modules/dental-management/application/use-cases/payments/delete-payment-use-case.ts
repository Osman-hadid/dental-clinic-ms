import { type PaymentRepositoryInterface } from '@/modules/dental-management/domain/interfaces/PaymentRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';

export class DeletePaymentUseCase {
  constructor(private readonly paymentRepository: PaymentRepositoryInterface) {}

  async execute(id: string | number): Promise<ApiResponse<null>> {
    return await this.paymentRepository.deletePayment(id);
  }
}
