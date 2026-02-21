<?php

declare(strict_types=1);

return [
    App\Modules\UserManagement\Infrastructure\Providers\UserManagementServiceProvider::class,
    App\Providers\AppServiceProvider::class,
    App\Providers\FortifyServiceProvider::class,
    App\Providers\ModuleTranslationServiceProvider::class,
    App\Modules\Common\Infrastructure\Providers\CommonServiceProvider::class,
    App\Modules\Settings\Infrastructure\Providers\SettingsServiceProvider::class,
];
