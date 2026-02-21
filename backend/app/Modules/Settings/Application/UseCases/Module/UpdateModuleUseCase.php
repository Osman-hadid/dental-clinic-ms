<?php

declare(strict_types=1);

namespace App\Modules\Settings\Application\UseCases\Module;

use App\Modules\Settings\Application\DTOs\ModuleData;
use App\Modules\Settings\Domain\Entities\Module;
use App\Modules\Settings\Domain\Services\ModuleService;

final readonly class UpdateModuleUseCase
{
    public function __construct(private ModuleService $moduleService) {}

    public function execute(int $id, ModuleData $moduleData): Module
    {
        return $this->moduleService->updateModule(id: $id, data: $moduleData->toArray());
    }
}
