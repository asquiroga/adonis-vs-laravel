import Patient from '#models/patient'
import Visit from '#models/visit'
import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'

const PER_PAGE = 50
const TYPES = new Set(['consultation', 'follow_up', 'emergency', 'telemedicine'])
const ISO_MILLIS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

export default class BenchmarkController {
  async json() {
    return { service: 'medihome-benchmark', status: 'ok', version: 1 }
  }

  async patients({ request, response }: HttpContext) {
    const page = Number(request.input('page', 1))
    if (!Number.isInteger(page) || page < 1 || page > 2000)
      return this.validation(response, ['page'])

    const patients = await Patient.query()
      .select([
        'id',
        'externalId',
        'firstName',
        'lastName',
        'birthDate',
        'email',
        'createdAt',
        'updatedAt',
      ])
      .orderBy('id', 'asc')
      .offset((page - 1) * PER_PAGE)
      .limit(PER_PAGE)

    return {
      data: patients.map((patient) => this.patientData(patient)),
      meta: { page, per_page: PER_PAGE, total: 100000 },
    }
  }

  async patient({ params, response }: HttpContext) {
    const patient = await Patient.find(params.id)
    if (!patient)
      return response
        .status(404)
        .send({ error: { code: 'not_found', message: 'Patient not found' } })

    const visits = await Visit.query()
      .where('patientId', patient.id)
      .orderBy('visitedAt', 'desc')
      .orderBy('id', 'desc')
      .limit(10)

    return {
      data: { ...this.patientData(patient), visits: visits.map((visit) => this.visitData(visit)) },
    }
  }

  async createVisit({ request, response }: HttpContext) {
    const body = request.only(['patient_id', 'visited_at', 'type', 'notes'])
    const fields: string[] = []
    const patientId = Number(body.patient_id)
    if (!Number.isInteger(patientId) || patientId < 1 || patientId > 100000)
      fields.push('patient_id')
    const parsed =
      typeof body.visited_at === 'string' && ISO_MILLIS.test(body.visited_at)
        ? DateTime.fromISO(body.visited_at, { zone: 'utc' })
        : DateTime.invalid('format')
    if (!parsed.isValid) fields.push('visited_at')
    if (typeof body.type !== 'string' || !TYPES.has(body.type)) fields.push('type')
    if (
      !Object.hasOwn(body, 'notes') ||
      (body.notes !== null && (typeof body.notes !== 'string' || body.notes.length > 1000))
    )
      fields.push('notes')
    if (!fields.includes('patient_id') && !(await Patient.find(patientId)))
      fields.push('patient_id')
    if (fields.length) return this.validation(response, fields)

    const visit = await db.transaction(async (trx) => {
      const model = new Visit()
      model.useTransaction(trx)
      model.patientId = patientId
      model.visitedAt = parsed
      model.type = body.type
      model.notes = body.notes
      await model.save()
      return model
    })
    return response.status(201).send({ data: this.visitData(visit) })
  }

  private patientData(patient: Patient) {
    return {
      id: Number(patient.id),
      external_id: patient.externalId,
      first_name: patient.firstName,
      last_name: patient.lastName,
      birth_date: patient.birthDate.toISODate(),
      email: patient.email,
      created_at: this.date(patient.createdAt),
      updated_at: this.date(patient.updatedAt),
    }
  }

  private visitData(visit: Visit) {
    return {
      id: Number(visit.id),
      patient_id: Number(visit.patientId),
      visited_at: this.date(visit.visitedAt),
      type: visit.type,
      notes: visit.notes,
      created_at: this.date(visit.createdAt),
      updated_at: this.date(visit.updatedAt),
    }
  }

  private date(value: DateTime) {
    return value.toUTC().toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
  }

  private validation(response: HttpContext['response'], fields: string[]) {
    return response.status(422).send({
      error: {
        code: 'validation_error',
        message: 'Invalid request',
        fields: [...new Set(fields)],
      },
    })
  }
}
