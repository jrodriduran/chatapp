import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { MotionDiv, MotionTr } from "@/components/ui/motion";

export default async function ConversationsPage() {
  const t = await getTranslations("conversations");
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

  const { data: conversations } = organizationId
    ? await supabase
        .from("conversations")
        .select("*, contacts(*), bots(name)")
        .eq("organization_id", organizationId)
        .order("last_message_at", { ascending: false })
        .limit(50)
    : { data: [] };

  const statusLabels: Record<string, string> = {
    open: t("statusOpen"),
    closed: t("statusClosed"),
    pending: t("statusPending"),
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">{t("subtitle")}</p>
      </div>

      {!conversations || conversations.length === 0 ? (
        <MotionDiv className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-600 dark:text-gray-300">{t("empty")}</p>
        </MotionDiv>
      ) : (
        <div className="bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 text-left text-gray-600 dark:text-gray-300">
                <th className="px-6 py-3 font-medium">{t("customer")}</th>
                <th className="px-6 py-3 font-medium">{t("bot")}</th>
                <th className="px-6 py-3 font-medium">{tc("status")}</th>
                <th className="px-6 py-3 font-medium">{t("lastMessage")}</th>
              </tr>
            </thead>
            <tbody>
              {conversations.map((conv, index) => (
                <MotionTr
                  key={conv.id}
                  delay={index * 0.05}
                  className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <td className="px-6 py-4">
                    {conv.contacts?.name || conv.contacts?.phone || "-"}
                  </td>
                  <td className="px-6 py-4">{conv.bots?.name || "-"}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        conv.status === "open"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          : conv.status === "pending"
                          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                      }`}
                    >
                      {statusLabels[conv.status] || conv.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                    {conv.last_message_at
                      ? new Date(conv.last_message_at).toLocaleString()
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