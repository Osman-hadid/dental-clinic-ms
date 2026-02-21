<?php

declare(strict_types=1);

namespace App\Modules\UserManagement\Infrastructure\Resources;

use App\Modules\Common\Infrastructure\Traits\HasLocalizedFields;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Collection;

final class UserResource extends JsonResource
{
    use HasLocalizedFields;

    public function toArray(Request $request): array
    {
        return $this->filterEmpty([
            'id' => $this->id,
            'firstName' => $this->first_name,
            'lastName' => $this->last_name,
            'jobTitle' => $this->job_title,
            'reportToId' => $this->report_to_id,

            'reportTo' => $this->whenLoaded(
                relationship: 'reportTo',
                value: fn (): ?array => $this->formatReportTo()
            ),

            'roles' => $this->whenLoaded(
                relationship: 'roles',
                value: fn (): Collection => $this->mapLocalizedCollection($this->roles)
            ),

            'roleIds' => $this->whenLoaded('roles', fn () => $this->roles->pluck('id')->toArray()),

            'permissions' => $this->whenLoaded(
                relationship: 'permissions',
                value: fn (): Collection => $this->mapLocalizedCollection($this->permissions)
            ),

            'permissionIds' => $this->getAllPermissions()->pluck('id')->toArray(),

            'email' => $this->email,
            'contactNumber' => $this->contact_number,
            'whatsappNumber' => $this->whatsapp_number,
            'locale' => $this->locale,
            'mainOrganizationId' => $this->main_organization_id,
            'rights' => $this->rights,
            'notifications' => $this->notifications,
            'enabled' => $this->enabled,
            'status' => $this->status,
            'remarks' => $this->remarks,
            'lastLoginAt' => $this->last_login_at?->toIso8601String(),
            'profilePhotoPath' => $this->fileUrl($this->profile_photo_path),
            'userFormPath' => $this->fileUrl($this->user_form_path),
            'createdBy' => $this->created_by,
            'updatedBy' => $this->updated_by,
            'deletedBy' => $this->deleted_by,
            'createdAt' => $this->created_at?->toIso8601String(),
            'updatedAt' => $this->updated_at?->toIso8601String(),
        ]);
    }

    private function formatReportTo(): ?array
    {
        if (!$this->reportTo) {
            return null;
        }

        return [
            'id' => $this->reportTo->id,
            'name' => trim("{$this->reportTo->first_name} {$this->reportTo->last_name}"),
        ];
    }

    private function fileUrl(?string $path): ?string
    {
        return $path ? asset("storage/{$path}") : null;
    }

    private function filterEmpty(array $data): array
    {
        return array_filter(
            $data,
            fn ($value): bool => !\in_array($value, [null, '', []], true)
                && !($value instanceof Collection && $value->isEmpty())
        );
    }

    private function mapLocalizedCollection(Collection $items): Collection
    {
        return $items->map(fn (object $item): array => [
            'id' => $item->id,
            'name' => $this->getLocalizedValue($item, 'display_name'),
        ]);
    }
}
