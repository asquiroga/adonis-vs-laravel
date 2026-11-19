<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BenchmarkSession extends Model
{
    protected $table = 'benchmark_sessions';

    protected $primaryKey = 'token_hash';

    public $incrementing = false;

    public $timestamps = false;

    protected $keyType = 'string';

    protected $fillable = ['token_hash', 'user_id', 'csrf_token', 'expires_at', 'created_at', 'last_seen_at'];

    protected function casts(): array
    {
        return [
            'expires_at' => 'immutable_datetime',
            'created_at' => 'immutable_datetime',
            'last_seen_at' => 'immutable_datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(BenchmarkUser::class, 'user_id');
    }
}
