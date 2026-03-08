<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\Policies;

use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

final class ShareholderTransactionPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('dental-management.shareholder-transactions.view');
    }

    public function view(User $user): bool
    {
        return $user->can('dental-management.shareholder-transactions.view');
    }

    public function create(User $user): bool
    {
        return $user->can('dental-management.shareholder-transactions.create');
    }

    public function update(User $user): bool
    {
        return $user->can('dental-management.shareholder-transactions.update');
    }

    public function delete(User $user): bool
    {
        return $user->can('dental-management.shareholder-transactions.delete');
    }

    public function restore(User $user): bool
    {
        return $user->can('dental-management.shareholder-transactions.restore');
    }

    public function forceDelete(User $user): bool
    {
        return $user->can('dental-management.shareholder-transactions.force-delete');
    }

    public function bulkDelete(User $user): bool
    {
        return $user->can('dental-management.shareholder-transactions.bulk-delete');
    }
}
