<?php

declare(strict_types=1);

namespace App\Modules\UserManagement\Infrastructure\Resources;

use App\Modules\Common\Infrastructure\Traits\HasLocalizedFields;
use App\Modules\Settings\Infrastructure\Resources\ModuleResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Collection;

final class PermissionResource extends JsonResource
{
    use HasLocalizedFields;

    public function toArray(Request $request): array
    {

        return $this->filterEmpty([
            'id' => $this->id,
            'name' => $this->name,
            'moduleId' => $this->module_id,
            'module' => $this->getModule(),
            'displayName' => $this->getLocalizedValue($this, 'display_name'),
            'displayNameEn' => $this->display_name_en,
            'displayNamePs' => $this->display_name_ps,
            'displayNameDr' => $this->display_name_dr,
            'createdAt' => $this->created_at?->toIso8601String(),
            'updatedAt' => $this->updated_at?->toIso8601String(),
        ]);
    }

    private function getModule(): ModuleResource
    {
        return new ModuleResource($this->whenLoaded('module'));
    }

    private function filterEmpty(array $data): array
    {
        return array_filter($data, fn ($value): bool => !\in_array($value, [null, '', []], true) && !($value instanceof Collection && $value->isEmpty()));
    }
}
