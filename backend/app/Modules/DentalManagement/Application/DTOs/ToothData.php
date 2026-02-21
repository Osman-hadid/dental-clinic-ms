<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\DTOs;

use App\Modules\Common\Infrastructure\Traits\IdCaster;

final readonly class ToothData
{
    use IdCaster;

    public function __construct(
        public string $toothNumber,
        public ?string $description,
        public ?int $createdBy,
        public ?int $updatedBy,
        public ?int $deletedBy,
        public array $visitTreatments = [],
    ) {}

    public static function fromArray(array $data): self
    {
        $ids = self::castIds(['createdBy', 'updatedBy', 'deletedBy'], $data);

        return new self(
            toothNumber: $data['toothNumber'] ?? null,
            description: $data['description'] ?? null,
            createdBy: $ids['createdBy'] ?? null,
            updatedBy: $ids['updatedBy'] ?? null,
            deletedBy: $ids['deletedBy'] ?? null,
            visitTreatments: $data['visitTreatments'] ?? [],
        );
    }

    public function toArray(): array
    {
        return [
            'tooth_number' => $this->toothNumber,
            'description' => $this->description,
            'created_by' => $this->createdBy,
            'updated_by' => $this->updatedBy,
            'deleted_by' => $this->deletedBy,
        ];
    }
}
