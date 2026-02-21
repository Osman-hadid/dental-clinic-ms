<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Controllers;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\Common\Infrastructure\Http\Controllers\BaseApiController;
use App\Modules\Common\Infrastructure\Resources\PaginatedResource;
use App\Modules\DentalManagement\Application\DTOs\VisitData;
use App\Modules\DentalManagement\Application\UseCases\Visit\BulkDeleteVisitsUseCase;
use App\Modules\DentalManagement\Application\UseCases\Visit\CreateVisitUseCase;
use App\Modules\DentalManagement\Application\UseCases\Visit\DeleteVisitUseCase;
use App\Modules\DentalManagement\Application\UseCases\Visit\ForceDeleteVisitUseCase;
use App\Modules\DentalManagement\Application\UseCases\Visit\GetVisitUseCase;
use App\Modules\DentalManagement\Application\UseCases\Visit\ListVisitsUseCase;
use App\Modules\DentalManagement\Application\UseCases\Visit\RestoreVisitUseCase;
use App\Modules\DentalManagement\Application\UseCases\Visit\UpdateVisitUseCase;
use App\Modules\DentalManagement\Domain\Entities\Visit;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Visit\BulkDeleteVisitsRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Visit\ListVisitsRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Visit\StoreVisitRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Visit\UpdateVisitRequest;
use App\Modules\DentalManagement\Infrastructure\Resources\VisitResource;
use Illuminate\Http\JsonResponse;

final class VisitController extends BaseApiController
{
    public function __construct(
        private readonly ListVisitsUseCase $listVisitsUseCase,
        private readonly GetVisitUseCase $getVisitUseCase,
        private readonly RestoreVisitUseCase $restoreVisitUseCase,
        private readonly CreateVisitUseCase $createVisitUseCase,
        private readonly UpdateVisitUseCase $updateVisitUseCase,
        private readonly DeleteVisitUseCase $deleteVisitUseCase,
        private readonly ForceDeleteVisitUseCase $forceDeleteVisitUseCase,
        private readonly BulkDeleteVisitsUseCase $bulkDeleteVisitsUseCase,
    ) {}

    public function index(ListVisitsRequest $listVisitsRequest): JsonResponse
    {
        $this->authorize('viewAny', Visit::class);

        $querySpecification = QuerySpecification::fromArray($listVisitsRequest->validated());

        $lengthAwarePaginator = $this->listVisitsUseCase->execute($querySpecification);

        $paginatedResource = new PaginatedResource($lengthAwarePaginator, VisitResource::class);

        return $this->successResponse(
            data: $paginatedResource,
            message: __('DentalManagement::messages.visits.fetched')
        );
    }

    public function store(StoreVisitRequest $storeVisitRequest): JsonResponse
    {
        $this->authorize('create', Visit::class);

        $visitData = VisitData::fromArray($storeVisitRequest->validated());
        $visit = $this->createVisitUseCase->execute(visitData: $visitData);

        return $this->successResponse(
            data: new VisitResource(resource: $visit),
            message: __('DentalManagement::messages.visit.created'),
            code: 201
        );
    }

    public function show(int $id): JsonResponse
    {
        $visit = $this->getVisitUseCase->execute($id);

        $this->authorize('view', $visit);

        return $this->successResponse(
            data: new VisitResource(resource: $visit),
            message: __('DentalManagement::messages.visit.fetched')
        );
    }

    public function restore(int $id): JsonResponse
    {
        $visit = $this->restoreVisitUseCase->execute($id);

        $this->authorize('restore', $visit);

        return $this->successResponse(
            data: new VisitResource(resource: $visit),
            message: __('DentalManagement::messages.visit.restored')
        );
    }

    public function update(UpdateVisitRequest $updateVisitRequest, int $id): JsonResponse
    {
        $visitData = VisitData::fromArray($updateVisitRequest->validated());
        $visit = $this->updateVisitUseCase->execute(id: $id, visitData: $visitData);

        $this->authorize('update', $visit);

        return $this->successResponse(
            data: new VisitResource(resource: $visit),
            message: __('DentalManagement::messages.visit.updated')
        );
    }

    public function destroy(int $id): JsonResponse
    {
        $this->authorize('delete', Visit::class);

        $this->deleteVisitUseCase->execute(id: $id);

        return $this->successResponse(
            data: null,
            message: __('DentalManagement::messages.visit.deleted')
        );
    }

    public function forceDelete(int $id): JsonResponse
    {
        $this->authorize('forceDelete', Visit::class);

        $this->forceDeleteVisitUseCase->execute($id);

        return $this->successResponse(
            data: null,
            message: __('DentalManagement::messages.visit.force_deleted')
        );
    }

    public function bulkDelete(BulkDeleteVisitsRequest $bulkDeleteVisitsRequest): JsonResponse
    {
        $this->authorize('bulkDelete', Visit::class);

        $result = $this->bulkDeleteVisitsUseCase->execute($bulkDeleteVisitsRequest->validated('ids'));

        $message = __('DentalManagement::messages.visits.bulk_deleted');
        if ($result['skipped']) {
            $message .= ' '.__('DentalManagement::messages.visits.bulk_skipped');
        }

        return $this->successResponse(
            data: $result,
            message: $message
        );
    }
}
