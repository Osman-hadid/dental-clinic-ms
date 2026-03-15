<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class ClinicProfileResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'ownerName' => $this->owner_name,
            'logoPath' => $this->fileUrl($this->logo_path),
            'address' => $this->address,
            'contactNumber' => $this->contact_number,
            'email' => $this->email,
            'website' => $this->website,
            'licenseNumber' => $this->license_number,
            'notes' => $this->notes,
            'createdAt' => $this->created_at?->toIso8601String(),
            'updatedAt' => $this->updated_at?->toIso8601String(),
        ];
    }

    private function fileUrl(?string $path): ?string
    {
        return $path ? asset("storage/{$path}") : null;
    }
}
