<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

final class DentalManagementAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_financial_and_inventory_endpoints_require_permissions(): void
    {
        $user = User::create([
            'email' => 'limited@example.test',
            'first_name' => 'Limited',
            'job_title' => 'Receptionist',
            'password' => Hash::make('password'),
            'rights' => 'approval',
            'enabled' => true,
            'status' => 'approved',
        ]);
        Sanctum::actingAs($user);

        $this->getJson('/api/v1/dental-management/expenses')->assertForbidden();
        $this->getJson('/api/v1/dental-management/salary-payments')->assertForbidden();
        $this->getJson('/api/v1/dental-management/inventory-items')->assertForbidden();
        $this->getJson('/api/v1/dental-management/clinic-profile')->assertForbidden();
    }
}
