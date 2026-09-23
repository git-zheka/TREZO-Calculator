"use client";

import { useState, useTransition } from "react";
import type { Client, Gear, Order, Role, Snapshot } from "@/lib/types";
import type { MoneyMode } from "@/lib/calc";
import { today, uid } from "@/lib/format";
import { removeClient, removeGear, removeOrder, removeRole, saveClient, saveGear, saveOrder, saveRole } from "@/app/actions";
import OrdersView from "./OrdersView";
import CalendarView from "./CalendarView";
import GearView from "./GearView";
import ClientsView from "./ClientsView";
import StatsView from "./StatsView";
import OrderSheet from "./OrderSheet";
import GearSheet from "./GearSheet";
import ClientSheet from "./ClientSheet";
import RoleSheet from "./RoleSheet";

export type View = "orders" | "calendar" | "gear" | "clients" | "stats";

const TABS: { id: View; label: string }[] = [
  { id: "orders", label: "Замовлення" },
  { id: "calendar", label: "Календар" },
  { id: "gear", label: "Обладнання" },
  { id: "clients", label: "Замовники" },
  { id: "stats", label: "Аналітика" },
];

export const emptyOrder = (date = today()): Order => ({
  id: uid(),
  date,
  clientId: null,
  clientName: "",
  title: "",
  kind: "rent+set",
  currency: "UAH",
  status: "confirmed",
  expenses: 0,
  notes: "",
  items: [],
});

export const emptyGear = (): Gear => ({
  id: uid(),
  name: "",
  category: "",
  qty: 1,
  purchaseDate: today(),
  purchasePrice: 0,
  purchaseCurrency: "UAH",
  rateUah: 0,
  rateUsd: 0,
  status: "active",
  notes: "",
  parts: [],
  needs: [],
  sort: 0,
});

export const emptyClient = (): Client => ({
  id: uid(),
  name: "",
  type: "Інше",
  regular: true,
  contact: "",
  notes: "",
});

export const emptyRole = (sort: number): Role => ({
  id: uid(),
  name: "",
  rateUah: 0,
  rateUsd: 0,
  sort,
});

export type StorageInfo = { kind: "json" | "postgres"; path: string | null };

