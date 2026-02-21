<?php

declare(strict_types=1);

namespace App\Modules\Settings\Application\UseCases\Module;

use App\Modules\Settings\Domain\Services\ModuleService;

final readonly class BulkDeleteModulesUseCase
{
    public function __construct(private ModuleService $moduleService) {}

    public function execute(array $ids): array
    {
        return $this->moduleService->bulkDeleteModules($ids);
    }
}
