<?php

declare(strict_types=1);

namespace App\Console\Commands\Frontend;

use App\Console\Commands\Shared\MigrationParser;
use App\Console\Commands\Shared\Naming;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

final readonly class ConfigGenerator
{
    private const EXCLUDED_FIELDS = ['createdAt', 'updatedAt', 'deletedAt', 'deletedBy', 'rememberToken'];

    public const INDENT_SEPARATOR = ",\n  ";

    public const NESTED_INDENT_SEPARATOR = ",\n      ";

    public function __construct(
        private MigrationParser $migrationParser,
        private ListRequestParser $listRequestParser,
    ) {}

    public function generateConfig(string $module, string $entity, array $fields): string
    {
        $naming = Naming::all($module, $entity);

        $stubPath = base_path('stubs/frontend/config.stub');
        $content = File::get($stubPath);

        $columns = $this->generateColumns($fields);
        $formFields = $this->generateFormFields($fields);
        $filters = $this->generateFilters($entity);
        $searchFields = $this->generateSearchFields($module, $entity);
        $sortableColumns = $this->generateSortableColumns($module, $entity);
        $relations = $this->generateRelations($module, $entity);

        $permissionPrefix = "{$naming['moduleKebab']}.{$naming['entityKebabPlural']}";
        $permissionsBlock = <<<PERMS
    view: '{$permissionPrefix}.view',
    create: '{$permissionPrefix}.create',
    update: '{$permissionPrefix}.update',
    delete: '{$permissionPrefix}.delete',
    bulkDelete: '{$permissionPrefix}.bulk-delete'
PERMS;

        $replacements = [
            '{entityName}' => $naming['entityCamel'],
            '{columns}' => implode(ConfigGenerator::INDENT_SEPARATOR, $columns),
            '{formFields}' => implode(ConfigGenerator::INDENT_SEPARATOR, $formFields),
            '{filters}' => $filters !== [] ? implode(ConfigGenerator::INDENT_SEPARATOR, $filters) : '',
            '{searchFields}' => $searchFields,
            '{sortableColumns}' => $sortableColumns,
            '{relations}' => $relations,
            '{title}' => "config.{$naming['entityCamel']}",
            '{createTitle}' => 'config.table.create',
            '{editTitle}' => 'config.table.edit',
            '{queryKey}' => $naming['entityQueryKey'],
            '{singleQueryKey}' => $naming['entityQueryKeySingle'],
            '{createButton}' => 'config.table.add',
            '{editButton}' => 'config.table.update',
            '{createSubmitText}' => 'config.create',
            '{editSubmitText}' => 'config.update',
            '{permissions}' => $permissionsBlock,
        ];

        $content = str_replace(array_keys($replacements), array_values($replacements), $content);

        // Clean up extra whitespace
        $content = preg_replace('/\s+\n/', "\n", $content);

        return preg_replace('/\n{2,}/', "\n", (string) $content);
    }

    public function generateColumns(array $fields): array
    {
        $out = [];
        foreach ($fields as $field) {
            if (\in_array($field['name'], self::EXCLUDED_FIELDS, true)) {
                continue;
            }
            $out[] = "{\n    accessorKey: '{$field['name']}',\n    header: 'config.form.{$field['name']}.label'\n  }";
        }

        return $out;
    }

    public function generateFormFields(array $fields): array
    {
        $out = [];
        foreach ($fields as $field) {
            if (\in_array($field['name'], self::EXCLUDED_FIELDS, true)) {
                continue;
            }

            $type = match ($field['name']) {
                'email' => 'email',
                'password' => 'password',
                'remarks' => 'textarea',
                'attachment', 'profilePhotoPath', 'userFormPath' => 'file',
                default => $field['type'] ?? 'text',
            };

            $validations = $this->getValidations($field);
            $validationBlock = $validations === []
                ? ''
                : ",\n    validation: {\n      ".implode(self::NESTED_INDENT_SEPARATOR, $validations)."\n    }";

            $optionsBlock = '';
            if (!empty($field['options']) && is_array($field['options'])) {
                $options = array_map(
                    fn ($opt): string => "{\n        label: \"config.form.{$field['name']}.options.{$opt}\",\n        value: \"{$opt}\"\n      }",
                    $field['options']
                );
                $optionsBlock = ",\n    options: [\n      ".implode(self::NESTED_INDENT_SEPARATOR, $options)."\n    ]";
            }

            $required = (!empty($field['required']) && $field['required'] !== 'false') ? 'true' : 'false';

            $out[] = "{\n    label: 'config.form.{$field['name']}.label',\n    name: '{$field['name']}',\n    required: {$required},\n    type: '{$type}'{$validationBlock}{$optionsBlock}\n  }";
        }

        return $out;
    }

    public function generateFilters(string $entity): array // NOSONAR
    {
        $filters = $this->migrationParser->extractFrontendFilters($entity);
        if ($filters === []) {
            return [];
        }

        $out = [];
        foreach ($filters as $key => $config) {
            $camelKey = Str::camel(is_numeric($key) ? $config : $key);

            if (\is_array($config) && ($config['type'] ?? '') === 'relation') {
                $relation = $config['relation'];
                $source = "{ type: 'relation', relation: '{$relation}'";
                if (!empty($config['labelKey'])) {
                    $source .= ", labelKey: '{$config['labelKey']}'";
                }
                if (!empty($config['valueKey'])) {
                    $source .= ", valueKey: '{$config['valueKey']}'";
                }
                $source .= ' }';

                $out[] = "{\n    key: '{$camelKey}',\n    title: 'config.form.{$camelKey}.label',\n    optionsSource: {$source}\n  }";
            } else {
                $options = [];
                foreach ((array) $config as $value => $label) {
                    $stringValue = is_numeric($value) ? $label : $value;
                    $labelKey = \is_string($label) ? $label : $value;
                    $options[] = "{ label: 'config.form.{$camelKey}.options.{$labelKey}', value: '{$stringValue}' }";
                }
                $out[] = "{\n    key: '{$camelKey}',\n    title: 'config.form.{$camelKey}.label',\n    options: [\n      ".implode(self::NESTED_INDENT_SEPARATOR, $options)."\n    ]\n  }";
            }
        }

        return $out;
    }

    public function generateSearchFields(string $module, string $entity): string
    {
        $keys = $this->listRequestParser->parse($module, $entity)['searchable'] ?? [];
        if (empty($keys)) {
            return '[]';
        }
        $items = array_map(fn ($k): string => "{ label: 'config.form.{$k}.label', value: '{$k}' }", $keys);

        return "[\n    ".implode(",\n    ", $items)."\n  ]";
    }

    public function generateSortableColumns(string $module, string $entity): string
    {
        $cols = $this->listRequestParser->parse($module, $entity)['sortable'] ?? [];

        return empty($cols) ? '[]' : '['.implode(', ', array_map(fn ($c): string => "'{$c}'", $cols)).']';
    }

    public function generateRelations(string $module, string $entity): string
    {
        $relations = $this->listRequestParser->parse($module, $entity)['relations'] ?? [];

        return empty($relations) ? '[]' : '['.implode(', ', array_map(fn ($r): string => "'{$r}'", $relations)).']';
    }

    private function getValidations(array $field): array
    {
        $rules = [];

        if (!empty($field['required']) && $field['required'] !== 'false') {
            $rules[] = "required: \"config.form.{$field['name']}.validation.required\"";
        }
        if ($field['name'] === 'email') {
            $rules[] = "pattern: { value: /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/, message: \"config.form.{$field['name']}.validation.email\" }";
        }
        if (\in_array($field['type'] ?? '', ['text', 'textarea', 'email', 'phone'])) {
            $rules[] = "maxLength: { value: 255, message: \"config.form.{$field['name']}.validation.maxLength\" }";
        }
        if (!empty($field['options']) && is_array($field['options'])) {
            $rules[] = 'in: { value: '.json_encode($field['options']).", message: \"config.form.{$field['name']}.validation.in\" }";
        }

        return $rules;
    }
}
