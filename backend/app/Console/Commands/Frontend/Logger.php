<?php

declare(strict_types=1);

namespace App\Console\Commands\Frontend;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Console\Output\OutputInterface;

final class Logger
{
    public function info(string $message, ?Command $command = null): void
    {
        $config = config('frontend_generator.logging', [
            'level' => 'info',
            'channel' => 'stack',
        ]);

        $logLevel = $config['level'] ?? 'info';
        $channel = $config['channel'] ?? 'stack';

        // THIS IS THE KEY: Use null-safe operator
        $isVerbose = $command?->getOutput()?->getVerbosity() >= OutputInterface::VERBOSITY_VERBOSE;

        if (\in_array($logLevel, ['info', 'debug'], true) || $isVerbose) {
            Log::channel($channel)->info($message);
        }

        if ($isVerbose && $command) {
            $command->info($message);
        }
    }

    public function error(string $message, ?Command $command = null): void
    {
        $channel = config('frontend_generator.logging.channel', 'stack');
        Log::channel($channel)->error($message);

        if ($command instanceof Command) {
            $command->error($message);
        }
    }
}
