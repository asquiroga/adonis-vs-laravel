<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;

class BenchmarkUser extends Model
{
    protected $table = 'benchmark_users';

    protected $fillable = ['email', 'password_hash', 'role', 'display_name'];

    protected $hidden = ['password_hash'];

    public function doctor(): HasOne
    {
        return $this->hasOne(Doctor::class, 'user_id');
    }
}
