<?php

declare(strict_types=1);

namespace App\Console\Commands\Shared;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

final class MigrationParser // NOSONAR
{
    /*
    * TODO: Needs refactoring. NOSONAR
    */

    public function parseForBackend(string $path): array
    {
        $content = File::get($path);
        $lines = collect(explode("\n", $content));
        $table = $this->extractTableName($lines);

        if (!$table) {
            return ['table' => null, 'fields' => [], 'constants' => []];
        }

        $fields = $this->extractColumnFields($lines, $content, $table);
        $fields = [...$fields, ...$this->extractHasManyFields($table)];
        $constants = $this->extractAllConstants($content);

        return [
            'table' => $table,
            'fields' => $fields,
            'constants' => $constants,
        ];
    }

    public function extractConstants(string $entity, array $wanted = []): array
    {
        $file = $this->findMigrationFile($entity);
        if (!$file) {
            return [];
        }

        $content = File::get($file);

        return $this->extractAllConstants($content, $wanted);
    }

    public function extractFrontendFilters(string $entity): array
    {
        $constants = $this->extractConstants($entity, wanted: ['FRONTEND_FILTERS']);

        return $constants['FRONTEND_FILTERS'] ?? [];
    }

    public function extractBackendFilters(string $entity): array
    {
        $constants = $this->extractConstants($entity, ['BACKEND_FILTERS']);

        return $constants['BACKEND_FILTERS'] ?? [];
    }

    private function findMigrationFile(string $entity): ?string
    {
        $pattern = base_path('database/migrations/*'.Str::snake(Str::plural($entity)).'*.php');
        $files = glob($pattern);

        return $files[0] ?? null;
    }

    private function extractAllConstants(string $content, array $only = []): array
    {
        $constants = [
            'SORTABLE_COLUMNS' => [],
            'BACKEND_FILTERS' => [],
            'FRONTEND_FILTERS' => [],
            'SEARCHABLE_COLUMNS' => [],
            'FIELDABLE_COLUMNS' => [],
            'BOOLEAN_FIELDS' => [],
            'CAST_IDS' => [],
        ];

        if (preg_match_all('/private\s+const\s+(\w+)\s*=\s*(\[[\s\S]*?\]);/', $content, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $match) {
                $name = $match[1];
                $raw = trim($match[2]);

                if ($only && !\in_array($name, $only, true)) {
                    continue;
                }

                // Special handling for BOOLEAN_FIELDS and CAST_IDS
                if (\in_array($name, ['BOOLEAN_FIELDS', 'CAST_IDS', 'SORTABLE_COLUMNS'], true)) {
                    $parsed = $this->safeEvalArray($raw);
                    $constants[$name] = $parsed ?? [];

                    continue;
                }

                // Complex constants (filters, searchable)
                if (str_contains($raw, 'AllowedFilter::') || str_contains($raw, 'function')) {
                    $constants[$name] = $raw;

                    continue;
                }

                // Simple arrays
                $parsed = $this->safeEvalArray($raw);
                $constants[$name] = $parsed ?? [];
            }
        }

        return $constants;
    }

    private function safeEvalArray(string $code): mixed
    {
        return @eval("return {$code};");
    }

    private function extractTableName(Collection $lines): ?string
    {
        foreach ($lines as $line) {
            if (preg_match("/Schema::(create|table)\(['\"](\w+)['\"]/", (string) $line, $m)) {
                return $m[2];
            }
        }

        return null;
    }

    private function extractColumnFields(Collection $lines, string $content, string $table): array
    {
        $fields = [];
        $seen = [];

        foreach ($lines as $line) {
            $line = trim((string) $line);
            if (!str_contains($line, '$table->')) {
                continue;
            }

            if (preg_match("/\\\$table->(\w+)\(['\"](\w+)['\"]/", $line, $m)) {
                [$method, $name] = [$m[1], $m[2]];
                if (\in_array($name, $seen, true)) {
                    continue;
                }

                $seen[] = $name;
                $fields[] = $this->buildField($method, $name, $line, $content, $table);
            }
        }

        return $fields;
    }

