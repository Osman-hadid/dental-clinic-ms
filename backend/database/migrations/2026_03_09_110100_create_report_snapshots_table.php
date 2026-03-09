<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('report_snapshots', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('report_key', 100);
            $table->string('reason', 30)->default('manual');
            $table->json('filters');
            $table->json('payload');
            $table->timestamp('captured_at');
            $table->timestamps();

            $table->index(['user_id', 'report_key', 'captured_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('report_snapshots');
    }
};
