<?php

declare(strict_types=1);

namespace App\Modules\DentalManagement\Infrastructure\Http\Controllers;

use App\Modules\Common\Infrastructure\Http\Controllers\BaseApiController;
use App\Modules\DentalManagement\Infrastructure\Http\Requests\AiImaging\AnalyzeDentalImageRequest;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;
use Symfony\Component\Process\Process;

final class AiImagingController extends BaseApiController
{
    public function analyze(AnalyzeDentalImageRequest $request): JsonResponse
    {
        $file = $request->file('image');
        if (!$file) {
            return $this->errorResponse(
                code: 'VALIDATION_ERROR',
                message: 'Image is required.',
                details: ['image' => ['Image is required.']],
                httpCode: 422
            );
        }

        $provider = strtolower((string) config('services.ai_imaging.provider', 'ollama'));
        $modality = (string) ($request->validated('modality') ?? 'xray');
        $patientContext = (string) ($request->validated('patientContext') ?? '');
        $imagePath = (string) $file->getRealPath();
        $mimeType = $file->getMimeType() ?: 'image/jpeg';

        return match ($provider) {
            'openai' => $this->analyzeWithOpenAi(
                imagePath: $imagePath,
                mimeType: $mimeType,
                modality: $modality,
                patientContext: $patientContext
            ),
            default => $this->analyzeWithOllama(
                imagePath: $imagePath,
                modality: $modality,
                patientContext: $patientContext
            ),
        };
    }

    private function analyzeWithOllama(
        string $imagePath,
        string $modality,
        string $patientContext
    ): JsonResponse {
        $baseUrl = rtrim((string) config('services.ai_imaging.ollama.base_url', 'http://127.0.0.1:11434'), '/');
        $model = trim((string) config('services.ai_imaging.ollama.model', 'llava:7b'));
        $timeout = (int) config('services.ai_imaging.timeout', 120);

        if ($baseUrl === '' || $model === '') {
            return $this->errorResponse(
                code: 'AI_NOT_CONFIGURED',
                message: 'Ollama imaging is not configured. Please set OLLAMA_BASE_URL and OLLAMA_MODEL.',
                details: null,
                httpCode: 503
            );
        }

        $binary = file_get_contents($imagePath);
        if ($binary === false) {
            return $this->errorResponse(
                code: 'FILE_READ_ERROR',
                message: 'Failed to read uploaded image.',
                details: null,
                httpCode: 400
            );
        }

        [$detections, $detectorWarning, $detectorModel] = $this->runDentalXrayAiDetector($imagePath, $timeout);

        $payload = $this->buildOllamaPayload(
            model: $model,
            modality: $modality,
            patientContext: $patientContext,
            detectorHint: $this->buildDetectorHint($detections),
            imageBinary: $binary
        );

        try {
            $response = Http::timeout($timeout)
                ->post("{$baseUrl}/api/chat", $payload)
                ->throw();
        } catch (ConnectionException $exception) {
            return $this->errorResponse(
                code: 'AI_CONNECTION_FAILED',
                message: 'Connection to Ollama failed. Make sure Ollama is running locally.',
                details: $exception->getMessage(),
                httpCode: 502
            );
        } catch (RequestException $exception) {
            return $this->errorResponse(
                code: 'AI_ANALYSIS_FAILED',
                message: 'Ollama analysis failed. Please try again.',
                details: $exception->response?->json() ?? $exception->response?->body(),
                httpCode: $exception->response?->status() ?? 500
            );
        } catch (\Throwable $exception) {
            return $this->errorResponse(
                code: 'AI_ANALYSIS_FAILED',
                message: 'Unexpected Ollama imaging error.',
                details: $exception->getMessage(),
                httpCode: 500
            );
        }

        $responseData = $response->json() ?? [];
        $outputText = trim((string) data_get($responseData, 'message.content', ''));
        $report = $this->parseStructuredReport($outputText);

        $responsePayload = [
            'disclaimer' => 'AI-generated preliminary interpretation only. Must be reviewed by a licensed dentist/radiologist.',
            'model' => (string) data_get($responseData, 'model', $model),
            'modality' => $modality,
            'provider' => $detections !== [] ? 'ollama+dentalxrayai' : 'ollama',
            'rawText' => $outputText,
            'report' => $report,
        ];

        if ($detections !== []) {
            $responsePayload['detections'] = $detections;
        }
        if ($detectorWarning !== null) {
            $responsePayload['detectorWarning'] = $detectorWarning;
        }
        if ($detectorModel !== null) {
            $responsePayload['detectorModel'] = $detectorModel;
        }

        return $this->successResponse(
            data: $responsePayload,
            message: 'AI imaging report generated successfully.'
        );
    }

