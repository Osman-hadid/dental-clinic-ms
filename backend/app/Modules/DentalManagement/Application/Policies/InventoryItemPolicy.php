<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\Policies;

use App\Models\User;
use App\Modules\DentalManagement\Domain\Services\WorkflowAccessService;
use Illuminate\Auth\Access\HandlesAuthorization;

final class InventoryItemPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('dental-management.inventory-items.view');
    }

    public function view(User $user): bool
    {
        return $this->viewAny($user);
    }

    public function create(User $user): bool
    {
        return $user->can('dental-management.inventory-items.create')
            && app(WorkflowAccessService::class)->hasAtLeast($user, 'review');
    }

    public function update(User $user): bool
    {
        return $user->can('dental-management.inventory-items.update')
            && app(WorkflowAccessService::class)->hasAtLeast($user, 'review');
    }

    public function delete(User $user): bool
    {
        return $user->can('dental-management.inventory-items.delete')
            && app(WorkflowAccessService::class)->hasAtLeast($user, 'approval');
    }
}
