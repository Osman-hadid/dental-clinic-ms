<?php

declare(strict_types=1);

namespace App\Modules\UserManagement\Infrastructure\Providers;

use App\Models\User;
use App\Modules\UserManagement\Application\Policies\PermissionPolicy;
use App\Modules\UserManagement\Application\Policies\RolePolicy;
use App\Modules\UserManagement\Application\Policies\UserPolicy;
use App\Modules\UserManagement\Domain\Entities\Permission;
use App\Modules\UserManagement\Domain\Entities\Role;
use App\Modules\UserManagement\Domain\Repositories\PermissionRepositoryInterface;
use App\Modules\UserManagement\Domain\Repositories\RoleRepositoryInterface;
use App\Modules\UserManagement\Domain\Repositories\UserRepositoryInterface;
use App\Modules\UserManagement\Infrastructure\Repositories\EloquentPermissionRepository;
use App\Modules\UserManagement\Infrastructure\Repositories\EloquentRoleRepository;
use App\Modules\UserManagement\Infrastructure\Repositories\EloquentUserRepository;
use Illuminate\Foundation\Support\Providers\AuthServiceProvider as BaseAuthServiceProvider;

final class UserManagementServiceProvider extends BaseAuthServiceProvider
{
    protected $policies = [
        User::class => UserPolicy::class,
        Role::class => RolePolicy::class,
        Permission::class => PermissionPolicy::class,
    ];

    public function register(): void
    {
        $this->registerBindings();
    }

    public function boot(): void
    {
        $this->registerPolicies();

        $this->loadRoutesFrom(path: modulePath(module: 'UserManagement', path: 'Routes/api.php'));
    }

    protected function registerBindings(): void
    {
        $this->app->bind(abstract: UserRepositoryInterface::class, concrete: EloquentUserRepository::class);
        $this->app->bind(abstract: RoleRepositoryInterface::class, concrete: EloquentRoleRepository::class);
        $this->app->bind(abstract: PermissionRepositoryInterface::class, concrete: EloquentPermissionRepository::class);
    }
}
