import { type Tooth } from '@/modules/dental-management/domain/entities/Tooth';
import { type ToothRepositoryInterface } from '@/modules/dental-management/domain/interfaces/ToothRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';

export class GetToothUseCase {
  constructor(private readonly toothRepository: ToothRepositoryInterface) {}

  async execute(id: string | number): Promise<ApiResponse<Tooth>> {
    return this.toothRepository.getTooth(id);
  }
}
