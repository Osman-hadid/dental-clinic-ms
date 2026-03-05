<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('prescriptions', function (Blueprint $table): void {
            $table->string('medicine_name', 160)->nullable();
            $table->string('dosage_unit', 32)->nullable();
            $table->string('dosage_amount', 64)->nullable();
            $table->string('frequency', 120)->nullable();
            $table->string('food_timing', 32)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('prescriptions', function (Blueprint $table): void {
            $table->dropColumn([
                'medicine_name',
                'dosage_unit',
                'dosage_amount',
                'frequency',
                'food_timing',
            ]);
        });
    }
};

