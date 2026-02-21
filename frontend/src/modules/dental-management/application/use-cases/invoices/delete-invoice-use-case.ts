import { type InvoiceRepositoryInterface } from '@/modules/dental-management/domain/interfaces/InvoiceRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';

export class DeleteInvoiceUseCase {
  constructor(private readonly invoiceRepository: InvoiceRepositoryInterface) {}

  async execute(id: string | number): Promise<ApiResponse<null>> {
    return await this.invoiceRepository.deleteInvoice(id);
  }
}
