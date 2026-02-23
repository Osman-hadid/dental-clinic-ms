<?php

declare(strict_types=1);

namespace App\Modules\Common\Infrastructure\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

abstract class BaseListRequest extends FormRequest
{
    abstract protected static function filters(): array;

    abstract protected static function sortableColumns(): array;

    abstract protected static function allowedRelations(): array;

    abstract protected static function searchableColumns(): array;

    abstract protected static function fieldableColumns(): array;

    // Getters
    public static function getFilters()
    {
        return static::filters();
    }

    public static function getSortableColumns()
    {
        return static::sortableColumns();
    }

    public static function getAllowedRelations()
    {
        return static::allowedRelations();
    }

    public static function getSearchableColumns()
    {
        return static::searchableColumns();
    }

    public static function getFieldableColumns()
    {
        return static::fieldableColumns();
    }

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if ($this->filled('sortBy')) {
            $sortBy = (string) $this->input('sortBy');
            $sortableMap = static::sortableMap();

            $candidates = [
                $sortBy,
                Str::camel($sortBy),
                Str::snake($sortBy),
            ];

            foreach ($candidates as $candidate) {
                if (array_key_exists($candidate, $sortableMap)) {
                    $this->merge(['sortBy' => $candidate]);
                    break;
                }
            }
        }
    }

    public function rules(): array
    {
        $sortables = array_keys(static::sortableMap());
        $relations = static::allowedRelations();
        $searchables = array_keys(static::searchableColumns());

        return [
            'perPage' => 'nullable|integer|min:1|max:100',
            'page' => 'nullable|integer|min:1',
            'sortBy' => ['nullable', 'string', Rule::in($sortables)],
            'sortDirection' => 'nullable|in:asc,desc',
            'include' => 'nullable|array',
            'include.*' => ['string', Rule::in($relations)],
            'search' => 'nullable|string|max:255',
            'searchFields' => 'nullable|array',
            'searchFields.*' => ['string', Rule::in($searchables)],
            'fields' => 'nullable|string',
            'filter' => 'nullable|array',
            'filter.*' => 'present',
            'filter.trashed' => 'nullable|in:only,with,without',
        ];
    }

    public function validated($key = null, $default = null)
    {
        $data = parent::validated();

        if ($key) {
            return $data[$key] ?? $default;
        }

        $sortableMap = static::sortableMap();
        $requestedSortBy = $data['sortBy'] ?? 'createdAt';
        $sortColumn = $sortableMap[$requestedSortBy]
            ?? $sortableMap[Str::camel((string) $requestedSortBy)]
            ?? 'created_at';

        $searchFields = $data['searchFields'] ?? array_keys(static::searchableColumns());
        $searchFields = array_unique(array_filter(Arr::wrap($searchFields)));

        $fieldable = static::fieldableColumns();
        $fieldsInput = $data['fields'] ?? null;
        $fieldsCamel = $fieldsInput ? preg_split('/\s*,\s*/', trim((string) $fieldsInput)) : null;
        $fieldsSnake = $fieldsCamel
            ? array_values(array_filter(array_map(fn ($f) => $fieldable[$f] ?? null, $fieldsCamel)))
            : null;

        return [
            'perPage' => (int) ($data['perPage'] ?? 10),
            'page' => (int) ($data['page'] ?? 1),
            'sortBy' => $sortColumn,
            'sortDirection' => strtolower($data['sortDirection'] ?? 'desc'),
            'include' => $data['include'] ?? [],
            'filters' => $data['filter'] ?? [],
            'search' => $data['search'] ?? null,
            'searchFields' => $searchFields,
            'fields' => $fieldsSnake,
            'fieldsCamel' => $fieldsCamel,
        ];
    }

    private static function sortableMap(): array
    {
        $sortableColumns = static::sortableColumns();
        $map = [];

        if (array_is_list($sortableColumns)) {
            foreach ($sortableColumns as $column) {
                $dbColumn = (string) $column;
                $map[$dbColumn] = $dbColumn;
                $map[Str::camel($dbColumn)] = $dbColumn;
            }

            return $map;
        }

        foreach ($sortableColumns as $alias => $column) {
            $dbColumn = (string) $column;
            $aliasString = (string) $alias;
            $map[$aliasString] = $dbColumn;
            $map[Str::camel($aliasString)] = $dbColumn;
            $map[Str::snake($aliasString)] = $dbColumn;
        }

        return $map;
    }
}
