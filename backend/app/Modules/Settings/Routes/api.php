<?php

declare(strict_types=1);

use App\Modules\Settings\Infrastructure\Http\Controllers\ModuleController;
use Illuminate\Support\Facades\Route;

Route::middleware(['api', 'auth:sanctum', 'set_locale'])->prefix('api/v1/settings')->group(function (): void {
    Route::apiResource('modules', ModuleController::class)->only(['index', 'show']);
});