    private function analyzeWithOpenAi(
        string $imagePath,
        string $mimeType,
        string $modality,
        string $patientContext
    ): JsonResponse {
        $openAiKey = (string) config('services.openai.api_key');
        $model = (string) config('services.openai.model', 'gpt-4.1-mini');

        if ($openAiKey === '') {
            return $this->errorResponse(
                code: 'AI_NOT_CONFIGURED',
                message: 'AI imaging is not configured. Please set OPENAI_API_KEY on backend.',
                details: null,
                httpCode: 503
            );
        }

        $binary = file_get_contents($imagePath);
        if ($binary === false) {
            return $this->errorResponse(
                code: 'FILE_READ_ERROR',
                message: 'Failed to read uploaded image.',
                details: null,
                httpCode: 400
            );
        }

        $imageDataUrl = sprintf('data:%s;base64,%s', $mimeType, base64_encode($binary));
        $payload = $this->buildOpenAiPayload($model, $modality, $patientContext, $imageDataUrl);
        $httpOptions = $this->openAiHttpOptions();

        try {
            $response = Http::withOptions($httpOptions)
                ->withToken($openAiKey)
                ->post('https://api.openai.com/v1/responses', $payload)
                ->throw();
        } catch (ConnectionException $exception) {
            return $this->errorResponse(
                code: 'AI_CONNECTION_FAILED',
                message: 'Connection to AI service failed. Check SSL settings or network connectivity.',
                details: $exception->getMessage(),
                httpCode: 502
            );
        } catch (RequestException $exception) {
            return $this->errorResponse(
                code: 'AI_ANALYSIS_FAILED',
                message: 'AI analysis failed. Please try again.',
                details: $exception->response?->json(),
                httpCode: $exception->response?->status() ?? 500
            );
        } catch (\Throwable $exception) {
            return $this->errorResponse(
                code: 'AI_ANALYSIS_FAILED',
                message: 'Unexpected AI imaging error.',
                details: $exception->getMessage(),
                httpCode: 500
            );
        }

        $responseData = $response->json() ?? [];
        $outputText = $this->extractOutputText($responseData);
        $report = $this->parseStructuredReport($outputText);

        return $this->successResponse(
            data: [
                'disclaimer' => 'AI-generated preliminary interpretation only. Must be reviewed by a licensed dentist/radiologist.',
                'model' => $model,
                'modality' => $modality,
                'provider' => 'openai',
                'rawText' => $outputText,
                'report' => $report,
            ],
            message: 'AI imaging report generated successfully.'
        );
    }

    private function runDentalXrayAiDetector(string $imagePath, int $timeout): array
    {
        $enabled = (bool) config('services.ai_imaging.dentalxrayai.enabled', false);
        if (!$enabled) {
            return [[], null, null];
        }

        $repoPath = trim((string) config('services.ai_imaging.dentalxrayai.repo_path', ''));
        $scriptPath = trim((string) config('services.ai_imaging.dentalxrayai.script_path', ''));
        $modelPath = trim((string) config('services.ai_imaging.dentalxrayai.model_path', ''));
        $detectorModel = basename($modelPath);

        if (
            $repoPath === '' ||
            $scriptPath === '' ||
            $modelPath === '' ||
            !is_dir($repoPath) ||
            !file_exists($scriptPath) ||
            !file_exists($modelPath)
        ) {
            return [[], 'DentalXrayAI detector is enabled but paths are not configured correctly.', $detectorModel];
        }

        $pythonCommand = $this->resolvePythonCommand();
        $process = new Process(
            [...$pythonCommand, $scriptPath, '--image', $imagePath, '--model', $modelPath],
            $repoPath
        );
        $process->setTimeout($timeout);

        try {
            $process->mustRun();
        } catch (\Throwable $exception) {
            $stderr = trim($process->getErrorOutput());
            $stdout = trim($process->getOutput());
            $errorMessage = $stderr !== '' ? $stderr : ($stdout !== '' ? $stdout : $exception->getMessage());

            return [[], 'DentalXrayAI detector failed: '.$errorMessage, $detectorModel];
        }

        $decoded = json_decode(trim($process->getOutput()), true);
        if (!is_array($decoded)) {
            return [[], 'DentalXrayAI detector returned invalid JSON.', $detectorModel];
        }

        return [$this->normalizeDetections($decoded['detections'] ?? []), null, $detectorModel];
    }

    private function normalizeDetections(mixed $value): array
    {
        if (!is_array($value)) {
            return [];
        }

        $normalized = [];
        foreach ($value as $item) {
            if (!is_array($item)) {
                continue;
            }

            $label = trim((string) ($item['label'] ?? ''));
            if ($label === '') {
                continue;
            }

            $normalized[] = [
                'confidence' => (float) ($item['confidence'] ?? 0),
                'label' => $label,
                'x1' => (int) ($item['x1'] ?? 0),
                'x2' => (int) ($item['x2'] ?? 0),
                'y1' => (int) ($item['y1'] ?? 0),
                'y2' => (int) ($item['y2'] ?? 0),
            ];
        }

        return $normalized;
    }

