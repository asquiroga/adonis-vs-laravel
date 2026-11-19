<?php

use App\Http\Controllers\BenchmarkAuthController;
use App\Http\Controllers\BenchmarkController;
use App\Http\Controllers\BenchmarkV2Controller;
use Illuminate\Support\Facades\Route;

Route::prefix('bench')->group(function (): void {
    Route::get('json', [BenchmarkController::class, 'json']);
    Route::get('patients', [BenchmarkController::class, 'patients']);
    Route::get('patients/{id}', [BenchmarkController::class, 'patient'])->whereNumber('id');
    Route::post('visits', [BenchmarkController::class, 'createVisit']);
});

Route::prefix('bench-auth')->group(function (): void {
    Route::get('json', [BenchmarkController::class, 'json'])->middleware('bench.token:read');
    Route::get('patients', [BenchmarkController::class, 'patients'])->middleware('bench.token:read');
    Route::get('patients/{id}', [BenchmarkController::class, 'patient'])->whereNumber('id')->middleware('bench.token:read');
    Route::post('visits', [BenchmarkController::class, 'createVisit'])->middleware('bench.token:write');
});

Route::prefix('bench-v2')->group(function (): void {
    Route::get('health', [BenchmarkV2Controller::class, 'health']);
    Route::post('auth/login', [BenchmarkAuthController::class, 'login']);

    Route::middleware('bench.session')->group(function (): void {
        Route::get('auth/me', [BenchmarkAuthController::class, 'me']);
        Route::post('auth/logout', [BenchmarkAuthController::class, 'logout']);
        Route::get('patients', [BenchmarkV2Controller::class, 'patients']);
        Route::get('patients/{id}', [BenchmarkV2Controller::class, 'patient'])->whereNumber('id');
        Route::patch('patients/{id}', [BenchmarkV2Controller::class, 'updatePatient'])->whereNumber('id');
        Route::get('visits/{id}', [BenchmarkV2Controller::class, 'visit'])->whereNumber('id');
        Route::post('visits', [BenchmarkV2Controller::class, 'createVisit']);
        Route::get('agenda', [BenchmarkV2Controller::class, 'agenda']);
        Route::post('appointments', [BenchmarkV2Controller::class, 'createAppointment']);
    });
});
