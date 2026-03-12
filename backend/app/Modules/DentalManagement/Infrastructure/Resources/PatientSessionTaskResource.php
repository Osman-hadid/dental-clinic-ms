<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Collection;
use App\Modules\Common\Infrastructure\Resources\Concerns\ResolvesUserStamps;

class PatientSessionTaskResource extends JsonResource
{
    use ResolvesUserStamps;

    public function toArray(Request $request): array
    {
        return $this->filterEmpty([
            'id' => $this->id,
            'patientId' => $this->patient_id,
            'implantCompanyId' => $this->implant_company_id,
            'title' => $this->title,
            'mark' => $this->mark,
            'status' => $this->status,
            'notes' => $this->notes,
            'createdBy' => $this->resolveUserStampName($this->created_by),
            'updatedBy' => $this->resolveUserStampName($this->updated_by),
            'createdAt' => $this->created_at?->toIso8601String(),
            'updatedAt' => $this->updated_at?->toIso8601String(),
        ]);
    }

    private function filterEmpty(array $data): array
    {
        return array_filter($data, fn ($value): bool => !\in_array($value, [null, '', []], true) && !($value instanceof Collection && $value->isEmpty()));
    }
}
