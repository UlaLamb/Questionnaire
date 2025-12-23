import { MentalHealthSurveyApp } from "@/components/MentalHealthSurveyApp";

export default function Home() {
  return (
    <main className="relative">
      {/* 页面内容 */}
      <div className="flex flex-col gap-8 items-center sm:items-start w-full px-3 md:px-0">
        <MentalHealthSurveyApp />
      </div>
    </main>
  );
}

