<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\DTOs;

use App\Modules\Common\Infrastructure\Traits\IdCaster;

final readonly class VisitTreatmentData
{
    use IdCaster;

    public function __construct(
        public int $visitId,
        public int $treatmentId,
        public ?int $toothId,
        public ?string $toothNumber,
        public int $dentistId,
        public string $price,
        public ?string $material,
        public ?string $notes,
        public ?array $materialItems,
        public ?array $prescription,
        public ?int $createdBy,
        public ?int $updatedBy,
        public ?int $deletedBy,
    ) {}

    public static function fromArray(array $data): self
    {
        $ids = self::castIds(['visitId', 'treatmentId', 'toothId', 'dentistId', 'createdBy', 'updatedBy', 'deletedBy'], $data);

        return new self(
            visitId: $ids['visitId'] ?? null,
            treatmentId: $ids['treatmentId'] ?? null,
            toothId: $ids['toothId'] ?? null,
            toothNumber: $data['toothNumber'] ?? null,
            dentistId: $ids['dentistId'] ?? null,
            price: $data['price'] ?? null,
            material: $data['material'] ?? null,
            notes: $data['notes'] ?? null,
            materialItems: isset($data['materialItems']) && is_array($data['materialItems'])
                ? $data['materialItems']
                : null,
            prescription: isset($data['prescription']) && is_array($data['prescription'])
                ? $data['prescription']
                : null,
            createdBy: $ids['createdBy'] ?? null,
            updatedBy: $ids['updatedBy'] ?? null,
            deletedBy: $ids['deletedBy'] ?? null,
        );
    }

    public function toArray(): array
    {
        return [
            'visit_id' => $this->visitId,
            'treatment_id' => $this->treatmentId,
            'tooth_id' => $this->toothId,
            'tooth_number' => $this->toothNumber,
            'dentist_id' => $this->dentistId,
            'price' => $this->price,
            'material' => $this->material,
            'notes' => $this->notes,
            'material_items' => $this->materialItems,
            'prescription' => $this->prescription,
            'created_by' => $this->createdBy,
            'updated_by' => $this->updatedBy,
            'deleted_by' => $this->deletedBy,
        ];
    }
}
