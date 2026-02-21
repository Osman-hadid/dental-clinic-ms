import { type ToothRepositoryInterface } from '@/modules/dental-management/domain/interfaces/ToothRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';

export class DeleteToothUseCase {
  constructor(private readonly toothRepository: ToothRepositoryInterface) {}

  async execute(id: string | number): Promise<ApiResponse<null>> {
    return await this.toothRepository.deleteTooth(id);
  }
}
