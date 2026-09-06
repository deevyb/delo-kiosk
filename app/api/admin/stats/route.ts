import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { summarize, TimedOrderInput } from '@/lib/orderTiming'
import { utcRangeForLocalDay } from '@/lib/dateUtils'

// Disable caching for fresh stats on every request
export const dynamic = 'force-dynamic'

// Bounded queries only. The old select-everything shape silently truncated at
// PostgREST's 1,000-row default — timing math on a quietly truncated dataset
// produces confidently wrong numbers (spec, Build §3).
const ORDER_COLUMNS = 'id, item, modifiers, status, created_at, ready_at, claimed_by'
const ROW_CAP = 1000

/**
 * Fetch one local calendar day's orders (by UTC bounds), capped at ROW_CAP,
 * warning if the cap was hit — shared by the target-date fetch and the
 * previous-event lookback loop, which otherwise duplicated this exactly.
 */
async function fetchDayOrders(startIso: string, endIso: string, dayLabel: string) {
  const res = await supabase
    .from('orders')
    .select(ORDER_COLUMNS)
    .gte('created_at', startIso)
    .lt('created_at', endIso)
    .order('created_at', { ascending: true })
    .limit(ROW_CAP)
  if ((res.data?.length ?? 0) === ROW_CAP) {
    // Not an error the owner can act on, but the timing math below would be
    // computed on part of a day while looking like the whole of it.
    console.warn(
      'stats: day hit the 1000-row cap; timing may be computed on a truncated day',
      dayLabel
    )
  }
  return res
}

/**
 * GET /api/admin/stats
 * Returns dashboard statistics:
 * - Order counts (today + all-time) with status breakdown
 * - Popular drinks (top 20)
 * - Modifier preferences with percentages
 * - Wait timing for the selected event date, plus the previous event's p90
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const timezone = searchParams.get('timezone') || 'America/Los_Angeles'
    const dateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone })
    const today = dateFmt.format(new Date())
    const targetDate = searchParams.get('date') || today
    const isViewingToday = targetDate === today
    const { startIso, endIso } = utcRangeForLocalDay(targetDate, timezone)

    const STATUSES = ['placed', 'in_progress', 'ready', 'canceled'] as const
    /** How many prior days to walk back looking for a real previous event. */
    const PREVIOUS_EVENT_LOOKBACK_DAYS = 3

    const [targetRes, trendRes, ...countResults] = await Promise.all([
      fetchDayOrders(startIso, endIso, targetDate),
      // All-time trends when viewing today (existing quirk, deliberately kept —
      // backlog #9's business). Newest-first so an explicit cap keeps recent
      // events rather than the oldest.
      isViewingToday
        ? supabase
            .from('orders')
            .select('item, modifiers')
            .order('created_at', { ascending: false })
            .limit(5000)
        : Promise.resolve({ data: null, error: null }),
      ...STATUSES.map((status) =>
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('status', status)
          .lt('created_at', endIso)
      ),
    ])

    if (targetRes.error) throw targetRes.error
    if (trendRes.error) throw trendRes.error
    const targetDateOrders = targetRes.data || []

    const countByStatus = (orderList: { status: string }[]) => {
      return orderList.reduce(
        (acc, order) => {
          acc.total++
          if (order.status === 'placed') acc.placed++
          else if (order.status === 'in_progress') acc.in_progress++
          else if (order.status === 'ready') acc.ready++
          else if (order.status === 'canceled') acc.canceled++
          return acc
        },
        { total: 0, placed: 0, in_progress: 0, ready: 0, canceled: 0 }
      )
    }

    const allTime = { total: 0, placed: 0, in_progress: 0, ready: 0, canceled: 0 }
    STATUSES.forEach((status, i) => {
      const result = countResults[i]
      if (result.error) throw result.error
      allTime[status] = result.count ?? 0
    })
    allTime.total = allTime.placed + allTime.in_progress + allTime.ready + allTime.canceled

    const ordersForTrends = isViewingToday ? trendRes.data || [] : targetDateOrders

    // Popular drinks - group by item name, sort by count
    const drinkCounts: Record<string, number> = {}
    for (const order of ordersForTrends) {
      drinkCounts[order.item] = (drinkCounts[order.item] || 0) + 1
    }

    const popularDrinks = Object.entries(drinkCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)

    // Modifier breakdown - dynamic categories
    const modifierCounts: Record<string, Record<string, number>> = {}

    for (const order of ordersForTrends) {
      if (!order.modifiers) continue

      for (const [category, option] of Object.entries(order.modifiers)) {
        if (!option) continue

        if (!modifierCounts[category]) modifierCounts[category] = {}
        modifierCounts[category][option as string] =
          (modifierCounts[category][option as string] || 0) + 1
      }
    }

    const modifierBreakdown: Record<
      string,
      { option: string; count: number; percentage: number }[]
    > = {}

    for (const [category, options] of Object.entries(modifierCounts)) {
      const total = Object.values(options).reduce((a, b) => a + b, 0)

      modifierBreakdown[category] = Object.entries(options)
        .map(([option, count]) => ({
          option,
          count,
          percentage: Math.round((count / total) * 100),
        }))
        .sort((a, b) => b.count - a.count)
    }

    // Timing — always scoped to the single selected event date.
    const summary = summarize(targetDateOrders as TimedOrderInput[])
    let timing = null
    if (summary) {
      // Previous event, for the headline delta: the most recent order before
      // this day names the date; that day's own summary provides the p90.
      //
      // The probe only looks at orders that could be timed, and walks back a
      // few days rather than giving up on the first miss. One canceled test
      // order the morning after an event would otherwise name an empty day the
      // "previous event" and silently drop the delta from the headline.
      let previousEvent = null
      let searchBeforeIso = startIso
      for (let day = 0; day < PREVIOUS_EVENT_LOOKBACK_DAYS && !previousEvent; day++) {
        const probe = await supabase
          .from('orders')
          .select('created_at')
          .eq('status', 'ready')
          .not('ready_at', 'is', null)
          .lt('created_at', searchBeforeIso)
          .order('created_at', { ascending: false })
          .limit(1)
        const probeRow = probe.data?.[0]
        if (probe.error || !probeRow) break

        const prevDate = dateFmt.format(new Date(probeRow.created_at))
        const prevRange = utcRangeForLocalDay(prevDate, timezone)
        const prevRes = await fetchDayOrders(prevRange.startIso, prevRange.endIso, prevDate)
        if (prevRes.error) break
        const prevRows = prevRes.data || []

        const prevSummary = summarize(prevRows as TimedOrderInput[])
        if (prevSummary) previousEvent = { date: prevDate, p90Seconds: prevSummary.p90Seconds }
        // Too small to summarize: keep walking back from the start of that day.
        else searchBeforeIso = prevRange.startIso
      }
      timing = { ...summary, previousEvent }
    }

    return NextResponse.json({
      today: countByStatus(targetDateOrders),
      allTime,
      popularDrinks,
      modifierBreakdown,
      timing,
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
