<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'openai' => [
        'api_key' => env('OPENAI_API_KEY', ''),
        'model' => env('OPENAI_MODEL', 'gpt-4.1-mini'),
        'verify_ssl' => filter_var(env('OPENAI_VERIFY_SSL', true), FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE) ?? true,
        'ca_bundle' => env('OPENAI_CA_BUNDLE', ''),
    ],

    'ai_imaging' => [
        'provider' => env('AI_IMAGING_PROVIDER', 'ollama'),
        'timeout' => (int) env('AI_IMAGING_TIMEOUT', 120),
        'ollama' => [
            'base_url' => env('OLLAMA_BASE_URL', 'http://127.0.0.1:11434'),
            'model' => env('OLLAMA_MODEL', 'llava:7b'),
        ],
        'dentalxrayai' => [
            'enabled' => filter_var(env('AI_IMAGING_USE_DENTALXRAYAI', false), FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE) ?? false,
            'python_bin' => env('DENTALXRAYAI_PYTHON', 'python'),
            'repo_path' => env('DENTALXRAYAI_REPO_PATH', base_path('../third_party/DentalXrayAI')),
            'script_path' => env('DENTALXRAYAI_SCRIPT_PATH', base_path('scripts/dentalxrayai_detect.py')),
            'model_path' => env('DENTALXRAYAI_MODEL_PATH', base_path('../third_party/DentalXrayAI/best.pt')),
        ],
    ],

];
