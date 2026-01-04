import { NextResponse } from 'next/server'

/**
 * POST /api/admin/verify
 * Verifies the admin passcode without exposing the env var to the client
 */
export async function POST(request: Request) {
  try {
    const { passcode } = await request.json()

    if (!passcode) {
      return NextResponse.json({ valid: false, error: 'Passcode required' }, { status: 400 })
    }

    const valid = passcode === process.env.ADMIN_PASSCODE

    return NextResponse.json({ valid })
  } catch {
    return NextResponse.json({ valid: false, error: 'Invalid request' }, { status: 400 })
  }
}
