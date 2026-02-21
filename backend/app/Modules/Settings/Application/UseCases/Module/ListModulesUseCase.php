<?php

declare(strict_types=1);

namespace App\Modules\Settings\Application\UseCases\Module;

use App\Modules\Common\Application\DTOs\QuerySpecification;
use App\Modules\Settings\Domain\Services\ModuleService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

final readonly class ListModulesUseCase
{
    public function __construct(private ModuleService $moduleService) {}

    public function execute(QuerySpecification $querySpecification): LengthAwarePaginator
    {
        return $this->moduleService->listModules($querySpecification);
    }
}
