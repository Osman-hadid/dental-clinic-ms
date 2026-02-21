<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\UseCases\Tooth;

use App\Modules\DentalManagement\Domain\Entities\Tooth;
use App\Modules\DentalManagement\Domain\Services\ToothService;

final readonly class GetToothUseCase
{
    public function __construct(private ToothService $toothService) {}

    public function execute(int $id): Tooth
    {
        return $this->toothService->getTooth(id: $id);
    }
}
