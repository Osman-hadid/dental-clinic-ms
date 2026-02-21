<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Collection;

class StaffResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return $this->filterEmpty([
            'id' => $this->id,
            'fullName' => $this->full_name,
            'role' => $this->role,
            'specialization' => $this->specialization,
            'contactNumber' => $this->contact_number,
            'email' => $this->email,
            'hireDate' => $this->hire_date,
            'enabled' => $this->enabled,
            'remarks' => $this->remarks,
            'createdBy' => $this->created_by,
            'updatedBy' => $this->updated_by,
            'deletedBy' => $this->deleted_by,
            'appointments' => $this->appointments,
            'visits' => $this->visits,
            'visitTreatments' => $this->visitTreatments,
            'createdAt' => $this->created_at?->toIso8601String(),
            'updatedAt' => $this->updated_at?->toIso8601String(),
        ]);
    }

    private function filterEmpty(array $data): array
    {
        return array_filter($data, fn ($value): bool => !\in_array($value, [null, '', []], true) && !($value instanceof Collection && $value->isEmpty()));
    }
}
