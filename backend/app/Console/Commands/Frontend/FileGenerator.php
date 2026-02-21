<?php

declare(strict_types=1);

namespace App\Console\Commands\Frontend;

use App\Console\Commands\Shared\MigrationParser;
use App\Console\Commands\Shared\Naming;
use App\Console\Commands\Shared\StubRegistry;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

final readonly class FileGenerator
{
    public function __construct(private Command $command, private Logger $logger) {}

    public function generate(string $module, string $entity, array $fields, array $extraReplacements = []): void
    {
        $naming = Naming::all($module, $entity);

        $replacements = [
            // Module
            '{moduleKebab}' => $naming['moduleKebab'],
            '{moduleCamel}' => $naming['moduleCamel'],
            '{modulePascal}' => $naming['modulePascal'],

            // Entity - Singular
            '{entity}' => $naming['entityPascal'],
            '{entityCamel}' => $naming['entityCamel'],
            '{entityKebab}' => $naming['entityKebab'],
            '{entitySnake}' => $naming['entitySnake'],
            '{entitySnakeUpper}' => $naming['entitySnakeUpper'],
            '{entityHeadline}' => $naming['entityHeadline'],
            '{singleQueryKey}' => $naming['entityQueryKeySingle'],

            // Entity - Plural
            '{entityPlural}' => $naming['entityPascalPlural'],
            '{entityCamelPlural}' => $naming['entityCamelPlural'],
            '{entityKebabPlural}' => $naming['entityKebabPlural'],
            '{entitySnakePlural}' => $naming['entitySnakePlural'],
            '{entityHeadlinePlural}' => $naming['entityHeadlinePlural'],
            '{queryKey}' => $naming['entityQueryKey'],

            // Permission
            '{permissionPrefix}' => $naming['permissionPrefix'],
        ];

        $replacements = [...$replacements, ...$extraReplacements];

        $stubs = StubRegistry::get('frontend');

        foreach ($stubs as $type => $config) {
            $this->processStub($type, $config, $replacements, $fields, $module, $entity);
        }

        $this->updateSidebarNavigation($module, $entity);
    }

    private function processStub(string $type, array $config, array $replacements, array $fields, string $module, string $entity): void
    {
        $stubPath = base_path($config['stub']);

        if (!File::exists($stubPath)) {
            $this->logger->error("Stub file not found: {$stubPath}", $this->command);
            throw new \Exception("Stub file not found: {$stubPath}"); // NOSONAR
        }

        $content = File::get($stubPath);

        // Replace output path placeholders (single braces)
        $outputPath = base_path(str_replace(
            array_keys($replacements),
            array_values($replacements),
            $config['output']
        ));

        if ($type === 'locale') {
            $this->generateLocaleFiles($config, $replacements, $fields, $entity);

            return;
        }

        if ($type === 'index') {
            $this->generateIndexFile($config, $replacements);

            return;
        }

        if ($type === 'request') {
            $this->generateRequestFile($config, $replacements);

            return;
        }

        $content = $this->replaceContentPlaceholders($content, $replacements, $fields, $type, $module, $entity);

        $this->writeFile($outputPath, $content);
    }

    private function generateLocaleFiles(array $config, array $replacements, array $fields, string $entity): void
    {
        $stubPath = base_path($config['stub']);
        $content = File::get($stubPath);

        foreach (LocaleGenerator::SUPPORTED_LOCALES as $locale) {
            $localeReplacements = [...$replacements, '{locale}' => $locale];

            // Generate dynamic parts
            $generator = new LocaleGenerator;
            $fieldEntries = array_map($generator->generateLocaleField(...), $fields);
            $fieldsJson = $fieldEntries !== [] ? implode(LocaleGenerator::INDENT_SEPARATOR, $fieldEntries) : '';

            $dynamicReplacements = [
                '{fields}' => $fieldsJson,
                '{table}' => $generator->generateTableTranslations($entity),
                '{repository}' => $generator->generateRepositoryTranslations($entity),
                '{presentation}' => $generator->generatePresentationTranslations($entity),
            ];

            $fullReplacements = [...$localeReplacements, ...$dynamicReplacements];

            $finalContent = str_replace(
                array_keys($fullReplacements),
                array_values($fullReplacements),
                $content
            );

            $outputPath = base_path(str_replace(
                array_keys($localeReplacements),
                array_values($localeReplacements),
                $config['output']
            ));

            $this->writeFile($outputPath, $finalContent);
        }
    }

    private function generateIndexFile(array $config, array $replacements): void
    {
        $outputPath = base_path(str_replace(
            array_keys($replacements),
            array_values($replacements),
            $config['output']
        ));

        $entityPascal = $replacements['{entity}'];
        $entityKebabPlural = $replacements['{entityKebabPlural}'];

        $exports = [
            "export { useCreate{$entityPascal} } from './{$entityKebabPlural}/useCreate{$entityPascal}';",
            "export { useDelete{$entityPascal} } from './{$entityKebabPlural}/useDelete{$entityPascal}';",
            "export { useGet{$entityPascal} } from './{$entityKebabPlural}/useGet{$entityPascal}';",
            "export { use{$entityPascal}List } from './{$entityKebabPlural}/use{$entityPascal}List';",
            "export { useUpdate{$entityPascal} } from './{$entityKebabPlural}/useUpdate{$entityPascal}';",
        ];

        $newContent = "/* eslint-disable */\n".implode("\n", $exports)."\n";

        if (File::exists($outputPath)) {
            $existing = File::get($outputPath);
            if (!str_contains($existing, "useCreate{$entityPascal}")) {
                $content = "{$existing}\n{$newContent}";
                $this->writeFile($outputPath, $content);
            }
        } else {
            $this->writeFile($outputPath, $newContent);
        }
    }

    private function generateRequestFile(array $config, array $replacements): void
    {
        $outputPath = base_path($config['output']);
        $entityCamel = $replacements['{entityCamel}'];
        $moduleKebab = $replacements['{moduleKebab}'];
        $entityKebab = $replacements['{entityKebab}'];

        $typeEntry = "  {$entityCamel}: Record<string, unknown>;";
        $messageEntry = "    {$entityCamel}: (await import(`@/messages/\${locale}/{$moduleKebab}/{$entityKebab}.json`)).default,";

        if (File::exists($outputPath)) {
            $content = File::get($outputPath);
            if (!str_contains($content, "{$entityCamel}: Record<string, unknown>")) {
                $content = $this->updateRequestContent($content, $typeEntry, $messageEntry);
                $this->writeFile($outputPath, $content);
            }
        } else {
            $content = File::get(base_path($config['stub']));
            $content = str_replace(array_keys($replacements), array_values($replacements), $content);
            $this->writeFile($outputPath, $content);
        }
    }

    private function updateRequestContent(string $content, string $typeEntry, string $messageEntry): string
    {
        $content = preg_replace_callback(
            '/(type Messages\s*=\s*\{)([^}]*?)(\})/s',
            function (array $m) use ($typeEntry): string {
                $existing = trim($m[2]);
                $newBody = $existing !== '' && $existing !== '0' ? "$existing\n$typeEntry" : $typeEntry;

                return "{$m[1]}\n{$newBody}\n  {$m[3]}";
            },
            $content
        );

        return preg_replace_callback(
            '/(const messages: Messages\s*=\s*\{)(.*?)(};)/s',
            function (array $m) use ($messageEntry): string {
                $existing = trim($m[2]);
                $clean = rtrim($existing, ",\n");
                $newBody = $clean !== '' && $clean !== '0' ? "$clean,\n$messageEntry" : $messageEntry;

                return "{$m[1]}\n{$newBody}\n  {$m[3]}";
            },
            (string) $content
        );
    }

    private function replaceContentPlaceholders(string $content, array $replacements, array $fields, string $type, string $module, string $entity): string
    {
        // First: special generators
        if ($type === 'config') {
            $generator = new ConfigGenerator(
                new MigrationParser,
                new ListRequestParser
            );

            return $generator->generateConfig($module, $entity, $fields);
        }

        if ($type === 'type') {
            $generator = new TypeGenerator;

            return $generator->generateTypeContent($replacements['{entity}'], $fields);
        }

        // Finally: replace all known single-brace placeholders
        return str_replace(array_keys($replacements), array_values($replacements), $content);
    }

    private function writeFile(string $path, string $content): void
    {
        File::ensureDirectoryExists(dirname($path));
        File::put($path, trim($content)."\n");
        $this->logger->info("Generated: {$path}", $this->command);
    }

    private function updateSidebarNavigation(string $module, string $entity): void
    {
        $moduleKebab = Naming::moduleKebab($module);
        $entityKebabPlural = Naming::entityKebabPlural($entity);
        $entityQueryKey = Naming::entityQueryKey($entity);
        $permissionPrefix = Naming::permissionPrefix($module, $entity);

        $sidebarPath = base_path('../frontend/src/generated/sidebar-items.ts');

        $newItem = "      { key: '{$entityQueryKey}', permission: '{$permissionPrefix}.view', url: '/{$moduleKebab}/{$entityKebabPlural}' }";

        $newModuleBlock = "  {
    icon: Folder,
    items: [
      {$newItem}
    ],
    key: '{$moduleKebab}',
    url: '/{$moduleKebab}',
  }";

        $content = File::get($sidebarPath);

        // Check if the module already exists
        if (str_contains($content, "key: '{$moduleKebab}'")) {
            // Module exists — update its items array
            $pattern = '/
            (items:\s*\[\s*)          # opening of items array
            (.*?)                     # existing items
            (\s*\]\s*,\s*key:\s*[\'"]'.preg_quote($moduleKebab, '/').'[\'"])
        /sx';

            if (preg_match($pattern, $content, $m)) {
                $before = $m[1];
                $existingItems = trim($m[2]);
                $after = $m[3];

                $duplicatePattern = sprintf(
                    "/key:\\s*['\"]%s['\"].*?url:\\s*['\"]%s['\"]/s",
                    preg_quote($entityQueryKey, '/'),
                    preg_quote("/{$moduleKebab}/{$entityKebabPlural}", '/')
                );

                if (preg_match($duplicatePattern, $existingItems)) {
                    $this->addSidebarTranslations($module, $entity);

                    return;
                }

                $existingItems = rtrim($existingItems, ", \n"); // remove trailing comma and spaces
                $separator = $existingItems !== '' ? ",\n" : "\n";
                $updatedItems = $existingItems.$separator.$newItem;

                $replacement = $before.$updatedItems."\n    ".$after;

                $content = preg_replace($pattern, $replacement, $content, 1);
            }
        } else {
            // Module does not exist — add it at the bottom (before closing ])
            $content = preg_replace(
                '/(\]\s*;)/s',
                "{$newModuleBlock},\n$1",
                $content,
                1
            );
        }

        File::put($sidebarPath, $content);
        $this->addSidebarTranslations($module, $entity);
    }

    private function addSidebarTranslations(string $module, string $entity): void
    {
        $moduleKebab = Naming::moduleKebab($module);
        $moduleHeadline = Naming::moduleHeadline($module);
        $entityHeadlinePlural = Naming::entityHeadlinePlural($entity);
        $entityQueryKey = Naming::entityQueryKey($entity);

        foreach (LocaleGenerator::SUPPORTED_LOCALES as $locale) {
            $path = base_path("../frontend/src/messages/{$locale}/sidebar.json");

            if (!File::exists($path)) {
                continue;
            }

            $content = File::get($path);
            $json = json_decode($content, true);

            if (isset($json[$moduleKebab])) {
                if (!isset($json[$moduleKebab][$entityQueryKey])) {
                    $json[$moduleKebab][$entityQueryKey] = $entityHeadlinePlural;
                }
            } else {
                $json[$moduleKebab] = [
                    'title' => $moduleHeadline,
                    $entityQueryKey => $entityHeadlinePlural,
                ];
            }

            $pretty = json_encode($json, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)."\n";
            File::put($path, $pretty);

            $this->logger->info("Updated sidebar translations for {$moduleKebab}.{$entityQueryKey} in {$locale}", $this->command);
        }
    }
}
