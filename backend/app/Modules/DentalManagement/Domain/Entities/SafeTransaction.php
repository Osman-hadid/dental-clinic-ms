<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Entities;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;
use App\Modules\Common\Domain\Entities\Concerns\HasUserStamps;

final class SafeTransaction extends Model
{
    use HasUserStamps;
    use LogsActivity;
    use SoftDeletes;

    protected $fillable = [
        'transaction_date',
        'entry_type',
        'direction',
        'amount',
        'amount_input',
        'currency',
        'exchange_rate',
        'source_id',
        'source_type',
        'picked_by_staff_id',
        'notes',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'amount_input' => 'decimal:2',
            'exchange_rate' => 'decimal:6',
            'transaction_date' => 'date:Y-m-d',
            'source_id' => 'integer',
            'picked_by_staff_id' => 'integer',
            'created_by' => 'integer',
            'updated_by' => 'integer',
            'deleted_by' => 'integer',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly([])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs()
            ->useLogName(class_basename($this))
            ->setDescriptionForEvent(fn (string $eventName): string => "SafeTransaction {$eventName}");
    }

    public function pickedByStaff(): BelongsTo
    {
        return $this->belongsTo(Staff::class, 'picked_by_staff_id');
    }

    /**
     * @return array<string, array{balance: float, totalIn: float, totalOut: float}>
     */
    public static function balanceSnapshot(?int $excludingId = null): array
    {
        $query = self::query()->select([
            'id',
            'direction',
            'amount',
            'amount_input',
            'currency',
            'exchange_rate',
        ]);

        if ($excludingId !== null) {
            $query->where('id', '!=', $excludingId);
        }

        $snapshot = [
            'AFN' => ['balance' => 0.0, 'totalIn' => 0.0, 'totalOut' => 0.0],
            'USD' => ['balance' => 0.0, 'totalIn' => 0.0, 'totalOut' => 0.0],
        ];

        foreach ($query->get() as $transaction) {
            $currency = self::normalizeCurrencyCode((string) ($transaction->currency ?? 'AFN'));
            $amountInput = self::resolveAmountInput($transaction);
            $direction = (string) ($transaction->direction ?? 'in');

            if ($direction === 'out') {
                $snapshot[$currency]['balance'] -= $amountInput;
                $snapshot[$currency]['totalOut'] += $amountInput;
                continue;
            }

            $snapshot[$currency]['balance'] += $amountInput;
            $snapshot[$currency]['totalIn'] += $amountInput;
        }

        foreach (['AFN', 'USD'] as $currency) {
            $snapshot[$currency]['balance'] = round((float) $snapshot[$currency]['balance'], 2);
            $snapshot[$currency]['totalIn'] = round((float) $snapshot[$currency]['totalIn'], 2);
            $snapshot[$currency]['totalOut'] = round((float) $snapshot[$currency]['totalOut'], 2);
        }

        return $snapshot;
    }

    public static function currentBalance(?int $excludingId = null): float
    {
        $query = self::query();

        if ($excludingId !== null) {
            $query->where('id', '!=', $excludingId);
        }

        $sumIn = (float) (clone $query)->where('direction', 'in')->sum('amount');
        $sumOut = (float) (clone $query)->where('direction', 'out')->sum('amount');

        return round($sumIn - $sumOut, 2);
    }

    public static function currentBalanceForCurrency(string $currency, ?int $excludingId = null): float
    {
        $snapshot = self::balanceSnapshot($excludingId);
        $resolvedCurrency = self::normalizeCurrencyCode($currency);

        return (float) ($snapshot[$resolvedCurrency]['balance'] ?? 0.0);
    }

    private static function normalizeCurrencyCode(string $currency): string
    {
        return strtoupper(trim($currency)) === 'USD' ? 'USD' : 'AFN';
    }

    private static function resolveAmountInput(self $transaction): float
    {
        $storedAmountInput = $transaction->amount_input;
        if ($storedAmountInput !== null && $storedAmountInput !== '') {
            return round((float) $storedAmountInput, 2);
        }

        $amount = round((float) ($transaction->amount ?? 0), 2);
        $currency = self::normalizeCurrencyCode((string) ($transaction->currency ?? 'AFN'));
        $exchangeRate = round((float) ($transaction->exchange_rate ?? 1), 6);

        if ($currency === 'USD' && $exchangeRate > 0) {
            return round($amount / $exchangeRate, 2);
        }

        return $amount;
    }
}
