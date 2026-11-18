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
        $email = (string) env('SOURIRE_SUPERADMIN_EMAIL', 'superadmin@system.af');
        $configuredPassword = trim((string) env('SOURIRE_SUPERADMIN_PASSWORD', ''));
        $user = User::firstOrNew(['email' => $email]);

        $user->fill([
            'first_name' => 'Super',
            'last_name' => 'Administrator',
            'job_title' => 'System Administrator',
            'email_verified_at' => now(),
            'enabled' => true,
            'status' => 'approved',
            'rights' => 'approval',
        ]);

        if (!$user->exists) {
            if ($configuredPassword === '') {
                throw new \RuntimeException('SOURIRE_SUPERADMIN_PASSWORD must be set before creating the super-admin user.');
            }

            $user->password = Hash::make($configuredPassword);
        } elseif ($configuredPassword !== '') {
            $user->password = Hash::make($configuredPassword);
        }

        $user->save();
        $user->assignRole('super-admin');
    }
}
