import { type Module } from '@/modules/settings/domain/entities/Module';
import { type ModuleRepositoryInterface } from '@/modules/settings/domain/interfaces/ModuleRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';

export class CreateModuleUseCase {
  constructor(private readonly moduleRepository: ModuleRepositoryInterface) {}

  async execute(
    module: Omit<Module, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ApiResponse<Module>> {
    return await this.moduleRepository.createModule(module);
  }
}
