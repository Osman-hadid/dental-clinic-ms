<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Application\Policies;

use App\Models\User;
use App\Modules\DentalManagement\Domain\Services\WorkflowAccessService;
use Illuminate\Auth\Access\HandlesAuthorization;

final class DentalBackupPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return $user->can('dental-management.backups.view')
            && app(WorkflowAccessService::class)->canViewBackups($user);
    }

    public function view(User $user): bool
    {
        return $user->can('dental-management.backups.view')
            && app(WorkflowAccessService::class)->canViewBackups($user);
    }

    public function create(User $user): bool
    {
        return $user->can('dental-management.backups.create')
            && app(WorkflowAccessService::class)->canRunBackups($user);
    }

    public function update(User $user): bool
    {
        return $user->can('dental-management.backups.update')
            && app(WorkflowAccessService::class)->canManageBackupSettings($user);
    }

    public function delete(User $user): bool
    {
        return $user->can('dental-management.backups.delete')
            && app(WorkflowAccessService::class)->canManageBackupSettings($user);
    }

    public function restore(User $user): bool
    {
        return $user->can('dental-management.backups.restore')
            && app(WorkflowAccessService::class)->canManageBackupSettings($user);
    }

    public function forceDelete(User $user): bool
    {
        return $user->can('dental-management.backups.force-delete')
            && app(WorkflowAccessService::class)->canManageBackupSettings($user);
    }

    public function bulkDelete(User $user): bool
    {
        return $user->can('dental-management.backups.bulk-delete')
            && app(WorkflowAccessService::class)->canManageBackupSettings($user);
    }
}
