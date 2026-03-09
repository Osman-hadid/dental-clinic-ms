<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Services;

use Symfony\Component\HttpFoundation\StreamedResponse;

final class ReportExportService
{
    public function __construct(private readonly ReportReadService $reportReadService) {}

    /**
     * @param array<string, mixed> $filters
     */
    public function streamCsv(string $type, array $filters): StreamedResponse
    {
        $payload = $this->buildCsvPayload($type, $filters);

        return response()->streamDownload(function () use ($payload): void {
            $handle = fopen('php://output', 'wb');
            if ($handle === false) {
                return;
            }

            fputcsv($handle, $payload['headers']);
            foreach ($payload['rows'] as $row) {
                fputcsv($handle, $row);
            }

            fclose($handle);
        }, $payload['filename'], [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    /**
     * @param array<string, mixed> $filters
     * @return array{filename: string, headers: array<int, string>, rows: array<int, array<int, mixed>>}
     */
    private function buildCsvPayload(string $type, array $filters): array
    {
        return match ($type) {
            'audit_log' => $this->auditLogPayload($filters),
            'clinical_treatment' => $this->clinicalTreatmentPayload($filters),
            'executive_summary' => $this->executiveSummaryPayload($filters),
            'financial_daily_safe' => $this->financialDailySafePayload($filters),
            'financial_implant_installment' => $this->financialImplantInstallmentPayload($filters),
            'financial_outstanding' => $this->financialOutstandingPayload($filters),
            'financial_patient_details' => $this->financialPatientDetailsPayload($filters),
            'financial_revenue' => $this->financialRevenuePayload($filters),
            'financial_shareholder' => $this->financialShareholderPayload($filters),
            'inventory_stock' => $this->inventoryStockPayload($filters),
            default => throw new \InvalidArgumentException("Unsupported export type [{$type}]"),
        };
    }

    /**
     * @param array<string, mixed> $filters
     * @return array{filename: string, headers: array<int, string>, rows: array<int, array<int, mixed>>}
     */
    private function executiveSummaryPayload(array $filters): array
    {
        $report = $this->reportReadService->executive($filters);
        $kpis = (array) ($report['kpis'] ?? []);

        return [
            'filename' => 'executive-summary.csv',
            'headers' => ['Metric', 'Value'],
            'rows' => [
                ['Billed', $kpis['billed'] ?? 0],
                ['Paid', $kpis['paid'] ?? 0],
                ['Net', $kpis['net'] ?? 0],
                ['Debt', $kpis['debt'] ?? 0],
                ['Discount', $kpis['discount'] ?? 0],
                ['Expenses', $kpis['expenses'] ?? 0],
                ['Salary Paid', $kpis['salaryPaid'] ?? 0],
                ['Active Patients', $kpis['activePatients'] ?? 0],
                ['Appointments', $kpis['appointments'] ?? 0],
                ['Visits', $kpis['visits'] ?? 0],
                ['Bank Balance', $report['bankBalance'] ?? 0],
                ['Cash In Safe', $report['cashInSafe'] ?? 0],
                ['Profit Loss', $report['profitLoss'] ?? 0],
                ['Treatment Acceptance Rate', $report['treatmentAcceptanceRate'] ?? 0],
            ],
        ];
    }

    /**
     * @param array<string, mixed> $filters
     * @return array{filename: string, headers: array<int, string>, rows: array<int, array<int, mixed>>}
     */
    private function financialRevenuePayload(array $filters): array
    {
        $report = $this->reportReadService->financial($filters);

        return [
            'filename' => 'financial-revenue.csv',
            'headers' => ['Treatment', 'Sessions', 'Amount'],
            'rows' => array_map(static fn (array $row): array => [
                $row['name'] ?? '',
                $row['sessions'] ?? 0,
                $row['amount'] ?? 0,
            ], (array) ($report['tables']['revenueByTreatment'] ?? [])),
        ];
    }

    /**
     * @param array<string, mixed> $filters
     * @return array{filename: string, headers: array<int, string>, rows: array<int, array<int, mixed>>}
     */
    private function financialOutstandingPayload(array $filters): array
    {
        $report = $this->reportReadService->financial($filters);

        return [
            'filename' => 'financial-outstanding.csv',
            'headers' => ['Invoice ID', 'Invoice Date', 'Patient', 'Net Amount', 'Paid Amount', 'Debt Amount', 'Status'],
            'rows' => array_map(static fn (array $row): array => [
                $row['invoiceId'] ?? '',
                $row['invoiceDate'] ?? '',
                $row['patientName'] ?? '',
                $row['netAmount'] ?? 0,
                $row['paidAmount'] ?? 0,
                $row['debtAmount'] ?? 0,
                $row['status'] ?? '',
            ], (array) ($report['tables']['outstandingInvoices'] ?? [])),
        ];
    }

    /**
     * @param array<string, mixed> $filters
     * @return array{filename: string, headers: array<int, string>, rows: array<int, array<int, mixed>>}
     */
    private function financialPatientDetailsPayload(array $filters): array
    {
        $report = $this->reportReadService->financial($filters);
        $patientSummaries = [];

        foreach ((array) ($report['tables']['revenueByPatient'] ?? []) as $row) {
            $patientId = (string) ($row['patientId'] ?? '');
            $patientName = (string) ($row['patientName'] ?? '');
            $key = $patientId !== '' ? $patientId : $patientName;
            if ($key === '') {
                $key = 'unknown';
            }

            $netAmount = (float) ($row['amount'] ?? 0);
            $patientSummaries[$key] = [
                'patientId' => $patientId,
                'patientName' => $patientName,
                'totalNetAmount' => $netAmount,
                'totalPaidAmount' => $netAmount,
                'totalDebtAmount' => 0.0,
                'openInvoiceCount' => 0,
                'lastInvoiceDate' => '',
                'invoiceIds' => [],
            ];
        }

        foreach ((array) ($report['tables']['outstandingInvoices'] ?? []) as $row) {
            $patientId = (string) ($row['patientId'] ?? '');
            $patientName = (string) ($row['patientName'] ?? '');
            $key = $patientId !== '' ? $patientId : $patientName;
            if ($key === '') {
                $key = 'unknown';
            }

            $netAmount = (float) ($row['netAmount'] ?? 0);
            $debtAmount = (float) ($row['debtAmount'] ?? 0);
            $invoiceDate = (string) ($row['invoiceDate'] ?? '');
            $invoiceId = (string) ($row['invoiceId'] ?? '');

            $patientSummaries[$key] ??= [
                'patientId' => $patientId,
                'patientName' => $patientName,
                'totalNetAmount' => $netAmount,
                'totalPaidAmount' => 0.0,
                'totalDebtAmount' => 0.0,
                'openInvoiceCount' => 0,
                'lastInvoiceDate' => '',
                'invoiceIds' => [],
            ];

            $patientSummaries[$key]['totalDebtAmount'] += $debtAmount;
            $patientSummaries[$key]['openInvoiceCount'] += 1;
            if ($invoiceDate !== '' && strcmp($invoiceDate, (string) $patientSummaries[$key]['lastInvoiceDate']) > 0) {
                $patientSummaries[$key]['lastInvoiceDate'] = $invoiceDate;
            }
            if ($invoiceId !== '') {
                $patientSummaries[$key]['invoiceIds'][] = $invoiceId;
            }
        }

        foreach ($patientSummaries as $key => $summary) {
            $patientSummaries[$key]['totalPaidAmount'] = max(
                0,
                (float) $summary['totalNetAmount'] - (float) $summary['totalDebtAmount']
            );
            $patientSummaries[$key]['invoiceIds'] = array_values(array_unique((array) ($summary['invoiceIds'] ?? [])));
        }

        uasort($patientSummaries, static fn (array $left, array $right): int => ($right['totalNetAmount'] <=> $left['totalNetAmount']));

        return [
            'filename' => 'financial-patient-details.csv',
            'headers' => ['Patient ID', 'Patient', 'Total Net Amount', 'Total Paid Amount', 'Total Debt Amount', 'Open Invoices', 'Last Invoice Date', 'Invoice IDs', 'Account Status'],
            'rows' => array_map(static fn (array $row): array => [
                $row['patientId'] ?? '',
                $row['patientName'] ?? '',
                round((float) ($row['totalNetAmount'] ?? 0), 2),
                round((float) ($row['totalPaidAmount'] ?? 0), 2),
                round((float) ($row['totalDebtAmount'] ?? 0), 2),
                $row['openInvoiceCount'] ?? 0,
                $row['lastInvoiceDate'] ?? '',
                implode(', ', array_filter(array_map(static fn (mixed $id): string => (string) $id, (array) ($row['invoiceIds'] ?? [])))),
                ((float) ($row['totalDebtAmount'] ?? 0)) > 0 ? 'Has unpaid balance' : 'Settled',
            ], array_values($patientSummaries)),
        ];
    }

    /**
     * @param array<string, mixed> $filters
     * @return array{filename: string, headers: array<int, string>, rows: array<int, array<int, mixed>>}
     */
    private function financialDailySafePayload(array $filters): array
    {
        $report = $this->reportReadService->financial($filters);

        return [
            'filename' => 'financial-daily-safe.csv',
            'headers' => ['Date', 'Direction', 'Entry Type', 'Amount', 'Picked By', 'Notes'],
            'rows' => array_map(static fn (array $row): array => [
                $row['transactionDate'] ?? '',
                $row['direction'] ?? '',
                $row['entryType'] ?? '',
                $row['amount'] ?? 0,
                $row['pickedByStaffName'] ?? '',
                $row['notes'] ?? '',
            ], (array) ($report['tables']['safeLedger'] ?? [])),
        ];
    }

    /**
     * @param array<string, mixed> $filters
     * @return array{filename: string, headers: array<int, string>, rows: array<int, array<int, mixed>>}
     */
    private function financialShareholderPayload(array $filters): array
    {
        $report = $this->reportReadService->financial($filters);

        return [
            'filename' => 'financial-shareholder.csv',
            'headers' => ['Date', 'Shareholder', 'Type', 'Amount', 'Notes'],
            'rows' => array_map(static fn (array $row): array => [
                $row['transactionDate'] ?? '',
                $row['shareholderName'] ?? '',
                $row['transactionType'] ?? '',
                $row['amount'] ?? 0,
                $row['notes'] ?? '',
            ], (array) ($report['tables']['shareholderLedger'] ?? [])),
        ];
    }

    /**
     * @param array<string, mixed> $filters
     * @return array{filename: string, headers: array<int, string>, rows: array<int, array<int, mixed>>}
     */
    private function financialImplantInstallmentPayload(array $filters): array
    {
        $report = $this->reportReadService->financial($filters);

        return [
            'filename' => 'financial-implant-installments.csv',
            'headers' => ['Created At', 'Patient', 'Tooth', 'Availability', 'Supplier Total', 'Supplier Paid', 'Supplier Remaining'],
            'rows' => array_map(static fn (array $row): array => [
                $row['createdAt'] ?? '',
                $row['patientName'] ?? '',
                $row['toothNumber'] ?? '',
                $row['availability'] ?? '',
                $row['supplierTotal'] ?? 0,
                $row['supplierPaid'] ?? 0,
                $row['supplierRemaining'] ?? 0,
            ], (array) ($report['tables']['implantInstallments'] ?? [])),
        ];
    }

    /**
     * @param array<string, mixed> $filters
     * @return array{filename: string, headers: array<int, string>, rows: array<int, array<int, mixed>>}
     */
    private function clinicalTreatmentPayload(array $filters): array
    {
        $report = $this->reportReadService->clinical($filters);

        return [
            'filename' => 'clinical-treatment.csv',
            'headers' => ['Treatment', 'Sessions', 'Revenue'],
            'rows' => array_map(static fn (array $row): array => [
                $row['name'] ?? '',
                $row['sessions'] ?? 0,
                $row['revenue'] ?? 0,
            ], (array) ($report['tables']['treatmentPerformance'] ?? [])),
        ];
    }

    /**
     * @param array<string, mixed> $filters
     * @return array{filename: string, headers: array<int, string>, rows: array<int, array<int, mixed>>}
     */
    private function inventoryStockPayload(array $filters): array
    {
        $report = $this->reportReadService->inventory($filters);

        return [
            'filename' => 'inventory-stock.csv',
            'headers' => ['Item', 'Category', 'Availability', 'Quantity', 'Consumed', 'Available', 'Stock Value', 'Supplier'],
            'rows' => array_map(static fn (array $row): array => [
                $row['itemName'] ?? '',
                $row['category'] ?? '',
                $row['availability'] ?? '',
                $row['quantity'] ?? 0,
                $row['consumedQuantity'] ?? 0,
                $row['availableQuantity'] ?? 0,
                $row['stockValue'] ?? 0,
                $row['supplier'] ?? '',
            ], (array) ($report['tables']['stockRows'] ?? [])),
        ];
    }

    /**
     * @param array<string, mixed> $filters
     * @return array{filename: string, headers: array<int, string>, rows: array<int, array<int, mixed>>}
     */
    private function auditLogPayload(array $filters): array
    {
        $report = $this->reportReadService->audit($filters);

        return [
            'filename' => 'audit-log.csv',
            'headers' => ['Timestamp', 'Type', 'Entity', 'Action', 'Changed By'],
            'rows' => array_map(static fn (array $row): array => [
                $row['timestamp'] ?? '',
                $row['type'] ?? '',
                $row['entity'] ?? '',
                $row['action'] ?? '',
                $row['changedBy'] ?? '',
            ], (array) ($report['timeline'] ?? [])),
        ];
    }
}
