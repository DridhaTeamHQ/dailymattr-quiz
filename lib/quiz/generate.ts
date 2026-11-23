import { promises as fs } from "node:fs"
import path from "node:path"
import { cacheLife } from "next/cache"

import type { Edition, LensKey, Question } from "@/components/quizz/content"
import { getStory, type StoryMeta } from "./stories"

/**
 * Writes a story's News IQ quiz with OpenAI, from the story's own text. Each quiz is written
 * once and kept: in Next's cache, and on disk under .cache/quizzes so a dev restart doesn't
 * pay for it again.
 */

const MODEL = process.env.OPENAI_QUIZ_MODEL || "gpt-4.1"
const CACHE_DIR = path.join(process.cwd(), ".cache", "quizzes")
/** Bump when the prompt or schema changes, so older quizzes are written again. */
const VERSION = 3

const LENSES: LensKey[] = ["data", "systems", "skeptic", "optimist"]

const PROMPT = `You write "News IQ" quizzes for dailymattr, an Indian news app. Given one news story, write a 3-question multiple-choice quiz that tests what the reader knows about the story.

Rules:
- Use ONLY facts stated in the story text. Never invent figures, names or dates.
- Medium difficulty: each question asks one straightforward fact from the story, in plain words. Short, direct options (a few words each).
- Each question has exactly 4 options and exactly ONE correct option.
- Wrong options should be plausible: other real figures or facts from the same story where possible (e.g. the old value, a related number), otherwise close, realistic alternatives.
- Mix question types: at least one about a key number, one about who/what/where, one about what happens next or why it matters.
- Every option has:
  - aw: closeness to the facts. 3 = the correct answer. 2 = close (a real figure from the story used for the wrong thing, or near-miss). 1 = plausible but wrong. 0 = clearly off.
  - lens: the thinking style the pick reflects. The 4 options of a question must use the 4 lenses exactly once each:
      "data"     precise, figure-focused (usually the correct answer on number/fact questions)
      "systems"  big-picture, connects causes and consequences (often correct on "why/what it means" questions)
      "skeptic"  the cautious or old/status-quo answer
      "optimist" the answer that sounds right at first glance, often an overstatement
  - note: one or two short sentences shown after the quiz. For the correct option start with "Right." and add the key detail. For wrong options, never say "wrong" or "no": say what that option actually is if it's from the story (e.g. "That's the valuation."), then ALWAYS state the right answer in full (e.g. "The IPO itself raised $81.3 billion."). Every note must contain the correct answer.
- lensLabel: 2-3 words naming what the question tests, like "The numbers", "What's next", "The record".
- shareHeadline: the headline shortened to under 60 characters.
- dek: 1-2 sentences (max 45 words) summarising the story.
- facts: 3 or 4 key facts. num is a very short figure or keyword (max 12 characters, e.g. "₹2,000 cr", "14", "25% → 10%", "Geneva"); text is one short sentence explaining it.
- takeaway: "The one thing to remember", 1-2 sentences.
- imageAlt: a short neutral description of a photo that would illustrate this story.
- sourceName: the publication the story came from, from the source URL (e.g. "Economic Times", "Livemint"); "dailymattr" if unknown.
Write in clear, simple British/Indian English.`

const option = {
  type: "object",
  additionalProperties: false,
  required: ["text", "aw", "lens", "note"],
  properties: {
    text: { type: "string" },
    aw: { type: "integer", enum: [0, 1, 2, 3] },
    lens: { type: "string", enum: LENSES },
    note: { type: "string" },
  },
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["shareHeadline", "dek", "imageAlt", "sourceName", "facts", "takeaway", "questions"],
  properties: {
    shareHeadline: { type: "string" },
    dek: { type: "string" },
    imageAlt: { type: "string" },
    sourceName: { type: "string" },
    takeaway: { type: "string" },
    facts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["num", "text"],
        properties: { num: { type: "string" }, text: { type: "string" } },
      },
    },
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["lensLabel", "text", "options"],
        properties: {
          lensLabel: { type: "string" },
          text: { type: "string" },
          options: { type: "array", items: option },
        },
      },
    },
  },
}

type Generated = {
  shareHeadline: string
  dek: string
  imageAlt: string
  sourceName: string
  takeaway: string
  facts: { num: string; text: string }[]
  questions: Question[]
}

function isValid(g: Generated) {
  return (
    g.questions.length === 3 &&
    g.facts.length >= 2 &&
    g.questions.every(
      (q) =>
        q.options.length === 4 &&
        q.options.filter((o) => o.aw === 3).length === 1 &&
        new Set(q.options.map((o) => o.lens)).size === 4
    )
  )
}

/** Small seeded shuffle, so the right answer's position varies but stays stable per story. */
function shuffle<T>(items: T[], seed: number) {
  const out = [...items]
  let s = seed || 1
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const j = s % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

async function callOpenAI(story: StoryMeta): Promise<Generated> {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error("Missing OPENAI_API_KEY in .env")
  const user = `Category: ${story.category}\nPublished: ${story.date}\nSource URL: ${story.sourceUrl ?? "unknown"}\nHeadline: ${story.headline}\n\nStory:\n${story.text.slice(0, 6000)}`

  let lastError = "no response"
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        messages: [
          { role: "system", content: PROMPT },
          { role: "user", content: user },
        ],
        response_format: { type: "json_schema", json_schema: { name: "news_iq_quiz", strict: true, schema: SCHEMA } },
      }),
    })
    if (!res.ok) {
      lastError = `OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`
      continue
    }
    const json = await res.json()
    const content = json.choices?.[0]?.message?.content
    try {
      const generated = JSON.parse(content) as Generated
      if (isValid(generated)) return generated
      lastError = "quiz failed validation"
    } catch {
      lastError = "unparseable quiz"
    }
  }
  throw new Error(`Couldn't write a quiz for story ${story.id}: ${lastError}`)
}

function toEdition(story: StoryMeta, g: Generated): Edition {
  return {
    slug: story.slug,
    category: story.category,
    date: story.date,
    headline: story.headline,
    shareHeadline: g.shareHeadline,
    dek: g.dek,
    image: { src: story.image, alt: g.imageAlt, width: 720, height: 1280, focus: "50% 30%" },
    facts: g.facts.slice(0, 4).map((f) => ({ ...f, source: g.sourceName })),
    sources: [g.sourceName],
    storyUrl: story.storyUrl,
    takeaway: g.takeaway,
    questions: g.questions.map((q, i) => ({ ...q, options: shuffle(q.options, Number(story.id) * 7 + i) })),
  }
}

async function readDisk(file: string) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as Generated
  } catch {
    return null
  }
}

async function writeDisk(file: string, data: Generated) {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true })
    await fs.writeFile(file, JSON.stringify(data, null, 2))
  } catch {
    // Read-only file systems (serverless) just skip the disk copy.
  }
}

/** The quiz for a story slug, or null when there is no such story. */
export async function getQuizEdition(slug: string): Promise<Edition | null> {
  "use cache"
  cacheLife("days")
  const story = await getStory(slug)
  if (!story) return null
  const file = path.join(CACHE_DIR, `${story.id}-v${VERSION}.json`)
  let generated = await readDisk(file)
  if (!generated) {
    generated = await callOpenAI(story)
    await writeDisk(file, generated)
  }
  return toEdition(story, generated)
}
