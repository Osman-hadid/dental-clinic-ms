import { type Module } from '@/modules/settings/domain/entities/Module';
import { type ModuleRepositoryInterface } from '@/modules/settings/domain/interfaces/ModuleRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';

export class GetModuleUseCase {
  constructor(private readonly moduleRepository: ModuleRepositoryInterface) {}

  async execute(id: string | number): Promise<ApiResponse<Module>> {
    return this.moduleRepository.getModule(id);
  }
}
