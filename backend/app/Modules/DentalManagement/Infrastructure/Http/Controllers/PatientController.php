<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Controllers;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\Common\Infrastructure\Http\Controllers\BaseApiController;
use App\Modules\Common\Infrastructure\Resources\PaginatedResource;
use App\Modules\DentalManagement\Application\DTOs\PatientData;
use App\Modules\DentalManagement\Application\UseCases\Patient\BulkDeletePatientsUseCase;
use App\Modules\DentalManagement\Application\UseCases\Patient\CreatePatientUseCase;
use App\Modules\DentalManagement\Application\UseCases\Patient\DeletePatientUseCase;
use App\Modules\DentalManagement\Application\UseCases\Patient\ForceDeletePatientUseCase;
use App\Modules\DentalManagement\Application\UseCases\Patient\GetPatientUseCase;
use App\Modules\DentalManagement\Application\UseCases\Patient\ListPatientsUseCase;
use App\Modules\DentalManagement\Application\UseCases\Patient\RestorePatientUseCase;
use App\Modules\DentalManagement\Application\UseCases\Patient\UpdatePatientUseCase;
use App\Modules\DentalManagement\Domain\Entities\Patient;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Patient\BulkDeletePatientsRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Patient\ListPatientsRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Patient\StorePatientRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Patient\UpdatePatientRequest;
use App\Modules\DentalManagement\Infrastructure\Resources\PatientResource;
use Illuminate\Http\JsonResponse;

final class PatientController extends BaseApiController
{
    public function __construct(
        private readonly ListPatientsUseCase $listPatientsUseCase,
        private readonly GetPatientUseCase $getPatientUseCase,
        private readonly RestorePatientUseCase $restorePatientUseCase,
        private readonly CreatePatientUseCase $createPatientUseCase,
        private readonly UpdatePatientUseCase $updatePatientUseCase,
        private readonly DeletePatientUseCase $deletePatientUseCase,
        private readonly ForceDeletePatientUseCase $forceDeletePatientUseCase,
        private readonly BulkDeletePatientsUseCase $bulkDeletePatientsUseCase,
    ) {}

    public function index(ListPatientsRequest $listPatientsRequest): JsonResponse
    {
        $this->authorize('viewAny', Patient::class);

        $querySpecification = QuerySpecification::fromArray($listPatientsRequest->validated());

        $lengthAwarePaginator = $this->listPatientsUseCase->execute($querySpecification);

        $paginatedResource = new PaginatedResource($lengthAwarePaginator, PatientResource::class);

        return $this->successResponse(
            data: $paginatedResource,
            message: __('DentalManagement::messages.patients.fetched')
        );
    }

    public function store(StorePatientRequest $storePatientRequest): JsonResponse
    {
        $this->authorize('create', Patient::class);

        $patientData = PatientData::fromArray($storePatientRequest->validated());
        $patient = $this->createPatientUseCase->execute(patientData: $patientData);

        return $this->successResponse(
            data: new PatientResource(resource: $patient),
            message: __('DentalManagement::messages.patient.created'),
            code: 201
        );
    }

    public function show(int $id): JsonResponse
    {
        $patient = $this->getPatientUseCase->execute($id);

        $this->authorize('view', $patient);

        return $this->successResponse(
            data: new PatientResource(resource: $patient),
            message: __('DentalManagement::messages.patient.fetched')
        );
    }

    public function restore(int $id): JsonResponse
    {
        $patient = $this->restorePatientUseCase->execute($id);

        $this->authorize('restore', $patient);

        return $this->successResponse(
            data: new PatientResource(resource: $patient),
            message: __('DentalManagement::messages.patient.restored')
        );
    }

    public function update(UpdatePatientRequest $updatePatientRequest, int $id): JsonResponse
    {
        $patientData = PatientData::fromArray($updatePatientRequest->validated());
        $patient = $this->updatePatientUseCase->execute(id: $id, patientData: $patientData);

        $this->authorize('update', $patient);

        return $this->successResponse(
            data: new PatientResource(resource: $patient),
            message: __('DentalManagement::messages.patient.updated')
        );
    }

    public function destroy(int $id): JsonResponse
    {
        $this->authorize('delete', Patient::class);

        $this->deletePatientUseCase->execute(id: $id);

        return $this->successResponse(
            data: null,
            message: __('DentalManagement::messages.patient.deleted')
        );
    }

    public function forceDelete(int $id): JsonResponse
    {
        $this->authorize('forceDelete', Patient::class);

        $this->forceDeletePatientUseCase->execute($id);

        return $this->successResponse(
            data: null,
            message: __('DentalManagement::messages.patient.force_deleted')
        );
    }

    public function bulkDelete(BulkDeletePatientsRequest $bulkDeletePatientsRequest): JsonResponse
    {
        $this->authorize('bulkDelete', Patient::class);

        $result = $this->bulkDeletePatientsUseCase->execute($bulkDeletePatientsRequest->validated('ids'));

        $message = __('DentalManagement::messages.patients.bulk_deleted');
        if ($result['skipped']) {
            $message .= ' '.__('DentalManagement::messages.patients.bulk_skipped');
        }

        return $this->successResponse(
            data: $result,
            message: $message
        );
    }
}
