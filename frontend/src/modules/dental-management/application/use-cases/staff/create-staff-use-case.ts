import { type Staff } from '@/modules/dental-management/domain/entities/Staff';
import { type StaffRepositoryInterface } from '@/modules/dental-management/domain/interfaces/StaffRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';

export class CreateStaffUseCase {
  constructor(private readonly staffRepository: StaffRepositoryInterface) {}

  async execute(staff: Omit<Staff, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<Staff>> {
    return await this.staffRepository.createStaff(staff);
  }
}
