<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\Appointment;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\DentalManagement\Domain\Services\AppointmentService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

final readonly class ListAppointmentsUseCase
{
    public function __construct(private AppointmentService $appointmentService) {}

    public function execute(QuerySpecification $querySpecification): LengthAwarePaginator
    {
        return $this->appointmentService->listAppointments($querySpecification);
    }
}
