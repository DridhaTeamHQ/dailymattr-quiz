import { Suspense } from "react"

import { seoMetadata } from "@/lib/seo"

import { PickerDate, PickerSkeleton, QuizIntro, QuizMain, QuizPicker } from "@/components/quizz"
import { SeriesBar } from "@/components/quizz/parts"

export const generateMetadata = () => seoMetadata("/quizz")

/** /quizz: the headline, then stories from the last 24 hours, streamed in from the CMS. */
export default function QuizzPage() {
  return (
    <QuizMain>
      <div className="mx-auto w-full max-w-[37.5rem] lg:max-w-[66rem]">
        <Suspense fallback={<SeriesBar />}>
          <PickerDate />
        </Suspense>
        <div className="mt-6 flex flex-col gap-8 sm:mt-8 lg:gap-10">
          <QuizIntro />
          <Suspense fallback={<PickerSkeleton />}>
            <QuizPicker />
          </Suspense>
        </div>
      </div>
    </QuizMain>
  )
}
