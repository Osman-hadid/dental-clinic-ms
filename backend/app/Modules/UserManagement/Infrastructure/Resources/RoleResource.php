<?php

declare(strict_types=1);

namespace App\Modules\UserManagement\Infrastructure\Resources;

use App\Modules\Common\Infrastructure\Traits\HasLocalizedFields;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Collection;

final class RoleResource extends JsonResource
{
    use HasLocalizedFields;

    public function toArray(Request $request): array
    {

        return $this->filterEmpty([
            'id' => $this->id,
            'name' => $this->name,
            'displayName' => $this->getLocalizedValue($this, 'display_name'),
            'displayNameEn' => $this->display_name_en,
            'displayNamePs' => $this->display_name_ps,
            'displayNameDr' => $this->display_name_dr,
            'permissions' => $this->getPermissions(),
            'permissionIds' => $this->getAllPermissions()->pluck('id')->toArray(),
            'createdAt' => $this->created_at?->toIso8601String(),
            'updatedAt' => $this->updated_at?->toIso8601String(),
        ]);
    }

    private function getPermissions()
    {
        return $this->whenLoaded('permissions', fn () => PermissionResource::collection($this->permissions));
    }

    private function filterEmpty(array $data): array
    {
        return array_filter($data, fn ($value): bool => !\in_array($value, [null, '', []], true) && !($value instanceof Collection && $value->isEmpty()));
    }
}
