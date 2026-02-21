<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class SuperAdminUserSeeder extends Seeder
{
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => 'superadmin@system.af'],
            [
                'first_name' => 'Super',
                'last_name' => 'Administrator',
                'job_title' => 'System Administrator',
                'email_verified_at' => now(),
                'password' => Hash::make('SuperAdmin123!'),
                'enabled' => true,
                'status' => 'approved',
                'rights' => 'approval',
            ]
        )->assignRole('super-admin');
    }
}
