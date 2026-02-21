import { type ApiResponse, type PaginatedApiResponse } from '@/types/ApiResponse';
import { type Appointment } from '../entities/Appointment';

export type AppointmentRepositoryInterface = {
  createAppointment: (
    appointment: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<ApiResponse<Appointment>>;
  getAppointment: (id: string | number) => Promise<ApiResponse<Appointment>>;
  updateAppointment: (
    id: string | number,
    appointment: Partial<Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>>
  ) => Promise<ApiResponse<Appointment>>;
  deleteAppointment: (id: string | number) => Promise<ApiResponse<null>>;
  paginate: (
    search?: string,
    searchFields?: string[],
    relations?: string[],
    filters?: Record<string, string[]>,
    page?: number,
    perPage?: number
  ) => Promise<ApiResponse<PaginatedApiResponse<Appointment[]>>>;
};
