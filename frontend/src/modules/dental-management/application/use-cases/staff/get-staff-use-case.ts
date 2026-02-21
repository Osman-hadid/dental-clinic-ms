import { type Staff } from '@/modules/dental-management/domain/entities/Staff';
import { type StaffRepositoryInterface } from '@/modules/dental-management/domain/interfaces/StaffRepositoryInterface';
import { type ApiResponse } from '@/types/ApiResponse';

export class GetStaffUseCase {
  constructor(private readonly staffRepository: StaffRepositoryInterface) {}

  async execute(id: string | number): Promise<ApiResponse<Staff>> {
    return this.staffRepository.getStaff(id);
  }
}
