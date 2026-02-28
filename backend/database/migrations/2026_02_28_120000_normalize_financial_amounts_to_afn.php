<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('invoices')->update([
            'total_amount' => DB::raw('COALESCE(total_amount_input, total_amount)'),
            'discount' => DB::raw('COALESCE(discount_input, discount)'),
            'net_amount' => DB::raw('COALESCE(net_amount_input, net_amount)'),
            'total_amount_input' => DB::raw('COALESCE(total_amount_input, total_amount)'),
            'discount_input' => DB::raw('COALESCE(discount_input, discount)'),
            'net_amount_input' => DB::raw('COALESCE(net_amount_input, net_amount)'),
            'currency' => 'AFN',
            'exchange_rate' => 1,
        ]);

        DB::table('payments')->update([
            'amount' => DB::raw('COALESCE(amount_input, amount)'),
            'amount_input' => DB::raw('COALESCE(amount_input, amount)'),
            'currency' => 'AFN',
            'exchange_rate' => 1,
        ]);

        DB::table('expenses')->update([
            'amount' => DB::raw('COALESCE(amount_input, amount)'),
            'unit_cost' => DB::raw('COALESCE(unit_cost_input, unit_cost)'),
            'amount_input' => DB::raw('COALESCE(amount_input, amount)'),
            'unit_cost_input' => DB::raw('COALESCE(unit_cost_input, unit_cost)'),
            'currency' => 'AFN',
            'exchange_rate' => 1,
        ]);

        DB::table('safe_transactions')->update([
            'amount' => DB::raw('COALESCE(amount_input, amount)'),
            'amount_input' => DB::raw('COALESCE(amount_input, amount)'),
            'currency' => 'AFN',
            'exchange_rate' => 1,
        ]);

        DB::table('salary_payments')->update([
            'gross_amount' => DB::raw('COALESCE(gross_amount_input, gross_amount)'),
            'bonus_amount' => DB::raw('COALESCE(bonus_amount_input, bonus_amount)'),
            'deduction_amount' => DB::raw('COALESCE(deduction_amount_input, deduction_amount)'),
            'net_amount' => DB::raw('COALESCE(net_amount_input, net_amount)'),
            'gross_amount_input' => DB::raw('COALESCE(gross_amount_input, gross_amount)'),
            'bonus_amount_input' => DB::raw('COALESCE(bonus_amount_input, bonus_amount)'),
            'deduction_amount_input' => DB::raw('COALESCE(deduction_amount_input, deduction_amount)'),
            'net_amount_input' => DB::raw('COALESCE(net_amount_input, net_amount)'),
            'currency' => 'AFN',
            'exchange_rate' => 1,
        ]);

        DB::table('financial_settings')->updateOrInsert(
            ['setting_key' => 'afn_per_usd'],
            ['setting_value' => '1']
        );
    }

    public function down(): void
    {
        // Intentionally irreversible data normalization.
    }
};

