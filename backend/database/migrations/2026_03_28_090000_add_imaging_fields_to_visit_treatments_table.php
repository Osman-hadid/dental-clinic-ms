<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('visit_treatments', function (Blueprint $table): void {
            $table->string('image_modality')->nullable()->after('material');
            $table->string('image_source')->nullable()->after('image_modality');
        });
    }

    public function down(): void
    {
        Schema::table('visit_treatments', function (Blueprint $table): void {
            $table->dropColumn(['image_modality', 'image_source']);
        });
    }
};
