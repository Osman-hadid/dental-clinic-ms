'use client';

import { JSX, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/header';
import { useCan } from '@/hooks/useCan';
import {
  AppointmentsScheduler,
  type SchedulerCreatePayload,
} from '@/components/shared/dental/appointments-scheduler';
import { EntityListClient as EntityList } from '@/components/shared/entity/entity-list';
import { appointmentConfig } from '@/modules/dental-management/presentation/config/appointment-config';
import {
  useAppointmentList,
  useCreateAppointment,
  useDeleteAppointment,
  usePatientList,
  useStaffList,
  useUpdateAppointment,
} from '@/modules/dental-management/presentation/hooks';
import { toast } from 'sonner';

const asText = (value: unknown): string => {
  if (typeof value === 'number') return String(value).trim();
  if (typeof value !== 'string') return '';
  return value.trim();
};

// eslint-disable-next-line react/function-component-definition
export default function AppointmentsPage(): JSX.Element {
  const t = useTranslations('appointment');
  const tSidebar = useTranslations('sidebar.dentalManagement');
  const { can } = useCan();
  const createAppointment = useCreateAppointment();
  const {
    entities: schedulerAppointments,
    isFetching: isLoadingScheduler,
    refetch: refetchSchedulerAppointments,
  } = useAppointmentList(
    1,
    100,
    '',
    ['tag', 'notes'],
    ['patient', 'dentist'],
    {}
  );
  const {
    entities: schedulerPatients,
  } = usePatientList(1, 100, '', ['patientCode', 'firstName', 'lastName'], [], {});
  const {
    entities: schedulerStaff,
  } = useStaffList(1, 100, '', ['fullName', 'specialization'], [], {});

  const patientOptions = useMemo(() => {
    return schedulerPatients.map((patient) => {
      const fullName = [asText(patient.firstName), asText(patient.lastName)].filter(Boolean).join(' ').trim();
      const fallback = asText(patient.patientCode) || `Patient #${patient.id}`;
      return {
        id: String(patient.id),
        label: fullName || fallback,
      };
    });
  }, [schedulerPatients]);

  const dentistOptions = useMemo(() => {
    const mapped = schedulerStaff.map((staff) => ({
      id: String(staff.id),
      label: [asText(staff.fullName), asText(staff.role)].filter(Boolean).join(' - '),
      role: asText(staff.role).toLowerCase(),
    }));

    const dentistsOnly = mapped.filter((option) => option.role.includes('dentist'));
    const source = dentistsOnly.length > 0 ? dentistsOnly : mapped;
    return source.map(({ id, label }) => ({ id, label: label || `Staff #${id}` }));
  }, [schedulerStaff]);

  const handleCreateFromScheduler = useCallback(async (
    payload: SchedulerCreatePayload
  ): Promise<{ message?: string; success: boolean }> => {
    try {
      const response = await createAppointment.mutateAsync(payload);
      if (!response.success) {
        const message = response.error?.message || 'Failed to create appointment.';
        toast.error(message);
        return { message, success: false };
      }

      toast.success('Appointment created successfully.');
      await refetchSchedulerAppointments();
      return { success: true };
    } catch {
      const message = 'Failed to create appointment.';
      toast.error(message);
      return { message, success: false };
    }
  }, [createAppointment, refetchSchedulerAppointments]);

  return (
    <>
      <Header
        breadcrumbs={[
          { id: 'dentalManagement', label: tSidebar('title') },
          { id: 'appointments', isCurrent: true, label: t(appointmentConfig.title) },
        ]}
      />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
            <div className="rounded-2xl border bg-gradient-to-r from-background to-muted/30 p-4">
              <h2 className="text-base font-semibold">Appointment Planner</h2>
              <p className="text-xs text-muted-foreground">
                Use the add button to open a quick, card-style form for booking appointments.
              </p>
            </div>
            <AppointmentsScheduler
              appointments={schedulerAppointments}
              canCreate={can(appointmentConfig.permissions.create)}
              dentistOptions={dentistOptions}
              isLoading={isLoadingScheduler}
              isSubmittingCreate={createAppointment.isPending}
              onCreateAppointment={handleCreateFromScheduler}
              patientOptions={patientOptions}
            />
            <div className="rounded-2xl border bg-card p-4">
              <h3 className="text-sm font-semibold">All Appointments Table</h3>
              <p className="text-xs text-muted-foreground">
                Use the table for full CRUD actions and advanced filters.
              </p>
            </div>
            <EntityList
              config={appointmentConfig}
              fetchHook={useAppointmentList}
              useCreate={useCreateAppointment}
              useUpdate={useUpdateAppointment}
              useDelete={useDeleteAppointment}
            />
          </div>
        </div>
      </div>
    </>
  );
}
