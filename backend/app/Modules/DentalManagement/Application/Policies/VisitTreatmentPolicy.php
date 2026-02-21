<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\Policies;

use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

final class VisitTreatmentPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('dental-management.visit-treatments.view');
    }

    public function view(User $user): bool
    {
        return $user->can('dental-management.visit-treatments.view');
    }

    public function create(User $user): bool
    {
        return $user->can('dental-management.visit-treatments.create');
    }

    public function update(User $user): bool
    {
        return $user->can('dental-management.visit-treatments.update');
    }

    public function delete(User $user): bool
    {
        return $user->can('dental-management.visit-treatments.delete');
    }

    public function restore(User $user): bool
    {
        return $user->can('dental-management.visit-treatments.restore');
    }

    public function forceDelete(User $user): bool
    {
        return $user->can('dental-management.visit-treatments.force-delete');
    }

    public function bulkDelete(User $user): bool
    {
        return $user->can('dental-management.visit-treatments.bulk-delete');
    }
}
