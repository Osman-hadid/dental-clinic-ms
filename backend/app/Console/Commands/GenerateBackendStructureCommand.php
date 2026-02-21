<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Console\Commands\Backend\FileGenerator;
use App\Console\Commands\Backend\TemplateDataGenerator;
use App\Console\Commands\Shared\MigrationParser;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;

final class GenerateBackendStructureCommand extends Command
{
    protected $signature = 'generate:backend {module} {entity}';

    protected $description = 'Generate full backend CRUD structure from migration';

    public function handle(): int
    {
        $module = $this->argument('module');
        $entity = $this->argument('entity');

        $this->info("Generating backend structure for module: <fg=cyan>{$module}</> → entity: <fg=cyan>{$entity}</>");

        $migrationPath = $this->findMigration($entity);

        if (!$migrationPath || !File::exists($migrationPath)) {
            $this->error("Migration file not found for entity: {$entity}");
            $this->newLine();
            $this->line('Searched for: <fg=yellow>*'.Str::snake(Str::plural($entity)).'*.php</> in database/migrations');

            return self::FAILURE;
        }

        $this->info('Found migration: <fg=green>'.File::basename($migrationPath).'</>');

        try {
            $migrationParser = new MigrationParser;
            $data = $migrationParser->parseForBackend($migrationPath);

            $templateDataGenerator = new TemplateDataGenerator(
                fields: $data['fields'],
                module: $module,
                entity: $entity,
            );

            $replacements = $templateDataGenerator->generate();

            $fileGenerator = new FileGenerator($this->output, $data['fields']);
            $fileGenerator->generate($module, $entity, $replacements);

            $this->newLine();
            $this->info("Backend structure generated successfully for <fg=green>{$module}/{$entity}</>!");

            // Run Pint formatting
            $this->formatWithPint($module);

            return self::SUCCESS;
        } catch (\Throwable $e) {
            $this->newLine();
            $this->error('Generation failed: '.$e->getMessage());

            if ($this->output->isDebug()) {
                $this->line($e->getTraceAsString());
            }

            return self::FAILURE;
        }
    }

    private function findMigration(string $entity): ?string
    {
        $pluralSnake = Str::snake(Str::plural($entity));
        $singularSnake = Str::snake($entity);

        $patterns = [
            base_path("database/migrations/*create_{$pluralSnake}_table*.php"),
            base_path("database/migrations/*create_{$singularSnake}_table*.php"),
            base_path("database/migrations/*{$pluralSnake}*.php"),
            base_path("database/migrations/*{$singularSnake}*.php"),
        ];

        foreach ($patterns as $pattern) {
            $files = glob($pattern);
            if ($files) {
                // Prefer "create_*_table" migrations
                foreach ($files as $file) {
                    if (str_contains(basename($file), 'create_') && str_contains(basename($file), '_table')) {
                        return $file;
                    }
                }

                // Fallback to first match
                return $files[0];
            }
        }

        return null;
    }

    private function formatWithPint(string $module): void
    {
        $modulePath = base_path("app/Modules/{$module}");

        if (!File::exists('./vendor/bin/pint')) {
            $this->warn('Pint not found. Skipping code formatting.');

            return;
        }

        $this->newLine();
        $this->info('Running Pint to format generated code...');

        // Use Symfony Process for safer, cross-platform execution
        $process = Process::fromShellCommandline('./vendor/bin/pint '.escapeshellarg($modulePath).' --quiet');

        $process->run();

        if ($process->isSuccessful()) {
            $this->line('<fg=green>✓ Code formatted successfully with Pint.</>');
        } else {
            $this->line('<fg=yellow>! Pint finished with warnings/errors:</>');
            $this->line($process->getOutput().$process->getErrorOutput());
        }

        // Also format bootstrap/providers.php if needed
        $bootstrapProviders = base_path('bootstrap/providers.php');
        if (File::exists($bootstrapProviders)) {
            $bootstrapProcess = Process::fromShellCommandline('./vendor/bin/pint '.escapeshellarg($bootstrapProviders).' --quiet');
            $bootstrapProcess->run();
        }
    }
}
