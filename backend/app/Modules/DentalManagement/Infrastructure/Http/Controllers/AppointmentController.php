<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Controllers;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\Common\Infrastructure\Http\Controllers\BaseApiController;
use App\Modules\Common\Infrastructure\Resources\PaginatedResource;
use App\Modules\DentalManagement\Application\DTOs\AppointmentData;
use App\Modules\DentalManagement\Application\UseCases\Appointment\BulkDeleteAppointmentsUseCase;
use App\Modules\DentalManagement\Application\UseCases\Appointment\CreateAppointmentUseCase;
use App\Modules\DentalManagement\Application\UseCases\Appointment\DeleteAppointmentUseCase;
use App\Modules\DentalManagement\Application\UseCases\Appointment\ForceDeleteAppointmentUseCase;
use App\Modules\DentalManagement\Application\UseCases\Appointment\GetAppointmentUseCase;
use App\Modules\DentalManagement\Application\UseCases\Appointment\ListAppointmentsUseCase;
use App\Modules\DentalManagement\Application\UseCases\Appointment\RestoreAppointmentUseCase;
use App\Modules\DentalManagement\Application\UseCases\Appointment\UpdateAppointmentUseCase;
use App\Modules\DentalManagement\Domain\Entities\Appointment;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Appointment\BulkDeleteAppointmentsRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Appointment\ListAppointmentsRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Appointment\StoreAppointmentRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Appointment\UpdateAppointmentRequest;
use App\Modules\DentalManagement\Infrastructure\Resources\AppointmentResource;
use Illuminate\Http\JsonResponse;

final class AppointmentController extends BaseApiController
{
    public function __construct(
        private readonly ListAppointmentsUseCase $listAppointmentsUseCase,
        private readonly GetAppointmentUseCase $getAppointmentUseCase,
        private readonly RestoreAppointmentUseCase $restoreAppointmentUseCase,
        private readonly CreateAppointmentUseCase $createAppointmentUseCase,
        private readonly UpdateAppointmentUseCase $updateAppointmentUseCase,
        private readonly DeleteAppointmentUseCase $deleteAppointmentUseCase,
        private readonly ForceDeleteAppointmentUseCase $forceDeleteAppointmentUseCase,
        private readonly BulkDeleteAppointmentsUseCase $bulkDeleteAppointmentsUseCase,
    ) {}

    public function index(ListAppointmentsRequest $listAppointmentsRequest): JsonResponse
    {
        $this->authorize('viewAny', Appointment::class);

        $querySpecification = QuerySpecification::fromArray($listAppointmentsRequest->validated());

        $lengthAwarePaginator = $this->listAppointmentsUseCase->execute($querySpecification);

        $paginatedResource = new PaginatedResource($lengthAwarePaginator, AppointmentResource::class);

        return $this->successResponse(
            data: $paginatedResource,
            message: __('DentalManagement::messages.appointments.fetched')
        );
    }

    public function store(StoreAppointmentRequest $storeAppointmentRequest): JsonResponse
    {
        $this->authorize('create', Appointment::class);

        $appointmentData = AppointmentData::fromArray($storeAppointmentRequest->validated());
        $appointment = $this->createAppointmentUseCase->execute(appointmentData: $appointmentData);

        return $this->successResponse(
            data: new AppointmentResource(resource: $appointment),
            message: __('DentalManagement::messages.appointment.created'),
            code: 201
        );
    }

    public function show(int $id): JsonResponse
    {
        $appointment = $this->getAppointmentUseCase->execute($id);

        $this->authorize('view', $appointment);

        return $this->successResponse(
            data: new AppointmentResource(resource: $appointment),
            message: __('DentalManagement::messages.appointment.fetched')
        );
    }

    public function restore(int $id): JsonResponse
    {
        $appointment = $this->restoreAppointmentUseCase->execute($id);

        $this->authorize('restore', $appointment);

        return $this->successResponse(
            data: new AppointmentResource(resource: $appointment),
            message: __('DentalManagement::messages.appointment.restored')
        );
    }

    public function update(UpdateAppointmentRequest $updateAppointmentRequest, int $id): JsonResponse
    {
        $appointmentData = AppointmentData::fromArray($updateAppointmentRequest->validated());
        $appointment = $this->updateAppointmentUseCase->execute(id: $id, appointmentData: $appointmentData);

        $this->authorize('update', $appointment);

        return $this->successResponse(
            data: new AppointmentResource(resource: $appointment),
            message: __('DentalManagement::messages.appointment.updated')
        );
    }

    public function destroy(int $id): JsonResponse
    {
        $this->authorize('delete', Appointment::class);

        $this->deleteAppointmentUseCase->execute(id: $id);

        return $this->successResponse(
            data: null,
            message: __('DentalManagement::messages.appointment.deleted')
        );
    }

    public function forceDelete(int $id): JsonResponse
    {
        $this->authorize('forceDelete', Appointment::class);

        $this->forceDeleteAppointmentUseCase->execute($id);

        return $this->successResponse(
            data: null,
            message: __('DentalManagement::messages.appointment.force_deleted')
        );
    }

    public function bulkDelete(BulkDeleteAppointmentsRequest $bulkDeleteAppointmentsRequest): JsonResponse
    {
        $this->authorize('bulkDelete', Appointment::class);

        $result = $this->bulkDeleteAppointmentsUseCase->execute($bulkDeleteAppointmentsRequest->validated('ids'));

        $message = __('DentalManagement::messages.appointments.bulk_deleted');
        if ($result['skipped']) {
            $message .= ' '.__('DentalManagement::messages.appointments.bulk_skipped');
        }

        return $this->successResponse(
            data: $result,
            message: $message
        );
    }
}
