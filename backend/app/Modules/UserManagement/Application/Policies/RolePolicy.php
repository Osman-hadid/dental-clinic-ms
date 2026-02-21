<?php

declare(strict_types=1);

namespace App\Modules\UserManagement\Application\Policies;

use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

final class RolePolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('user-management.roles.view');
    }

    public function view(User $user): bool
    {
        return $user->can('user-management.roles.view');
    }

    public function create(User $user): bool
    {
        return $user->can('user-management.roles.create');
    }

    public function update(User $user): bool
    {
        return $user->can('user-management.roles.update');
    }

    public function delete(User $user): bool
    {
        return $user->can('user-management.roles.delete');
    }

    public function restore(User $user): bool
    {
        return $user->can('user-management.roles.restore');
    }

    public function forceDelete(User $user): bool
    {
        return $user->can('user-management.roles.force-delete');
    }

    public function bulkDelete(User $user): bool
    {
        return $user->can('user-management.roles.bulk-delete');
    }
}
