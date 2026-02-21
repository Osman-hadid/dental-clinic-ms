import { type Appointment } from '@/modules/dental-management/domain/entities/Appointment';
import { type AppointmentRepositoryInterface } from '@/modules/dental-management/domain/interfaces/AppointmentRepositoryInterface';
import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';

export class ListAppointmentsUseCase {
  constructor(private readonly appointmentRepository: AppointmentRepositoryInterface) {}

  async execute(
    search: string = '',
    searchFields: string[] = [],
    relations: string[] = [],
    filters: Record<string, string[]> = {},
    page: number = 1,
    perPage: number = 10
  ): Promise<ApiResponse<PaginatedApiResponse<Appointment[]>>> {
    const relationsArray = Array.isArray(relations) ? relations : [];
    return this.appointmentRepository.paginate(
      search,
      searchFields,
      relationsArray,
      filters,
      page,
      perPage
    );
  }
}
