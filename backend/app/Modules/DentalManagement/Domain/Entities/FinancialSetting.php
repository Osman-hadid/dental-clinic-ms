<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Entities;

use Illuminate\Database\Eloquent\Model;
use App\Modules\Common\Domain\Entities\Concerns\HasUserStamps;

final class FinancialSetting extends Model
{
    use HasUserStamps;
    protected $fillable = [
        'setting_key',
        'setting_value',
    ];
}