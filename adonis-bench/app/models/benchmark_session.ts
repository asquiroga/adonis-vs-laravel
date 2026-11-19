import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import BenchmarkUser from '#models/benchmark_user'

export default class BenchmarkSession extends BaseModel {
  static table = 'benchmark_sessions'
  static primaryKey = 'tokenHash'
  static selfAssignPrimaryKey = true

  @column({ isPrimary: true, columnName: 'token_hash' }) declare tokenHash: string
  @column({ columnName: 'user_id' }) declare userId: number
  @column({ columnName: 'csrf_token' }) declare csrfToken: string
  @column.dateTime({ columnName: 'expires_at' }) declare expiresAt: DateTime
  @column.dateTime({ columnName: 'created_at' }) declare createdAt: DateTime
  @column.dateTime({ columnName: 'last_seen_at' }) declare lastSeenAt: DateTime
  @belongsTo(() => BenchmarkUser, { foreignKey: 'userId' })
  declare user: BelongsTo<typeof BenchmarkUser>
}
