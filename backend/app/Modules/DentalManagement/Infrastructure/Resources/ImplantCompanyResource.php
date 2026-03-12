<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use App\Modules\Common\Infrastructure\Resources\Concerns\ResolvesUserStamps;

final class ImplantCompanyResource extends JsonResource
{
    use ResolvesUserStamps;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'companyName' => $this->company_name,
            'implantType' => $this->implant_type,
            'recordDate' => $this->record_date?->format('Y-m-d'),
            'note' => $this->note,
            'createdBy' => $this->resolveUserStampName($this->created_by),
            'updatedBy' => $this->resolveUserStampName($this->updated_by),
            'createdAt' => $this->created_at?->toIso8601String(),
            'updatedAt' => $this->updated_at?->toIso8601String(),
        ];
    }
}
