import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { MotionDiv } from "@/components/ui/motion";
import { routing } from "@/i18n/routing";

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const tc = await getTranslations("common");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .single();

  const organizationId = memberships?.organization_id;

  const { data: organization } = organizationId
    ? await supabase
        .from("organizations")
        .select("*")
        .eq("id", organizationId)
        .single()
    : { data: null };

  const localeNames: Record<string, string> = {
    en: "English",
    es: "Español",
    "pt-BR": "Português (Brasil)",
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">{t("subtitle")}</p>
      </div>

      <MotionDiv className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-xl p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-4">{t("organization")}</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                {t("organizationName")}
              </label>
              <input
                type="text"
                defaultValue={organization?.name || ""}
                placeholder={t("organizationNamePlaceholder")}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-4">{t("language")}</h2>
          <div className="grid grid-cols-3 gap-3">
            {routing.locales.map((locale) => (
              <a
                key={locale}
                href={`/${locale}/settings`}
                className={`px-4 py-3 rounded-lg border text-sm font-medium text-center transition-colors ${
                  locale === "en"
                    ? "border-primary bg-primary-light dark:bg-primary/20 text-primary"
                    : "border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                {localeNames[locale]}
              </a>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-4">{t("theme")}</h2>
          <div className="grid grid-cols-3 gap-3">
            <button className="px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              {t("themeLight")}
            </button>
            <button className="px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              {t("themeDark")}
            </button>
            <button className="px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              {t("themeSystem")}
            </button>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
          <Button>{tc("save")}</Button>
        </div>
      </MotionDiv>

      <MotionDiv
        delay={0.1}
        className="bg-white dark:bg-surface-dark border border-red-200 dark:border-red-900/50 rounded-xl p-6"
      >
        <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
          {t("dangerZone")}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          {t("deleteOrganizationConfirm")}
        </p>
        <Button variant="danger">{t("deleteOrganization")}</Button>
      </MotionDiv>
    </div>
  );
}