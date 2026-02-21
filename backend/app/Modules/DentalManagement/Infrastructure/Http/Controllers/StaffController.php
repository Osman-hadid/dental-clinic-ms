<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Controllers;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\Common\Infrastructure\Http\Controllers\BaseApiController;
use App\Modules\Common\Infrastructure\Resources\PaginatedResource;
use App\Modules\DentalManagement\Application\DTOs\StaffData;
use App\Modules\DentalManagement\Application\UseCases\Staff\BulkDeleteStaffUseCase;
use App\Modules\DentalManagement\Application\UseCases\Staff\CreateStaffUseCase;
use App\Modules\DentalManagement\Application\UseCases\Staff\DeleteStaffUseCase;
use App\Modules\DentalManagement\Application\UseCases\Staff\ForceDeleteStaffUseCase;
use App\Modules\DentalManagement\Application\UseCases\Staff\GetStaffUseCase;
use App\Modules\DentalManagement\Application\UseCases\Staff\ListStaffUseCase;
use App\Modules\DentalManagement\Application\UseCases\Staff\RestoreStaffUseCase;
use App\Modules\DentalManagement\Application\UseCases\Staff\UpdateStaffUseCase;
use App\Modules\DentalManagement\Domain\Entities\Staff;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Staff\BulkDeleteStaffRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Staff\ListStaffRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Staff\StoreStaffRequest;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\Staff\UpdateStaffRequest;
use App\Modules\DentalManagement\Infrastructure\Resources\StaffResource;
use Illuminate\Http\JsonResponse;

final class StaffController extends BaseApiController
{
    public function __construct(
        private readonly ListStaffUseCase $listStaffUseCase,
        private readonly GetStaffUseCase $getStaffUseCase,
        private readonly RestoreStaffUseCase $restoreStaffUseCase,
        private readonly CreateStaffUseCase $createStaffUseCase,
        private readonly UpdateStaffUseCase $updateStaffUseCase,
        private readonly DeleteStaffUseCase $deleteStaffUseCase,
        private readonly ForceDeleteStaffUseCase $forceDeleteStaffUseCase,
        private readonly BulkDeleteStaffUseCase $bulkDeleteStaffUseCase,
    ) {}

    public function index(ListStaffRequest $listStaffRequest): JsonResponse
    {
        $this->authorize('viewAny', Staff::class);

        $querySpecification = QuerySpecification::fromArray($listStaffRequest->validated());

        $lengthAwarePaginator = $this->listStaffUseCase->execute($querySpecification);

        $paginatedResource = new PaginatedResource($lengthAwarePaginator, StaffResource::class);

        return $this->successResponse(
            data: $paginatedResource,
            message: __('DentalManagement::messages.staff.fetched')
        );
    }

    public function store(StoreStaffRequest $storeStaffRequest): JsonResponse
    {
        $this->authorize('create', Staff::class);

        $staffData = StaffData::fromArray($storeStaffRequest->validated());
        $staff = $this->createStaffUseCase->execute(staffData: $staffData);

        return $this->successResponse(
            data: new StaffResource(resource: $staff),
            message: __('DentalManagement::messages.staff.created'),
            code: 201
        );
    }

    public function show(int $id): JsonResponse
    {
        $staff = $this->getStaffUseCase->execute($id);

        $this->authorize('view', $staff);

        return $this->successResponse(
            data: new StaffResource(resource: $staff),
            message: __('DentalManagement::messages.staff.fetched')
        );
    }

    public function restore(int $id): JsonResponse
    {
        $staff = $this->restoreStaffUseCase->execute($id);

        $this->authorize('restore', $staff);

        return $this->successResponse(
            data: new StaffResource(resource: $staff),
            message: __('DentalManagement::messages.staff.restored')
        );
    }

    public function update(UpdateStaffRequest $updateStaffRequest, int $id): JsonResponse
    {
        $staffData = StaffData::fromArray($updateStaffRequest->validated());
        $staff = $this->updateStaffUseCase->execute(id: $id, staffData: $staffData);

        $this->authorize('update', $staff);

        return $this->successResponse(
            data: new StaffResource(resource: $staff),
            message: __('DentalManagement::messages.staff.updated')
        );
    }

    public function destroy(int $id): JsonResponse
    {
        $this->authorize('delete', Staff::class);

        $this->deleteStaffUseCase->execute(id: $id);

        return $this->successResponse(
            data: null,
            message: __('DentalManagement::messages.staff.deleted')
        );
    }

    public function forceDelete(int $id): JsonResponse
    {
        $this->authorize('forceDelete', Staff::class);

        $this->forceDeleteStaffUseCase->execute($id);

        return $this->successResponse(
            data: null,
            message: __('DentalManagement::messages.staff.force_deleted')
        );
    }

    public function bulkDelete(BulkDeleteStaffRequest $bulkDeleteStaffRequest): JsonResponse
    {
        $this->authorize('bulkDelete', Staff::class);

        $result = $this->bulkDeleteStaffUseCase->execute($bulkDeleteStaffRequest->validated('ids'));

        $message = __('DentalManagement::messages.staff.bulk_deleted');
        if ($result['skipped']) {
            $message .= ' '.__('DentalManagement::messages.staff.bulk_skipped');
        }

        return $this->successResponse(
            data: $result,
            message: $message
        );
    }
}
