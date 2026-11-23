/**
 * News IQ: one quiz per dailymattr story published in the last 24 hours in Sports, Technology,
 * Business or World (lib/quiz/stories.ts). Each lives at /quizz/<slug> and is written from the
 * story's text by lib/quiz/generate.ts, following the rules below.
 *
 * Questions test what the reader knows about the story's topic, not how it was reported.
 * Medium difficulty: each question asks one straightforward fact from the brief, with short,
 * direct options. The wrong options are other real figures or facts from the same story, so
 * they are close enough to make the reader think. The right answer's position varies.
 *
 * Each option carries:
 *   aw   closeness to the facts, 0 to 3
 *   lens the thinking style the answer reflects
 *   note the right answer explained (shown with the result, never as "wrong")
 */

export type LensKey = "data" | "systems" | "skeptic" | "optimist"

export type Fact = { num: string; text: string; source: string }

export type QuizOption = { text: string; aw: 0 | 1 | 2 | 3; lens: LensKey; note: string }

export type Question = {
  /** What the question tests, shown beside the progress count. */
  lensLabel: string
  text: string
  options: QuizOption[]
}

export type Edition = {
  /** URL segment: the quiz lives at /quizz/<slug>. */
  slug: string
  category: string
  /** Date of the dailymattr story. */
  date: string
  headline: string
  /** Shorter headline for the copied result. */
  shareHeadline: string
  dek: string
  image: { src: string; alt: string; width: number; height: number; /** CSS object-position for crops */ focus: string }
  facts: Fact[]
  sources: string[]
  /** The dailymattr story this edition is built from. */
  storyUrl: string
  takeaway: string
  questions: Question[]
}

export const QUIZ_HOME = "/quizz"

/** The quiz page for a story. */
export const quizPath = (slug: string) => `${QUIZ_HOME}/${slug}`

/**
 * Thinking styles: how the reader's knowledge shows up in their picks. Told apart by label and
 * monogram, never by colour.
 */
export const lenses: Record<LensKey, { name: string; short: string; mono: string; desc: string }> = {
  data: {
    name: "The Data Detective",
    short: "Data Detective",
    mono: "DD",
    desc: "You remember the exact figures and what each one stands for. Numbers are where you shine.",
  },
  systems: {
    name: "The Big-Picture Thinker",
    short: "Big-Picture",
    mono: "BP",
    desc: "You know why the story matters and how its pieces connect. Locking in the exact figures will make you unbeatable.",
  },
  skeptic: {
    name: "The Careful Doubter",
    short: "Doubter",
    mono: "CD",
    desc: "When you're unsure, you lean towards the cautious answer. Pinning down the key facts will turn that caution into confidence.",
  },
  optimist: {
    name: "The Quick Thinker",
    short: "Quick Thinker",
    mono: "QT",
    desc: "You go with the answer that sounds right at first glance. Slowing down on the details will lift your score.",
  },
}

export const lensOrder: LensKey[] = ["data", "systems", "skeptic", "optimist"]

/** Result bands, highest first: how well the reader knows the story. */
export const bands = [
  {
    min: 89,
    name: "You're well aware",
    desc: "You know this story inside out: the numbers, the details and why they matter.",
  },
  {
    min: 56,
    name: "Mostly aware",
    desc: "You know the big picture. A couple of details tripped you up, and your answers below show which.",
  },
  {
    min: 23,
    name: "Partly aware",
    desc: "You know the gist, but some key facts slipped past you. Your answers below fill in the gaps.",
  },
  {
    min: 0,
    name: "Just catching up",
    desc: "This story was new to you. Your answers below get you up to speed in a minute.",
  },
] as const

export const intro = {
  /** The /quizz headline in parts; `accent` parts are set in brand blue. */
  title: [
    { text: "Take a quiz", accent: true },
    { text: " to see how well you know " },
    { text: "what mattrs", accent: true },
  ],
}
