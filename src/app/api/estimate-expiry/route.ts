import { z } from "zod";
import { generateObject } from "@/lib/server/ai";
import { errorResponse, HttpError, requireUid } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/rate-limit";
import { LOCATIONS } from "@/lib/types";

const Input = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().max(40).default("other"),
  location: z.enum(LOCATIONS),
});

const Output = z.object({
  days: z.number().int().describe("Whole days the item stays good from today, as stored."),
});

const SYSTEM = `You estimate how long groceries stay safe and good to eat.
Given a food item, its category, and where it is stored (fridge, freezer, or pantry), answer with the number of whole days it keeps starting today, assuming it was just bought and is unopened.
Be conservative: when unsure, choose the shorter end of the typical range, especially for meat, poultry, seafood, dairy, and cooked food.
If the item is not normally stored in that location, estimate for how it would actually hold up there.`;

export async function POST(req: Request) {
  try {
    const uid = await requireUid(req);
    rateLimit(uid, "estimate-expiry", 30);

    const parsed = Input.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "Expected { name, category, location }");
    const { name, category, location } = parsed.data;

    const { days } = await generateObject({
      task: "estimateExpiry",
      system: SYSTEM,
      content: JSON.stringify({ name, category, location }),
      schema: Output,
    });

    return Response.json({ days: Math.min(Math.max(Math.round(days), 0), 1095) });
  } catch (err) {
    return errorResponse(err);
  }
}
