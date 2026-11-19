import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import BenchmarkUser from '#models/benchmark_user'

export default class Doctor extends BaseModel {
  @column({ isPrimary: true }) declare id: number
  @column({ columnName: 'user_id' }) declare userId: number
  @column({ columnName: 'license_number' }) declare licenseNumber: string
  @column() declare specialty: string
  @column.dateTime({ columnName: 'created_at' }) declare createdAt: DateTime
  @column.dateTime({ columnName: 'updated_at' }) declare updatedAt: DateTime
  @belongsTo(() => BenchmarkUser) declare user: BelongsTo<typeof BenchmarkUser>
}
