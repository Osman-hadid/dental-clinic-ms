<?php

declare(strict_types=1);

namespace App\Modules\Settings\Application\UseCases\Module;

use App\Modules\Settings\Domain\Entities\Module;
use App\Modules\Settings\Domain\Services\ModuleService;

final readonly class GetModuleUseCase
{
    public function __construct(private ModuleService $moduleService) {}

    public function execute(int $id): Module
    {
        return $this->moduleService->getModule(id: $id);
    }
}
