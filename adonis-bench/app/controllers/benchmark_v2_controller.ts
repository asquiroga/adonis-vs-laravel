import Appointment from '#models/appointment'
import Patient from '#models/patient'
import Visit from '#models/visit'
import type BenchmarkUser from '#models/benchmark_user'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

const PER_PAGE = 50
const TYPES = new Set(['consultation', 'follow_up', 'emergency', 'telemedicine'])
const ISO_MILLIS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

export default class BenchmarkV2Controller {
  health() {
    return { service: 'medihome-benchmark', status: 'ok', version: 2 }
  }

  async patients({ request, response, benchmarkUser }: HttpContext) {
    const pageInput = request.input('page', 1)
    const page = Number(pageInput)
    const searchInput = request.input('search', '')
    const fields: string[] = []
    if (!Number.isInteger(page) || page < 1 || page > 2000) fields.push('page')
    if (typeof searchInput !== 'string' || searchInput.length > 80) fields.push('search')
    if (fields.length) return this.validation(response, fields)

    const search = searchInput.trim()
    const query = Patient.query()
    if (benchmarkUser!.role === 'doctor') {
      query.whereIn(
        'patients.id',
        db
          .from('doctor_patients')
          .select('patient_id')
          .where('doctor_id', Number(benchmarkUser!.doctor.id))
      )
    }
    if (search !== '') {
      query.where((builder) => {
        builder
          .where('document', search)
          .orWhereRaw('lower(last_name) LIKE ?', [`${search.toLowerCase()}%`])
          .orWhereRaw('lower(first_name) LIKE ?', [`${search.toLowerCase()}%`])
      })
    }

    const count = await query.clone().count('* as total').firstOrFail()
    const patients = await query
      .select([
        'id',
        'externalId',
        'document',
        'firstName',
        'lastName',
        'birthDate',
        'email',
        'phone',
        'createdAt',
        'updatedAt',
      ])
      .orderBy('id', 'asc')
      .offset((page - 1) * PER_PAGE)
      .limit(PER_PAGE)

    return response.send({
      data: patients.map((patient) => this.patientData(patient)),
      meta: { page, per_page: PER_PAGE, total: Number(count.$extras.total) },
    })
  }

  async patient({ params, response, benchmarkUser }: HttpContext) {
    const patient = await Patient.find(params.id)
    if (!patient) return this.notFound(response, 'Patient')
    if (!(await this.canAccessPatient(benchmarkUser!, patient.id))) return this.forbidden(response)

    const visits = await Visit.query()
      .where('patientId', patient.id)
      .orderBy('visitedAt', 'desc')
      .orderBy('id', 'desc')
      .limit(10)
    return response.send({
      data: { ...this.patientData(patient), visits: visits.map((visit) => this.visitData(visit)) },
    })
  }

  async visit({ params, response, benchmarkUser }: HttpContext) {
    const visit = await Visit.find(params.id)
    if (!visit) return this.notFound(response, 'Visit')
    if (!(await this.canAccessPatient(benchmarkUser!, visit.patientId)))
      return this.forbidden(response)
    return response.send({ data: this.visitData(visit) })
  }

  async agenda({ request, response, benchmarkUser }: HttpContext) {
    const dateInput = request.input('date')
    const doctorInput = request.input('doctor_id')
    const fields: string[] = []
    const date =
      typeof dateInput === 'string' && DATE_ONLY.test(dateInput)
        ? DateTime.fromFormat(dateInput, 'yyyy-MM-dd', { zone: 'utc' })
        : DateTime.invalid('format')
    if (!date.isValid || date.toFormat('yyyy-MM-dd') !== dateInput) fields.push('date')
    if (
      doctorInput !== undefined &&
      (!Number.isInteger(Number(doctorInput)) ||
        Number(doctorInput) < 1 ||
        Number(doctorInput) > 150)
    )
      fields.push('doctor_id')
    if (fields.length) return this.validation(response, fields)

    const doctorId =
      benchmarkUser!.role === 'doctor' ? Number(benchmarkUser!.doctor.id) : Number(doctorInput || 0)
    if (doctorId === 0) return this.validation(response, ['doctor_id'])
    if (!(await this.doctorExists(doctorId))) return this.validation(response, ['doctor_id'])
    if (benchmarkUser!.role === 'doctor' && Number(doctorInput || doctorId) !== doctorId)
      return this.forbidden(response)

    const appointments = await Appointment.query()
      .where('doctorId', doctorId)
      .where('scheduledAt', '>=', date.toJSDate())
      .where('scheduledAt', '<', date.plus({ day: 1 }).toJSDate())
      .orderBy('scheduledAt', 'asc')
      .orderBy('id', 'asc')
    return response.send({
      data: appointments.map((appointment) => this.appointmentData(appointment)),
      meta: { date: date.toFormat('yyyy-MM-dd'), doctor_id: Number(doctorId) },
    })
  }