    private function extractHasManyFields(string $tableName): array
    {
        $relationships = $this->findHasManyRelationships($tableName);

        return array_map(fn ($table): array => [
            'name' => $table,
            'camel' => Str::camel($table),
            'rule' => null,
            'required' => false,
            'cast' => null,
            'type' => null,
            'unique' => false,
            'has_default' => false,
            'relationship' => [
                'type' => 'HasMany',
                'name' => Str::camel($table),
                'model' => Str::studly(Str::singular($table)),
                'function' => 'hasMany',
            ],
            'table' => $tableName,
        ], $relationships);
    }

    protected function buildField(string $method, string $name, string $modifiers, string $content, string $tableName): array
    {
        $required = !Str::contains($modifiers, ['->nullable()', '->default(']);
        $hasDefault = Str::contains($modifiers, '->default(');
        $isUnique = Str::contains($modifiers, '->unique()');

        $field = [
            'name' => $name,
            'camel' => Str::camel($name),
            'rule' => 'string|max:255',
            'required' => $hasDefault ? false : $required,
            'cast' => null,
            'type' => 'string',
            'unique' => $isUnique,
            'has_default' => $hasDefault,
            'relationship' => null,
            'table' => $tableName,
            'default' => null,
        ];

        // Extract default value
        if ($hasDefault && preg_match("/->default\(['\"]?([^'\"]+)['\"]?\)/", $modifiers, $defaultMatch)) {
            $field['default'] = $defaultMatch[1];
        }

        // Apply field-specific transformations
        return $this->applyTypeCasting($field, $method, $modifiers, $content, $name);
    }

    protected function applyTypeCasting(array $field, string $method, string $modifiers, string $content, string $name): array
    {
        // Handle integer casts
        if (\in_array($method, ['foreignId', 'unsignedBigInteger', 'integer', 'unsignedTinyInteger', 'unsignedInteger'])) {
            $field = $this->setIntType($field);
        }

        // Enum via array
        if ($method === 'enum' && preg_match("/\[(.*?)\]/", $modifiers, $enumMatch)) {
            $field = $this->setEnumArrayRule($field, $enumMatch[1]);
        }

        // Enum via comment
        if ($method === 'string' && preg_match("/->comment\(['\"]enum:(.*?)['\"]\)/", $modifiers, $enumComment)) {
            $field = $this->setEnumCommentRule($field, $enumComment[1]);
        }

        // Boolean type
        if ($method === 'boolean') {
            $field['cast'] = 'boolean';
            $field['type'] = 'bool';
            $field['rule'] = 'boolean';
        }

        // Date or timestamp type
        if (Str::contains($method, 'date') || $method === 'timestamp') {
            $field['cast'] = 'datetime';
            $field['type'] = 'string';
            $field['rule'] = 'date';
        }

        // Relationship check
        if (Str::contains($content, ['->foreign(', 'foreignId'])) {
            $field['relationship'] = $this->buildRelationship($name, $content);
        }

        return $field;
    }

    protected function setIntType(array $field): array
    {
        $field['cast'] = 'integer';
        $field['type'] = 'int';
        $field['rule'] = 'integer';

        return $field;
    }

    protected function setEnumArrayRule(array $field, string $enumValues): array
    {
        $options = array_map(trim(...), explode(',', str_replace("'", '', $enumValues)));
        $rule = 'in:'.implode(',', $options);
        $baseRule = $field['required'] ? "string|{$rule}" : "nullable|string|{$rule}";
        $field['rule'] = $baseRule;
        $field['cast'] = 'string';

        return $field;
    }

