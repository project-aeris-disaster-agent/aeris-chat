export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AUTH_DISABLED } from '@/lib/config'
import { getClientIP } from '@/lib/utils/anonymous-session'
import {
  BASE_MAINNET_CHAIN_ID,
  BASE_MAINNET_NETWORK,
  createReportMessageId,
} from '@/lib/reports/onchain'

const PH_BBOX = [116.0, 4.5, 127.0, 21.5] as const
const ALLOWED_CATEGORIES = new Set([
  'flood',
  'landslide',
  'stranded',
  'SOS',
  'infra_damage',
  'power_out',
  'road_closed',
])

const REPORT_SELECT =
  'id, report_message_id, source_app, source_channel, category, description, longitude, latitude, location_accuracy_m, photo_url, confidence, verification_status, moderation_status, confirmations, phone_verification_status, proxy_wallet_id, proxy_wallet_address, onchain_network, onchain_chain_id, onchain_mint_status, onchain_tx_hash, onchain_token_id, onchain_minted_at, created_at'

const LEGACY_REPORT_SELECT =
  'id, source_app, source_channel, category, description, longitude, latitude, location_accuracy_m, photo_url, confidence, verification_status, moderation_status, confirmations, metadata, created_at'

type ServiceClient = NonNullable<Awaited<ReturnType<typeof getServiceClient>>>

