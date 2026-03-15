<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Entities;

use Illuminate\Database\Eloquent\Model;

final class ClinicProfile extends Model
{
    protected $fillable = [
        'name',
        'owner_name',
        'logo_path',
        'address',
        'contact_number',
        'email',
        'website',
        'license_number',
        'notes',
    ];
}