export default function AppShell({ snapshot, storage }: { snapshot: Snapshot; storage: StorageInfo }) {
  const [view, setView] = useState<View>("orders");
  const [orderDraft, setOrderDraft] = useState<Order | null>(null);
  const [gearDraft, setGearDraft] = useState<Gear | null>(null);
  const [clientDraft, setClientDraft] = useState<Client | null>(null);
  const [roleDraft, setRoleDraft] = useState<Role | null>(null);
  const [pending, start] = useTransition();

  const { orders, gear, clients, roles, settings } = snapshot;

  // Поки жодне замовлення не виконане, режим «тільки виконане» показував би самі нулі —
  // тож стартуємо з підтверджених, а далі перемикач у руках користувача.
  const [mode, setMode] = useState<MoneyMode>(() =>
    orders.some((o) => o.status === "done") ? "done" : "active",
  );

  const commitOrder = (o: Order) => start(async () => { await saveOrder(o); setOrderDraft(null); });
  const dropOrder = (id: string) => start(async () => { await removeOrder(id); setOrderDraft(null); });
  const commitGear = (g: Gear) => start(async () => { await saveGear(g); setGearDraft(null); });
  const dropGear = (id: string) => start(async () => { await removeGear(id); setGearDraft(null); });

  const commitClient = (c: Client) => start(async () => { await saveClient(c); setClientDraft(null); });
  const dropClient = (id: string) => start(async () => { await removeClient(id); setClientDraft(null); });

  const openOrder = (id: string) => setOrderDraft(structuredClone(orders.find((o) => o.id === id) ?? emptyOrder()));
  const openGear = (id: string) => setGearDraft(structuredClone(gear.find((g) => g.id === id) ?? emptyGear()));
  const openClient = (id: string) => setClientDraft(structuredClone(clients.find((c) => c.id === id) ?? emptyClient()));

  const commitRole = (r: Role) => start(async () => { await saveRole(r); setRoleDraft(null); });
  const dropRole = (id: string) => start(async () => { await removeRole(id); setRoleDraft(null); });
  const openRole = (id: string) =>
    setRoleDraft(structuredClone(roles.find((r) => r.id === id) ?? emptyRole(roles.length)));

  return (
    <>
      <header className="top">
        <div className="top-in">
          <div className="brand"><span className="dot" />Райдер</div>
          <nav className="tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} className="tab" role="tab" aria-selected={view === t.id} onClick={() => setView(t.id)}>
                {t.label}
              </button>
            ))}
          </nav>
          <button className="btn primary" onClick={() => setOrderDraft(emptyOrder())}>＋ Замовлення</button>
        </div>
      </header>

      <main>
        {view === "orders" && <OrdersView orders={orders} onOpen={openOrder} onNew={() => setOrderDraft(emptyOrder())} />}
        {view === "calendar" && (
          <CalendarView
            orders={orders}
            gear={gear}
            settings={settings}
            onOpen={openOrder}
            onNewOn={(date) => setOrderDraft(emptyOrder(date))}
          />
        )}
        {view === "gear" && (
          <GearView
            orders={orders}
            gear={gear}
            settings={settings}
            mode={mode}
            onMode={setMode}
            onOpen={openGear}
            onNew={() => setGearDraft(emptyGear())}
          />
        )}
        {view === "clients" && (
          <ClientsView
            orders={orders}
            clients={clients}
            onOpen={openClient}
            onNewClient={() => setClientDraft(emptyClient())}
            onNewOrder={() => setOrderDraft(emptyOrder())}
            mode={mode}
            onMode={setMode}
          />
        )}
        {view === "stats" && (
          <StatsView
            orders={orders}
            gear={gear}
            roles={roles}
            settings={settings}
            mode={mode}
            onMode={setMode}
            onOpenRole={openRole}
            onNewRole={() => setRoleDraft(emptyRole(roles.length))}
          />
        )}

        <p className="hint" style={{ marginTop: 28, textAlign: "center" }}>
          {storage.kind === "json"
            ? `Дані у файлі ${storage.path} — це і є те, що варто бекапити`
            : "Дані в Postgres"}
        </p>
      </main>

      {orderDraft && (
        <OrderSheet
          draft={orderDraft}
          gear={gear}
          clients={clients}
          roles={roles}
          exists={orders.some((o) => o.id === orderDraft.id)}
          pending={pending}
          onChange={setOrderDraft}
          onClose={() => setOrderDraft(null)}
          onSave={commitOrder}
          onDelete={dropOrder}
        />
      )}
      {gearDraft && (
        <GearSheet
          draft={gearDraft}
          allGear={gear}
          orders={orders}
          settings={settings}
          exists={gear.some((g) => g.id === gearDraft.id)}
          pending={pending}
          onChange={setGearDraft}
          onClose={() => setGearDraft(null)}
          onSave={commitGear}
          onDelete={dropGear}
        />
      )}
      {clientDraft && (
        <ClientSheet
          draft={clientDraft}
          orders={orders}
          allClients={clients}
          exists={clients.some((c) => c.id === clientDraft.id)}
          pending={pending}
          onChange={setClientDraft}
          onClose={() => setClientDraft(null)}
          onSave={commitClient}
          onDelete={dropClient}
        />
      )}
      {roleDraft && (
        <RoleSheet
          draft={roleDraft}
          orders={orders}
          allRoles={roles}
          mode={mode}
          exists={roles.some((r) => r.id === roleDraft.id)}
          pending={pending}
          onChange={setRoleDraft}
          onClose={() => setRoleDraft(null)}
          onSave={commitRole}
          onDelete={dropRole}
        />
      )}
    </>
  );
}
