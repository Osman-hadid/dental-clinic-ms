<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\Tooth;

use App\Modules\DentalManagement\Domain\Services\ToothService;

final readonly class DeleteToothUseCase
{
    public function __construct(private ToothService $toothService) {}

    public function execute(int $id): void
    {
        $this->toothService->deleteTooth(id: $id);
    }
}
