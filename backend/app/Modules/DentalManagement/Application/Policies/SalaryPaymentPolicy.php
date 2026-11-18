<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\Policies;

use App\Models\User;
use App\Modules\DentalManagement\Domain\Services\WorkflowAccessService;
use Illuminate\Auth\Access\HandlesAuthorization;

final class SalaryPaymentPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('dental-management.salary-payments.view');
    }

    public function view(User $user): bool
    {
        return $this->viewAny($user);
    }

    public function create(User $user): bool
    {
        return $user->can('dental-management.salary-payments.create')
            && app(WorkflowAccessService::class)->hasAtLeast($user, 'review');
    }

    public function update(User $user): bool
    {
        return $user->can('dental-management.salary-payments.update')
            && app(WorkflowAccessService::class)->hasAtLeast($user, 'review');
    }

    public function delete(User $user): bool
    {
        return $user->can('dental-management.salary-payments.delete')
            && app(WorkflowAccessService::class)->hasAtLeast($user, 'approval');
    }
}
