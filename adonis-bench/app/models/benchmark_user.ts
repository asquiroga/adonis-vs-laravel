import { BaseModel, column, hasOne } from '@adonisjs/lucid/orm'
import type { HasOne } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import Doctor from '#models/doctor'

export default class BenchmarkUser extends BaseModel {
  static table = 'benchmark_users'

  @column({ isPrimary: true }) declare id: number
  @column() declare email: string
  @column({ columnName: 'password_hash', serializeAs: null }) declare passwordHash: string
  @column() declare role: 'admin' | 'doctor' | 'reception'
  @column({ columnName: 'display_name' }) declare displayName: string
  @column.dateTime({ columnName: 'created_at' }) declare createdAt: DateTime
  @column.dateTime({ columnName: 'updated_at' }) declare updatedAt: DateTime
  @hasOne(() => Doctor, { foreignKey: 'userId' }) declare doctor: HasOne<typeof Doctor>
}
