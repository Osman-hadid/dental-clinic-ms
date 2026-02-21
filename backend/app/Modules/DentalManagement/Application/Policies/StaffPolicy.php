<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\Policies;

use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

final class StaffPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('dental-management.staff.view');
    }

    public function view(User $user): bool
    {
        return $user->can('dental-management.staff.view');
    }

    public function create(User $user): bool
    {
        return $user->can('dental-management.staff.create');
    }

    public function update(User $user): bool
    {
        return $user->can('dental-management.staff.update');
    }

    public function delete(User $user): bool
    {
        return $user->can('dental-management.staff.delete');
    }

    public function restore(User $user): bool
    {
        return $user->can('dental-management.staff.restore');
    }

    public function forceDelete(User $user): bool
    {
        return $user->can('dental-management.staff.force-delete');
    }

    public function bulkDelete(User $user): bool
    {
        return $user->can('dental-management.staff.bulk-delete');
    }
}
