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

    public function closeDay(CarbonImmutable $closingDate, float $countedBalance, ?string $notes, ?int $closedBy): FinancialDayClose
    {
        $snapshot = $this->buildDailySnapshot($closingDate);
        $summary = (array) ($snapshot['summary'] ?? []);
        $expectedBalance = $this->decimal($summary['expectedBalance'] ?? 0);
        $countedBalance = $this->decimal($countedBalance);

        return FinancialDayClose::query()->updateOrCreate(
            ['closing_date' => $closingDate->toDateString()],
            [
                'cash_payment_total' => $this->decimal($summary['cashPaymentTotal'] ?? 0),
                'closed_at' => now(),
                'closed_by' => $closedBy,
                'counted_balance' => $countedBalance,
                'discrepancy_amount' => $this->decimal($countedBalance - $expectedBalance),
                'expected_balance' => $expectedBalance,
                'non_cash_payment_total' => $this->decimal($summary['nonCashPaymentTotal'] ?? 0),
                'notes' => $this->text($notes),
                'open_debt_count' => (int) ($summary['openDebtCount'] ?? 0),
                'open_debt_total' => $this->decimal($summary['openDebtTotal'] ?? 0),
                'overdue_debt_count' => (int) ($summary['overdueDebtCount'] ?? 0),
                'payment_total' => $this->decimal($summary['paymentTotal'] ?? 0),
                'safe_in_total' => $this->decimal($summary['safeInTotal'] ?? 0),
                'safe_out_total' => $this->decimal($summary['safeOutTotal'] ?? 0),
            ]
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function buildDailySnapshot(CarbonImmutable $closingDate): array
    {
        $safeInTotal = (float) SafeTransaction::query()
            ->whereDate('transaction_date', $closingDate->toDateString())
            ->where('direction', 'in')
            ->sum('amount_input');

        $safeOutTotal = (float) SafeTransaction::query()
            ->whereDate('transaction_date', $closingDate->toDateString())
            ->where('direction', 'out')
            ->sum('amount_input');

        $balanceIn = (float) SafeTransaction::query()
            ->whereDate('transaction_date', '<=', $closingDate->toDateString())
            ->where('direction', 'in')
            ->sum('amount_input');

        $balanceOut = (float) SafeTransaction::query()
            ->whereDate('transaction_date', '<=', $closingDate->toDateString())
            ->where('direction', 'out')
            ->sum('amount_input');

        $paymentRows = Payment::query()
            ->whereDate('payment_date', $closingDate->toDateString())
            ->get(['amount', 'amount_input', 'created_by', 'method', 'payment_date']);

        $paymentTotal = 0.0;
        $cashPaymentTotal = 0.0;
        foreach ($paymentRows as $payment) {
            $amount = (float) ($payment->amount_input ?? $payment->amount ?? 0);
            $paymentTotal += $amount;
            if (mb_strtolower(trim((string) ($payment->method ?? ''))) === 'cash') {
                $cashPaymentTotal += $amount;
            }
        }

        $debtRows = $this->openDebtRows($closingDate, 12);
        $debtMetrics = $this->debtMetrics($closingDate);

        return [
            'collectors' => $this->collectorPerformance($closingDate->startOfDay(), $closingDate->endOfDay(), 8),
            'debtWatchlist' => $debtRows,
            'summary' => [
                'cashPaymentTotal' => $this->decimal($cashPaymentTotal),
                'expectedBalance' => $this->decimal($balanceIn - $balanceOut),
                'nonCashPaymentTotal' => $this->decimal($paymentTotal - $cashPaymentTotal),
                'openDebtCount' => (int) ($debtMetrics['openDebtCount'] ?? 0),
                'openDebtTotal' => $this->decimal($debtMetrics['openDebtTotal'] ?? 0),
                'overdueDebtCount' => (int) ($debtMetrics['overdueDebtCount'] ?? 0),
                'paymentTotal' => $this->decimal($paymentTotal),
                'safeInTotal' => $this->decimal($safeInTotal),
                'safeOutTotal' => $this->decimal($safeOutTotal),
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
            ->get(['amount', 'amount_input', 'created_by', 'method', 'payment_date']);

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
            $amount = (float) ($payment->amount_input ?? $payment->amount ?? 0);

            if (!isset($rows[$key])) {
                $user = $collectorId > 0 ? $users->get($collectorId) : null;
                $rows[$key] = [
                    'cashAmount' => 0.0,
                    'collector' => $this->personName($user, $collectorId > 0 ? $collectorId : null, $collectorId > 0 ? 'User' : 'System'),
                    'paymentsCount' => 0,
                    'totalAmount' => 0.0,
                ];
            }

            $rows[$key]['paymentsCount'] += 1;
            $rows[$key]['totalAmount'] = $this->decimal($rows[$key]['totalAmount'] + $amount);
            if (mb_strtolower(trim((string) ($payment->method ?? ''))) === 'cash') {
                $rows[$key]['cashAmount'] = $this->decimal($rows[$key]['cashAmount'] + $amount);
            }
        }

        return array_slice($this->sortRows(array_values($rows), 'totalAmount'), 0, $limit);
    }

    private function mapCloseRecord(?FinancialDayClose $close): ?array
    {
        if ($close === null) {
            return null;
        }

        return [
            'closedAt' => $this->dateTimeString($close->closed_at),
            'closedBy' => $this->personName($close->closedBy, $close->closed_by, $close->closed_by ? 'User' : 'System'),
            'closingDate' => $this->dateString($close->closing_date),
            'countedBalance' => $this->decimal($close->counted_balance ?? 0),
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
            ->with('patient:id,patient_code,first_name,last_name')
            ->where('debt_amount', '>', 0)
            ->where('invoice_date', '<=', $referenceDate->toDateString())
            ->whereHas('invoice', function ($query): void {
                $query->whereIn('status', ['unpaid', 'partially_paid']);
            })
            ->get()
            ->map(function (Debt $debt) use ($referenceDate): array {
                $invoiceDate = $this->dateString($debt->invoice_date);
                $agingDays = (int) round($this->parseDate($invoiceDate)?->diffInDays($referenceDate) ?? 0);

                return [
                    'agingBucket' => $this->agingBucket($agingDays),
                    'agingDays' => $agingDays,
                    'debtAmount' => $this->decimal($debt->debt_amount ?? 0),
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
            ->where('debt_amount', '>', 0)
            ->where('invoice_date', '<=', $referenceDate->toDateString())
            ->whereHas('invoice', function ($query): void {
                $query->whereIn('status', ['unpaid', 'partially_paid']);
            })
            ->get(['debt_amount', 'invoice_date']);

        $openDebtTotal = 0.0;
        $overdueDebtCount = 0;

        foreach ($rows as $row) {
            $openDebtTotal += (float) ($row->debt_amount ?? 0);
            $invoiceDate = $this->parseDate($this->dateString($row->invoice_date));
            $agingDays = (int) round($invoiceDate?->diffInDays($referenceDate) ?? 0);
            if ($agingDays > 30) {
                $overdueDebtCount += 1;
            }
        }

        return [
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
}
