<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Controllers;

use App\Modules\Common\Infrastructure\Http\Controllers\BaseApiController;
use App\Modules\DentalManagement\Domain\Entities\Appointment;
use App\Modules\DentalManagement\Domain\Entities\Debt;
use App\Modules\DentalManagement\Domain\Entities\Invoice;
use App\Modules\DentalManagement\Domain\Entities\Payment;
use App\Modules\DentalManagement\Domain\Entities\PatientSessionTask;
use App\Modules\DentalManagement\Domain\Entities\SafeTransaction;
use App\Modules\DentalManagement\Domain\Entities\Visit;
use App\Modules\DentalManagement\Domain\Services\CurrencyService;
use App\Modules\DentalManagement\Domain\Services\OperationsHealthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class DashboardSummaryController extends BaseApiController
{
    public function __construct(
        private readonly CurrencyService $currencyService,
        private readonly OperationsHealthService $operationsHealthService,
    ) {}

    public function overview(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user?->can('dental-management.view'), 403);

        $validated = $request->validate([
            'scheduleStart' => 'nullable|date',
            'scheduleEnd' => 'nullable|date|after_or_equal:scheduleStart',
            'revenueRange' => 'nullable|in:7d,30d,90d',
        ]);

        $revenueRange = (string) ($validated['revenueRange'] ?? '90d');
        $days = $revenueRange === '7d' ? 7 : ($revenueRange === '30d' ? 30 : 90);

        $today = Carbon::today();
        $scheduleStart = isset($validated['scheduleStart'])
            ? Carbon::parse((string) $validated['scheduleStart'])->startOfDay()
            : $today->copy()->startOfMonth();
        $scheduleEnd = isset($validated['scheduleEnd'])
            ? Carbon::parse((string) $validated['scheduleEnd'])->endOfDay()
            : $today->copy()->endOfMonth()->addDays(31)->endOfDay();

        $patientTotal = DB::table('patients')->whereNull('deleted_at')->count();
        $newPatients = DB::table('patients')
            ->whereNull('deleted_at')
            ->where('created_at', '>=', $today->copy()->subDays(30)->startOfDay())
            ->count();

        $returningPatients = max(0, (int) $patientTotal - (int) $newPatients);

        $todayVisits = (int) Visit::query()
            ->whereDate('visit_date', $today->toDateString())
            ->count();

        $todayAppointments = (int) Appointment::query()
            ->whereDate('appointment_date', $today->toDateString())
            ->count();

        $appointments = Appointment::query()
            ->with([
                'patient:id,first_name,last_name,patient_code',
                'dentist:id,full_name',
                'visits:id,appointment_id',
            ])
            ->whereBetween('appointment_date', [$scheduleStart->toDateString(), $scheduleEnd->toDateString()])
            ->orderBy('appointment_date')
            ->orderBy('start_time')
            ->get();

        $visits = Visit::query()
            ->with([
                'patient:id,first_name,last_name,patient_code',
                'dentist:id,full_name',
                'appointment:id,start_time',
            ])
            ->whereBetween('visit_date', [$scheduleStart->toDateString(), $scheduleEnd->toDateString()])
            ->orderBy('visit_date')
            ->get();

        $toDateKey = static fn (Carbon $date): string => $date->format('Y-m-d');
        $formatClock = static fn (?Carbon $dateTime): string => $dateTime ? $dateTime->format('g:i A') : '';

        $eventsByDate = [];

        foreach ($appointments as $appointment) {
            $date = $appointment->appointment_date instanceof Carbon
                ? $appointment->appointment_date
                : Carbon::parse((string) $appointment->appointment_date);

            $dateKey = $toDateKey($date);
            $time = (string) ($appointment->start_time ?? '');
            $dateTime = $time !== '' ? Carbon::parse($dateKey . ' ' . $time) : $date->copy();

            $patient = $appointment->patient;
            $patientName = $patient
                ? trim((string) ($patient->first_name ?? '') . ' ' . (string) ($patient->last_name ?? ''))
                : '';
            if ($patientName === '' && $patient) {
                $patientName = (string) ($patient->patient_code ?? '');
            }

            $dentistName = $appointment->dentist ? (string) ($appointment->dentist->full_name ?? '') : '';

            $linkedVisitId = null;
            $visitsRel = $appointment->visits;
            if ($visitsRel && $visitsRel->count() > 0) {
                $linkedVisitId = $visitsRel->first()?->id;
            }

            $eventsByDate[$dateKey][] = [
                'dateKey' => $dateKey,
                'dentistName' => $dentistName !== '' ? $dentistName : ('Dentist #' . ((string) ($appointment->dentist_id ?? '-'))),
                'key' => 'appointment-' . (string) $appointment->id,
                'linkedVisitId' => $linkedVisitId,
                'note' => (string) ($appointment->notes ?? ''),
                'patientId' => $appointment->patient_id,
                'patientName' => $patientName !== '' ? $patientName : ('Patient #' . ((string) ($appointment->patient_id ?? $appointment->id))),
                'status' => (string) ($appointment->status ?? 'scheduled'),
                'tag' => (string) ($appointment->tag ?? ('Appointment #' . (string) $appointment->id)),
                'timeLabel' => $formatClock($dateTime),
                'title' => 'Appointment',
                'type' => 'appointment',
                'timestamp' => $dateTime->getTimestamp(),
            ];
        }

        foreach ($visits as $visit) {
            $date = $visit->visit_date instanceof Carbon ? $visit->visit_date : Carbon::parse((string) $visit->visit_date);
            $dateKey = $toDateKey($date);
            $fallbackTime = $visit->appointment ? (string) ($visit->appointment->start_time ?? '') : '';
            $dateTime = $fallbackTime !== '' ? Carbon::parse($dateKey . ' ' . $fallbackTime) : $date->copy();

            $patient = $visit->patient;
            $patientName = $patient ? trim((string) ($patient->first_name ?? '') . ' ' . (string) ($patient->last_name ?? '')) : '';
            if ($patientName === '' && $patient) {
                $patientName = (string) ($patient->patient_code ?? '');
            }

            $dentistName = $visit->dentist ? (string) ($visit->dentist->full_name ?? '') : '';

            $eventsByDate[$dateKey][] = [
                'dateKey' => $dateKey,
                'dentistName' => $dentistName !== '' ? $dentistName : ('Dentist #' . ((string) ($visit->dentist_id ?? '-'))),
                'key' => 'visit-' . (string) $visit->id,
                'linkedVisitId' => $visit->id,
                'note' => (string) ($visit->diagnosis_notes ?? ''),
                'patientId' => $visit->patient_id,
                'patientName' => $patientName !== '' ? $patientName : ('Patient #' . ((string) ($visit->patient_id ?? $visit->id))),
                'status' => 'completed',
                'tag' => (string) ($visit->tag ?? ('Visit #' . (string) $visit->id)),
                'timeLabel' => $formatClock($dateTime),
                'title' => 'Visit',
                'type' => 'visit',
                'timestamp' => $dateTime->getTimestamp(),
            ];
        }

        foreach ($eventsByDate as $dateKey => $events) {
            usort($events, static fn (array $a, array $b): int => ($a['timestamp'] ?? 0) <=> ($b['timestamp'] ?? 0));
            $eventsByDate[$dateKey] = array_values($events);
        }

        $upcomingEvents = [];
        $startTs = $today->getTimestamp();
        foreach ($eventsByDate as $events) {
            foreach ($events as $event) {
                $ts = (int) ($event['timestamp'] ?? 0);
                if ($ts < $startTs) {
                    continue;
                }
                $status = strtolower(trim((string) ($event['status'] ?? '')));
                if (\in_array($status, ['completed', 'done'], true)) {
                    continue;
                }
                $upcomingEvents[] = $event;
            }
        }
        usort($upcomingEvents, static fn (array $a, array $b): int => ($a['timestamp'] ?? 0) <=> ($b['timestamp'] ?? 0));
        $upcomingEvents = array_slice($upcomingEvents, 0, 5);

        $appointmentMixWindowStart = $today->copy()->subDays($days)->startOfDay();

        $appointmentWindow = Appointment::query()
            ->whereBetween('appointment_date', [$appointmentMixWindowStart->toDateString(), $today->toDateString()])
            ->get(['id', 'status']);

        $completedCount = 0;
        $cancelledCount = 0;
        foreach ($appointmentWindow as $row) {
            $status = strtolower(trim((string) ($row->status ?? '')));
            if (\in_array($status, ['completed', 'done'], true)) {
                $completedCount += 1;
                continue;
            }
            if (\in_array($status, ['cancelled', 'canceled', 'rejected'], true)) {
                $cancelledCount += 1;
            }
        }
        $appointmentCount = $appointmentWindow->count();
        $scheduledCount = max(0, $appointmentCount - $completedCount - $cancelledCount);
        $completionRate = $appointmentCount > 0 ? (int) round(($completedCount / $appointmentCount) * 100) : 0;

        $invoiceRows = Invoice::query()
            ->whereBetween('invoice_date', [$appointmentMixWindowStart->toDateString(), $today->toDateString()])
            ->get(['invoice_date', 'net_amount']);

        $paymentRows = Payment::query()
            ->whereBetween('payment_date', [$appointmentMixWindowStart->toDateString(), $today->toDateString()])
            ->get(['payment_date', 'amount']);

        $revenueByDate = [];
        foreach ($invoiceRows as $invoice) {
            $date = $invoice->invoice_date instanceof Carbon ? $invoice->invoice_date : Carbon::parse((string) $invoice->invoice_date);
            $key = $toDateKey($date);
            $revenueByDate[$key] = $revenueByDate[$key] ?? ['date' => $key, 'billed' => 0.0, 'paid' => 0.0];
            $revenueByDate[$key]['billed'] = round(((float) $revenueByDate[$key]['billed']) + (float) ($invoice->net_amount ?? 0), 2);
        }
        foreach ($paymentRows as $payment) {
            $date = $payment->payment_date instanceof Carbon ? $payment->payment_date : Carbon::parse((string) $payment->payment_date);
            $key = $toDateKey($date);
            $revenueByDate[$key] = $revenueByDate[$key] ?? ['date' => $key, 'billed' => 0.0, 'paid' => 0.0];
            $revenueByDate[$key]['paid'] = round(((float) $revenueByDate[$key]['paid']) + (float) ($payment->amount ?? 0), 2);
        }
        ksort($revenueByDate);
        $revenueSeries = array_values($revenueByDate);

        $safeBalancePayload = $this->radialSafeSummary(request())->getData(true)['data'] ?? null;
        $safeCurrencySections = SafeTransaction::balanceSnapshot();
        $afnSafeSection = $safeCurrencySections['AFN'] ?? ['balance' => 0.0, 'totalIn' => 0.0, 'totalOut' => 0.0];

        $recentSafe = SafeTransaction::query()
            ->with('pickedByStaff:id,full_name')
            ->orderByDesc('transaction_date')
            ->orderByDesc('id')
            ->limit(6)
            ->get();

        $recentSafeTransactions = $recentSafe->map(static function ($entry): array {
            $pickedName = $entry->pickedByStaff ? (string) ($entry->pickedByStaff->full_name ?? '') : '';
            $currency = strtoupper(trim((string) ($entry->currency ?? 'AFN'))) === 'USD' ? 'USD' : 'AFN';
            $amountInput = $entry->amount_input;
            if (($amountInput === null || $amountInput === '') && $currency === 'USD') {
                $exchangeRate = (float) ($entry->exchange_rate ?? 1);
                $amountInput = $exchangeRate > 0 ? round((float) ($entry->amount ?? 0) / $exchangeRate, 2) : 0;
            }

            return [
                'id' => (string) $entry->id,
                'entryType' => (string) ($entry->entry_type ?? ''),
                'direction' => (string) ($entry->direction ?? ''),
                'amount' => round((float) ($amountInput ?? $entry->amount ?? 0), 2),
                'currency' => $currency,
                'transactionDate' => (string) ($entry->transaction_date ?? ''),
                'pickedByStaffId' => (string) ($entry->picked_by_staff_id ?? ''),
                'pickedByStaffName' => $pickedName,
                'notes' => (string) ($entry->notes ?? ''),
            ];
        })->values()->all();

        $topPickups = [];
        $pickupRows = SafeTransaction::query()
            ->with('pickedByStaff:id,full_name')
            ->where('direction', 'out')
            ->orderByDesc('transaction_date')
            ->get(['id', 'picked_by_staff_id', 'amount', 'amount_input', 'currency', 'exchange_rate']);

        foreach ($pickupRows as $row) {
            $currency = strtoupper(trim((string) ($row->currency ?? 'AFN'))) === 'USD' ? 'USD' : 'AFN';
            $amountInput = $row->amount_input;
            if (($amountInput === null || $amountInput === '') && $currency === 'USD') {
                $exchangeRate = (float) ($row->exchange_rate ?? 1);
                $amountInput = $exchangeRate > 0 ? round((float) ($row->amount ?? 0) / $exchangeRate, 2) : 0;
            }

            $name = $row->pickedByStaff
                ? (string) ($row->pickedByStaff->full_name ?? '')
                : '';
            if ($name === '') {
                $name = 'Staff #' . ((string) ($row->picked_by_staff_id ?? '-'));
            }

            $key = $currency . '|' . $name;
            $topPickups[$key] ??= [
                'amount' => 0.0,
                'currency' => $currency,
                'name' => $name,
            ];
            $topPickups[$key]['amount'] = round((float) $topPickups[$key]['amount'] + (float) ($amountInput ?? $row->amount ?? 0), 2);
        }

        $topPickups = array_values($topPickups);
        usort($topPickups, static fn (array $left, array $right): int => ((float) $right['amount']) <=> ((float) $left['amount']));
        $topPickups = array_slice($topPickups, 0, 4);

        $implantSummary = $this->buildImplantSupplierSummary();

        return $this->successResponse(
            data: [
                'schedule' => [
                    'start' => $scheduleStart->toDateString(),
                    'end' => $scheduleEnd->toDateString(),
                    'todayKey' => $today->toDateString(),
                    'eventsByDate' => $eventsByDate,
                    'upcomingEvents' => $upcomingEvents,
                    'todayVisits' => $todayVisits,
                    'todayAppointments' => $todayAppointments,
                ],
                'patients' => [
                    'total' => (int) $patientTotal,
                    'new30d' => (int) $newPatients,
                    'returning' => (int) $returningPatients,
                ],
                'performance' => [
                    'completionRate' => $completionRate,
                    'calendarCoverageDays' => \count(array_keys($eventsByDate)),
                ],
                'charts' => [
                    'revenueRange' => $revenueRange,
                    'revenueSeries' => $revenueSeries,
                    'appointmentMix' => [
                        'scheduled' => $scheduledCount,
                        'completed' => $completedCount,
                        'cancelled' => $cancelledCount,
                    ],
                ],
                'safe' => [
                    'balance' => round((float) ($afnSafeSection['balance'] ?? 0), 2),
                    'currencySections' => $safeCurrencySections,
                    'totalIn' => round((float) ($afnSafeSection['totalIn'] ?? 0), 2),
                    'totalOut' => round((float) ($afnSafeSection['totalOut'] ?? 0), 2),
                    'afnPerUsd' => $this->currencyService->getDefaultAfnPerUsd(),
                    'topPickups' => $topPickups,
                    'recentTransactions' => $recentSafeTransactions,
                ],
                'implantSupplier' => $implantSummary,
                'operations' => $this->operationsHealthService->dashboardSummary(),
                'radialSafeSummary' => $safeBalancePayload,
            ],
            message: 'Dashboard overview fetched successfully.'
        );
    }

    public function radialSafeSummary(): JsonResponse
    {
        $this->authorize('viewAny', Debt::class);

        $safeSections = SafeTransaction::balanceSnapshot();
        $safeBalance = round((float) (($safeSections['AFN']['balance'] ?? 0)), 2);

        $debtOutstanding = (float) Debt::query()
            ->where('status', 'open')
            ->sum('debt_amount');

        $tasks = PatientSessionTask::query()->get([
            'id',
            'patient_id',
            'status',
            'title',
            'notes',
            'created_at',
        ]);

        /** @var array<string, array{createdAt: string, patientId: string, supplierRemaining: float}> $byToothKey */
        $byToothKey = [];

        foreach ($tasks as $task) {
            $notes = (string) ($task->notes ?? '');
            $title = (string) ($task->title ?? '');

            $lowerNotes = strtolower($notes);

            if (!str_contains($lowerNotes, 'implant_tooth') && stripos($title, 'implant tooth') === false) {
                continue;
            }

            $toothNumber = null;

            if (preg_match('/\[implant_tooth:([0-9]{2})\]/i', $notes, $match) === 1 && isset($match[1])) {
                $toothNumber = $match[1];
            } elseif (preg_match('/([0-9]{2})/', $title, $match) === 1 && isset($match[1])) {
                $toothNumber = $match[1];
            }

            if ($toothNumber === null) {
                continue;
            }

            $supplierTotal = 0.0;
            if (preg_match('/\[supplier_total:([0-9]+(?:\.[0-9]+)?)\]/i', $notes, $match) === 1 && isset($match[1])) {
                $supplierTotal = max(0.0, (float) $match[1]);
            }

            $supplierPaid = 0.0;
            if (preg_match('/\[supplier_paid:([0-9]+(?:\.[0-9]+)?)\]/i', $notes, $match) === 1 && isset($match[1])) {
                $supplierPaid = max(0.0, (float) $match[1]);
                if ($supplierPaid > $supplierTotal) {
                    $supplierPaid = $supplierTotal;
                }
            }

            $supplierRemaining = max(0.0, $supplierTotal - $supplierPaid);

            $patientId = (string) ($task->patient_id ?? '');
            $dedupeKey = ($patientId !== '' ? $patientId : '-') . ':' . $toothNumber;

            $createdAt = $task->created_at?->format('c') ?? '';

            $row = [
                'createdAt' => $createdAt,
                'patientId' => $patientId,
                'supplierRemaining' => round($supplierRemaining, 2),
            ];

            $previous = $byToothKey[$dedupeKey] ?? null;

            if ($previous === null || $row['createdAt'] >= $previous['createdAt']) {
                $byToothKey[$dedupeKey] = $row;
            }
        }

        $supplierUnpaids = 0.0;

        foreach ($byToothKey as $row) {
            $supplierUnpaids += $row['supplierRemaining'];
        }

        $supplierUnpaids = round($supplierUnpaids, 2);

        $safeMoneyForRing = max(0.0, round($safeBalance, 2));
        $debtOutstanding = max(0.0, round($debtOutstanding, 2));
        $supplierUnpaids = max(0.0, $supplierUnpaids);

        $total = $safeMoneyForRing + $debtOutstanding + $supplierUnpaids;

        if ($total <= 0.0) {
            $ring = [
                'safePercent' => 0.0,
                'debtPercent' => 0.0,
                'unpaidPercent' => 0.0,
            ];
        } else {
            $safePercent = min(100.0, max(0.0, ($safeMoneyForRing / $total) * 100.0));
            $debtPercent = min(100.0 - $safePercent, max(0.0, ($debtOutstanding / $total) * 100.0));
            $unpaidPercent = max(0.0, 100.0 - $safePercent - $debtPercent);

            $ring = [
                'safePercent' => $safePercent,
                'debtPercent' => $debtPercent,
                'unpaidPercent' => $unpaidPercent,
            ];
        }

        $chartData = array_values(array_filter([
            $safeMoneyForRing > 0.0 ? ['category' => 'inSafe', 'value' => $safeMoneyForRing] : null,
            $debtOutstanding > 0.0 ? ['category' => 'debts', 'value' => $debtOutstanding] : null,
            $supplierUnpaids > 0.0 ? ['category' => 'unpaids', 'value' => $supplierUnpaids] : null,
        ]));

        return $this->successResponse(
            data: [
                'safeBalance' => $safeMoneyForRing,
                'debtOutstanding' => $debtOutstanding,
                'supplierUnpaids' => $supplierUnpaids,
                'ring' => $ring,
                'chartData' => $chartData,
            ],
            message: 'Dashboard radial summary fetched successfully.'
        );
    }

    private function buildImplantSupplierSummary(): array
    {
        $tasks = PatientSessionTask::query()->get([
            'id',
            'patient_id',
            'status',
            'title',
            'notes',
            'created_at',
        ]);

        $statusFallback = [
            'done' => 'done',
            'in_progress' => 'available',
            'pending' => 'not_available',
        ];

        $byToothKey = [];

        foreach ($tasks as $task) {
            $notes = (string) ($task->notes ?? '');
            $title = (string) ($task->title ?? '');
            $lowerNotes = strtolower($notes);
            if (!str_contains($lowerNotes, 'implant_tooth') && stripos($title, 'implant tooth') === false) {
                continue;
            }

            $toothNumber = null;
            if (preg_match('/\[implant_tooth:([0-9]{2})\]/i', $notes, $match) === 1 && isset($match[1])) {
                $toothNumber = $match[1];
            } elseif (preg_match('/([0-9]{2})/', $title, $match) === 1 && isset($match[1])) {
                $toothNumber = $match[1];
            }
            if ($toothNumber === null) {
                continue;
            }

            $availability = null;
            if (preg_match('/\[implant_availability:(not_available|in_purchase|available|done)\]/i', $notes, $match) === 1 && isset($match[1])) {
                $availability = strtolower((string) $match[1]);
            }
            if ($availability === null) {
                $normalized = strtolower(trim((string) ($task->status ?? '')));
                $availability = $statusFallback[$normalized] ?? 'not_available';
            }

            $supplierTotal = 0.0;
            if (preg_match('/\[supplier_total:([0-9]+(?:\.[0-9]+)?)\]/i', $notes, $match) === 1 && isset($match[1])) {
                $supplierTotal = max(0.0, (float) $match[1]);
            }
            $supplierPaid = 0.0;
            if (preg_match('/\[supplier_paid:([0-9]+(?:\.[0-9]+)?)\]/i', $notes, $match) === 1 && isset($match[1])) {
                $supplierPaid = max(0.0, (float) $match[1]);
                if ($supplierPaid > $supplierTotal) {
                    $supplierPaid = $supplierTotal;
                }
            }

            $supplierRemaining = max(0.0, $supplierTotal - $supplierPaid);
            $patientId = (string) ($task->patient_id ?? '');
            $dedupeKey = ($patientId !== '' ? $patientId : '-') . ':' . $toothNumber;
            $createdAt = $task->created_at?->format('c') ?? '';

            $row = [
                'status' => $availability,
                'count' => 1,
                'total' => round($supplierTotal, 2),
                'paid' => round($supplierPaid, 2),
                'unpaid' => round($supplierRemaining, 2),
                'createdAt' => $createdAt,
            ];

            $previous = $byToothKey[$dedupeKey] ?? null;
            if ($previous === null || $row['createdAt'] >= $previous['createdAt']) {
                $byToothKey[$dedupeKey] = $row;
            }
        }

        $buckets = [
            'not_available' => ['count' => 0, 'paid' => 0.0, 'total' => 0.0, 'unpaid' => 0.0],
            'in_purchase' => ['count' => 0, 'paid' => 0.0, 'total' => 0.0, 'unpaid' => 0.0],
            'available' => ['count' => 0, 'paid' => 0.0, 'total' => 0.0, 'unpaid' => 0.0],
            'done' => ['count' => 0, 'paid' => 0.0, 'total' => 0.0, 'unpaid' => 0.0],
        ];

        $rows = array_values($byToothKey);
        $implantCount = \count($rows);

        $totalSupplierCost = 0.0;
        $totalPaid = 0.0;
        $totalUnpaid = 0.0;
        $unpaidCount = 0;

        foreach ($rows as $row) {
            $status = (string) ($row['status'] ?? 'not_available');
            if (!isset($buckets[$status])) {
                $status = 'not_available';
            }

            $buckets[$status]['count'] += 1;
            $buckets[$status]['total'] = round($buckets[$status]['total'] + (float) ($row['total'] ?? 0), 2);
            $buckets[$status]['paid'] = round($buckets[$status]['paid'] + (float) ($row['paid'] ?? 0), 2);
            $buckets[$status]['unpaid'] = round($buckets[$status]['unpaid'] + (float) ($row['unpaid'] ?? 0), 2);

            $totalSupplierCost += (float) ($row['total'] ?? 0);
            $totalPaid += (float) ($row['paid'] ?? 0);
            $totalUnpaid += (float) ($row['unpaid'] ?? 0);
            if (((float) ($row['unpaid'] ?? 0)) > 0.0) {
                $unpaidCount += 1;
            }
        }

        $totalSupplierCost = round($totalSupplierCost, 2);
        $totalPaid = round($totalPaid, 2);
        $totalUnpaid = round($totalUnpaid, 2);

        $paidRatio = $totalSupplierCost > 0.0
            ? (float) number_format(min(100.0, ($totalPaid / $totalSupplierCost) * 100.0), 1, '.', '')
            : 0.0;

        $byAvailability = [];
        foreach (['not_available', 'in_purchase', 'available', 'done'] as $status) {
            $bucket = $buckets[$status];
            $byAvailability[] = [
                'status' => $status,
                'count' => (int) $bucket['count'],
                'total' => (float) $bucket['total'],
                'paid' => (float) $bucket['paid'],
                'unpaid' => (float) $bucket['unpaid'],
            ];
        }

        return [
            'implantCount' => (int) $implantCount,
            'paidRatio' => $paidRatio,
            'totalPaid' => $totalPaid,
            'totalSupplierCost' => $totalSupplierCost,
            'totalUnpaid' => $totalUnpaid,
            'unpaidCount' => (int) $unpaidCount,
            'byAvailability' => $byAvailability,
        ];
    }
}