  async createVisit({ request, response, benchmarkUser }: HttpContext) {
    if (!['admin', 'doctor'].includes(benchmarkUser!.role)) return this.forbidden(response)

    const body = request.only(['patient_id', 'doctor_id', 'visited_at', 'type', 'notes'])
    const fields: string[] = []
    const patientId = Number(body.patient_id)
    if (!Number.isInteger(patientId) || patientId < 1 || patientId > 100000)
      fields.push('patient_id')
    const parsed = this.parseInstant(body.visited_at)
    if (!parsed.isValid) fields.push('visited_at')
    if (typeof body.type !== 'string' || !TYPES.has(body.type)) fields.push('type')
    if (
      !Object.hasOwn(body, 'notes') ||
      (body.notes !== null && (typeof body.notes !== 'string' || body.notes.length > 1000))
    )
      fields.push('notes')
    if (!fields.includes('patient_id') && !(await this.patientExists(patientId)))
      fields.push('patient_id')
    if (body.doctor_id !== undefined && !this.validDoctorId(body.doctor_id))
      fields.push('doctor_id')
    if (fields.length) return this.validation(response, fields)

    const doctorId =
      benchmarkUser!.role === 'doctor'
        ? Number(benchmarkUser!.doctor.id)
        : Number(body.doctor_id || 0)
    if (doctorId === 0 || (benchmarkUser!.role === 'admin' && !(await this.doctorExists(doctorId))))
      return this.validation(response, ['doctor_id'])
    if (!(await this.doctorHasPatient(doctorId, patientId))) {
      return benchmarkUser!.role === 'doctor'
        ? this.forbidden(response)
        : this.validation(response, ['patient_id'])
    }

    const visit = await db.transaction(async (trx) => {
      const model = new Visit()
      model.useTransaction(trx)
      model.patientId = patientId
      model.doctorId = doctorId
      model.visitedAt = parsed
      model.type = body.type
      model.notes = body.notes
      await model.save()
      return model
    })
    return response.status(201).send({ data: this.visitData(visit) })
  }

  async updatePatient({ request, params, response, benchmarkUser }: HttpContext) {
    if (!['admin', 'reception'].includes(benchmarkUser!.role)) return this.forbidden(response)
    const patient = await Patient.find(params.id)
    if (!patient) return this.notFound(response, 'Patient')
    const phone = request.input('phone')
    if (typeof phone !== 'string' || phone.length > 30 || !/^\+[0-9]{8,20}$/.test(phone))
      return this.validation(response, ['phone'])

    await db.transaction(async (trx) => {
      patient.useTransaction(trx)
      patient.phone = phone
      await patient.save()
    })
    await patient.refresh()
    return response.send({ data: this.patientData(patient) })
  }

