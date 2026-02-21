<?php

declare(strict_types=1);

namespace App\Modules\Common\Infrastructure\Traits;

trait IdCaster
{
    protected static function castId(mixed $value): ?int
    {
        return match (true) {
            $value === null || $value === '' => null,
            is_numeric($value) => (int) $value,
            default => throw new \InvalidArgumentException("Invalid ID value: {$value}"),
        };
    }

    protected static function castIds(array $keys, array $data): array
    {
        $result = [];

        foreach ($keys as $key) {
            if (str_ends_with((string) $key, '.*')) {
                $mainKey = rtrim((string) $key, '.*');
                $result[$mainKey] = ($data[$mainKey] ?? []) !== []
                    ? array_map(self::castId(...), $data[$mainKey])
                    : [];

                continue;
            }

            $result[$key] = isset($data[$key]) ? self::castId($data[$key]) : null;
        }

        return $result;
    }
}
