<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\Policies;

use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

final class PatientPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('dental-management.patients.view');
    }

    public function view(User $user): bool
    {
        return $user->can('dental-management.patients.view');
    }

    public function create(User $user): bool
    {
        return $user->can('dental-management.patients.create');
    }

    public function update(User $user): bool
    {
        return $user->can('dental-management.patients.update');
    }

    public function delete(User $user): bool
    {
        return $user->can('dental-management.patients.delete');
    }

    public function restore(User $user): bool
    {
        return $user->can('dental-management.patients.restore');
    }

    public function forceDelete(User $user): bool
    {
        return $user->can('dental-management.patients.force-delete');
    }

    public function bulkDelete(User $user): bool
    {
        return $user->can('dental-management.patients.bulk-delete');
    }
}
