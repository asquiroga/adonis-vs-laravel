import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import Patient from '#models/patient'

export default class Visit extends BaseModel {
  @column({ isPrimary: true }) declare id: number
  @column({ columnName: 'patient_id' }) declare patientId: number
  @column.dateTime({ columnName: 'visited_at' }) declare visitedAt: DateTime
  @column() declare type: 'consultation' | 'follow_up' | 'emergency' | 'telemedicine'
  @column() declare notes: string | null
  @column.dateTime({ autoCreate: true, columnName: 'created_at' }) declare createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime
  @belongsTo(() => Patient) declare patient: BelongsTo<typeof Patient>
}
