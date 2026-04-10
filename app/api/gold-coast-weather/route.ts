import { NextResponse } from "next/server"

const GOLD_COAST_LATITUDE = -28.0167
const GOLD_COAST_LONGITUDE = 153.4

export async function GET() {
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${GOLD_COAST_LATITUDE}&longitude=${GOLD_COAST_LONGITUDE}&current=temperature_2m&timezone=Australia%2FBrisbane`,
      {
        cache: "no-store"
      }
    )

    if (!response.ok) {
      throw new Error("Failed to load Gold Coast weather")
    }

    const data: {
      current?: {
        temperature_2m?: number
      }
    } = await response.json()

    return NextResponse.json({
      temperatureC: data.current?.temperature_2m ?? null
    })
  } catch {
    return NextResponse.json(
      {
        temperatureC: null
      },
      { status: 200 }
    )
  }
}
