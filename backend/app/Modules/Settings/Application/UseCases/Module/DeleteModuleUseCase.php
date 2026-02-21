<?php

declare(strict_types=1);

namespace App\Modules\Settings\Application\UseCases\Module;

use App\Modules\Settings\Domain\Services\ModuleService;

final readonly class DeleteModuleUseCase
{
    public function __construct(private ModuleService $moduleService) {}

    public function execute(int $id): void
    {
        $this->moduleService->deleteModule(id: $id);
    }
}
