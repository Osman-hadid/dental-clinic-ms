<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\Policies;

use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

final class DebtPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('dental-management.debts.view');
    }

    public function view(User $user): bool
    {
        return $user->can('dental-management.debts.view');
    }

    public function create(User $user): bool
    {
        return $user->can('dental-management.debts.create');
    }

    public function update(User $user): bool
    {
        return $user->can('dental-management.debts.update');
    }

    public function delete(User $user): bool
    {
        return $user->can('dental-management.debts.delete');
    }

    public function restore(User $user): bool
    {
        return $user->can('dental-management.debts.restore');
    }

    public function forceDelete(User $user): bool
    {
        return $user->can('dental-management.debts.force-delete');
    }

    public function bulkDelete(User $user): bool
    {
        return $user->can('dental-management.debts.bulk-delete');
    }
}
