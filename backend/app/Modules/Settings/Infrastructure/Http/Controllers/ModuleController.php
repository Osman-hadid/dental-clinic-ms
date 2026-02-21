<?php

declare(strict_types=1);

namespace App\Modules\Settings\Infrastructure\Http\Controllers;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\Common\Infrastructure\Http\Controllers\BaseApiController;
use App\Modules\Common\Infrastructure\Resources\PaginatedResource;
use App\Modules\Settings\Application\DTOs\ModuleData;
use App\Modules\Settings\Application\UseCases\Module\BulkDeleteModulesUseCase;
use App\Modules\Settings\Application\UseCases\Module\CreateModuleUseCase;
use App\Modules\Settings\Application\UseCases\Module\DeleteModuleUseCase;
use App\Modules\Settings\Application\UseCases\Module\ForceDeleteModuleUseCase;
use App\Modules\Settings\Application\UseCases\Module\GetModuleUseCase;
use App\Modules\Settings\Application\UseCases\Module\ListModulesUseCase;
use App\Modules\Settings\Application\UseCases\Module\RestoreModuleUseCase;
use App\Modules\Settings\Application\UseCases\Module\UpdateModuleUseCase;
use App\Modules\Settings\Infrastructure\Http\Requests\Module\BulkDeleteModulesRequest;
use App\Modules\Settings\Infrastructure\Http\Requests\Module\ListModulesRequest;
use App\Modules\Settings\Infrastructure\Http\Requests\Module\StoreModuleRequest;
use App\Modules\Settings\Infrastructure\Http\Requests\Module\UpdateModuleRequest;
use App\Modules\Settings\Infrastructure\Resources\ModuleResource;
use Illuminate\Http\JsonResponse;

final class ModuleController extends BaseApiController
{
    public function __construct(
        private readonly ListModulesUseCase $listModulesUseCase,
        private readonly GetModuleUseCase $getModuleUseCase,
        private readonly RestoreModuleUseCase $restoreModuleUseCase,
        private readonly CreateModuleUseCase $createModuleUseCase,
        private readonly UpdateModuleUseCase $updateModuleUseCase,
        private readonly DeleteModuleUseCase $deleteModuleUseCase,
        private readonly ForceDeleteModuleUseCase $forceDeleteModuleUseCase,
        private readonly BulkDeleteModulesUseCase $bulkDeleteModulesUseCase,
    ) {}

    public function index(ListModulesRequest $listModulesRequest): JsonResponse
    {
        $querySpecification = QuerySpecification::fromArray($listModulesRequest->validated());

        $lengthAwarePaginator = $this->listModulesUseCase->execute($querySpecification);

        $paginatedResource = new PaginatedResource($lengthAwarePaginator, ModuleResource::class);

        return $this->successResponse(
            data: $paginatedResource,
            message: __('Settings::messages.modules.fetched')
        );
    }

    public function store(StoreModuleRequest $storeModuleRequest): JsonResponse
    {
        $moduleData = ModuleData::fromArray($storeModuleRequest->validated());
        $module = $this->createModuleUseCase->execute(moduleData: $moduleData);

        return $this->successResponse(
            data: new ModuleResource(resource: $module),
            message: __('Settings::messages.module.created'),
            code: 201
        );
    }

    public function show(int $id): JsonResponse
    {
        $module = $this->getModuleUseCase->execute($id);

        return $this->successResponse(
            data: new ModuleResource(resource: $module),
            message: __('Settings::messages.module.fetched')
        );
    }

    public function restore(int $id): JsonResponse
    {
        $module = $this->restoreModuleUseCase->execute($id);

        return $this->successResponse(
            data: new ModuleResource(resource: $module),
            message: __('Settings::messages.module.restored')
        );
    }

    public function update(UpdateModuleRequest $updateModuleRequest, int $id): JsonResponse
    {
        $moduleData = ModuleData::fromArray($updateModuleRequest->validated());
        $module = $this->updateModuleUseCase->execute(id: $id, moduleData: $moduleData);

        return $this->successResponse(
            data: new ModuleResource(resource: $module),
            message: __('Settings::messages.module.updated')
        );
    }

    public function destroy(int $id): JsonResponse
    {
        $this->deleteModuleUseCase->execute(id: $id);

        return $this->successResponse(
            data: null,
            message: __('Settings::messages.module.deleted')
        );
    }

    public function forceDelete(int $id): JsonResponse
    {
        $this->forceDeleteModuleUseCase->execute($id);

        return $this->successResponse(
            data: null,
            message: __('Settings::messages.module.force_deleted')
        );
    }

    public function bulkDelete(BulkDeleteModulesRequest $bulkDeleteModulesRequest): JsonResponse
    {
        $result = $this->bulkDeleteModulesUseCase->execute($bulkDeleteModulesRequest->validated('ids'));

        $message = __('Settings::messages.modules.bulk_deleted');
        if ($result['skipped']) {
            $message .= ' '.__('Settings::messages.modules.bulk_skipped');
        }

        return $this->successResponse(
            data: $result,
            message: $message
        );
    }
}
