import { z } from "zod";

export const thingSchema = z.object({ name: z.string() });
export type Thing = { name: string };
