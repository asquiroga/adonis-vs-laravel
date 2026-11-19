<?php

namespace App\Http\Controllers;

use App\Models\Patient;
use App\Models\Visit;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class BenchmarkController extends Controller
{
    private const PER_PAGE = 50;

    public function json(): JsonResponse
    {
        return response()->json(['service' => 'medihome-benchmark', 'status' => 'ok', 'version' => 1]);
    }

    public function patients(Request $request): JsonResponse
    {
        $validator = Validator::make($request->query(), ['page' => ['sometimes', 'integer', 'min:1', 'max:2000']]);
        if ($validator->fails()) {
            return $this->validationError($validator->errors()->toArray());
        }

        $page = (int) $request->query('page', 1);
        $patients = Patient::query()
            ->select(['id', 'external_id', 'first_name', 'last_name', 'birth_date', 'email', 'created_at', 'updated_at'])
            ->orderBy('id')
            ->offset(($page - 1) * self::PER_PAGE)
            ->limit(self::PER_PAGE)
            ->get()
            ->map(fn (Patient $patient) => $this->patientData($patient));

        return response()->json(['data' => $patients, 'meta' => ['page' => $page, 'per_page' => self::PER_PAGE, 'total' => 100000]]);
    }

    public function patient(int $id): JsonResponse
    {
        $patient = Patient::query()->find($id);
        if (! $patient) {
            return response()->json(['error' => ['code' => 'not_found', 'message' => 'Patient not found']], 404);
        }

        $visits = Visit::query()
            ->where('patient_id', $patient->id)
            ->orderByDesc('visited_at')
            ->orderByDesc('id')
            ->limit(10)
            ->get()
            ->map(fn (Visit $visit) => $this->visitData($visit));

        return response()->json(['data' => [...$this->patientData($patient), 'visits' => $visits]]);
    }

    public function createVisit(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'patient_id' => ['bail', 'required', 'integer', 'min:1', 'max:100000', Rule::exists('patients', 'id')],
            'visited_at' => ['required', 'date_format:Y-m-d\TH:i:s.v\Z'],
            'type' => ['required', Rule::in(['consultation', 'follow_up', 'emergency', 'telemedicine'])],
            'notes' => ['present', 'nullable', 'string', 'max:1000'],
        ]);
        if ($validator->fails()) {
            return $this->validationError($validator->errors()->toArray());
        }

        $data = $validator->validated();
        $visit = DB::transaction(fn () => Visit::query()->create([
            'patient_id' => $data['patient_id'],
            'visited_at' => CarbonImmutable::createFromFormat('Y-m-d\TH:i:s.v\Z', $data['visited_at'], 'UTC'),
            'type' => $data['type'],
            'notes' => $data['notes'],
        ]));

        return response()->json(['data' => $this->visitData($visit)], 201);
    }

    /**
     * @return array{id: int, external_id: string, first_name: string, last_name: string, birth_date: string, email: string, created_at: string, updated_at: string}
     */
    private function patientData(Patient $patient): array
    {
        return [
            'id' => $patient->id,
            'external_id' => $patient->external_id,
            'first_name' => $patient->first_name,
            'last_name' => $patient->last_name,
            'birth_date' => $patient->birth_date->format('Y-m-d'),
            'email' => $patient->email,
            'created_at' => $this->date($patient->created_at),
            'updated_at' => $this->date($patient->updated_at),
        ];
    }

    /**
     * @return array{id: int, patient_id: int, visited_at: string, type: string, notes: string|null, created_at: string, updated_at: string}
     */
    private function visitData(Visit $visit): array
    {
        return [
            'id' => $visit->id,
            'patient_id' => $visit->patient_id,
            'visited_at' => $this->date($visit->visited_at),
            'type' => $visit->type,
            'notes' => $visit->notes,
            'created_at' => $this->date($visit->created_at),
            'updated_at' => $this->date($visit->updated_at),
        ];
    }

    private function date(CarbonInterface $date): string
    {
        return $date->utc()->format('Y-m-d\TH:i:s.v\Z');
    }

    /**
     * @param  array<string, array<int, string>>  $errors
     */
    private function validationError(array $errors): JsonResponse
    {
        return response()->json(['error' => ['code' => 'validation_error', 'message' => 'Invalid request', 'fields' => array_keys($errors)]], 422);
    }
}
