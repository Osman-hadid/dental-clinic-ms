<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Domain\Services\Concerns;

use App\Models\User;
use App\Modules\DentalManagement\Domain\Entities\Patient;
use Carbon\CarbonImmutable;

trait InteractsWithReportData
{
    /**
     * @param array<string, mixed> $filters
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}
     */
    private function resolveDateRange(array $filters): array
    {
        $startDate = CarbonImmutable::parse((string) ($filters['startDate'] ?? now()->subDays(90)->format('Y-m-d')))->startOfDay();
        $endDate = CarbonImmutable::parse((string) ($filters['endDate'] ?? now()->format('Y-m-d')))->endOfDay();

        if ($endDate->lt($startDate)) {
            return [$endDate->startOfDay(), $startDate->endOfDay()];
        }

        return [$startDate, $endDate];
    }

    /**
     * @param array<string, mixed> $filters
     */
    private function normalizedFilter(array $filters, string $key): string
    {
        $value = trim((string) ($filters[$key] ?? ''));

        return $value === '' || $value === 'all' ? '' : $value;
    }

    private function decimal(mixed $value): float
    {
        return round((float) ($value ?? 0), 2);
    }

    private function currencyCode(mixed $value): string
    {
        $currency = strtoupper($this->text($value, 'AFN'));

        return $currency === 'USD' ? 'USD' : 'AFN';
    }

    /**
     * @param array<int, string> $keys
     * @return array{AFN: array<string, float>, USD: array<string, float>}
     */
    private function initializeCurrencySections(array $keys): array
    {
        $afn = [];
        $usd = [];

        foreach ($keys as $key) {
            $afn[$key] = 0.0;
            $usd[$key] = 0.0;
        }

        return [
            'AFN' => $afn,
            'USD' => $usd,
        ];
    }

    /**
     * @param array{AFN: array<string, float>, USD: array<string, float>} $sections
     */
    private function addCurrencySectionValue(array &$sections, mixed $currency, string $key, mixed $amount): void
    {
        $code = $this->currencyCode($currency);
        $sections[$code][$key] = $this->decimal(($sections[$code][$key] ?? 0) + (float) ($amount ?? 0));
    }

    private function convertBaseAmountToInputCurrency(mixed $amount, mixed $currency, mixed $exchangeRate): float
    {
        $value = $this->decimal($amount);
        if ($this->currencyCode($currency) !== 'USD') {
            return $value;
        }

        $rate = (float) ($exchangeRate ?? 0);
        if ($rate <= 0) {
            return $value;
        }

        return $this->decimal($value / $rate);
    }

    private function resolveInputAmount(mixed $amountInput, mixed $amount, mixed $currency, mixed $exchangeRate): float
    {
        $inputText = trim((string) ($amountInput ?? ''));
        if ($inputText !== '') {
            return $this->decimal($amountInput);
        }

        return $this->convertBaseAmountToInputCurrency($amount, $currency, $exchangeRate);
    }

    private function text(mixed $value, string $fallback = ''): string
    {
        $text = trim((string) ($value ?? ''));

        return $text !== '' ? $text : $fallback;
    }

    private function dateString(mixed $value): string
    {
        if ($value instanceof \DateTimeInterface) {
            return $value->format('Y-m-d');
        }

        return $this->text($value);
    }

    private function dateTimeString(mixed $value): string
    {
        if ($value instanceof \DateTimeInterface) {
            return $value->format(DATE_ATOM);
        }

        return $this->text($value);
    }

    private function parseDate(mixed $value): ?CarbonImmutable
    {
        $text = $this->text($value);
        if ($text === '') {
            return null;
        }

        try {
            return CarbonImmutable::parse($text);
        } catch (\Throwable) {
            return null;
        }
    }

    private function inDateRange(mixed $value, CarbonImmutable $startDate, CarbonImmutable $endDate): bool
    {
        $date = $this->parseDate($value);

        return $date !== null && !$date->lt($startDate) && !$date->gt($endDate);
    }

    private function patientName(?Patient $patient, mixed $patientId = null): string
    {
        if ($patient !== null) {
            $fullName = trim(sprintf('%s %s', (string) ($patient->first_name ?? ''), (string) ($patient->last_name ?? '')));
            if ($fullName !== '') {
                return $fullName;
            }

            $patientCode = trim((string) ($patient->patient_code ?? ''));
            if ($patientCode !== '') {
                return $patientCode;
            }
        }

        $id = trim((string) ($patientId ?? $patient?->id ?? ''));

        return $id !== '' ? "Patient #{$id}" : 'Unknown Patient';
    }

