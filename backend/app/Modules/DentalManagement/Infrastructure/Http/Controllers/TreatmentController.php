<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Controllers;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\Common\Infrastructure\Http\Controllers\BaseApiController;
use App\Modules\Common\Infrastructure\Resources\PaginatedResource;
use App\Modules\DentalManagement\Application\DTOs\TreatmentData;
use App\Modules\DentalManagement\Application\UseCases\Treatment\BulkDeleteTreatmentsUseCase;
use App\Modules\DentalManagement\Application\UseCases\Treatment\CreateTreatmentUseCase;
use App\Modules\DentalManagement\Application\UseCases\Treatment\DeleteTreatmentUseCase;
use App\Modules\DentalManagement\Application\UseCases\Treatment\ForceDeleteTreatmentUseCase;
use App\Modules\DentalManagement\Application\UseCases\Treatment\GetTreatmentUseCase;
use App\Modules\DentalManagement\Application\UseCases\Treatment\ListTreatmentsUseCase;
use App\Modules\DentalManagement\Application\UseCases\Treatment\RestoreTreatmentUseCase;
use App\Modules\DentalManagement\Application\UseCases\Treatment\UpdateTreatmentUseCase;
use App\Modules\DentalManagement\Domain\Entities\Treatment;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Treatment\BulkDeleteTreatmentsRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Treatment\ListTreatmentsRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Treatment\StoreTreatmentRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Treatment\UpdateTreatmentRequest;
use App\Modules\DentalManagement\Infrastructure\Resources\TreatmentResource;
use Illuminate\Http\JsonResponse;

final class TreatmentController extends BaseApiController
{
    public function __construct(
        private readonly ListTreatmentsUseCase $listTreatmentsUseCase,
        private readonly GetTreatmentUseCase $getTreatmentUseCase,
        private readonly RestoreTreatmentUseCase $restoreTreatmentUseCase,
        private readonly CreateTreatmentUseCase $createTreatmentUseCase,
        private readonly UpdateTreatmentUseCase $updateTreatmentUseCase,
        private readonly DeleteTreatmentUseCase $deleteTreatmentUseCase,
        private readonly ForceDeleteTreatmentUseCase $forceDeleteTreatmentUseCase,
        private readonly BulkDeleteTreatmentsUseCase $bulkDeleteTreatmentsUseCase,
    ) {}

    public function index(ListTreatmentsRequest $listTreatmentsRequest): JsonResponse
    {
        $this->authorize('viewAny', Treatment::class);

        $querySpecification = QuerySpecification::fromArray($listTreatmentsRequest->validated());

        $lengthAwarePaginator = $this->listTreatmentsUseCase->execute($querySpecification);

        $paginatedResource = new PaginatedResource($lengthAwarePaginator, TreatmentResource::class);

        return $this->successResponse(
            data: $paginatedResource,
            message: __('DentalManagement::messages.treatments.fetched')
        );
    }

    public function store(StoreTreatmentRequest $storeTreatmentRequest): JsonResponse
    {
        $this->authorize('create', Treatment::class);

        $treatmentData = TreatmentData::fromArray($storeTreatmentRequest->validated());
        $treatment = $this->createTreatmentUseCase->execute(treatmentData: $treatmentData);

        return $this->successResponse(
            data: new TreatmentResource(resource: $treatment),
            message: __('DentalManagement::messages.treatment.created'),
            code: 201
        );
    }

    public function show(int $id): JsonResponse
    {
        $treatment = $this->getTreatmentUseCase->execute($id);

        $this->authorize('view', $treatment);

        return $this->successResponse(
            data: new TreatmentResource(resource: $treatment),
            message: __('DentalManagement::messages.treatment.fetched')
        );
    }

    public function restore(int $id): JsonResponse
    {
        $treatment = $this->restoreTreatmentUseCase->execute($id);

        $this->authorize('restore', $treatment);

        return $this->successResponse(
            data: new TreatmentResource(resource: $treatment),
            message: __('DentalManagement::messages.treatment.restored')
        );
    }

    public function update(UpdateTreatmentRequest $updateTreatmentRequest, int $id): JsonResponse
    {
        $treatmentData = TreatmentData::fromArray($updateTreatmentRequest->validated());
        $treatment = $this->updateTreatmentUseCase->execute(id: $id, treatmentData: $treatmentData);

        $this->authorize('update', $treatment);

        return $this->successResponse(
            data: new TreatmentResource(resource: $treatment),
            message: __('DentalManagement::messages.treatment.updated')
        );
    }

    public function destroy(int $id): JsonResponse
    {
        $this->authorize('delete', Treatment::class);

        $this->deleteTreatmentUseCase->execute(id: $id);

        return $this->successResponse(
            data: null,
            message: __('DentalManagement::messages.treatment.deleted')
        );
    }

    public function forceDelete(int $id): JsonResponse
    {
        $this->authorize('forceDelete', Treatment::class);

        $this->forceDeleteTreatmentUseCase->execute($id);

        return $this->successResponse(
            data: null,
            message: __('DentalManagement::messages.treatment.force_deleted')
        );
    }

    public function bulkDelete(BulkDeleteTreatmentsRequest $bulkDeleteTreatmentsRequest): JsonResponse
    {
        $this->authorize('bulkDelete', Treatment::class);

        $result = $this->bulkDeleteTreatmentsUseCase->execute($bulkDeleteTreatmentsRequest->validated('ids'));

        $message = __('DentalManagement::messages.treatments.bulk_deleted');
        if ($result['skipped']) {
            $message .= ' '.__('DentalManagement::messages.treatments.bulk_skipped');
        }

        return $this->successResponse(
            data: $result,
            message: $message
        );
    }
}
