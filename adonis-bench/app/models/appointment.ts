import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class Appointment extends BaseModel {
  @column({ isPrimary: true }) declare id: number
  @column({ columnName: 'patient_id' }) declare patientId: number
  @column({ columnName: 'doctor_id' }) declare doctorId: number
  @column.dateTime({ columnName: 'scheduled_at' }) declare scheduledAt: DateTime
  @column() declare status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled'
  @column() declare reason: string
  @column.dateTime({ autoCreate: true, columnName: 'created_at' }) declare createdAt: DateTime
  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime
}
