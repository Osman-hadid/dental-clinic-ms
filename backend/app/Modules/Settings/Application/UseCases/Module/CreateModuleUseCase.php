<?php

declare(strict_types=1);

namespace App\Modules\Settings\Application\UseCases\Module;

use App\Modules\Settings\Application\DTOs\ModuleData;
use App\Modules\Settings\Domain\Entities\Module;
use App\Modules\Settings\Domain\Services\ModuleService;

final readonly class CreateModuleUseCase
{
    public function __construct(
        private ModuleService $moduleService
    ) {}

    public function execute(ModuleData $moduleData): Module
    {
        return $this->moduleService->createModule(data: $moduleData->toArray());
    }
}
