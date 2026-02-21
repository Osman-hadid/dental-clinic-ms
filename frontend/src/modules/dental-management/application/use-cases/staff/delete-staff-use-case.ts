import { type StaffRepositoryInterface } from '@/modules/dental-management/domain/interfaces/StaffRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';

export class DeleteStaffUseCase {
  constructor(private readonly staffRepository: StaffRepositoryInterface) {}

  async execute(id: string | number): Promise<ApiResponse<null>> {
    return await this.staffRepository.deleteStaff(id);
  }
}
