<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Controllers;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\Common\Infrastructure\Http\Controllers\BaseApiController;
use App\Modules\Common\Infrastructure\Resources\PaginatedResource;
use App\Modules\DentalManagement\Application\DTOs\VisitTreatmentData;
use App\Modules\DentalManagement\Application\UseCases\VisitTreatment\BulkDeleteVisitTreatmentsUseCase;
use App\Modules\DentalManagement\Application\UseCases\VisitTreatment\CreateVisitTreatmentUseCase;
use App\Modules\DentalManagement\Application\UseCases\VisitTreatment\DeleteVisitTreatmentUseCase;
use App\Modules\DentalManagement\Application\UseCases\VisitTreatment\ForceDeleteVisitTreatmentUseCase;
use App\Modules\DentalManagement\Application\UseCases\VisitTreatment\GetVisitTreatmentUseCase;
use App\Modules\DentalManagement\Application\UseCases\VisitTreatment\ListVisitTreatmentsUseCase;
use App\Modules\DentalManagement\Application\UseCases\VisitTreatment\RestoreVisitTreatmentUseCase;
use App\Modules\DentalManagement\Application\UseCases\VisitTreatment\UpdateVisitTreatmentUseCase;
use App\Modules\DentalManagement\Domain\Entities\VisitTreatment;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\VisitTreatment\BulkDeleteVisitTreatmentsRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\VisitTreatment\ListVisitTreatmentsRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\VisitTreatment\StoreVisitTreatmentRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\VisitTreatment\UpdateVisitTreatmentRequest;
use App\Modules\DentalManagement\Infrastructure\Resources\VisitTreatmentResource;
use Illuminate\Http\JsonResponse;

final class VisitTreatmentController extends BaseApiController
{
    public function __construct(
        private readonly ListVisitTreatmentsUseCase $listVisitTreatmentsUseCase,
        private readonly GetVisitTreatmentUseCase $getVisitTreatmentUseCase,
        private readonly RestoreVisitTreatmentUseCase $restoreVisitTreatmentUseCase,
        private readonly CreateVisitTreatmentUseCase $createVisitTreatmentUseCase,
        private readonly UpdateVisitTreatmentUseCase $updateVisitTreatmentUseCase,
        private readonly DeleteVisitTreatmentUseCase $deleteVisitTreatmentUseCase,
        private readonly ForceDeleteVisitTreatmentUseCase $forceDeleteVisitTreatmentUseCase,
        private readonly BulkDeleteVisitTreatmentsUseCase $bulkDeleteVisitTreatmentsUseCase,
    ) {}

    public function index(ListVisitTreatmentsRequest $listVisitTreatmentsRequest): JsonResponse
    {
        $this->authorize('viewAny', VisitTreatment::class);

        $querySpecification = QuerySpecification::fromArray($listVisitTreatmentsRequest->validated());

        $lengthAwarePaginator = $this->listVisitTreatmentsUseCase->execute($querySpecification);

        $paginatedResource = new PaginatedResource($lengthAwarePaginator, VisitTreatmentResource::class);

        return $this->successResponse(
            data: $paginatedResource,
            message: __('DentalManagement::messages.visit_treatments.fetched')
        );
    }

    public function store(StoreVisitTreatmentRequest $storeVisitTreatmentRequest): JsonResponse
    {
        $this->authorize('create', VisitTreatment::class);

        $visitTreatmentData = VisitTreatmentData::fromArray($storeVisitTreatmentRequest->validated());
        $visitTreatment = $this->createVisitTreatmentUseCase->execute(visitTreatmentData: $visitTreatmentData);

        return $this->successResponse(
            data: new VisitTreatmentResource(resource: $visitTreatment),
            message: __('DentalManagement::messages.visit_treatment.created'),
            code: 201
        );
    }

    public function show(int $id): JsonResponse
    {
        $visitTreatment = $this->getVisitTreatmentUseCase->execute($id);

        $this->authorize('view', $visitTreatment);

        return $this->successResponse(
            data: new VisitTreatmentResource(resource: $visitTreatment),
            message: __('DentalManagement::messages.visit_treatment.fetched')
        );
    }

    public function restore(int $id): JsonResponse
    {
        $visitTreatment = $this->restoreVisitTreatmentUseCase->execute($id);

        $this->authorize('restore', $visitTreatment);

        return $this->successResponse(
            data: new VisitTreatmentResource(resource: $visitTreatment),
            message: __('DentalManagement::messages.visit_treatment.restored')
        );
    }

    public function update(UpdateVisitTreatmentRequest $updateVisitTreatmentRequest, int $id): JsonResponse
    {
        $visitTreatmentData = VisitTreatmentData::fromArray($updateVisitTreatmentRequest->validated());
        $visitTreatment = $this->updateVisitTreatmentUseCase->execute(id: $id, visitTreatmentData: $visitTreatmentData);

        $this->authorize('update', $visitTreatment);

        return $this->successResponse(
            data: new VisitTreatmentResource(resource: $visitTreatment),
            message: __('DentalManagement::messages.visit_treatment.updated')
        );
    }

    public function destroy(int $id): JsonResponse
    {
        $this->authorize('delete', VisitTreatment::class);

        $this->deleteVisitTreatmentUseCase->execute(id: $id);

        return $this->successResponse(
            data: null,
            message: __('DentalManagement::messages.visit_treatment.deleted')
        );
    }

    public function forceDelete(int $id): JsonResponse
    {
        $this->authorize('forceDelete', VisitTreatment::class);

        $this->forceDeleteVisitTreatmentUseCase->execute($id);

        return $this->successResponse(
            data: null,
            message: __('DentalManagement::messages.visit_treatment.force_deleted')
        );
    }

    public function bulkDelete(BulkDeleteVisitTreatmentsRequest $bulkDeleteVisitTreatmentsRequest): JsonResponse
    {
        $this->authorize('bulkDelete', VisitTreatment::class);

        $result = $this->bulkDeleteVisitTreatmentsUseCase->execute($bulkDeleteVisitTreatmentsRequest->validated('ids'));

        $message = __('DentalManagement::messages.visit_treatments.bulk_deleted');
        if ($result['skipped']) {
            $message .= ' '.__('DentalManagement::messages.visit_treatments.bulk_skipped');
        }

        return $this->successResponse(
            data: $result,
            message: $message
        );
    }
}
