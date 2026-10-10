// One live line per page for the menu, so nothing is hidden behind it:
// "2 of 4 in", "5 day streak", "+$12 this month"... Each one is its own small
// component and is only mounted while the menu is open.
import { useDayDocs, useMyCheckins } from '../hooks'
import { useGroupCtx } from '../groupContext'
import { useWorkouts, useMealsOn, useWeights, useSettings } from '../lib/privateData'
import { useLedgerInputs, runLedger } from '../lib/useLedger'
import { onItsDay, myToday } from '../lib/clock'
import { currentStreak, mondayOf } from '../lib/dates'
import { fmt } from '../lib/money'

const LB = 2.20462

function TodayStat({ user }) {
  const { group, members } = useGroupCtx()
  const today = group.clock.today()
  const checkins = useDayDocs(group.id, 'checkins', today)
  if (!checkins) return '...'
  const active = members.filter((m) => group.clock.joinDay(m) <= today && !group.clock.hasLeft(m.uid))
  const done = new Set(checkins.filter((c) => onItsDay(c, group.clock)).map((c) => c.uid))
  return `${done.has(user.uid) ? 'You\'re in. ' : 'Not in yet. '}${done.size} of ${active.length} in`
}

function WallStat() {
  const { group } = useGroupCtx()
  const photos = useDayDocs(group.id, 'photos', group.clock.today())
  if (!photos) return '...'
  const people = new Set(photos.map((p) => p.uid)).size
  return photos.length ? `${photos.length} photo${photos.length > 1 ? 's' : ''} from ${people} today` : 'No photos yet today'
}

function CalendarStat({ user }) {
  const { group } = useGroupCtx()
  const mine = useMyCheckins(group.id, user.uid)
  if (!mine) return '...'
  const days = new Set(mine.filter((c) => onItsDay(c, group.clock)).map((c) => c.date))
  const s = currentStreak(days, group.clock.today())
  return s ? `${s} day streak` : 'Start a streak today'
}

function BoardStat({ user }) {
  const { group, members } = useGroupCtx()
  const today = group.clock.today()
  const start = today.slice(0, 8) + '01'
  const inputs = useLedgerInputs(group, start, today)
  if (!inputs) return '...'
  const to = group.clock.closedThrough()
  const bal = to >= start ? runLedger(group, members, inputs, start, to).totals[user.uid] || 0 : 0
  return `${fmt(bal, group.money.current(), { plus: true })} this month`
}

function GroupStat() {
  const { group, members } = useGroupCtx()
  const n = members.filter((m) => !group.clock.hasLeft(m.uid)).length
  return `${group.name}, ${n} member${n === 1 ? '' : 's'}`
}

function MeStat({ user }) {
  const workouts = useWorkouts(user.uid)
  if (!workouts) return '...'
  const mon = mondayOf(myToday())
  const n = new Set(workouts.filter((w) => w.date >= mon).map((w) => w.date)).size
  return `${n} training day${n === 1 ? '' : 's'} this week`
}

function FoodStat({ user }) {
  const meals = useMealsOn(user.uid, myToday())
  if (!meals) return '...'
  const kcal = Math.round(meals.reduce((s, m) => s + (m.nutrients?.kcal || 0), 0))
  return meals.length ? `${kcal.toLocaleString()} kcal today` : 'Nothing logged today'
}

function ProgressStat({ user }) {
  const weights = useWeights(user.uid)
  const settings = useSettings(user.uid)
  if (!weights || settings === undefined) return '...'
  const last = [...weights].sort((a, b) => a.date.localeCompare(b.date)).pop()
  const lb = settings?.weightUnit === 'lb'
  return last ? `${Math.round((lb ? last.kg * LB : last.kg) * 10) / 10} ${lb ? 'lb' : 'kg'} latest` : 'No weight logged'
}

function TargetsStat({ user }) {
  const settings = useSettings(user.uid)
  if (settings === undefined) return '...'
  const k = settings?.targets?.kcal
  return k ? `${k.toLocaleString()} kcal a day` : 'Set your targets'
}

function TrainingStat({ user }) {
  const workouts = useWorkouts(user.uid)
  if (!workouts) return '...'
  const last = [...workouts].sort((a, b) => a.date.localeCompare(b.date)).pop()
  return last ? `Last: ${last.title || 'workout'}, ${new Date(last.date + 'T12:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })}` : 'Log your first workout'
}

const CREW = { today: TodayStat, wall: WallStat, calendar: CalendarStat, board: BoardStat, group: GroupStat }
const YOU = { me: MeStat, food: FoodStat, progress: ProgressStat, targets: TargetsStat, training: TrainingStat }

export default function PageStat({ pageKey, user }) {
  const { status } = useGroupCtx()
  if (pageKey === 'account') return user.email
  const You = YOU[pageKey]
  if (You) return <You user={user} />
  const Crew = CREW[pageKey]
  if (!Crew) return null
  if (status !== 'ready') return pageKey === 'group' ? 'Join or create a group' : 'Needs a group'
  return <Crew user={user} />
}
