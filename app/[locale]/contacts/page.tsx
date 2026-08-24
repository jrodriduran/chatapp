import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { MotionDiv, MotionTr } from "@/components/ui/motion";

export default async function ContactsPage() {
  const t = await getTranslations("contacts");
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

  const { data: contacts } = organizationId
    ? await supabase
        .from("contacts")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">{t("subtitle")}</p>
      </div>

      {!contacts || contacts.length === 0 ? (
        <MotionDiv className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-600 dark:text-gray-300">{t("empty")}</p>
        </MotionDiv>
      ) : (
        <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 text-left text-gray-600 dark:text-gray-300">
                <th className="px-6 py-3 font-medium">{t("name")}</th>
                <th className="px-6 py-3 font-medium">{t("phone")}</th>
                <th className="px-6 py-3 font-medium">{t("language")}</th>
                <th className="px-6 py-3 font-medium">{t("lastSeen")}</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact, index) => (
                <MotionTr
                  key={contact.id}
                  delay={index * 0.05}
                  className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <td className="px-6 py-4">{contact.name || "-"}</td>
                  <td className="px-6 py-4">{contact.phone}</td>
                  <td className="px-6 py-4">{contact.language}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                    {contact.last_seen_at
                      ? new Date(contact.last_seen_at).toLocaleString()
                      : "-"}
                  </td>
                </MotionTr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}