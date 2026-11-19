<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Appointment extends Model
{
    protected $dateFormat = 'Y-m-d H:i:s.v';

    protected $fillable = ['patient_id', 'doctor_id', 'scheduled_at', 'status', 'reason'];

    protected function casts(): array
    {
        return [
            'scheduled_at' => 'immutable_datetime',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
        ];
    }
}
