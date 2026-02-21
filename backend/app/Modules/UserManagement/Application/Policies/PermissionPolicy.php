<?php

declare(strict_types=1);

namespace App\Modules\UserManagement\Application\Policies;

use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

final class PermissionPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('user-management.permissions.view');
    }

    public function view(User $user): bool
    {
        return $user->can('user-management.permissions.view');
    }

    public function create(User $user): bool
    {
        return $user->can('user-management.permissions.create');
    }

    public function update(User $user): bool
    {
        return $user->can('user-management.permissions.update');
    }

    public function delete(User $user): bool
    {
        return $user->can('user-management.permissions.delete');
    }

    public function restore(User $user): bool
    {
        return $user->can('user-management.permissions.restore');
    }

    public function forceDelete(User $user): bool
    {
        return $user->can('user-management.permissions.force-delete');
    }

    public function bulkDelete(User $user): bool
    {
        return $user->can('user-management.permissions.bulk-delete');
    }
}
