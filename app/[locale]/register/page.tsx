import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RegisterForm } from "@/components/auth/register-form";
import { MotionDiv } from "@/components/ui/motion";

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("register");
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
          <h2 className="text-xl font-semibold">{t("title")}</h2>
        </div>

        <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <RegisterForm locale={locale} />
        </div>

        <p className="text-center text-sm text-gray-600 dark:text-gray-300 mt-4">
          {t("haveAccount")}{" "}
          <Link
            href={`/${locale}/login`}
            className="text-primary hover:underline"
          >
            {t("login")}
          </Link>
        </p>
      </MotionDiv>
    </main>
  );
}