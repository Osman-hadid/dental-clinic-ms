<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\Policies;

use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

final class AppointmentPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('dental-management.appointments.view');
    }

    public function view(User $user): bool
    {
        return $user->can('dental-management.appointments.view');
    }

    public function create(User $user): bool
    {
        return $user->can('dental-management.appointments.create');
    }

    public function update(User $user): bool
    {
        return $user->can('dental-management.appointments.update');
    }

    public function delete(User $user): bool
    {
        return $user->can('dental-management.appointments.delete');
    }

    public function restore(User $user): bool
    {
        return $user->can('dental-management.appointments.restore');
    }

    public function forceDelete(User $user): bool
    {
        return $user->can('dental-management.appointments.force-delete');
    }

    public function bulkDelete(User $user): bool
    {
        return $user->can('dental-management.appointments.bulk-delete');
    }
}
