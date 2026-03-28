<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\Policies;

use App\Models\User;
use App\Modules\DentalManagement\Domain\Services\WorkflowAccessService;
use Illuminate\Auth\Access\HandlesAuthorization;

final class PaymentPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('dental-management.payments.view');
    }

    public function view(User $user): bool
    {
        return $user->can('dental-management.payments.view');
    }

    public function create(User $user): bool
    {
        return $user->can('dental-management.payments.create');
    }

    public function update(User $user): bool
    {
        return $user->can('dental-management.payments.update')
            && app(WorkflowAccessService::class)->canUpdatePayments($user);
    }

    public function delete(User $user): bool
    {
        return $user->can('dental-management.payments.delete')
            && app(WorkflowAccessService::class)->canDeletePayments($user);
    }

    public function restore(User $user): bool
    {
        return $user->can('dental-management.payments.restore');
    }

    public function forceDelete(User $user): bool
    {
        return $user->can('dental-management.payments.force-delete')
            && app(WorkflowAccessService::class)->canDeletePayments($user);
    }

    public function bulkDelete(User $user): bool
    {
        return $user->can('dental-management.payments.bulk-delete')
            && app(WorkflowAccessService::class)->canDeletePayments($user);
    }
}
