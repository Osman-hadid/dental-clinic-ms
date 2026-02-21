<?php

declare(strict_types=1);

namespace App\Modules\Settings\Infrastructure\Resources;

use App\Modules\Common\Infrastructure\Traits\HasLocalizedFields;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Collection;

class ModuleResource extends JsonResource
{
    use HasLocalizedFields;

    public function toArray(Request $request): array
    {

        return $this->filterEmpty([
            'id' => $this->id,
            'name' => $this->getLocalizedValue($this, 'name'),
            'url' => $this->url,
            'description' => $this->description,
            'sortOrder' => $this->sort_order,
            'createdAt' => $this->created_at?->toIso8601String(),
            'updatedAt' => $this->updated_at?->toIso8601String(),
        ]);
    }

    private function filterEmpty(array $data): array
    {
        return array_filter($data, fn ($value): bool => !\in_array($value, [null, '', []], true) && !($value instanceof Collection && $value->isEmpty()));
    }
}
