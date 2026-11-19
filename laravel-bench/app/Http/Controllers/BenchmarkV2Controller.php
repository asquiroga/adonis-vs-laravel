<?php

namespace App\Http\Controllers;

use App\Models\Appointment;
use App\Models\BenchmarkUser;
use App\Models\Patient;
use App\Models\Visit;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class BenchmarkV2Controller extends Controller
{
    private const PER_PAGE = 50;

    public function health(): JsonResponse
    {
        return response()->json(['service' => 'medihome-benchmark', 'status' => 'ok', 'version' => 2]);
    }

    public function patients(Request $request): JsonResponse
    {
        $validator = Validator::make($request->query(), [
            'page' => ['sometimes', 'integer', 'min:1', 'max:2000'],
            'search' => ['sometimes', 'string', 'max:80'],
        ]);
        if ($validator->fails()) {
            return $this->validationError($validator->errors()->toArray());
        }

        $page = (int) $request->query('page', 1);
        $search = trim((string) $request->query('search', ''));
        $user = $this->user($request);
        $query = Patient::query();

        if ($user->role === 'doctor') {
            $query->whereIn('patients.id', DB::table('doctor_patients')->select('patient_id')->where('doctor_id', $user->doctor->id));
        }

        if ($search !== '') {
            $prefix = mb_strtolower($search).'%';
            $query->where(function (Builder $builder) use ($search, $prefix): void {
                $builder->where('document', $search)
                    ->orWhereRaw('lower(last_name) LIKE ?', [$prefix])
                    ->orWhereRaw('lower(first_name) LIKE ?', [$prefix]);
            });
        }

        $total = (clone $query)->count();
        $patients = $query
            ->select(['id', 'external_id', 'document', 'first_name', 'last_name', 'birth_date', 'email', 'phone', 'created_at', 'updated_at'])
            ->orderBy('id')
            ->offset(($page - 1) * self::PER_PAGE)
            ->limit(self::PER_PAGE)
            ->get()
            ->map(fn (Patient $patient): array => $this->patientData($patient));

        return response()->json(['data' => $patients, 'meta' => ['page' => $page, 'per_page' => self::PER_PAGE, 'total' => $total]]);
    }

    public function patient(Request $request, int $id): JsonResponse
    {
        $patient = Patient::query()->find($id);
        if (! $patient) {
            return $this->notFound('Patient');
        }
        if (! $this->canAccessPatient($this->user($request), $id)) {
            return $this->forbidden();
        }

        $visits = Visit::query()
            ->where('patient_id', $patient->id)
            ->orderByDesc('visited_at')
            ->orderByDesc('id')
            ->limit(10)
            ->get()
            ->map(fn (Visit $visit): array => $this->visitData($visit));

        return response()->json(['data' => [...$this->patientData($patient), 'visits' => $visits]]);
    }

    public function visit(Request $request, int $id): JsonResponse
    {
        $visit = Visit::query()->find($id);
        if (! $visit) {
            return $this->notFound('Visit');
        }
        if (! $this->canAccessPatient($this->user($request), $visit->patient_id)) {
            return $this->forbidden();
        }

        return response()->json(['data' => $this->visitData($visit)]);
    }

    public function agenda(Request $request): JsonResponse
    {
        $user = $this->user($request);
        $validator = Validator::make($request->query(), [
            'date' => ['required', 'date_format:Y-m-d'],
            'doctor_id' => ['sometimes', 'integer', 'min:1', 'max:100', Rule::exists('doctors', 'id')],
        ]);
        if ($validator->fails()) {
            return $this->validationError($validator->errors()->toArray());
        }

        $doctorId = $user->role === 'doctor' ? $user->doctor->id : (int) $request->query('doctor_id', 0);
        if ($doctorId === 0) {
            return $this->validationError(['doctor_id' => ['The doctor id field is required.']]);
        }
        if ($user->role === 'doctor' && (int) $request->query('doctor_id', $doctorId) !== $doctorId) {
            return $this->forbidden();
        }

        $from = CarbonImmutable::createFromFormat('!Y-m-d', (string) $request->query('date'), 'UTC');
        $appointments = Appointment::query()
            ->where('doctor_id', $doctorId)
            ->where('scheduled_at', '>=', $from)
            ->where('scheduled_at', '<', $from->addDay())
            ->orderBy('scheduled_at')
            ->orderBy('id')
            ->get()
            ->map(fn (Appointment $appointment): array => $this->appointmentData($appointment));

        return response()->json(['data' => $appointments, 'meta' => ['date' => $from->format('Y-m-d'), 'doctor_id' => $doctorId]]);
    }

    public function createVisit(Request $request): JsonResponse
    {
        $user = $this->user($request);
        if (! in_array($user->role, ['admin', 'doctor'], true)) {
            return $this->forbidden();
        }

        $validator = Validator::make($request->all(), [
            'patient_id' => ['bail', 'required', 'integer', 'min:1', 'max:100000', Rule::exists('patients', 'id')],
            'doctor_id' => ['sometimes', 'integer', 'min:1', 'max:100', Rule::exists('doctors', 'id')],
            'visited_at' => ['required', 'date_format:Y-m-d\TH:i:s.v\Z'],
            'type' => ['required', Rule::in(['consultation', 'follow_up', 'emergency', 'telemedicine'])],
            'notes' => ['present', 'nullable', 'string', 'max:1000'],
        ]);
        if ($validator->fails()) {
            return $this->validationError($validator->errors()->toArray());
        }

        $data = $validator->validated();
        $doctorId = $user->role === 'doctor' ? $user->doctor->id : (int) ($data['doctor_id'] ?? 0);
        if ($doctorId === 0) {
            return $this->validationError(['doctor_id' => ['The doctor id field is required.']]);
        }
        if (! $this->doctorHasPatient($doctorId, (int) $data['patient_id'])) {
            return $user->role === 'doctor' ? $this->forbidden() : $this->validationError(['patient_id' => ['Patient is not assigned to doctor.']]);
        }

        $visit = DB::transaction(fn (): Visit => Visit::query()->create([
            'patient_id' => $data['patient_id'],
            'doctor_id' => $doctorId,
            'visited_at' => CarbonImmutable::createFromFormat('Y-m-d\TH:i:s.v\Z', $data['visited_at'], 'UTC'),
            'type' => $data['type'],
            'notes' => $data['notes'],
        ]));

        return response()->json(['data' => $this->visitData($visit)], 201);
    }

    public function updatePatient(Request $request, int $id): JsonResponse
    {
        $user = $this->user($request);
        if (! in_array($user->role, ['admin', 'reception'], true)) {
            return $this->forbidden();
        }

        $patient = Patient::query()->find($id);
        if (! $patient) {
            return $this->notFound('Patient');
        }

        $validator = Validator::make($request->all(), [
            'phone' => ['required', 'string', 'max:30', 'regex:/^\+[0-9]{8,20}$/'],
        ]);
        if ($validator->fails()) {
            return $this->validationError($validator->errors()->toArray());
        }

        DB::transaction(function () use ($patient, $validator): void {
            $patient->update(['phone' => $validator->validated()['phone']]);
        });

        return response()->json(['data' => $this->patientData($patient->refresh())]);
    }

    public function createAppointment(Request $request): JsonResponse
    {
        $user = $this->user($request);
        if (! in_array($user->role, ['admin', 'reception'], true)) {
            return $this->forbidden();
        }

        $validator = Validator::make($request->all(), [
            'patient_id' => ['bail', 'required', 'integer', 'min:1', 'max:100000', Rule::exists('patients', 'id')],
            'doctor_id' => ['bail', 'required', 'integer', 'min:1', 'max:100', Rule::exists('doctors', 'id')],
            'scheduled_at' => ['required', 'date_format:Y-m-d\TH:i:s.v\Z'],
            'reason' => ['required', 'string', 'max:255'],
        ]);
        if ($validator->fails()) {
            return $this->validationError($validator->errors()->toArray());
        }

        $data = $validator->validated();
        if (! $this->doctorHasPatient((int) $data['doctor_id'], (int) $data['patient_id'])) {
            return $this->validationError(['patient_id' => ['Patient is not assigned to doctor.']]);
        }

        $appointment = DB::transaction(fn (): Appointment => Appointment::query()->create([
            'patient_id' => $data['patient_id'],
            'doctor_id' => $data['doctor_id'],
            'scheduled_at' => CarbonImmutable::createFromFormat('Y-m-d\TH:i:s.v\Z', $data['scheduled_at'], 'UTC'),
            'status' => 'scheduled',
            'reason' => $data['reason'],
        ]));

        return response()->json(['data' => $this->appointmentData($appointment)], 201);
    }

    private function user(Request $request): BenchmarkUser
    {
        return $request->attributes->get('benchmark_user');
    }

    private function canAccessPatient(BenchmarkUser $user, int $patientId): bool
    {
        return $user->role !== 'doctor' || $this->doctorHasPatient($user->doctor->id, $patientId);
    }

    private function doctorHasPatient(int $doctorId, int $patientId): bool
    {
        return DB::table('doctor_patients')->where('doctor_id', $doctorId)->where('patient_id', $patientId)->exists();
    }

    /**
     * @return array{id: int, external_id: string, document: string, first_name: string, last_name: string, birth_date: string, email: string, phone: string|null, created_at: string, updated_at: string}
     */
    private function patientData(Patient $patient): array
    {
        return [
            'id' => $patient->id,
            'external_id' => $patient->external_id,
            'document' => $patient->document,
            'first_name' => $patient->first_name,
            'last_name' => $patient->last_name,
            'birth_date' => $patient->birth_date->format('Y-m-d'),
            'email' => $patient->email,
            'phone' => $patient->phone,
            'created_at' => $this->date($patient->created_at),
            'updated_at' => $this->date($patient->updated_at),
        ];
    }

    /**
     * @return array{id: int, patient_id: int, doctor_id: int|null, visited_at: string, type: string, notes: string|null, created_at: string, updated_at: string}
     */
    private function visitData(Visit $visit): array
    {
        return [
            'id' => $visit->id,
            'patient_id' => $visit->patient_id,
            'doctor_id' => $visit->doctor_id,
            'visited_at' => $this->date($visit->visited_at),
            'type' => $visit->type,
            'notes' => $visit->notes,
            'created_at' => $this->date($visit->created_at),
            'updated_at' => $this->date($visit->updated_at),
        ];
    }

    /**
     * @return array{id: int, patient_id: int, doctor_id: int, scheduled_at: string, status: string, reason: string, created_at: string, updated_at: string}
     */
    private function appointmentData(Appointment $appointment): array
    {
        return [
            'id' => $appointment->id,
            'patient_id' => $appointment->patient_id,
            'doctor_id' => $appointment->doctor_id,
            'scheduled_at' => $this->date($appointment->scheduled_at),
            'status' => $appointment->status,
            'reason' => $appointment->reason,
            'created_at' => $this->date($appointment->created_at),
            'updated_at' => $this->date($appointment->updated_at),
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

    private function forbidden(): JsonResponse
    {
        return response()->json(['error' => ['code' => 'forbidden', 'message' => 'Insufficient permissions']], 403);
    }

    private function notFound(string $resource): JsonResponse
    {
        return response()->json(['error' => ['code' => 'not_found', 'message' => $resource.' not found']], 404);
    }
}
