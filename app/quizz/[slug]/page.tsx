import { Suspense } from "react"
import { notFound } from "next/navigation"

import { getQuizEdition } from "@/lib/quiz/generate"
import { getDailyEdition } from "@/lib/quiz/edition"
import { getRecentStories } from "@/lib/quiz/stories"
import { seoMetadata } from "@/lib/seo"

import { Quiz, QuizMain, QuizSkeleton } from "@/components/quizz"
import { quizPath } from "@/components/quizz/content"

type Params = PageProps<"/quizz/[slug]">["params"]

/**
 * Cache Components needs at least one param here. Today's stories are listed; older ones still
 * resolve at request time.
 */
export async function generateStaticParams() {
  const stories = await getRecentStories().catch(() => [])
  return stories.length ? stories.slice(0, 1).map((s) => ({ slug: s.slug })) : [{ slug: "placeholder-0" }]
}

export async function generateMetadata({ params }: PageProps<"/quizz/[slug]">) {
  const { slug } = await params
  return seoMetadata(quizPath(slug))
}

/**
 * /quizz/<slug>: the story's start screen (photo, headline, how it works), then its questions
 * and report. The frame renders at once and the quiz streams in below it: the first visit to a
 * story writes its quiz, which takes a few seconds.
 */
export default function QuizStoryPage({ params }: PageProps<"/quizz/[slug]">) {
  return (
    <QuizMain>
      <Suspense fallback={<QuizSkeleton label="Writing your quiz from this story" />}>
        <StoryQuiz params={params} />
      </Suspense>
    </QuizMain>
  )
}

async function StoryQuiz({ params }: { params: Params }) {
  const { slug } = await params
  const [edition, today] = await Promise.all([getQuizEdition(slug), getDailyEdition()])
  if (!edition) notFound()
  // Keyed by story so moving between stories always starts fresh at question 1.
  return <Quiz key={slug} edition={edition} date={today.date} />
}
