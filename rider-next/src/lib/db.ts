import type { Client, Gear, Order, Snapshot } from "./types";
import * as json from "./store-json";
import * as pg from "./store-pg";

/**
 * Одна точка вибору сховища. Решта коду не знає, куди лягають дані.
 *
 *   STORAGE=json      → data/rider.json на диску (типово)
 *   STORAGE=postgres  → Neon Postgres через DATABASE_URL
 *
 * Без явного STORAGE вибір за наявністю DATABASE_URL: є — Postgres, немає — файл.
 * Тому локально нічого налаштовувати не треба, а на проді достатньо задати
 * DATABASE_URL, і застосунок сам піде в базу.
 *
 * Важливо: JSON-режим вимагає справжнього диска. На Vercel файлова система
 * ефемерна — там працює тільки Postgres.
 */
export const storageKind: "json" | "postgres" =
  process.env.STORAGE === "postgres" || (!process.env.STORAGE && !!process.env.DATABASE_URL)
    ? "postgres"
    : "json";

const store = storageKind === "postgres" ? pg : json;

export const loadSnapshot = (): Promise<Snapshot> => store.loadSnapshot();
export const loadForIcs = (token: string): Promise<Order[] | null> => store.loadForIcs(token);
export const upsertOrder = (o: Order): Promise<void> => store.upsertOrder(o);
export const deleteOrder = (id: string): Promise<void> => store.deleteOrder(id);
export const upsertGear = (g: Gear): Promise<void> => store.upsertGear(g);
export const deleteGear = (id: string): Promise<void> => store.deleteGear(id);
export const reorderGear = (ids: string[]): Promise<void> => store.reorderGear(ids);
export const findOrCreateClient = (name: string): Promise<Client | null> => store.findOrCreateClient(name);
export const upsertClient = (c: Client): Promise<void> => store.upsertClient(c);
export const deleteClient = (id: string): Promise<void> => store.deleteClient(id);
export const saveRate = (rate: number): Promise<void> => store.saveRate(rate);
export const rotateIcsToken = (): Promise<string> => store.rotateIcsToken();

/** Шлях до JSON-файлу — тільки коли він і є сховищем. */
export const dataFilePath = storageKind === "json" ? json.dataFilePath : null;
