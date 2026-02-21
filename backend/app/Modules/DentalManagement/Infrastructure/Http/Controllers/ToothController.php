<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Controllers;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\Common\Infrastructure\Http\Controllers\BaseApiController;
use App\Modules\Common\Infrastructure\Resources\PaginatedResource;
use App\Modules\DentalManagement\Application\DTOs\ToothData;
use App\Modules\DentalManagement\Application\UseCases\Tooth\BulkDeleteTeethUseCase;
use App\Modules\DentalManagement\Application\UseCases\Tooth\CreateToothUseCase;
use App\Modules\DentalManagement\Application\UseCases\Tooth\DeleteToothUseCase;
use App\Modules\DentalManagement\Application\UseCases\Tooth\ForceDeleteToothUseCase;
use App\Modules\DentalManagement\Application\UseCases\Tooth\GetToothUseCase;
use App\Modules\DentalManagement\Application\UseCases\Tooth\ListTeethUseCase;
use App\Modules\DentalManagement\Application\UseCases\Tooth\RestoreToothUseCase;
use App\Modules\DentalManagement\Application\UseCases\Tooth\UpdateToothUseCase;
use App\Modules\DentalManagement\Domain\Entities\Tooth;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Tooth\BulkDeleteTeethRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Tooth\ListTeethRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Tooth\StoreToothRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Tooth\UpdateToothRequest;
use App\Modules\DentalManagement\Infrastructure\Resources\ToothResource;
use Illuminate\Http\JsonResponse;

final class ToothController extends BaseApiController
{
    public function __construct(
        private readonly ListTeethUseCase $listTeethUseCase,
        private readonly GetToothUseCase $getToothUseCase,
        private readonly RestoreToothUseCase $restoreToothUseCase,
        private readonly CreateToothUseCase $createToothUseCase,
        private readonly UpdateToothUseCase $updateToothUseCase,
        private readonly DeleteToothUseCase $deleteToothUseCase,
        private readonly ForceDeleteToothUseCase $forceDeleteToothUseCase,
        private readonly BulkDeleteTeethUseCase $bulkDeleteTeethUseCase,
    ) {}

    public function index(ListTeethRequest $listTeethRequest): JsonResponse
    {
        $this->authorize('viewAny', Tooth::class);

        $querySpecification = QuerySpecification::fromArray($listTeethRequest->validated());

        $lengthAwarePaginator = $this->listTeethUseCase->execute($querySpecification);

        $paginatedResource = new PaginatedResource($lengthAwarePaginator, ToothResource::class);

        return $this->successResponse(
            data: $paginatedResource,
            message: __('DentalManagement::messages.teeth.fetched')
        );
    }

    public function store(StoreToothRequest $storeToothRequest): JsonResponse
    {
        $this->authorize('create', Tooth::class);

        $toothData = ToothData::fromArray($storeToothRequest->validated());
        $tooth = $this->createToothUseCase->execute(toothData: $toothData);

        return $this->successResponse(
            data: new ToothResource(resource: $tooth),
            message: __('DentalManagement::messages.tooth.created'),
            code: 201
        );
    }

    public function show(int $id): JsonResponse
    {
        $tooth = $this->getToothUseCase->execute($id);

        $this->authorize('view', $tooth);

        return $this->successResponse(
            data: new ToothResource(resource: $tooth),
            message: __('DentalManagement::messages.tooth.fetched')
        );
    }

    public function restore(int $id): JsonResponse
    {
        $tooth = $this->restoreToothUseCase->execute($id);

        $this->authorize('restore', $tooth);

        return $this->successResponse(
            data: new ToothResource(resource: $tooth),
            message: __('DentalManagement::messages.tooth.restored')
        );
    }

    public function update(UpdateToothRequest $updateToothRequest, int $id): JsonResponse
    {
        $toothData = ToothData::fromArray($updateToothRequest->validated());
        $tooth = $this->updateToothUseCase->execute(id: $id, toothData: $toothData);

        $this->authorize('update', $tooth);

        return $this->successResponse(
            data: new ToothResource(resource: $tooth),
            message: __('DentalManagement::messages.tooth.updated')
        );
    }

    public function destroy(int $id): JsonResponse
    {
        $this->authorize('delete', Tooth::class);

        $this->deleteToothUseCase->execute(id: $id);

        return $this->successResponse(
            data: null,
            message: __('DentalManagement::messages.tooth.deleted')
        );
    }

    public function forceDelete(int $id): JsonResponse
    {
        $this->authorize('forceDelete', Tooth::class);

        $this->forceDeleteToothUseCase->execute($id);

        return $this->successResponse(
            data: null,
            message: __('DentalManagement::messages.tooth.force_deleted')
        );
    }

    public function bulkDelete(BulkDeleteTeethRequest $bulkDeleteTeethRequest): JsonResponse
    {
        $this->authorize('bulkDelete', Tooth::class);

        $result = $this->bulkDeleteTeethUseCase->execute($bulkDeleteTeethRequest->validated('ids'));

        $message = __('DentalManagement::messages.teeth.bulk_deleted');
        if ($result['skipped']) {
            $message .= ' '.__('DentalManagement::messages.teeth.bulk_skipped');
        }

        return $this->successResponse(
            data: $result,
            message: $message
        );
    }
}
