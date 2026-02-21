<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\Tooth;

use App\Modules\DentalManagement\Application\DTOs\ToothData;
use App\Modules\DentalManagement\Domain\Entities\Tooth;
use App\Modules\DentalManagement\Domain\Services\ToothService;

final readonly class CreateToothUseCase
{
    public function __construct(
        private ToothService $toothService
    ) {}

    public function execute(ToothData $toothData): Tooth
    {
        return $this->toothService->createTooth(data: $toothData->toArray());
    }
}