    protected function setEnumCommentRule(array $field, string $enumValues): array
    {
        $options = array_map(trim(...), explode(',', $enumValues));
        $rule = 'in:'.implode(',', $options);
        $baseRule = $field['required'] ? "string|{$rule}" : "nullable|string|{$rule}";
        $field['rule'] = $baseRule;
        $field['cast'] = 'string';

        return $field;
    }

    protected function buildRelationship(string $name, string $content): ?array
    {
        $relatedTable = null;

        // Inline: $table->foreignId('user_id')->references('id')->on('users')
        if (preg_match("/\\\$table->(foreignId|unsignedBigInteger)\(['\"]{$name}['\"](?:,\s*[^)]+)?\)->references\(['\"](\w+)['\"]\)->on\(['\"](\w+)['\"]\)/", $content, $ref)) {
            $relatedTable = $ref[3];

            // Separate: $table->foreign('user_id')->references('id')->on('users')
        } elseif (preg_match("/\\\$table->foreign\(['\"]{$name}['\"]\)->references\(['\"](\w+)['\"]\)->on\(['\"](\w+)['\"]\)/", $content, $ref)) {
            $relatedTable = $ref[2];

            // Short: $table->foreignId('user_id')->constrained('users') or $table->foreignId('user_id')
        } elseif (preg_match("/\\\$table->foreignId\(['\"]{$name}['\"]\)(?:->constrained(?:\(['\"](\w+)['\"]\))?)?/", $content, $ref)) {
            $relatedTable = $ref[1] ?? Str::plural(Str::replaceLast('_id', '', $name));
        }

        if ($relatedTable) {
            return [
                'type' => 'BelongsTo',
                'name' => Str::camel(Str::replaceLast('_id', '', $name)),
                'model' => Str::studly(Str::singular($relatedTable)),
                'function' => 'belongsTo',
            ];
        }

        return null;
    }

    protected function findHasManyRelationships(string $tableName): array
    {
        $migrationPath = base_path('database/migrations');
        $relationships = [];

        foreach (File::allFiles($migrationPath) as $file) {
            $content = File::get($file);
            $relatedTable = $this->extractTableNameFromContent($content);
            if (!$relatedTable) {
                continue;
            }

            if ($this->matchesExplicitForeignConstraint($content, $tableName)) {
                $relationships[] = $relatedTable;
            }

            if ($this->matchesConstrainedForeignId($content, $tableName)) {
                $relationships[] = $relatedTable;
            }

            $inferredMatches = $this->matchesInferredForeignId($content, $tableName);
            if ($inferredMatches !== []) {
                $relationships[] = $relatedTable;
            }
        }

        return array_unique($relationships);
    }

    protected function extractTableNameFromContent(string $content): ?string
    {
        if (preg_match("/Schema::(create|table)\(['\"](\w+)['\"]/", $content, $match)) {
            return $match[2];
        }

        return null;
    }

    private function matchesExplicitForeignConstraint(string $content, string $tableName): bool
    {
        $pattern = "/
        \\\$table->foreign\(
            \s*['\"]([^'\"]+)['\"]\s*
        \)->references\(
            \s*['\"][^'\"]+['\"]\s*
        \)->on\(
            \s*['\"]{$tableName}['\"]\s*
        \)
    /x";

        return (bool) preg_match_all($pattern, $content);
    }

    private function matchesConstrainedForeignId(string $content, string $tableName): bool
    {
        return (bool) preg_match_all(
            "/\\\$table->foreignId\(['\"]\w+['\"]\)->constrained\(['\"]{$tableName}['\"]\)/",
            $content
        );
    }

    private function matchesInferredForeignId(string $content, string $tableName): array
    {
        preg_match_all(
            "/\\\$table->foreignId\(['\"](\w+)['\"]\)/",
            $content,
            $matches
        );

        return collect($matches[1] ?? [])
            ->filter(fn ($key): bool => Str::plural(Str::replaceLast('_id', '', $key)) === $tableName)
            ->all();
    }
}
