<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\Appointment;

use App\Modules\DentalManagement\Domain\Services\AppointmentService;

final readonly class BulkDeleteAppointmentsUseCase
{
    public function __construct(private AppointmentService $appointmentService) {}

    public function execute(array $ids): array
    {
        return $this->appointmentService->bulkDeleteAppointments($ids);
    }
}
