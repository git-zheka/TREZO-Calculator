"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import * as db from "@/lib/db";
import { COOKIE, COOKIE_OPTIONS, checkPassword, issueToken } from "@/lib/auth";
import type { Client, Gear, Order } from "@/lib/types";

/* ---------- авторизація ---------- */

export type LoginState = { error?: string };

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const pass = String(form.get("password") ?? "");
  if (!pass) return { error: "Введи пароль" };
  if (!checkPassword(pass)) return { error: "Пароль не підходить" };
  (await cookies()).set(COOKIE, await issueToken(), COOKIE_OPTIONS);
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(COOKIE);
  redirect("/login");
}

/* ---------- замовлення ---------- */

export async function saveOrder(order: Order) {
  const next = { ...order };
  if (next.clientName?.trim()) {
    const client = await db.findOrCreateClient(next.clientName);
    if (client) {
      next.clientId = client.id;
      next.clientName = client.name;
    }
  } else {
    next.clientId = null;
  }
  if (!next.title.trim()) next.title = next.clientName || "Замовлення";
  await db.upsertOrder(next);
  revalidatePath("/");
}

export async function removeOrder(id: string) {
  await db.deleteOrder(id);
  revalidatePath("/");
}

/* ---------- обладнання ---------- */

export async function saveGear(gear: Gear) {
  await db.upsertGear(gear);
  revalidatePath("/");
}

export async function reorderGear(ids: string[]) {
  await db.reorderGear(ids);
  revalidatePath("/");
}

export async function removeGear(id: string) {
  await db.deleteGear(id);
  revalidatePath("/");
}

/* ---------- замовники ---------- */

export async function saveClient(client: Client) {
  await db.upsertClient({ ...client, name: client.name.trim() });
  revalidatePath("/");
}

export async function removeClient(id: string) {
  await db.deleteClient(id);
  revalidatePath("/");
}

/* ---------- налаштування ---------- */

export async function setRate(rate: number) {
  await db.saveRate(Number.isFinite(rate) ? rate : 0);
  revalidatePath("/");
}

export async function rotateIcsToken() {
  const token = await db.rotateIcsToken();
  revalidatePath("/");
  return token;
}
