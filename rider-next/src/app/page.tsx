import AppShell from "@/components/AppShell";
import { dataFilePath, loadSnapshot, storageKind } from "@/lib/db";
import type { Snapshot } from "@/lib/types";

// Дані персональні й змінюються після кожного запису — кешувати нічого.
export const dynamic = "force-dynamic";

export default async function Page() {
  let snapshot: Snapshot | null = null;
  let error: string | null = null;
  try {
    snapshot = await loadSnapshot();
  } catch (err) {
    error = err instanceof Error ? err.message : "Невідома помилка";
  }

  if (!snapshot) {
    return (
      <main>
        <div className="banner" style={{ marginTop: 24 }}>
          <strong>Сховище не відповідає.</strong>
          <span>{error}</span>
        </div>
        <p className="hint">
          {storageKind === "json" ? (
            <>
              Дані мають лежати у <code>{dataFilePath}</code>. Перевір, що папка доступна на запис.
            </>
          ) : (
            <>
              Перевір змінну <code>DATABASE_URL</code> і що схему застосовано: <code>npm run db:push</code>.
            </>
          )}
        </p>
      </main>
    );
  }

  return <AppShell snapshot={snapshot} storage={{ kind: storageKind, path: dataFilePath }} />;
}
