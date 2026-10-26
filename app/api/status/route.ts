import { connection } from "next/server"
import { llmConfigured } from "@/lib/engine/llm"
import { MODEL, modelIsUsable } from "@/lib/engine/ml"
import { PROVIDERS } from "@/lib/engine/threat-intel"

/** Which optional capabilities this server has enabled. Contains no secrets. */
export async function GET() {
  await connection()
  const network = process.env.QRSHIELD_DISABLE_NETWORK !== "1"
  return Response.json({
    network,
    ml: modelIsUsable() ? { name: MODEL.name, version: MODEL.version } : null,
    llm: llmConfigured(),
    providers: PROVIDERS.map((p) => ({
      id: p.id,
      name: p.name,
      enabled: network && !p.unavailableReason(),
      reason: network ? p.unavailableReason() : "Outbound network checks are disabled",
    })),
  })
}
