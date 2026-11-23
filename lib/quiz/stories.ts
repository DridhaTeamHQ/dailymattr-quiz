import { cacheLife } from "next/cache"

/**
 * Live stories for News IQ, read from the dailymattr Pix database (Supabase table `pix_posts`).
 * Server only: it uses the service-role key from .env.
 */

/** The four News IQ categories, by the CMS's category id. */
export const QUIZ_CATEGORIES = [
  { id: 6, name: "Sports" },
  { id: 15, name: "Technology" },
  { id: 3, name: "Business" },
  { id: 1, name: "World" },
] as const

export type QuizCategory = (typeof QUIZ_CATEGORIES)[number]["name"]

const categoryName = (id: number | null) => QUIZ_CATEGORIES.find((c) => c.id === id)?.name

/** A published story the reader can pick, plus the text the quiz is written from. */
export type StoryMeta = {
  /** The CMS (Buzz) id: unique, and the last part of the quiz slug. */
  id: string
  slug: string
  category: QuizCategory
  headline: string
  /** ISO timestamp. */
  publishedAt: string
  /** "23 November 2026". */
  date: string
  image: string
  storyUrl: string
  sourceUrl: string | null
  /** Bullets, summary and article text, cleaned, for the quiz writer. */
  text: string
}

type PostRow = {
  published_id: string | null
  published_at: string
  category_id: number | null
  headline: string | null
  detail_body: string | null
  detail_text: string | null
  article_text: string | null
  voice_summary: string | null
  source_url: string | null
  main_image_url: string | null
}

const COLUMNS =
  "published_id,published_at,category_id,headline,detail_body,detail_text,article_text,voice_summary,source_url,main_image_url"

const DAY_MS = 24 * 60 * 60 * 1000

function env(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name} in .env`)
  return value
}

async function queryPosts(query: string): Promise<PostRow[]> {
  const key = env("SUPABASE_SERVICE_ROLE_KEY")
  const res = await fetch(`${env("SUPABASE_URL")}/rest/v1/pix_posts?${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`)
  return res.json()
}

/** Text from the CMS: some fields are JSON-encoded strings, and [brackets] mark highlights. */
function clean(value: string | null) {
  if (!value) return ""
  let text = value.trim()
  if (text.startsWith('"')) {
    try {
      text = JSON.parse(text)
    } catch {}
  }
  return text
    .replace(/[[\]]/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim()
}

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" })

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/['’‘]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "")

/** The quiz slug ends in the story's id: /quizz/gukesh-prepares-to-defend-world-chess-title-20506 */
export const storyIdFromSlug = (slug: string) => slug.match(/-(\d+)$/)?.[1] ?? null

function toStory(row: PostRow): StoryMeta | null {
  const category = categoryName(row.category_id)
  const headline = clean(row.headline)
  if (!category || !row.published_id || !row.main_image_url || !headline || headline === "undefined") return null
  const base = slugify(headline)
  const text = [clean(row.detail_body || row.detail_text), clean(row.voice_summary), clean(row.article_text)]
    .filter(Boolean)
    .join("\n\n")
  if (text.length < 80) return null
  return {
    id: row.published_id,
    slug: `${base}-${row.published_id}`,
    category,
    headline,
    publishedAt: row.published_at,
    date: formatDate(row.published_at),
    image: row.main_image_url,
    storyUrl: `https://www.dailymattr.com/news/${base}-${row.published_id}`,
    sourceUrl: row.source_url,
    text,
  }
}

const published = "approved=eq.true&rejected=not.is.true&is_draft=not.is.true&published_id=not.is.null"

/** Stories published in the last 24 hours in the four quiz categories, newest first. */
export async function getRecentStories(): Promise<StoryMeta[]> {
  "use cache"
  cacheLife("minutes")
  const since = new Date(Date.now() - DAY_MS).toISOString()
  const ids = QUIZ_CATEGORIES.map((c) => c.id).join(",")
  const rows = await queryPosts(
    `select=${COLUMNS}&${published}&category_id=in.(${ids})&published_at=gte.${since}&order=published_at.desc&limit=200`
  )
  return rows.map(toStory).filter((s): s is StoryMeta => s !== null)
}

/** One story by its quiz slug, at any age (so shared quiz links keep working). */
export async function getStory(slug: string): Promise<StoryMeta | null> {
  "use cache"
  cacheLife("hours")
  const id = storyIdFromSlug(slug)
  if (!id) return null
  const [row] = await queryPosts(`select=${COLUMNS}&${published}&published_id=eq.${id}&limit=1`)
  // Looked up by id, so a link still works if the headline (and with it the slug) is edited.
  return row ? toStory(row) : null
}

