<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Entities;

use Illuminate\Database\Eloquent\Model;

final class FinancialSetting extends Model
{
    protected $fillable = [
        'setting_key',
        'setting_value',
    ];
}
