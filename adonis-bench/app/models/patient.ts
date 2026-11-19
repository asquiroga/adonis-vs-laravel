import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import Visit from '#models/visit'

export default class Patient extends BaseModel {
  @column({ isPrimary: true }) declare id: number
  @column({ columnName: 'external_id' }) declare externalId: string
  @column({ columnName: 'first_name' }) declare firstName: string
  @column({ columnName: 'last_name' }) declare lastName: string
  @column.date({ columnName: 'birth_date' }) declare birthDate: DateTime
  @column() declare email: string
  @column.dateTime({ columnName: 'created_at' }) declare createdAt: DateTime
  @column.dateTime({ columnName: 'updated_at' }) declare updatedAt: DateTime
  @hasMany(() => Visit) declare visits: HasMany<typeof Visit>
}
