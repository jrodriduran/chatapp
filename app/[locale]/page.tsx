import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { MotionDiv } from "@/components/ui/motion";

export default async function HomePage() {
  const t = await getTranslations();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <MotionDiv className="text-center max-w-2xl">
        <h1 className="text-4xl md:text-6xl font-bold mb-6">
          {t("common.appName")}
        </h1>
        <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-8">
          {t("auth.signUpSubtitle")}
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/dashboard"
            className="px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover transition-colors"
          >
            {t("auth.signIn")}
          </Link>
          <Link
            href="/signup"
            className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {t("auth.signUp")}
          </Link>
        </div>
      </MotionDiv>
    </main>
  );
}