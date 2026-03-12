<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Entities;

use App\Modules\Common\Domain\Entities\Concerns\HasUserStamps;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Modules\DentalManagement\Domain\Entities\PatientSessionTask;

final class ImplantCompany extends Model
{
    use HasUserStamps;

    protected $fillable = [
        'company_name',
        'implant_type',
        'record_date',
        'note',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'record_date' => 'date',
            'created_by' => 'integer',
            'updated_by' => 'integer',
        ];
    }

    public function sessionTasks(): HasMany
    {
        return $this->hasMany(PatientSessionTask::class);
    }
}
