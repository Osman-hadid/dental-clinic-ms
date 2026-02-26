<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('financial_settings', function (Blueprint $table): void {
            $table->id();
            $table->string('setting_key', 100)->unique();
            $table->string('setting_value', 255);
            $table->timestamps();
        });

        DB::table('financial_settings')->insert([
            'setting_key' => 'afn_per_usd',
            'setting_value' => '70',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('financial_settings');
    }
};
