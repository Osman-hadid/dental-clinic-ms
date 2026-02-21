import { type Invoice } from '@/modules/dental-management/domain/entities/Invoice';
import { type InvoiceRepositoryInterface } from '@/modules/dental-management/domain/interfaces/InvoiceRepositoryInterface';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';

export class ListInvoicesUseCase {
  constructor(private readonly invoiceRepository: InvoiceRepositoryInterface) {}

  async execute(
    search: string = '',
    searchFields: string[] = [],
    relations: string[] = [],
    filters: Record<string, string[]> = {},
    page: number = 1,
    perPage: number = 10
  ): Promise<ApiResponse<PaginatedApiResponse<Invoice[]>>> {
    const relationsArray = Array.isArray(relations) ? relations : [];
    return this.invoiceRepository.paginate(
      search,
      searchFields,
      relationsArray,
      filters,
      page,
      perPage
    );
  }
}
