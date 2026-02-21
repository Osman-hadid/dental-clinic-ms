import { type Invoice } from '@/modules/dental-management/domain/entities/Invoice';
import { type InvoiceRepositoryInterface } from '@/modules/dental-management/domain/interfaces/InvoiceRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';

export class UpdateInvoiceUseCase {
  constructor(private readonly invoiceRepository: InvoiceRepositoryInterface) {}

  async execute(
    id: string | number,
    invoice: Partial<Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<ApiResponse<Invoice>> {
    return await this.invoiceRepository.updateInvoice(id, invoice);
  }
}
