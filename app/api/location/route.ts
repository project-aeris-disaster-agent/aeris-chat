export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getClientIP } from '@/lib/utils/anonymous-session'

const IP_LOCATION_ACCURACY_M = 25000

type IpLocationResult = {
  position: [number, number]
  accuracyM: number
  source: 'ip'
  label: string
  metadata: {
    clientIp?: string
    ipLocation: {
      provider: string
      city?: string
      region?: string
      country?: string
      countryCode?: string
      latitude: number
      longitude: number
    }
  }
}

async function fetchFromIpApi(ip: string): Promise<IpLocationResult | null> {
  try {
    const url = ip && ip !== 'unknown' ? `https://ipapi.co/${ip}/json/` : 'https://ipapi.co/json/'
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { 'User-Agent': 'AERIS-Chat/1.0' },
      signal: AbortSignal.timeout(6000),
    })
    if (!response.ok) return null

    const data = await response.json()
    const longitude = Number(data.longitude)
    const latitude = Number(data.latitude)
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null

    const label = [data.city, data.region, data.country_name].filter(Boolean).join(', ')
    return {
      position: [longitude, latitude],
      accuracyM: IP_LOCATION_ACCURACY_M,
      source: 'ip',
      label: label || 'Approximate IP location',
      metadata: {
        clientIp: typeof data.ip === 'string' ? data.ip : undefined,
        ipLocation: {
          provider: 'ipapi.co',
          city: data.city,
          region: data.region,
          country: data.country_name,
          countryCode: data.country_code,
          latitude,
          longitude,
        },
      },
    }
  } catch {
    return null
  }
}

async function fetchFromIpWhoIs(ip: string): Promise<IpLocationResult | null> {
  try {
    const url = ip && ip !== 'unknown' ? `https://ipwho.is/${ip}` : 'https://ipwho.is/'
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { 'User-Agent': 'AERIS-Chat/1.0' },
      signal: AbortSignal.timeout(6000),
    })
    if (!response.ok) return null

    const data = await response.json()
    const longitude = Number(data.longitude)
    const latitude = Number(data.latitude)
    if (!data.success || !Number.isFinite(longitude) || !Number.isFinite(latitude)) return null

    const label = [data.city, data.region, data.country].filter(Boolean).join(', ')
    return {
      position: [longitude, latitude],
      accuracyM: IP_LOCATION_ACCURACY_M,
      source: 'ip',
      label: label || 'Approximate IP location',
      metadata: {
        clientIp: typeof data.ip === 'string' ? data.ip : undefined,
        ipLocation: {
          provider: 'ipwho.is',
          city: data.city,
          region: data.region,
          country: data.country,
          countryCode: data.country_code,
          latitude,
          longitude,
        },
      },
    }
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const clientIp = getClientIP(request) ?? 'unknown'

  const result = (await fetchFromIpApi(clientIp)) ?? (await fetchFromIpWhoIs(clientIp))

  if (!result) {
    return NextResponse.json({ error: 'Unable to determine location from IP' }, { status: 503 })
  }

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'private, max-age=300',
    },
  })
}
