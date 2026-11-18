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
        $email = (string) env('SOURIRE_ADMIN_EMAIL', 'admin@system.af');
        $configuredPassword = trim((string) env('SOURIRE_ADMIN_PASSWORD', ''));
        $user = User::firstOrNew(['email' => $email]);

        $user->fill([
            'first_name' => 'System',
            'last_name' => 'Administrator',
            'job_title' => 'Administrator',
            'email_verified_at' => now(),
            'enabled' => true,
            'status' => 'approved',
            'rights' => 'review',
        ]);

        if (!$user->exists) {
            if ($configuredPassword === '') {
                throw new \RuntimeException('SOURIRE_ADMIN_PASSWORD must be set before creating the admin user.');
            }

            $user->password = Hash::make($configuredPassword);
        } elseif ($configuredPassword !== '') {
            $user->password = Hash::make($configuredPassword);
        }

        $user->save();
        $user->assignRole('admin');
    }
}
