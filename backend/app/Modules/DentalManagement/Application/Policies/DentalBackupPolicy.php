<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\Policies;

use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

final class DentalBackupPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('dental-management.backups.view');
    }

    public function view(User $user): bool
    {
        return $user->can('dental-management.backups.view');
    }

    public function create(User $user): bool
    {
        return $user->can('dental-management.backups.create');
    }

    public function update(User $user): bool
    {
        return $user->can('dental-management.backups.update');
    }

    public function delete(User $user): bool
    {
        return $user->can('dental-management.backups.delete');
    }

    public function restore(User $user): bool
    {
        return $user->can('dental-management.backups.restore');
    }

    public function forceDelete(User $user): bool
    {
        return $user->can('dental-management.backups.force-delete');
    }

    public function bulkDelete(User $user): bool
    {
        return $user->can('dental-management.backups.bulk-delete');
    }
}
