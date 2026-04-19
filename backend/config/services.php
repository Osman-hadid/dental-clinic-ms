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
        'provider' => env('AI_IMAGING_PROVIDER', 'dentalgemma'),
        'timeout' => (int) env('AI_IMAGING_TIMEOUT', 120),
        'gemini' => [
            'api_key' => env('GEMINI_API_KEY', ''),
            'model' => env('GEMINI_MODEL', 'gemini-2.0-flash'),
            'endpoint' => env('GEMINI_ENDPOINT', 'https://generativelanguage.googleapis.com/v1beta'),
            'verify_ssl' => filter_var(env('GEMINI_VERIFY_SSL', true), FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE) ?? true,
            'ca_bundle' => env('GEMINI_CA_BUNDLE', ''),
        ],
        'dentalgemma' => [
            'python_bin' => env('DENTALGEMMA_PYTHON', 'python'),
            'repo_path' => env('DENTALGEMMA_REPO_PATH', base_path()),
            'script_path' => env('DENTALGEMMA_SCRIPT_PATH', base_path('scripts/dentalgemma_analyze.py')),
            'model_path' => env('DENTALGEMMA_MODEL_PATH', base_path('../third_party/dentalgemma-1.5-4b-it')),
            'model_name' => env('DENTALGEMMA_MODEL_NAME', 'DentalGemma 1.5 4B IT'),
        ],
    ],

];
