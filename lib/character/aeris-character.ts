/**
 * Compiles the AERIS character card (character/aeris.character.json) into a
 * single deterministic system prompt for the citizen-facing POST /api/chat.
 *
 * The card supplies the warm-companion personality, voice, and behavioral
 * style. The Philippines operating context, safety escalation, and the
 * official-source disclaimer are appended here so they are guaranteed present
 * regardless of future card edits.
 *
 * The result is static (no live data), so it is compiled once and cached in
 * module scope. The dashboard agent (/api/llm/chat) is unaffected — it sends
 * its own operational persona.
 */

import character from "@/character/aeris.character.json";

type CharacterCard = {
  name?: string;
  system?: string;
  bio?: string[];
  lore?: string[];
  adjectives?: string[];
  topics?: string[];
  style?: {
    all?: string[];
    chat?: string[];
  };
};

const card = character as CharacterCard;

/** Deterministic Philippines context appended to every citizen persona. */
const PH_OPERATING_CONTEXT = `OPERATING CONTEXT (Philippines)
- You operate in the Philippine disaster-response context. Frame guidance around Philippine hazards: typhoons (bagyo), habagat-enhanced monsoon rains, flooding, storm surge, landslides, and severe rainfall.
- Reference the right authorities: PAGASA for weather and tropical cyclone bulletins, NDRRMC for national disaster coordination, and the user's LGU/barangay for local evacuation orders.
- Use Philippine signal/warning language carefully. Only call something a "PAGASA Signal No. X" or "TCWS" if that exact information is given to you; otherwise describe risk in plain terms.
- If the user writes in Filipino or Taglish, you may mirror their language warmly while keeping safety-critical details clear.`;

const SAFETY_ESCALATION = `SAFETY ESCALATION (highest priority)
- If the user reports an ACTIVE life-threatening situation (trapped, drowning, severe injury, no air, building collapse), STOP and lead with: "Call 911 immediately. NDRRMC hotline: (02) 8911-1406. If you can, share your exact location with rescuers."
- Then give 2-3 minimal, immediate safety actions. Keep them short — every second matters.`;

const DISCLAIMER = `DISCLAIMER
- When giving weather or risk guidance, close with: "Not an official PAGASA product. Follow PAGASA, NDRRMC, and your LGU for evacuation orders."`;

function bullets(items: string[] | undefined): string {
  if (!items || items.length === 0) return "";
  return items.map((line) => `- ${line.trim()}`).join("\n");
}

function buildCitizenSystemPrompt(): string {
  const sections: string[] = [];

  if (card.system?.trim()) {
    sections.push(card.system.trim());
  }

  const intro = [...(card.bio ?? []), ...(card.lore ?? [])]
    .map((line) => line.trim())
    .filter(Boolean);
  if (intro.length > 0) {
    sections.push(`WHO YOU ARE\n${bullets(intro)}`);
  }

  if (card.adjectives && card.adjectives.length > 0) {
    sections.push(`You are: ${card.adjectives.join(", ")}.`);
  }

  if (card.topics && card.topics.length > 0) {
    sections.push(
      `SCOPE — you can help with:\n${bullets(card.topics)}`,
    );
  }

  const styleRules = [...(card.style?.all ?? []), ...(card.style?.chat ?? [])]
    .map((line) => line.trim())
    .filter(Boolean);
  if (styleRules.length > 0) {
    sections.push(`HOW YOU COMMUNICATE\n${bullets(styleRules)}`);
  }

  sections.push(PH_OPERATING_CONTEXT);
  sections.push(SAFETY_ESCALATION);
  sections.push(DISCLAIMER);

  return sections.join("\n\n");
}

let cachedPrompt: string | null = null;

/**
 * Returns the compiled citizen-facing AERIS system prompt. Compiled once and
 * cached for the lifetime of the server process.
 */
export function getCitizenSystemPrompt(): string {
  if (cachedPrompt === null) {
    cachedPrompt = buildCitizenSystemPrompt();
  }
  return cachedPrompt;
}
