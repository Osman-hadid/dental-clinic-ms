<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\Policies;

use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

final class VisitPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('dental-management.visits.view');
    }

    public function view(User $user): bool
    {
        return $user->can('dental-management.visits.view');
    }

    public function create(User $user): bool
    {
        return $user->can('dental-management.visits.create');
    }

    public function update(User $user): bool
    {
        return $user->can('dental-management.visits.update');
    }

    public function delete(User $user): bool
    {
        return $user->can('dental-management.visits.delete');
    }

    public function restore(User $user): bool
    {
        return $user->can('dental-management.visits.restore');
    }

    public function forceDelete(User $user): bool
    {
        return $user->can('dental-management.visits.force-delete');
    }

    public function bulkDelete(User $user): bool
    {
        return $user->can('dental-management.visits.bulk-delete');
    }
}