    private function buildDetectorHint(array $detections): string
    {
        if ($detections === []) {
            return '';
        }

        $counts = [];
        $confidenceTotals = [];

        foreach ($detections as $detection) {
            $label = (string) $detection['label'];
            $confidence = (float) $detection['confidence'];
            $counts[$label] = ($counts[$label] ?? 0) + 1;
            $confidenceTotals[$label] = ($confidenceTotals[$label] ?? 0.0) + $confidence;
        }

        arsort($counts);
        $parts = [];
        foreach ($counts as $label => $count) {
            $avgConfidence = (int) round((($confidenceTotals[$label] ?? 0.0) / max($count, 1)) * 100);
            $parts[] = "{$label} x{$count} (~{$avgConfidence}%)";
        }

        return implode('; ', $parts);
    }

    private function buildOllamaPayload(
        string $model,
        string $modality,
        string $patientContext,
        string $detectorHint,
        string $imageBinary
    ): array {
        $context = trim($patientContext) !== ''
            ? "Additional clinical context: {$patientContext}"
            : 'Additional clinical context: none provided.';

        $detectorContext = $detectorHint !== ''
            ? "Detector findings (DentalXrayAI): {$detectorHint}. Use this as supportive evidence and state uncertainty."
            : 'Detector findings (DentalXrayAI): none available.';

        $imageBase64 = base64_encode($imageBinary);

        return [
            'model' => $model,
            'stream' => false,
            'format' => 'json',
            'messages' => [
                [
                    'role' => 'system',
                    'content' => 'You are a dental imaging assistant. Produce a concise PRELIMINARY, non-diagnostic report for clinicians only.',
                ],
                [
                    'role' => 'user',
                    'content' => "Modality: {$modality}\n{$context}\n{$detectorContext}\n\nReturn JSON only with keys: summary (string), findings (string[]), concerns (string[]), recommendations (string[]), urgency (low|moderate|high), confidence (number 0-100), disclaimer (string).",
                    'images' => [$imageBase64],
                ],
            ],
            'options' => [
                'temperature' => 0.2,
            ],
        ];
    }

    private function buildOpenAiPayload(
        string $model,
        string $modality,
        string $patientContext,
        string $imageDataUrl
    ): array {
        $context = trim($patientContext) !== ''
            ? "Additional clinical context: {$patientContext}"
            : 'Additional clinical context: none provided.';

        return [
            'model' => $model,
            'input' => [
                [
                    'role' => 'system',
                    'content' => [
                        [
                            'type' => 'input_text',
                            'text' => 'You are a dental imaging assistant. Produce a concise PRELIMINARY, non-diagnostic report for clinicians only.',
                        ],
                    ],
                ],
                [
                    'role' => 'user',
                    'content' => [
                        [
                            'type' => 'input_text',
                            'text' => "Modality: {$modality}\n{$context}\n\nReturn JSON only with keys: summary (string), findings (string[]), concerns (string[]), recommendations (string[]), urgency (low|moderate|high), confidence (number 0-100), disclaimer (string).",
                        ],
                        [
                            'type' => 'input_image',
                            'image_url' => $imageDataUrl,
                        ],
                    ],
                ],
            ],
            'max_output_tokens' => 1200,
        ];
    }

    private function extractOutputText(array $data): string
    {
        $outputText = $data['output_text'] ?? null;

        if (is_string($outputText)) {
            return trim($outputText);
        }

        if (is_array($outputText)) {
            return trim(implode("\n", array_map(fn ($item): string => is_string($item) ? $item : '', $outputText)));
        }

        $chunks = [];
        $outputItems = $data['output'] ?? [];

        if (is_array($outputItems)) {
            foreach ($outputItems as $outputItem) {
                if (!is_array($outputItem)) {
                    continue;
                }

                $contentItems = $outputItem['content'] ?? [];
                if (!is_array($contentItems)) {
                    continue;
                }

                foreach ($contentItems as $contentItem) {
                    if (!is_array($contentItem)) {
                        continue;
                    }

                    $text = $contentItem['text'] ?? null;
                    if (is_string($text) && $text !== '') {
                        $chunks[] = $text;
                    }
                }
            }
        }

        return trim(implode("\n", $chunks));
    }

