import { loadForIcs } from "@/lib/db";
import { buildIcs } from "@/lib/ics";

export const dynamic = "force-dynamic";

/**
 * Публічний (за секретом у шляху) фід календаря.
 * Google Календар / Apple Calendar підписуються на цей URL і перечитують його самі —
 * ніякого OAuth, ніякої синхронізації руками. Токен ротується в налаштуваннях.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  let orders;
  try {
    orders = await loadForIcs(token);
  } catch {
    // Календарний клієнт має відрізняти «немає такого фіду» від «база лягла»,
    // інакше Google може відписатись назавжди.
    return new Response("Calendar temporarily unavailable", { status: 503 });
  }
  if (!orders) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(buildIcs(orders), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "cache-control": "public, max-age=600",
      "content-disposition": 'inline; filename="rider.ics"',
    },
  });
}
