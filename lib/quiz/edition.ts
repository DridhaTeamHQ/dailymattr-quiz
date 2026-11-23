import { promises as fs } from "node:fs"
import path from "node:path"
import { connection } from "next/server"

import { getQuizEdition } from "./generate"
import { QUIZ_CATEGORIES, formatDate, getRecentStories, getStory, type StoryMeta } from "./stories"

/**
 * The daily News IQ edition: the latest story in each category (Sports, Technology, Business,
 * World), chosen once per day (India time) and kept for the whole day, so every reader sees the
 * same four stories until the next day's edition. The pick is saved under .cache/editions so a
 * restart doesn't change it mid-day.
 */

const DIR = path.join(process.cwd(), ".cache", "editions")

/** Today's date in India, as YYYY-MM-DD. */
const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })

export type DailyEdition = { day: string; date: string; stories: StoryMeta[] }

/** Picks per day, so concurrent requests share one pick. */
const inFlight = new Map<string, Promise<DailyEdition>>()

async function load(day: string): Promise<DailyEdition | null> {
  try {
    const { slugs } = JSON.parse(await fs.readFile(path.join(DIR, `${day}.json`), "utf8")) as { slugs: string[] }
    const stories = (await Promise.all(slugs.map((s) => getStory(s)))).filter((s): s is StoryMeta => s !== null)
    return stories.length ? { day, date: formatDate(`${day}T12:00:00+05:30`), stories } : null
  } catch {
    return null
  }
}

async function create(day: string): Promise<DailyEdition> {
  const recent = await getRecentStories() // newest first
  const stories = QUIZ_CATEGORIES.flatMap((c) => recent.find((s) => s.category === c.name) ?? [])
  try {
    await fs.mkdir(DIR, { recursive: true })
    await fs.writeFile(path.join(DIR, `${day}.json`), JSON.stringify({ slugs: stories.map((s) => s.slug) }, null, 2))
  } catch {
    // Read-only file systems (serverless) keep the pick in memory only.
  }
  // Write the four quizzes now, so the first reader of each doesn't wait.
  for (const s of stories) getQuizEdition(s.slug).catch(() => {})
  return { day, date: formatDate(`${day}T12:00:00+05:30`), stories }
}

/** Today's edition. Request time only: the day changes. */
export async function getDailyEdition(): Promise<DailyEdition> {
  await connection()
  const day = todayIST()
  let edition = inFlight.get(day)
  if (!edition) {
    edition = load(day).then((saved) => saved ?? create(day))
    inFlight.set(day, edition)
    // A failed pick is retried on the next request.
    edition.catch(() => inFlight.delete(day))
  }
  return edition
}
