import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/components/auth/login-form";
import { MotionDiv } from "@/components/ui/motion";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("auth");
  const tc = await getTranslations("common");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(`/${locale}/dashboard`);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <MotionDiv className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">{tc("appName")}</h1>
          <h2 className="text-xl font-semibold">{t("loginTitle")}</h2>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            {t("loginSubtitle")}
          </p>
        </div>

        <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <LoginForm locale={locale} />
        </div>

        <p className="text-center text-sm text-gray-600 dark:text-gray-300 mt-4">
          {t("noAccount")}{" "}
          <Link
            href={`/${locale}/auth/register`}
            className="text-primary hover:underline"
          >
            {t("signUp")}
          </Link>
        </p>
      </MotionDiv>
    </main>
  );
}