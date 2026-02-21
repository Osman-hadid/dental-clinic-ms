<?php

declare(strict_types=1);

namespace App\Modules\UserManagement\Application\DTOs;

use App\Modules\Common\Infrastructure\Traits\IdCaster;

final readonly class RoleData
{
    use IdCaster;

    public function __construct(
        public string $name,
        public string $displayNameEn,
        public string $displayNamePs,
        public string $displayNameDr,
        public array $permissionIds = [],
        public ?string $guardName = 'web',
    ) {}

    public static function fromArray(array $data): self
    {
        $ids = self::castIds(['permissionIds.*'], $data);

        return new self(
            name: $data['name'] ?? '',
            displayNameEn: $data['displayNameEn'] ?? '',
            displayNamePs: $data['displayNamePs'] ?? '',
            displayNameDr: $data['displayNameDr'] ?? '',
            permissionIds: $ids['permissionIds'] ?? [],
            guardName: $data['guardName'] ?? 'web',
        );
    }

    public function toArray(): array
    {
        return [
            'name' => $this->name,
            'display_name_en' => $this->displayNameEn,
            'display_name_ps' => $this->displayNamePs,
            'display_name_dr' => $this->displayNameDr,
            'permissions' => $this->permissionIds,
            'guard_name' => $this->guardName,
        ];
    }
}
