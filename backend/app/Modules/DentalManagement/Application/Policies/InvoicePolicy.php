<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\Policies;

use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

final class InvoicePolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('dental-management.invoices.view');
    }

    public function view(User $user): bool
    {
        return $user->can('dental-management.invoices.view');
    }

    public function create(User $user): bool
    {
        return $user->can('dental-management.invoices.create');
    }

    public function update(User $user): bool
    {
        return $user->can('dental-management.invoices.update');
    }

    public function delete(User $user): bool
    {
        return $user->can('dental-management.invoices.delete');
    }

    public function restore(User $user): bool
    {
        return $user->can('dental-management.invoices.restore');
    }

    public function forceDelete(User $user): bool
    {
        return $user->can('dental-management.invoices.force-delete');
    }

    public function bulkDelete(User $user): bool
    {
        return $user->can('dental-management.invoices.bulk-delete');
    }
}
