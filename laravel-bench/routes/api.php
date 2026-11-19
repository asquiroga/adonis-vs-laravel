<?php

use App\Http\Controllers\BenchmarkController;
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
