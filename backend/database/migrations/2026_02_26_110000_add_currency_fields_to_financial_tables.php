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
        Schema::table('invoices', function (Blueprint $table): void {
            $table->string('currency', 3)->default('USD');
            $table->decimal('exchange_rate', 14, 6)->default(1);
            $table->decimal('total_amount_input', 14, 2)->nullable();
            $table->decimal('discount_input', 14, 2)->nullable();
            $table->decimal('net_amount_input', 14, 2)->nullable();
        });

        Schema::table('payments', function (Blueprint $table): void {
            $table->string('currency', 3)->default('USD');
            $table->decimal('exchange_rate', 14, 6)->default(1);
            $table->decimal('amount_input', 14, 2)->nullable();
        });

        Schema::table('expenses', function (Blueprint $table): void {
            $table->string('currency', 3)->default('USD');
            $table->decimal('exchange_rate', 14, 6)->default(1);
            $table->decimal('amount_input', 14, 2)->nullable();
            $table->decimal('unit_cost_input', 14, 2)->nullable();
        });

        Schema::table('safe_transactions', function (Blueprint $table): void {
            $table->string('currency', 3)->default('USD');
            $table->decimal('exchange_rate', 14, 6)->default(1);
            $table->decimal('amount_input', 14, 2)->nullable();
        });

        Schema::table('salary_payments', function (Blueprint $table): void {
            $table->string('currency', 3)->default('USD');
            $table->decimal('exchange_rate', 14, 6)->default(1);
            $table->decimal('gross_amount_input', 14, 2)->nullable();
            $table->decimal('bonus_amount_input', 14, 2)->nullable();
            $table->decimal('deduction_amount_input', 14, 2)->nullable();
            $table->decimal('net_amount_input', 14, 2)->nullable();
        });

        DB::table('invoices')->update([
            'currency' => 'USD',
            'discount_input' => DB::raw('discount'),
            'exchange_rate' => 1,
            'net_amount_input' => DB::raw('net_amount'),
            'total_amount_input' => DB::raw('total_amount'),
        ]);

        DB::table('payments')->update([
            'amount_input' => DB::raw('amount'),
            'currency' => 'USD',
            'exchange_rate' => 1,
        ]);

        DB::table('expenses')->update([
            'amount_input' => DB::raw('amount'),
            'currency' => 'USD',
            'exchange_rate' => 1,
            'unit_cost_input' => DB::raw('unit_cost'),
        ]);

        DB::table('safe_transactions')->update([
            'amount_input' => DB::raw('amount'),
            'currency' => 'USD',
            'exchange_rate' => 1,
        ]);

        DB::table('salary_payments')->update([
            'bonus_amount_input' => DB::raw('bonus_amount'),
            'currency' => 'USD',
            'deduction_amount_input' => DB::raw('deduction_amount'),
            'exchange_rate' => 1,
            'gross_amount_input' => DB::raw('gross_amount'),
            'net_amount_input' => DB::raw('net_amount'),
        ]);
    }

    public function down(): void
    {
        Schema::table('salary_payments', function (Blueprint $table): void {
            $table->dropColumn([
                'currency',
                'exchange_rate',
                'gross_amount_input',
                'bonus_amount_input',
                'deduction_amount_input',
                'net_amount_input',
            ]);
        });

        Schema::table('safe_transactions', function (Blueprint $table): void {
            $table->dropColumn(['currency', 'exchange_rate', 'amount_input']);
        });

        Schema::table('expenses', function (Blueprint $table): void {
            $table->dropColumn(['currency', 'exchange_rate', 'amount_input', 'unit_cost_input']);
        });

        Schema::table('payments', function (Blueprint $table): void {
            $table->dropColumn(['currency', 'exchange_rate', 'amount_input']);
        });

        Schema::table('invoices', function (Blueprint $table): void {
            $table->dropColumn([
                'currency',
                'exchange_rate',
                'total_amount_input',
                'discount_input',
                'net_amount_input',
            ]);
        });
    }
};
