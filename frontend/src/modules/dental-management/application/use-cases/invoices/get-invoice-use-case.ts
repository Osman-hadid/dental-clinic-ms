import { type Invoice } from '@/modules/dental-management/domain/entities/Invoice';
import { type InvoiceRepositoryInterface } from '@/modules/dental-management/domain/interfaces/InvoiceRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';

export class GetInvoiceUseCase {
  constructor(private readonly invoiceRepository: InvoiceRepositoryInterface) {}

  async execute(id: string | number): Promise<ApiResponse<Invoice>> {
    return this.invoiceRepository.getInvoice(id);
  }
}
