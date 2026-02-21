<?php

declare(strict_types=1);

namespace App\Modules\Settings\Infrastructure\Providers;

use App\Modules\Settings\Domain\Repositories\ModuleRepositoryInterface;
use App\Modules\Settings\Infrastructure\Repositories\EloquentModuleRepository;
use Illuminate\Support\ServiceProvider;

final class SettingsServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->registerBindings();
    }

    public function boot(): void
    {
        $this->loadRoutesFrom(path: modulePath(module: 'Settings', path: 'Routes/api.php'));
    }

    protected function registerBindings(): void
    {
        $this->app->bind(abstract: ModuleRepositoryInterface::class, concrete: EloquentModuleRepository::class);
    }
}
