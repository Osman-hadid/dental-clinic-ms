<?php

declare(strict_types=1);

namespace App\Modules\UserManagement\Application\Policies;

use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

final class UserPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('user-management.users.view');
    }

    public function view(User $user): bool
    {
        return $user->can('user-management.users.view');
    }

    public function create(User $user): bool
    {
        return $user->can('user-management.users.create');
    }

    public function update(User $user): bool
    {
        return $user->can('user-management.users.update');
    }

    public function delete(User $user): bool
    {
        return $user->can('user-management.users.delete');
    }

    public function restore(User $user): bool
    {
        return $user->can('user-management.users.restore');
    }

    public function forceDelete(User $user): bool
    {
        return $user->can('user-management.users.force-delete');
    }

    public function bulkDelete(User $user): bool
    {
        return $user->can('user-management.users.bulk-delete');
    }
}
