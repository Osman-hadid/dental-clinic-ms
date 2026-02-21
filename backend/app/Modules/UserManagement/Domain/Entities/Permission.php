<?php

declare(strict_types=1);

namespace App\Modules\UserManagement\Domain\Entities;

use App\Modules\Settings\Domain\Entities\Module;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Permission\Models\Permission as SpatiePermission;

final class Permission extends SpatiePermission
{
    protected $fillable = [
        'guard_name',
        'module_id',
        'display_name_en',
        'display_name_ps',
        'display_name_dr',
    ];

    protected function casts(): array
    {
        return [
            'module_id' => 'int',
        ];
    }

    public function module(): BelongsTo
    {
        return $this->belongsTo(Module::class);
    }
}
