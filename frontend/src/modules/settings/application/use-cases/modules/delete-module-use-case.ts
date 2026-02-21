import { type ModuleRepositoryInterface } from '@/modules/settings/domain/interfaces/ModuleRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';

export class DeleteModuleUseCase {
  constructor(private readonly moduleRepository: ModuleRepositoryInterface) {}

  async execute(id: string | number): Promise<ApiResponse<null>> {
    return await this.moduleRepository.deleteModule(id);
  }
}
