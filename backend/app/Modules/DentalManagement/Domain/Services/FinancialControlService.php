<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Services;

use App\Models\User;
use App\Modules\DentalManagement\Domain\Entities\Debt;
use App\Modules\DentalManagement\Domain\Entities\FinancialDayClose;
use App\Modules\DentalManagement\Domain\Entities\Payment;
use App\Modules\DentalManagement\Domain\Entities\SafeTransaction;
use App\Modules\DentalManagement\Domain\Services\Concerns\InteractsWithReportData;
use Carbon\CarbonImmutable;

final class FinancialControlService
{
    use InteractsWithReportData;

    /**
     * @return array<string, mixed>
     */
    public function buildDashboard(CarbonImmutable $closingDate): array
    {
        $snapshot = $this->buildDailySnapshot($closingDate);

        return [
            'closeHistory' => $this->recentCloseHistory(),
            'closingDate' => $closingDate->toDateString(),
            'collectors' => $snapshot['collectors'],
            'currentClose' => $this->mapCloseRecord(
                FinancialDayClose::query()->with('closedBy')->where('closing_date', $closingDate->toDateString())->first()
            ),
            'debtWatchlist' => $snapshot['debtWatchlist'],
            'summary' => $snapshot['summary'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function buildRangeInsights(CarbonImmutable $startDate, CarbonImmutable $endDate): array
    {
        $closeRows = FinancialDayClose::query()
            ->with('closedBy')
            ->where('closing_date', '>=', $startDate->toDateString())
            ->where('closing_date', '<=', $endDate->toDateString())
            ->orderByDesc('closing_date')
            ->limit(20)
            ->get()
            ->map(fn (FinancialDayClose $close): array => $this->mapCloseRecord($close))
            ->values()
            ->all();

        $debtRows = $this->openDebtRows($endDate, 20);
        $debtMetrics = $this->debtMetrics($endDate);

        return [
            'summary' => [
                'closeCount' => count($closeRows),
                'discrepancyTotal' => $this->decimal(array_sum(array_map(
                    static fn (array $row): float => abs((float) ($row['discrepancyAmount'] ?? 0)),
                    $closeRows
                ))),
                'latestCloseDifference' => $this->decimal((float) ($closeRows[0]['discrepancyAmount'] ?? 0)),
                'openDebtCount' => (int) ($debtMetrics['openDebtCount'] ?? 0),
                'overdueDebtCount' => (int) ($debtMetrics['overdueDebtCount'] ?? 0),
            ],
            'tables' => [
                'collectorPerformance' => $this->collectorPerformance($startDate, $endDate, 12),
                'dailyCloseRows' => $closeRows,
                'debtWatchlist' => $debtRows,
            ],
        ];
    }

    /**
     * @param array<string, float> $countedBalances
     */
    public function closeDay(CarbonImmutable $closingDate, array $countedBalances, ?string $notes, ?int $closedBy): FinancialDayClose
    {
        $snapshot = $this->buildDailySnapshot($closingDate);
        $summary = (array) ($snapshot['summary'] ?? []);
        $summaryCurrencySections = $this->normalizeStoredCurrencySections(
            $summary['currencySections'] ?? null,
            ['cashPaymentTotal', 'expectedBalance', 'nonCashPaymentTotal', 'openDebtTotal', 'paymentTotal', 'safeInTotal', 'safeOutTotal']
        );
        $countedCurrencySections = $this->initializeCurrencySections(['countedBalance', 'discrepancyAmount']);

        foreach (['AFN', 'USD'] as $currency) {
            $countedBalance = $this->decimal($countedBalances[$currency] ?? 0);
            $expectedBalance = $this->decimal($summaryCurrencySections[$currency]['expectedBalance'] ?? 0);
            $countedCurrencySections[$currency]['countedBalance'] = $countedBalance;
            $countedCurrencySections[$currency]['discrepancyAmount'] = $this->decimal($countedBalance - $expectedBalance);
        }

        return FinancialDayClose::query()->updateOrCreate(
            ['closing_date' => $closingDate->toDateString()],
            [
                'cash_payment_total' => $this->decimal($summaryCurrencySections['AFN']['cashPaymentTotal'] ?? 0),
                'closed_at' => now(),
                'closed_by' => $closedBy,
                'counted_balance' => $this->decimal($countedCurrencySections['AFN']['countedBalance'] ?? 0),
                'counted_currency_sections' => $countedCurrencySections,
                'discrepancy_amount' => $this->decimal($countedCurrencySections['AFN']['discrepancyAmount'] ?? 0),
                'expected_balance' => $this->decimal($summaryCurrencySections['AFN']['expectedBalance'] ?? 0),
                'non_cash_payment_total' => $this->decimal($summaryCurrencySections['AFN']['nonCashPaymentTotal'] ?? 0),
                'notes' => $this->text($notes),
                'open_debt_count' => (int) ($summary['openDebtCount'] ?? 0),
                'open_debt_total' => $this->decimal($summaryCurrencySections['AFN']['openDebtTotal'] ?? 0),
                'overdue_debt_count' => (int) ($summary['overdueDebtCount'] ?? 0),
                'payment_total' => $this->decimal($summaryCurrencySections['AFN']['paymentTotal'] ?? 0),
                'safe_in_total' => $this->decimal($summaryCurrencySections['AFN']['safeInTotal'] ?? 0),
                'safe_out_total' => $this->decimal($summaryCurrencySections['AFN']['safeOutTotal'] ?? 0),
                'summary_currency_sections' => $summaryCurrencySections,
            ]
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function buildDailySnapshot(CarbonImmutable $closingDate): array
    {
        $currencySections = $this->initializeCurrencySections([
            'cashPaymentTotal',
            'expectedBalance',
            'nonCashPaymentTotal',
            'openDebtTotal',
            'paymentTotal',
            'safeInTotal',
            'safeOutTotal',
        ]);

        $safeRows = SafeTransaction::query()
            ->whereDate('transaction_date', '<=', $closingDate->toDateString())
            ->get(['transaction_date', 'direction', 'amount', 'amount_input', 'currency', 'exchange_rate']);

        foreach ($safeRows as $row) {
            $currency = $this->currencyCode($row->currency);
            $amountInput = $this->resolveInputAmount($row->amount_input, $row->amount, $currency, $row->exchange_rate);
            $isOut = $this->text($row->direction, 'in') === 'out';
            $transactionDate = $this->dateString($row->transaction_date);

            if ($transactionDate === $closingDate->toDateString()) {
                if ($isOut) {
                    $this->addCurrencySectionValue($currencySections, $currency, 'safeOutTotal', $amountInput);
                } else {
                    $this->addCurrencySectionValue($currencySections, $currency, 'safeInTotal', $amountInput);
                }
            }

            $this->addCurrencySectionValue(
                $currencySections,
                $currency,
                'expectedBalance',
                $isOut ? -$amountInput : $amountInput
            );
        }

        $paymentRows = Payment::query()
            ->whereDate('payment_date', $closingDate->toDateString())
            ->get(['amount', 'amount_input', 'currency', 'exchange_rate', 'created_by', 'method', 'payment_date']);

        foreach ($paymentRows as $payment) {
            $currency = $this->currencyCode($payment->currency);
            $amountInput = $this->resolveInputAmount($payment->amount_input, $payment->amount, $currency, $payment->exchange_rate);
            $this->addCurrencySectionValue($currencySections, $currency, 'paymentTotal', $amountInput);
            if (mb_strtolower(trim((string) ($payment->method ?? ''))) === 'cash') {
                $this->addCurrencySectionValue($currencySections, $currency, 'cashPaymentTotal', $amountInput);
                continue;
            }

            $this->addCurrencySectionValue($currencySections, $currency, 'nonCashPaymentTotal', $amountInput);
        }

        $debtRows = $this->openDebtRows($closingDate, 12);
        $debtMetrics = $this->debtMetrics($closingDate);
        foreach (['AFN', 'USD'] as $currency) {
            $currencySections[$currency]['openDebtTotal'] = $this->decimal(
                $debtMetrics['currencySections'][$currency]['openDebtTotal'] ?? 0
            );
        }

        return [
            'collectors' => $this->collectorPerformance($closingDate->startOfDay(), $closingDate->endOfDay(), 8),
            'debtWatchlist' => $debtRows,
            'summary' => [
                'cashPaymentTotal' => $this->decimal($currencySections['AFN']['cashPaymentTotal'] ?? 0),
                'currencySections' => $currencySections,
                'expectedBalance' => $this->decimal($currencySections['AFN']['expectedBalance'] ?? 0),
                'nonCashPaymentTotal' => $this->decimal($currencySections['AFN']['nonCashPaymentTotal'] ?? 0),
                'openDebtCount' => (int) ($debtMetrics['openDebtCount'] ?? 0),
                'openDebtTotal' => $this->decimal($currencySections['AFN']['openDebtTotal'] ?? 0),
                'overdueDebtCount' => (int) ($debtMetrics['overdueDebtCount'] ?? 0),
                'paymentTotal' => $this->decimal($currencySections['AFN']['paymentTotal'] ?? 0),
                'safeInTotal' => $this->decimal($currencySections['AFN']['safeInTotal'] ?? 0),
                'safeOutTotal' => $this->decimal($currencySections['AFN']['safeOutTotal'] ?? 0),
            ],
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function collectorPerformance(CarbonImmutable $startDate, CarbonImmutable $endDate, int $limit): array
    {
        $payments = Payment::query()
            ->where('payment_date', '>=', $startDate->toDateString())
            ->where('payment_date', '<=', $endDate->toDateString())
            ->get(['amount', 'amount_input', 'currency', 'exchange_rate', 'created_by', 'method', 'payment_date']);

        $userIds = $payments
            ->pluck('created_by')
            ->filter(static fn ($id): bool => (int) $id > 0)
            ->unique()
            ->values()
            ->all();

        $users = User::query()->whereIn('id', $userIds)->get()->keyBy('id');
        $rows = [];

        foreach ($payments as $payment) {
            $collectorId = (int) ($payment->created_by ?? 0);
            $key = $collectorId > 0 ? (string) $collectorId : 'system';
            $currency = $this->currencyCode($payment->currency);
            $amountInput = $this->resolveInputAmount($payment->amount_input, $payment->amount, $currency, $payment->exchange_rate);

            if (!isset($rows[$key])) {
                $user = $collectorId > 0 ? $users->get($collectorId) : null;
                $rows[$key] = [
                    'cashAmount' => 0.0,
                    'collector' => $this->personName($user, $collectorId > 0 ? $collectorId : null, $collectorId > 0 ? 'User' : 'System'),
                    'currencySections' => $this->initializeCurrencySections(['cashAmount', 'totalAmount']),
                    'paymentsCount' => 0,
                    'totalAmount' => 0.0,
                ];
            }

            $rows[$key]['paymentsCount'] += 1;
            $rows[$key]['currencySections'][$currency]['totalAmount'] = $this->decimal(
                ($rows[$key]['currencySections'][$currency]['totalAmount'] ?? 0) + $amountInput
            );
            $rows[$key]['totalAmount'] = $this->decimal($rows[$key]['currencySections']['AFN']['totalAmount'] ?? 0);
            if (mb_strtolower(trim((string) ($payment->method ?? ''))) === 'cash') {
                $rows[$key]['currencySections'][$currency]['cashAmount'] = $this->decimal(
                    ($rows[$key]['currencySections'][$currency]['cashAmount'] ?? 0) + $amountInput
                );
                $rows[$key]['cashAmount'] = $this->decimal($rows[$key]['currencySections']['AFN']['cashAmount'] ?? 0);
            }
        }

        $rows = array_values($rows);
        usort($rows, static function (array $left, array $right): int {
            $paymentSort = ((int) ($right['paymentsCount'] ?? 0)) <=> ((int) ($left['paymentsCount'] ?? 0));
            if ($paymentSort !== 0) {
                return $paymentSort;
            }

            return strcmp((string) ($left['collector'] ?? ''), (string) ($right['collector'] ?? ''));
        });

        return array_slice($rows, 0, $limit);
    }

    private function mapCloseRecord(?FinancialDayClose $close): ?array
    {
        if ($close === null) {
            return null;
        }

        $summaryCurrencySections = $this->normalizeStoredCurrencySections(
            $close->summary_currency_sections,
            ['cashPaymentTotal', 'expectedBalance', 'nonCashPaymentTotal', 'openDebtTotal', 'paymentTotal', 'safeInTotal', 'safeOutTotal']
        );
        $countedCurrencySections = $this->normalizeStoredCurrencySections(
            $close->counted_currency_sections,
            ['countedBalance', 'discrepancyAmount']
        );

        if ($summaryCurrencySections['AFN']['expectedBalance'] === 0.0 && $summaryCurrencySections['USD']['expectedBalance'] === 0.0) {
            $summaryCurrencySections['AFN'] = [
                'cashPaymentTotal' => $this->decimal($close->cash_payment_total ?? 0),
                'expectedBalance' => $this->decimal($close->expected_balance ?? 0),
                'nonCashPaymentTotal' => $this->decimal($close->non_cash_payment_total ?? 0),
                'openDebtTotal' => $this->decimal($close->open_debt_total ?? 0),
                'paymentTotal' => $this->decimal($close->payment_total ?? 0),
                'safeInTotal' => $this->decimal($close->safe_in_total ?? 0),
                'safeOutTotal' => $this->decimal($close->safe_out_total ?? 0),
            ];
        }

        if ($countedCurrencySections['AFN']['countedBalance'] === 0.0 && $countedCurrencySections['USD']['countedBalance'] === 0.0) {
            $countedCurrencySections['AFN'] = [
                'countedBalance' => $this->decimal($close->counted_balance ?? 0),
                'discrepancyAmount' => $this->decimal($close->discrepancy_amount ?? 0),
            ];
        }

        $currencySections = $this->initializeCurrencySections([
            'cashPaymentTotal',
            'countedBalance',
            'discrepancyAmount',
            'expectedBalance',
            'nonCashPaymentTotal',
            'openDebtTotal',
            'paymentTotal',
            'safeInTotal',
            'safeOutTotal',
        ]);
        foreach (['AFN', 'USD'] as $currency) {
            foreach (array_keys($currencySections[$currency]) as $key) {
                if (array_key_exists($key, $summaryCurrencySections[$currency])) {
                    $currencySections[$currency][$key] = $this->decimal($summaryCurrencySections[$currency][$key]);
                }
                if (array_key_exists($key, $countedCurrencySections[$currency])) {
                    $currencySections[$currency][$key] = $this->decimal($countedCurrencySections[$currency][$key]);
                }
            }
        }

        return [
            'closedAt' => $this->dateTimeString($close->closed_at),
            'closedBy' => $this->personName($close->closedBy, $close->closed_by, $close->closed_by ? 'User' : 'System'),
            'closingDate' => $this->dateString($close->closing_date),
            'countedBalance' => $this->decimal($close->counted_balance ?? 0),
            'currencySections' => $currencySections,
            'discrepancyAmount' => $this->decimal($close->discrepancy_amount ?? 0),
            'expectedBalance' => $this->decimal($close->expected_balance ?? 0),
            'notes' => $this->text($close->notes),
            'openDebtCount' => (int) ($close->open_debt_count ?? 0),
            'openDebtTotal' => $this->decimal($close->open_debt_total ?? 0),
            'overdueDebtCount' => (int) ($close->overdue_debt_count ?? 0),
            'paymentTotal' => $this->decimal($close->payment_total ?? 0),
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function openDebtRows(CarbonImmutable $referenceDate, int $limit): array
    {
        $rows = Debt::query()
            ->with([
                'invoice:id,currency,exchange_rate',
                'patient:id,patient_code,first_name,last_name',
            ])
            ->where('debt_amount', '>', 0)
            ->where('invoice_date', '<=', $referenceDate->toDateString())
            ->whereHas('invoice', function ($query): void {
                $query->whereIn('status', ['unpaid', 'partially_paid']);
            })
            ->get(['invoice_id', 'patient_id', 'debt_amount', 'invoice_date', 'currency', 'status'])
            ->map(function (Debt $debt) use ($referenceDate): array {
                $invoiceDate = $this->dateString($debt->invoice_date);
                $agingDays = (int) round($this->parseDate($invoiceDate)?->diffInDays($referenceDate) ?? 0);
                $currency = $this->currencyCode($debt->currency ?? $debt->invoice?->currency);
                $exchangeRate = $this->decimal($debt->invoice?->exchange_rate ?? 1) ?: 1.0;

                return [
                    'agingBucket' => $this->agingBucket($agingDays),
                    'agingDays' => $agingDays,
                    'debtAmount' => $this->decimal($debt->debt_amount ?? 0),
                    'debtAmountInput' => $this->convertBaseAmountToInputCurrency($debt->debt_amount ?? 0, $currency, $exchangeRate),
                    'currency' => $currency,
                    'exchangeRate' => $exchangeRate,
                    'invoiceDate' => $invoiceDate,
                    'invoiceId' => (string) ($debt->invoice_id ?? ''),
                    'patientId' => (string) ($debt->patient_id ?? ''),
                    'patientName' => $this->patientName($debt->patient, $debt->patient_id),
                    'status' => $this->text($debt->status, 'open'),
                ];
            })
            ->values()
            ->all();

        usort($rows, static function (array $left, array $right): int {
            $agingSort = ((int) ($right['agingDays'] ?? 0)) <=> ((int) ($left['agingDays'] ?? 0));
            if ($agingSort !== 0) {
                return $agingSort;
            }

            return ((float) ($right['debtAmount'] ?? 0)) <=> ((float) ($left['debtAmount'] ?? 0));
        });

        return array_slice($rows, 0, $limit);
    }

    /**
     * @return array<string, float|int>
     */
    private function debtMetrics(CarbonImmutable $referenceDate): array
    {
        $rows = Debt::query()
            ->with('invoice:id,currency,exchange_rate')
            ->where('debt_amount', '>', 0)
            ->where('invoice_date', '<=', $referenceDate->toDateString())
            ->whereHas('invoice', function ($query): void {
                $query->whereIn('status', ['unpaid', 'partially_paid']);
            })
            ->get(['invoice_id', 'debt_amount', 'invoice_date']);

        $openDebtTotal = 0.0;
        $overdueDebtCount = 0;
        $currencySections = $this->initializeCurrencySections(['openDebtTotal']);

        foreach ($rows as $row) {
            $openDebtTotal += (float) ($row->debt_amount ?? 0);
            $currency = $this->currencyCode($row->invoice?->currency);
            $exchangeRate = $this->decimal($row->invoice?->exchange_rate ?? 1) ?: 1.0;
            $debtInput = $this->convertBaseAmountToInputCurrency($row->debt_amount ?? 0, $currency, $exchangeRate);
            $this->addCurrencySectionValue($currencySections, $currency, 'openDebtTotal', $debtInput);
            $invoiceDate = $this->parseDate($this->dateString($row->invoice_date));
            $agingDays = (int) round($invoiceDate?->diffInDays($referenceDate) ?? 0);
            if ($agingDays > 30) {
                $overdueDebtCount += 1;
            }
        }

        return [
            'currencySections' => $currencySections,
            'openDebtCount' => $rows->count(),
            'openDebtTotal' => $this->decimal($openDebtTotal),
            'overdueDebtCount' => $overdueDebtCount,
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function recentCloseHistory(): array
    {
        return FinancialDayClose::query()
            ->with('closedBy')
            ->orderByDesc('closing_date')
            ->limit(14)
            ->get()
            ->map(fn (FinancialDayClose $close): array => $this->mapCloseRecord($close))
            ->values()
            ->all();
    }

    private function agingBucket(int $agingDays): string
    {
        if ($agingDays <= 30) {
            return '0-30 days';
        }
        if ($agingDays <= 60) {
            return '31-60 days';
        }
        if ($agingDays <= 90) {
            return '61-90 days';
        }

        return '90+ days';
    }

    /**
     * @param array<int, string> $keys
     * @return array{AFN: array<string, float>, USD: array<string, float>}
     */
    private function normalizeStoredCurrencySections(mixed $value, array $keys): array
    {
        $sections = $this->initializeCurrencySections($keys);
        if (!is_array($value)) {
            return $sections;
        }

        foreach (['AFN', 'USD'] as $currency) {
            foreach ($keys as $key) {
                $sections[$currency][$key] = $this->decimal($value[$currency][$key] ?? 0);
            }
        }

        return $sections;
    }
}
