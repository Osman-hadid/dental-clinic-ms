<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('appointments', function (Blueprint $table): void {
            $table->string('tag', 100)->nullable()->after('dentist_id');
            $table->index('tag', 'appointments_tag_idx');
        });

        Schema::table('visits', function (Blueprint $table): void {
            $table->string('tag', 100)->nullable()->after('dentist_id');
            $table->index('tag', 'visits_tag_idx');
        });
    }

    public function down(): void
    {
        Schema::table('visits', function (Blueprint $table): void {
            $table->dropIndex('visits_tag_idx');
            $table->dropColumn('tag');
        });

        Schema::table('appointments', function (Blueprint $table): void {
            $table->dropIndex('appointments_tag_idx');
            $table->dropColumn('tag');
        });
    }
};

