<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('financial_day_closes', function (Blueprint $table): void {
            $table->json('summary_currency_sections')->nullable()->after('overdue_debt_count');
            $table->json('counted_currency_sections')->nullable()->after('summary_currency_sections');
        });
    }

    public function down(): void
    {
        Schema::table('financial_day_closes', function (Blueprint $table): void {
            $table->dropColumn(['summary_currency_sections', 'counted_currency_sections']);
        });
    }
};
