<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\Policies;

use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

final class ToothPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('dental-management.teeth.view');
    }

    public function view(User $user): bool
    {
        return $user->can('dental-management.teeth.view');
    }

    public function create(User $user): bool
    {
        return $user->can('dental-management.teeth.create');
    }

    public function update(User $user): bool
    {
        return $user->can('dental-management.teeth.update');
    }

    public function delete(User $user): bool
    {
        return $user->can('dental-management.teeth.delete');
    }

    public function restore(User $user): bool
    {
        return $user->can('dental-management.teeth.restore');
    }

    public function forceDelete(User $user): bool
    {
        return $user->can('dental-management.teeth.force-delete');
    }

    public function bulkDelete(User $user): bool
    {
        return $user->can('dental-management.teeth.bulk-delete');
    }
}