    private function parseStructuredReport(string $outputText): array
    {
        $normalized = trim($outputText);

        if (str_starts_with($normalized, '```')) {
            $normalized = preg_replace('/^```[a-zA-Z]*\s*/', '', $normalized) ?? $normalized;
            $normalized = preg_replace('/```$/', '', $normalized) ?? $normalized;
            $normalized = trim($normalized);
        }

        $decoded = json_decode($normalized, true);
        if (!is_array($decoded)) {
            return [
                'confidence' => 0,
                'concerns' => [],
                'disclaimer' => 'AI-generated preliminary interpretation only. Clinical confirmation required.',
                'findings' => [],
                'recommendations' => [],
                'summary' => $outputText !== '' ? $outputText : 'No report content returned.',
                'urgency' => 'moderate',
            ];
        }

        return [
            'confidence' => (int) ($decoded['confidence'] ?? 0),
            'concerns' => array_values(array_filter((array) ($decoded['concerns'] ?? []), fn ($value): bool => is_string($value))),
            'disclaimer' => (string) ($decoded['disclaimer'] ?? 'AI-generated preliminary interpretation only. Clinical confirmation required.'),
            'findings' => array_values(array_filter((array) ($decoded['findings'] ?? []), fn ($value): bool => is_string($value))),
            'recommendations' => array_values(array_filter((array) ($decoded['recommendations'] ?? []), fn ($value): bool => is_string($value))),
            'summary' => (string) ($decoded['summary'] ?? ''),
            'urgency' => (string) ($decoded['urgency'] ?? 'moderate'),
        ];
    }

    private function openAiHttpOptions(): array
    {
        $caBundle = trim((string) config('services.openai.ca_bundle', ''));
        $verifySsl = (bool) config('services.openai.verify_ssl', true);
        $timeout = (int) config('services.ai_imaging.timeout', 120);

        $options = [
            'timeout' => $timeout,
            'verify' => $verifySsl,
        ];

        if ($caBundle !== '') {
            $options['verify'] = $caBundle;
        }

        return $options;
    }

    private function resolvePythonCommand(): array
    {
        $configured = trim((string) config('services.ai_imaging.dentalxrayai.python_bin', 'python'));
        $candidates = [];

        if ($configured !== '') {
            $candidates[] = $this->splitCommand($configured);
        }

        $candidates[] = ['python'];
        $candidates[] = ['python3'];
        $candidates[] = ['py', '-3'];
        $candidates[] = ['py'];

        foreach ($this->windowsPythonExecutables() as $pythonExe) {
            $candidates[] = [$pythonExe];
        }

        $seen = [];
        $uniqueCandidates = [];
        foreach ($candidates as $candidate) {
            if ($candidate === []) {
                continue;
            }
            $key = implode("\0", $candidate);
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $uniqueCandidates[] = $candidate;
        }

        foreach ($uniqueCandidates as $candidate) {
            $probe = new Process([...$candidate, '--version']);
            $probe->setTimeout(8);
            $probe->run();
            if ($probe->isSuccessful()) {
                return $candidate;
            }
        }

        return $uniqueCandidates[0] ?? ['python'];
    }

    private function splitCommand(string $command): array
    {
        $trimmed = trim($command, " \t\n\r\0\x0B\"'");
        if ($trimmed === '') {
            return [];
        }

        if (file_exists($trimmed)) {
            return [$trimmed];
        }

        return preg_split('/\s+/', $trimmed, -1, PREG_SPLIT_NO_EMPTY) ?: [$trimmed];
    }

    private function windowsPythonExecutables(): array
    {
        if (DIRECTORY_SEPARATOR !== '\\') {
            return [];
        }

        $candidates = [];
        $roots = array_filter([
            getenv('LOCALAPPDATA') ? rtrim((string) getenv('LOCALAPPDATA'), '\\/').DIRECTORY_SEPARATOR.'Programs'.DIRECTORY_SEPARATOR.'Python' : null,
            'C:\\Python39',
            'C:\\Python310',
            'C:\\Python311',
            'C:\\Python312',
            'C:\\Python313',
            'C:\\Python314',
            'C:\\Program Files\\Python39',
            'C:\\Program Files\\Python310',
            'C:\\Program Files\\Python311',
            'C:\\Program Files\\Python312',
            'C:\\Program Files\\Python313',
            'C:\\Program Files\\Python314',
        ]);

        foreach ($roots as $root) {
            $direct = rtrim($root, '\\/').DIRECTORY_SEPARATOR.'python.exe';
            if (file_exists($direct)) {
                $candidates[] = $direct;
            }

            $pattern = rtrim($root, '\\/').DIRECTORY_SEPARATOR.'Python*'.DIRECTORY_SEPARATOR.'python.exe';
            $matches = glob($pattern) ?: [];
            foreach ($matches as $match) {
                if (file_exists($match)) {
                    $candidates[] = $match;
                }
            }
        }

        return array_values(array_unique($candidates));
    }
}