    private function personName(?User $user, mixed $fallbackId = null, string $fallbackPrefix = 'User'): string
    {
        if ($user !== null) {
            $fullName = trim(sprintf('%s %s', (string) ($user->first_name ?? ''), (string) ($user->last_name ?? '')));
            if ($fullName !== '') {
                return $fullName;
            }

            if ($user->email !== null && trim((string) $user->email) !== '') {
                return trim((string) $user->email);
            }
        }

        $id = trim((string) ($fallbackId ?? $user?->id ?? ''));

        return $id !== '' ? "{$fallbackPrefix} #{$id}" : $fallbackPrefix;
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @return array<int, array<string, mixed>>
     */
    private function sortRows(array $rows, string $sortBy, string $direction = 'desc'): array
    {
        usort($rows, function (array $left, array $right) use ($direction, $sortBy): int {
            $leftValue = $left[$sortBy] ?? null;
            $rightValue = $right[$sortBy] ?? null;

            if (is_numeric($leftValue) && is_numeric($rightValue)) {
                $comparison = ((float) $leftValue) <=> ((float) $rightValue);
            } else {
                $comparison = strcmp(mb_strtolower((string) $leftValue), mb_strtolower((string) $rightValue));
            }

            return $direction === 'asc' ? $comparison : -$comparison;
        });

        return $rows;
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @return array{data: array<int, array<string, mixed>>, meta: array<string, int>}
     */
    private function paginateRows(array $rows, int $page, int $perPage): array
    {
        $page = max(1, $page);
        $perPage = max(1, min(100, $perPage));
        $total = count($rows);
        $offset = ($page - 1) * $perPage;
        $lastPage = max(1, (int) ceil($total / $perPage));

        return [
            'data' => array_values(array_slice($rows, $offset, $perPage)),
            'meta' => [
                'currentPage' => $page,
                'lastPage' => $lastPage,
                'perPage' => $perPage,
                'total' => $total,
            ],
        ];
    }

    /**
     * @return array{key: string, label: string, sort: int}
     */
    private function monthBucket(CarbonImmutable $date): array
    {
        return [
            'key' => $date->format('Y-m'),
            'label' => $date->format('M Y'),
            'sort' => $date->startOfMonth()->getTimestampMs(),
        ];
    }

    /**
     * @return array{key: string, label: string, sort: int}
     */
    private function granularityBucket(CarbonImmutable $date, string $granularity): array
    {
        return match ($granularity) {
            'month' => $this->monthBucket($date),
            'year' => [
                'key' => $date->format('Y'),
                'label' => $date->format('Y'),
                'sort' => $date->startOfYear()->getTimestampMs(),
            ],
            default => [
                'key' => $date->format('Y-m-d'),
                'label' => $date->format('M j'),
                'sort' => $date->startOfDay()->getTimestampMs(),
            ],
        };
    }

    private function reportStatus(string $value): string
    {
        return match (mb_strtolower($value)) {
            'cancelled' => 'cancelled',
            'paid', 'completed', 'done' => 'completed',
            default => 'pending',
        };
    }

    private function implantToothNumber(string $notes, string $title): ?string
    {
        if (preg_match('/\[implant_tooth:([0-9]{2})\]/i', $notes, $matches) === 1 && isset($matches[1])) {
            return $matches[1];
        }

        if (preg_match('/([0-9]{2})/', $title, $matches) === 1 && isset($matches[1])) {
            return $matches[1];
        }

        return null;
    }

    private function taggedAmount(string $notes, string $key): float
    {
        if (preg_match("/\\[{$key}:([0-9]+(?:\\.[0-9]+)?)\\]/i", $notes, $matches) !== 1 || !isset($matches[1])) {
            return 0.0;
        }

        return max(0, (float) $matches[1]);
    }

    private function isImplantTask(string $title, string $notes): bool
    {
        $haystack = mb_strtolower($title.' '.$notes);

        return str_contains($haystack, 'implant')
            || str_contains($haystack, 'implant_tooth');
    }

    private function taskAvailability(string $notes, string $status): string
    {
        if (preg_match('/\[implant_availability:(not_available|in_purchase|available|done)\]/i', $notes, $matches) === 1 && isset($matches[1])) {
            return mb_strtolower($matches[1]);
        }

        return match (mb_strtolower($status)) {
            'done' => 'done',
            'in_progress' => 'available',
            default => 'not_available',
        };
    }
}
