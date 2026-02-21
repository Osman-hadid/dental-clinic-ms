import { type Invoice } from '@/modules/dental-management/domain/entities/Invoice';
import { type InvoiceRepositoryInterface } from '@/modules/dental-management/domain/interfaces/InvoiceRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';

export class CreateInvoiceUseCase {
  constructor(private readonly invoiceRepository: InvoiceRepositoryInterface) {}

  async execute(
    invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ApiResponse<Invoice>> {
    return await this.invoiceRepository.createInvoice(invoice);
  }
}
