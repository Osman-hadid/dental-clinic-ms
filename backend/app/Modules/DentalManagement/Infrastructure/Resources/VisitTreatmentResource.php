<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Resources;

use App\Models\ActivityLog;
use App\Modules\DentalManagement\Domain\Entities\VisitTreatment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use App\Modules\Common\Infrastructure\Resources\Concerns\ResolvesUserStamps;
use Illuminate\Support\Collection;

class VisitTreatmentResource extends JsonResource
{
    use ResolvesUserStamps;

    public function toArray(Request $request): array
    {
        return $this->filterEmpty([
            'id' => $this->id,
            'visitId' => $this->visit_id,
            'treatmentId' => $this->treatment_id,
            'toothId' => $this->tooth_id,
            'toothNumber' => $this->tooth_number,
            'dentistId' => $this->dentist_id,
            'price' => $this->price,
            'material' => $this->material,
            'imageModality' => $this->image_modality,
            'imageSource' => $this->image_source,
            'notes' => $this->notes,
            'prescription' => $this->prescription !== null ? [
                'id' => $this->prescription->id,
                'visitId' => $this->prescription->visit_id,
                'visitTreatmentId' => $this->prescription->visit_treatment_id,
                'patientId' => $this->prescription->patient_id,
                'dentistId' => $this->prescription->dentist_id,
                'content' => $this->prescription->content,
                'name' => $this->prescription->medicine_name,
                'unit' => $this->prescription->dosage_unit,
                'amount' => $this->prescription->dosage_amount,
                'frequency' => $this->prescription->frequency,
                'foodTiming' => $this->prescription->food_timing,
                'items' => $this->prescription->items !== null ? $this->prescription->items->map(fn ($item): array => [
                    'id' => $item->id,
                    'prescriptionId' => $item->prescription_id,
                    'name' => $item->name,
                    'unit' => $item->unit,
                    'amount' => $item->amount,
                    'frequency' => $item->frequency,
                    'foodTiming' => $item->food_timing,
                    'createdBy' => $this->resolveUserStampName($item->created_by),
                    'updatedBy' => $this->resolveUserStampName($item->updated_by),
                    'deletedBy' => $item->deleted_by,
                    'createdAt' => $item->created_at?->toIso8601String(),
                    'updatedAt' => $item->updated_at?->toIso8601String(),
                ])->values()->all() : [],
                'createdBy' => $this->resolveUserStampName($this->prescription->created_by),
                'updatedBy' => $this->resolveUserStampName($this->prescription->updated_by),
                'deletedBy' => $this->prescription->deleted_by,
                'createdAt' => $this->prescription->created_at?->toIso8601String(),
                'updatedAt' => $this->prescription->updated_at?->toIso8601String(),
            ] : null,
            'materialItems' => $this->materialItems !== null ? $this->materialItems->map(fn ($item): array => [
                'id' => $item->id,
                'visitTreatmentId' => $item->visit_treatment_id,
                'inventoryItemId' => $item->inventory_item_id,
                'itemName' => $item->item_name,
                'unit' => $item->unit,
                'quantityUsed' => $item->quantity_used,
                'createdBy' => $this->resolveUserStampName($item->created_by),
                'updatedBy' => $this->resolveUserStampName($item->updated_by),
                'deletedBy' => $item->deleted_by,
                'createdAt' => $item->created_at?->toIso8601String(),
                'updatedAt' => $item->updated_at?->toIso8601String(),
            ])->values()->all() : null,
            'treatmentImages' => $this->whenLoaded(
                'treatmentImages',
                fn () => $this->treatmentImages->map(fn ($image): array => [
                    'id' => $image->id,
                    'visitTreatmentId' => $image->visit_treatment_id,
                    'path' => $image->path,
                    'url' => $this->fileUrl($image->path),
                    'originalName' => $image->original_name,
                    'mimeType' => $image->mime_type,
                    'size' => $image->size,
                    'createdBy' => $this->resolveUserStampName($image->created_by),
                    'updatedBy' => $this->resolveUserStampName($image->updated_by),
                    'deletedBy' => $image->deleted_by,
                    'createdAt' => $image->created_at?->toIso8601String(),
                    'updatedAt' => $image->updated_at?->toIso8601String(),
                ])->values()->all()
            ),
            'correctionHistory' => $this->correctionHistory(),
            'createdBy' => $this->resolveUserStampName($this->created_by),
            'updatedBy' => $this->resolveUserStampName($this->updated_by),
            'deletedBy' => $this->deleted_by,
            'visit' => $this->visit,
            'treatment' => $this->treatment,
            'tooth' => $this->tooth,
            'dentist' => $this->dentist,
            'createdAt' => $this->created_at?->toIso8601String(),
            'updatedAt' => $this->updated_at?->toIso8601String(),
        ]);
    }

    private function fileUrl(?string $path): ?string
    {
        return $path ? asset("storage/{$path}") : null;
    }

    private function filterEmpty(array $data): array
    {
        return array_filter($data, fn ($value): bool => !\in_array($value, [null, '', []], true) && !($value instanceof Collection && $value->isEmpty()));
    }

    private function correctionHistory(): array
    {
        return ActivityLog::query()
            ->with('causer')
            ->where('subject_type', VisitTreatment::class)
            ->where('subject_id', $this->id)
            ->orderByDesc('created_at')
            ->limit(10)
            ->get()
            ->map(function ($activity): array {
                $properties = is_array($activity->properties) ? $activity->properties : [];

                return [
                    'id' => $activity->id,
                    'changes' => is_array($properties['diff'] ?? null) ? array_values($properties['diff']) : [],
                    'changedBy' => $activity->causer?->first_name && $activity->causer?->last_name
                        ? trim($activity->causer->first_name.' '.$activity->causer->last_name)
                        : ($activity->causer?->email ?? 'System'),
                    'correctionReason' => $properties['correctionReason'] ?? null,
                    'description' => $activity->description,
                    'event' => $activity->event,
                    'createdAt' => $activity->created_at?->toIso8601String(),
                ];
            })
            ->values()
            ->all();
    }
}
