<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\DTOs;

use App\Modules\Common\Infrastructure\Traits\IdCaster;
use Illuminate\Http\UploadedFile;

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
        public ?string $imageModality,
        public ?string $imageSource,
        public ?string $notes,
        public ?string $correctionReason,
        public ?array $materialItems,
        public ?array $treatmentImages,
        public ?array $retainedTreatmentImageIds,
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
            imageModality: $data['imageModality'] ?? null,
            imageSource: $data['imageSource'] ?? null,
            notes: $data['notes'] ?? null,
            correctionReason: $data['correctionReason'] ?? null,
            materialItems: isset($data['materialItems']) && is_array($data['materialItems'])
                ? $data['materialItems']
                : null,
            treatmentImages: isset($data['treatmentImages']) && is_array($data['treatmentImages'])
                ? array_values(array_filter(
                    $data['treatmentImages'],
                    static fn (mixed $file): bool => $file instanceof UploadedFile
                ))
                : null,
            retainedTreatmentImageIds: isset($data['retainedTreatmentImageIds']) && is_array($data['retainedTreatmentImageIds'])
                ? array_map(
                    static fn (mixed $id): int => (int) $id,
                    array_values(array_filter(
                        $data['retainedTreatmentImageIds'],
                        static fn (mixed $id): bool => (int) $id > 0
                    ))
                )
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
            'image_modality' => $this->imageModality,
            'image_source' => $this->imageSource,
            'notes' => $this->notes,
            'correction_reason' => $this->correctionReason,
            'material_items' => $this->materialItems,
            'treatment_images' => $this->treatmentImages,
            'retained_treatment_image_ids' => $this->retainedTreatmentImageIds,
            'prescription' => $this->prescription,
            'created_by' => $this->createdBy,
            'updated_by' => $this->updatedBy,
            'deleted_by' => $this->deletedBy,
        ];
    }
}
