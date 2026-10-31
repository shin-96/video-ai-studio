import { testKey } from "@/lib/providers";
import { err } from "@/lib/refs";

export async function POST(req: Request) {
  try {
    const { provider } = await req.json();
    if (provider !== "openai" && provider !== "gemini") throw new Error("Provider không hợp lệ.");
    return Response.json(await testKey(provider));
  } catch (e) { return err(e); }
}
