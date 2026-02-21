import { type Payment } from '@/modules/dental-management/domain/entities/Payment';
import { type PaymentRepositoryInterface } from '@/modules/dental-management/domain/interfaces/PaymentRepositoryInterface';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';

export class ListPaymentsUseCase {
  constructor(private readonly paymentRepository: PaymentRepositoryInterface) {}

  async execute(
    search: string = '',
    searchFields: string[] = [],
    relations: string[] = [],
    filters: Record<string, string[]> = {},
    page: number = 1,
    perPage: number = 10
  ): Promise<ApiResponse<PaginatedApiResponse<Payment[]>>> {
    const relationsArray = Array.isArray(relations) ? relations : [];
    return this.paymentRepository.paginate(
      search,
      searchFields,
      relationsArray,
      filters,
      page,
      perPage
    );
  }
}
