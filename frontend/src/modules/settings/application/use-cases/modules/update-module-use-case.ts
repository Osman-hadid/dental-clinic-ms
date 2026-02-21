import { type Module } from '@/modules/settings/domain/entities/Module';
import { type ModuleRepositoryInterface } from '@/modules/settings/domain/interfaces/ModuleRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';

export class UpdateModuleUseCase {
  constructor(private readonly moduleRepository: ModuleRepositoryInterface) {}

  async execute(
    id: string | number,
    module: Partial<Omit<Module, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<ApiResponse<Module>> {
    return await this.moduleRepository.updateModule(id, module);
  }
}