export async function GET(request: NextRequest) {
  try {
    const anonymousId = request.nextUrl.searchParams.get('anonymousId') ?? undefined
    const context = await getReportContext(request, anonymousId)
    if ('response' in context) return context.response

    const { data, error } = await listOwnedReports(context, REPORT_SELECT)
    if (error && isMissingOnchainSchema(error)) {
      const legacy = await listOwnedReports(context, LEGACY_REPORT_SELECT)
      if (legacy.error) return reportStorageError(legacy.error)

      return NextResponse.json({
        reports: (legacy.data ?? []).map(toPublicReport),
      })
    }
    if (error) return reportStorageError(error)

    return NextResponse.json({
      reports: (data ?? []).map(toPublicReport),
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const validated = validateReport(await request.json().catch(() => null))
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 })
    }

    const context = await getReportContext(request, validated.data.anonymousId)
    if ('response' in context) return context.response

    const serverObservedIp = getClientIP(request) ?? 'unknown'
    const ipHash = await hashIp(serverObservedIp)
    const [longitude, latitude] = validated.data.position
    const reportMessageId = createReportMessageId()

    const insertPayload = {
      report_message_id: reportMessageId,
      source_app: 'aeris-chat',
      source_channel: 'consumer_chat',
      category: validated.data.category,
      description: validated.data.description,
      longitude,
      latitude,
      location_accuracy_m: validated.data.locationAccuracyM ?? null,
      photo_url: validated.data.photoUrl ?? null,
      severity: validated.data.category === 'SOS' ? 'emergency' : 'info',
      confidence: context.userId ? 0.35 : 0.25,
      verification_status: 'unverified',
      phone_verification_status: 'unverified',
      moderation_status: 'visible',
      confirmations: 0,
      user_id: context.userId,
      anonymous_id: context.userId ? null : context.anonymousId,
      session_id: validated.data.sessionId ?? null,
      ip_hash: ipHash,
      onchain_network: BASE_MAINNET_NETWORK,
      onchain_chain_id: BASE_MAINNET_CHAIN_ID,
      onchain_mint_status: 'not_started',
      metadata: buildReportMetadata({
        reportMessageId,
        request,
        serverObservedIp,
        ipHash,
        clientMetadata: validated.data.metadata,
      }),
    }

    let result = await context.serviceClient
      .from('disaster_reports')
      .insert(insertPayload)
      .select(REPORT_SELECT)
      .single()

    if (result.error && isMissingOnchainSchema(result.error)) {
      result = await context.serviceClient
        .from('disaster_reports')
        .insert(toLegacyInsertPayload(insertPayload))
        .select(LEGACY_REPORT_SELECT)
        .single()
    }

    if (result.error) {
      return reportStorageError(result.error)
    }

    return NextResponse.json(
      {
        report: toPublicReport(result.data),
      },
      { status: 201 }
    )
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Body must be an object.' }, { status: 400 })
    }

    const value = body as Record<string, unknown>
    const reportId = typeof value.id === 'string' ? value.id : ''
    if (!reportId) {
      return NextResponse.json({ error: 'Report id is required.' }, { status: 400 })
    }

    const anonymousId = typeof value.anonymousId === 'string' ? value.anonymousId : undefined
    const context = await getReportContext(request, anonymousId)
    if ('response' in context) return context.response

    const { data: report, error: lookupError } = await context.serviceClient
      .from('disaster_reports')
      .select('id, user_id, anonymous_id')
      .eq('id', reportId)
      .eq('source_app', 'aeris-chat')
      .single()

    if (lookupError) {
      if (lookupError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Report not found.' }, { status: 404 })
      }
      return reportStorageError(lookupError)
    }

    const ownsReport = context.userId
      ? report.user_id === context.userId
      : report.anonymous_id === context.anonymousId

    if (!ownsReport) {
      return NextResponse.json({ error: 'You can only delete your own reports.' }, { status: 403 })
    }

    const { error } = await context.serviceClient
      .from('disaster_reports')
      .delete()
      .eq('id', reportId)

    if (error) return reportStorageError(error)

    return NextResponse.json({ deleted: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

type ValidReport = {
  category: string
  description: string
  position: [number, number]
  photoUrl?: string
  locationAccuracyM?: number
  anonymousId?: string
  sessionId?: string
  metadata?: Record<string, unknown>
}

type ReportContext =
  | {
      userId: string | null
      anonymousId: string
      serviceClient: ServiceClient
    }
  | { response: NextResponse }

async function getReportContext(
  request: NextRequest,
  anonymousId?: string
): Promise<ReportContext> {
  const supabase = await createClient()
  let userId: string | null = null

  if (!AUTH_DISABLED && supabase?.auth) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    userId = user?.id ?? null
  }

  if (!userId && !anonymousId) {
    return {
      response: NextResponse.json(
        { error: 'anonymousId is required for anonymous reports' },
        { status: 400 }
      ),
    }
  }

  const serviceClient = await getServiceClient()
  if (!serviceClient) {
    return {
      response: NextResponse.json(
        { error: 'Shared Supabase intake is not configured.' },
        { status: 500 }
      ),
    }
  }

  return {
    userId,
    anonymousId: anonymousId ?? '',
    serviceClient,
  }
}

async function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return null

  const { createClient: createServiceClient } = await import('@supabase/supabase-js')
  return createServiceClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

async function listOwnedReports(context: Exclude<ReportContext, { response: NextResponse }>, select: string) {
  const query = context.serviceClient
    .from('disaster_reports')
    .select(select)
    .eq('source_app', 'aeris-chat')
    .order('created_at', { ascending: false })
    .limit(100)

  if (context.userId) {
    query.eq('user_id', context.userId)
  } else {
    query.eq('anonymous_id', context.anonymousId)
  }

  return query
}

function buildReportMetadata({
  reportMessageId,
  request,
  serverObservedIp,
  ipHash,
  clientMetadata,
}: {
  reportMessageId: string
  request: NextRequest
  serverObservedIp: string
  ipHash: string
  clientMetadata?: Record<string, unknown>
}) {
  return {
    messageId: reportMessageId,
    userAgent: request.headers.get('user-agent'),
    ipAddress: serverObservedIp,
    ipHash,
    client: clientMetadata ?? null,
    onchain: {
      gasless: true,
      network: BASE_MAINNET_NETWORK,
      chainId: BASE_MAINNET_CHAIN_ID,
      mintAfter: 'phone_verification',
    },
  }
}

function toLegacyInsertPayload(payload: Record<string, unknown>) {
  const {
    report_message_id,
    phone_verification_status,
    proxy_wallet_id,
    proxy_wallet_address,
    onchain_network,
    onchain_chain_id,
    onchain_mint_status,
    onchain_tx_hash,
    onchain_token_id,
    onchain_minted_at,
    ...legacyPayload
  } = payload

  return legacyPayload
}

function toPublicReport(row: any) {
  const network = row.onchain_network ?? BASE_MAINNET_NETWORK
  const chainId = row.onchain_chain_id ?? BASE_MAINNET_CHAIN_ID
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
  const metadataOnchain = metadata.onchain && typeof metadata.onchain === 'object'
    ? metadata.onchain
    : {}
  const messageId = row.report_message_id ?? metadata.messageId ?? row.id

  return {
    id: row.id,
    messageId,
    category: row.category,
    description: row.description,
    position: [row.longitude, row.latitude],
    locationAccuracyM: row.location_accuracy_m ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    createdAt: row.created_at,
    confirmations: row.confirmations ?? 0,
    sourceApp: row.source_app,
    sourceChannel: row.source_channel,
    confidence: row.confidence,
    verificationStatus: row.verification_status,
    moderationStatus: row.moderation_status,
    onchain: {
      messageId,
      phoneVerificationStatus: row.phone_verification_status ?? 'unverified',
      proxyWallet: row.proxy_wallet_id || row.proxy_wallet_address
        ? {
            id: row.proxy_wallet_id ?? undefined,
            address: row.proxy_wallet_address ?? undefined,
            network,
            chainId,
          }
        : undefined,
      mint: {
        network: row.onchain_network ?? metadataOnchain.network ?? network,
        chainId: row.onchain_chain_id ?? metadataOnchain.chainId ?? chainId,
        status: row.onchain_mint_status ?? 'not_started',
        txHash: row.onchain_tx_hash ?? undefined,
        tokenId: row.onchain_token_id ?? undefined,
        mintedAt: row.onchain_minted_at ?? undefined,
      },
    },
  }
}

function isMissingOnchainSchema(error: { code?: string; message: string }) {
  return (
    error.code === 'PGRST204' ||
    /report_message_id|phone_verification_status|proxy_wallet|onchain_|schema cache/i.test(
      error.message
    )
  )
}

function reportStorageError(error: { code?: string; message: string }) {
  if (isMissingOnchainSchema(error)) {
    return NextResponse.json(
      { error: 'Report on-chain columns are missing. Apply the latest report Supabase migration.' },
      { status: 503 }
    )
  }

  if (
    error.code === '42P01' ||
    /disaster_reports|schema cache|does not exist/i.test(error.message)
  ) {
    return NextResponse.json(
      { error: 'Shared reports table is missing. Apply the disaster_reports Supabase migration.' },
      { status: 503 }
    )
  }

  return NextResponse.json({ error: error.message }, { status: 500 })
}

function validateReport(
  body: unknown
): { ok: true; data: ValidReport } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Body must be an object.' }
  }

  const value = body as Record<string, unknown>
  const category = String(value.category ?? '')
  if (!ALLOWED_CATEGORIES.has(category)) {
    return { ok: false, error: 'Invalid category.' }
  }

  const description = sanitizeText(String(value.description ?? ''))
  if (description.length < 3) {
    return { ok: false, error: 'Description too short.' }
  }

  const position = value.position
  if (
    !Array.isArray(position) ||
    position.length !== 2 ||
    !Number.isFinite(position[0]) ||
    !Number.isFinite(position[1])
  ) {
    return { ok: false, error: 'Invalid position.' }
  }

  const lng = Number(position[0])
  const lat = Number(position[1])
  if (lng < PH_BBOX[0] || lng > PH_BBOX[2] || lat < PH_BBOX[1] || lat > PH_BBOX[3]) {
    return { ok: false, error: 'Coordinates outside Philippines.' }
  }

  let photoUrl: string | undefined
  if (value.photoUrl) {
    const raw = String(value.photoUrl)
    if (!isSafeUrl(raw)) return { ok: false, error: 'Invalid photo URL.' }
    photoUrl = raw
  }

  const locationAccuracyM = Number(value.locationAccuracyM)
  return {
    ok: true,
    data: {
      category,
      description,
      position: [lng, lat],
      photoUrl,
      locationAccuracyM: Number.isFinite(locationAccuracyM) ? locationAccuracyM : undefined,
      anonymousId: typeof value.anonymousId === 'string' ? value.anonymousId : undefined,
      sessionId: typeof value.sessionId === 'string' ? value.sessionId : undefined,
      metadata: sanitizeMetadata(value.metadata),
    },
  }
}

function sanitizeText(raw: string, maxLen = 280): string {
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen)
}

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

function sanitizeMetadata(value: unknown): Record<string, unknown> | undefined {
  const sanitized = sanitizeJsonValue(value, 0)
  return sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized)
    ? (sanitized as Record<string, unknown>)
    : undefined
}

function sanitizeJsonValue(value: unknown, depth: number): unknown {
  if (depth > 4 || value == null) return undefined

  if (typeof value === 'string') return sanitizeText(value, 500)
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'boolean') return value

  if (Array.isArray(value)) {
    return value
      .slice(0, 20)
      .map((item) => sanitizeJsonValue(item, depth + 1))
      .filter((item) => item !== undefined)
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 30)
        .map(([key, item]) => [sanitizeText(key, 80), sanitizeJsonValue(item, depth + 1)])
        .filter(([key, item]) => key && item !== undefined)
    )
  }

  return undefined
}

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(`${ip}|aeris-chat-report-salt`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf).slice(0, 8))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
