<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\Policies;

use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

final class ShareholderPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('dental-management.shareholders.view');
    }

    public function view(User $user): bool
    {
        return $user->can('dental-management.shareholders.view');
    }

    public function create(User $user): bool
    {
        return $user->can('dental-management.shareholders.create');
    }

    public function update(User $user): bool
    {
        return $user->can('dental-management.shareholders.update');
    }

    public function delete(User $user): bool
    {
        return $user->can('dental-management.shareholders.delete');
    }

    public function restore(User $user): bool
    {
        return $user->can('dental-management.shareholders.restore');
    }

    public function forceDelete(User $user): bool
    {
        return $user->can('dental-management.shareholders.force-delete');
    }

    public function bulkDelete(User $user): bool
    {
        return $user->can('dental-management.shareholders.bulk-delete');
    }
}
