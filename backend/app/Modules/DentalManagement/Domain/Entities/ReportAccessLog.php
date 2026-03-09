<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Entities;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class ReportAccessLog extends Model
{
    protected $fillable = [
        'user_id',
        'report_key',
        'action',
        'filters',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'filters' => 'array',
            'meta' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
