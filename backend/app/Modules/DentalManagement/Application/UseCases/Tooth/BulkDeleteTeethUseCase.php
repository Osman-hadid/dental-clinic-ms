<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\Tooth;

use App\Modules\DentalManagement\Domain\Services\ToothService;

final readonly class BulkDeleteTeethUseCase
{
    public function __construct(private ToothService $toothService) {}

    public function execute(array $ids): array
    {
        return $this->toothService->bulkDeleteTeeth($ids);
    }
}
