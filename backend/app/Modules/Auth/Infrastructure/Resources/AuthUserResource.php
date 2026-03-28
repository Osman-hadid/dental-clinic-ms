<?php

declare(strict_types=1);

namespace App\Modules\Auth\Infrastructure\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

final class AuthUserResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'firstName' => $this->first_name,
            'lastName' => $this->last_name,
            'email' => $this->email,
            'locale' => $this->locale,
            'rights' => $this->rights,
            'profilePhotoPath' => $this->fileUrl($this->profile_photo_path),

            'roles' => $this->whenLoaded(
                'roles',
                fn () => $this->roles->pluck('name')->toArray()
            ),

            'permissions' => $this->getAllPermissionsAttribute(),
        ];
    }

    private function fileUrl(?string $path): ?string
    {
        return $path ? asset("storage/{$path}") : null;
    }
}
