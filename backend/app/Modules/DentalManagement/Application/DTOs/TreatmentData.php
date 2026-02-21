<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\DTOs;

use App\Modules\Common\Infrastructure\Traits\IdCaster;

final readonly class TreatmentData
{
    use IdCaster;

    public function __construct(
        public string $name,
        public string $category,
        public string $defaultPrice,
        public ?int $durationMinutes,
        public ?string $description,
        public ?int $createdBy,
        public ?int $updatedBy,
        public ?int $deletedBy,
        public bool $enabled = true,
        public array $visitTreatments = [],
    ) {}

    public static function fromArray(array $data): self
    {
        $ids = self::castIds(['createdBy', 'updatedBy', 'deletedBy'], $data);

        return new self(
            name: $data['name'] ?? null,
            category: $data['category'] ?? null,
            defaultPrice: $data['defaultPrice'] ?? null,
            durationMinutes: $data['durationMinutes'] ?? null,
            description: $data['description'] ?? null,
            createdBy: $ids['createdBy'] ?? null,
            updatedBy: $ids['updatedBy'] ?? null,
            deletedBy: $ids['deletedBy'] ?? null,
            enabled: $data['enabled'] ?? true,
            visitTreatments: $data['visitTreatments'] ?? [],
        );
    }

    public function toArray(): array
    {
        return [
            'name' => $this->name,
            'category' => $this->category,
            'default_price' => $this->defaultPrice,
            'duration_minutes' => $this->durationMinutes,
            'description' => $this->description,
            'enabled' => $this->enabled,
            'created_by' => $this->createdBy,
            'updated_by' => $this->updatedBy,
            'deleted_by' => $this->deletedBy,
        ];
    }
}
