<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => 'admin@system.af'],
            [
                'first_name' => 'System',
                'last_name' => 'Administrator',
                'job_title' => 'Administrator',
                'email_verified_at' => now(),
                'password' => Hash::make('Admin123!'),
                'enabled' => true,
                'status' => 'approved',
                'rights' => 'review',
            ]
        )->assignRole('admin');
    }
}
