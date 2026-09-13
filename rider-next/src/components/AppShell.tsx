"use client";

import { useState, useTransition } from "react";
import type { Gear, Order, Snapshot } from "@/lib/types";
import { today, uid } from "@/lib/format";
import { removeGear, removeOrder, saveGear, saveOrder } from "@/app/actions";
import OrdersView from "./OrdersView";
import CalendarView from "./CalendarView";
import GearView from "./GearView";
import ClientsView from "./ClientsView";
import StatsView from "./StatsView";
import OrderSheet from "./OrderSheet";
import GearSheet from "./GearSheet";

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

export type StorageInfo = { kind: "json" | "postgres"; path: string | null };

export default function AppShell({ snapshot, storage }: { snapshot: Snapshot; storage: StorageInfo }) {
  const [view, setView] = useState<View>("orders");
  const [orderDraft, setOrderDraft] = useState<Order | null>(null);
  const [gearDraft, setGearDraft] = useState<Gear | null>(null);
  const [pending, start] = useTransition();

  const { orders, gear, clients, settings } = snapshot;

  const commitOrder = (o: Order) => start(async () => { await saveOrder(o); setOrderDraft(null); });
  const dropOrder = (id: string) => start(async () => { await removeOrder(id); setOrderDraft(null); });
  const commitGear = (g: Gear) => start(async () => { await saveGear(g); setGearDraft(null); });
  const dropGear = (id: string) => start(async () => { await removeGear(id); setGearDraft(null); });

  const openOrder = (id: string) => setOrderDraft(structuredClone(orders.find((o) => o.id === id) ?? emptyOrder()));
  const openGear = (id: string) => setGearDraft(structuredClone(gear.find((g) => g.id === id) ?? emptyGear()));

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
        {view === "gear" && <GearView orders={orders} gear={gear} settings={settings} onOpen={openGear} onNew={() => setGearDraft(emptyGear())} />}
        {view === "clients" && <ClientsView orders={orders} onNew={() => setOrderDraft(emptyOrder())} />}
        {view === "stats" && <StatsView orders={orders} gear={gear} settings={settings} />}

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
    </>
  );
}