  async createAppointment({ request, response, benchmarkUser }: HttpContext) {
    if (!['admin', 'reception'].includes(benchmarkUser!.role)) return this.forbidden(response)
    const body = request.only(['patient_id', 'doctor_id', 'scheduled_at', 'reason'])
    const patientId = Number(body.patient_id)
    const doctorId = Number(body.doctor_id)
    const parsed = this.parseInstant(body.scheduled_at)
    const fields: string[] = []
    if (!Number.isInteger(patientId) || patientId < 1 || patientId > 100000)
      fields.push('patient_id')
    if (!this.validDoctorId(body.doctor_id)) fields.push('doctor_id')
    if (!parsed.isValid) fields.push('scheduled_at')
    if (typeof body.reason !== 'string' || body.reason.length === 0 || body.reason.length > 255)
      fields.push('reason')
    if (!fields.includes('patient_id') && !(await this.patientExists(patientId)))
      fields.push('patient_id')
    if (!fields.includes('doctor_id') && !(await this.doctorExists(doctorId)))
      fields.push('doctor_id')
    if (fields.length) return this.validation(response, fields)
    if (!(await this.doctorHasPatient(doctorId, patientId)))
      return this.validation(response, ['patient_id'])

    const appointment = await db.transaction(async (trx) => {
      const model = new Appointment()
      model.useTransaction(trx)
      model.patientId = patientId
      model.doctorId = doctorId
      model.scheduledAt = parsed
      model.status = 'scheduled'
      model.reason = body.reason
      await model.save()
      return model
    })
    return response.status(201).send({ data: this.appointmentData(appointment) })
  }

  private async canAccessPatient(user: BenchmarkUser, patientId: number) {
    return user.role !== 'doctor' || this.doctorHasPatient(Number(user.doctor.id), patientId)
  }

  private async doctorHasPatient(doctorId: number, patientId: number) {
    const result = await db.rawQuery(
      'select exists(select * from "doctor_patients" where "doctor_id" = ? and "patient_id" = ?) as "exists"',
      [doctorId, patientId]
    )
    return Boolean(result.rows[0]?.exists)
  }

  private async doctorExists(doctorId: number) {
    const result = await db.from('doctors').where('id', doctorId).count('* as aggregate').first()
    return Number(result?.aggregate || 0) > 0
  }

  private async patientExists(patientId: number) {
    const result = await db.from('patients').where('id', patientId).count('* as aggregate').first()
    return Number(result?.aggregate || 0) > 0
  }

  private validDoctorId(input: unknown) {
    const id = Number(input)
    return Number.isInteger(id) && id >= 1 && id <= 150
  }

  private parseInstant(input: unknown) {
    return typeof input === 'string' && ISO_MILLIS.test(input)
      ? DateTime.fromISO(input, { zone: 'utc' })
      : DateTime.invalid('format')
  }

  private patientData(patient: Patient) {
    return {
      id: Number(patient.id),
      external_id: patient.externalId,
      document: patient.document,
      first_name: patient.firstName,
      last_name: patient.lastName,
      birth_date: patient.birthDate.toISODate(),
      email: patient.email,
      phone: patient.phone,
      created_at: this.date(patient.createdAt),
      updated_at: this.date(patient.updatedAt),
    }
  }

  private visitData(visit: Visit) {
    return {
      id: Number(visit.id),
      patient_id: Number(visit.patientId),
      doctor_id: visit.doctorId === null ? null : Number(visit.doctorId),
      visited_at: this.date(visit.visitedAt),
      type: visit.type,
      notes: visit.notes,
      created_at: this.date(visit.createdAt),
      updated_at: this.date(visit.updatedAt),
    }
  }

  private appointmentData(appointment: Appointment) {
    return {
      id: Number(appointment.id),
      patient_id: Number(appointment.patientId),
      doctor_id: Number(appointment.doctorId),
      scheduled_at: this.date(appointment.scheduledAt),
      status: appointment.status,
      reason: appointment.reason,
      created_at: this.date(appointment.createdAt),
      updated_at: this.date(appointment.updatedAt),
    }
  }

  private date(value: DateTime) {
    return value.toUTC().toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
  }

  private validation(response: HttpContext['response'], fields: string[]) {
    return response.status(422).send({
      error: { code: 'validation_error', message: 'Invalid request', fields: [...new Set(fields)] },
    })
  }

  private forbidden(response: HttpContext['response']) {
    return response
      .status(403)
      .send({ error: { code: 'forbidden', message: 'Insufficient permissions' } })
  }

  private notFound(response: HttpContext['response'], resource: string) {
    return response
      .status(404)
      .send({ error: { code: 'not_found', message: `${resource} not found` } })
  }
}
