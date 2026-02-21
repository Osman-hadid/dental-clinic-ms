import { type Tooth } from '@/modules/dental-management/domain/entities/Tooth';
import { type ToothRepositoryInterface } from '@/modules/dental-management/domain/interfaces/ToothRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';

export class UpdateToothUseCase {
  constructor(private readonly toothRepository: ToothRepositoryInterface) {}

  async execute(
    id: string | number,
    tooth: Partial<Omit<Tooth, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<ApiResponse<Tooth>> {
    return await this.toothRepository.updateTooth(id, tooth);
  }
}
