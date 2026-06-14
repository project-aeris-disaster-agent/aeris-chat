import React from "react";
import { normalizePhoneNumber } from "@/data/emergency-hotlines";

export type MessageEnrichHandlers = {
  /** Opens the in-app PANAHON forecast popup panel (PAGASA / PANAHON taps). */
  onOpenForecast?: () => void;
};

type SourceLink = {
  /** Case-insensitive label as it appears in AERIS responses. */
  label: string;
  /** External URL (used when the source has no in-app panel). */
  url: string;
  /** When true, tapping opens the in-app PANAHON forecast panel instead. */
  opensForecastPanel?: boolean;
};

/**
 * Known sources AERIS cites inline. Order matters: longer / more specific
 * labels must come first so "Project NOAH" wins over a bare "NOAH", etc.
 */
export const SOURCE_LINKS: SourceLink[] = [
  { label: "Open-Meteo", url: "https://open-meteo.com" },
  { label: "Project NOAH", url: "https://noah.up.edu.ph" },
  { label: "PANAHON", url: "https://www.panahon.gov.ph", opensForecastPanel: true },
  { label: "PAGASA", url: "https://www.pagasa.dost.gov.ph", opensForecastPanel: true },
  { label: "NDRRMC", url: "https://ndrrmc.gov.ph" },
  { label: "GDACS", url: "https://www.gdacs.org" },
];

const SOURCE_REGEX = new RegExp(
  `(${SOURCE_LINKS.map((s) => s.label.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")).join("|")})`,
  "gi",
);

/**
 * Philippine phone-number patterns. Deliberately specific to avoid matching
 * coordinates ("121.0223"), percentages, dates ("June 15"), or rainfall
 * figures that appear in forecast answers.
 */
const PHONE_REGEX =
  /(?:\+63|\(0\d{1,2}\)|0\d{2,3})[\s-]?\d{3,4}[\s-]?\d{3,4}|\b\d{4}[\s-]\d{4}\b|\b(?:911|8888|117|143)\b/g;

type Token = { start: number; end: number; node: React.ReactNode };

function sourceNode(
  matchText: string,
  key: string,
  handlers: MessageEnrichHandlers,
): React.ReactNode {
  const entry = SOURCE_LINKS.find(
    (s) => s.label.toLowerCase() === matchText.toLowerCase(),
  );
  if (!entry) return matchText;

  const className =
    "font-medium text-sky-700 underline decoration-dotted underline-offset-2 hover:text-sky-900 dark:text-sky-300 dark:hover:text-sky-100";

  if (entry.opensForecastPanel && handlers.onOpenForecast) {
    return (
      <button
        key={key}
        type="button"
        onClick={handlers.onOpenForecast}
        className={`${className} cursor-pointer bg-transparent p-0`}
        title="Open PANAHON forecast"
      >
        {matchText}
      </button>
    );
  }

  return (
    <a
      key={key}
      href={entry.url}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {matchText}
    </a>
  );
}

function phoneNode(matchText: string, key: string): React.ReactNode {
  const dialable = normalizePhoneNumber(matchText) || matchText.replace(/[^\d+]/g, "");
  if (!dialable || dialable.replace(/\D/g, "").length < 3) return matchText;

  return (
    <a
      key={key}
      href={`tel:${dialable}`}
      className="font-medium text-emerald-700 underline decoration-dotted underline-offset-2 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-100"
      title={`Call ${matchText.trim()}`}
    >
      {matchText}
    </a>
  );
}

/**
 * Splits a plain string into React nodes, linkifying known sources and phone
 * numbers. Non-matching text is returned as-is.
 */
export function enrichString(
  text: string,
  handlers: MessageEnrichHandlers,
  keyPrefix: string,
): React.ReactNode[] {
  const tokens: Token[] = [];

  for (const match of text.matchAll(SOURCE_REGEX)) {
    if (match.index === undefined) continue;
    tokens.push({
      start: match.index,
      end: match.index + match[0].length,
      node: sourceNode(match[0], `${keyPrefix}-s-${match.index}`, handlers),
    });
  }

  for (const match of text.matchAll(PHONE_REGEX)) {
    if (match.index === undefined) continue;
    tokens.push({
      start: match.index,
      end: match.index + match[0].length,
      node: phoneNode(match[0], `${keyPrefix}-p-${match.index}`),
    });
  }

  if (tokens.length === 0) return [text];

  tokens.sort((a, b) => a.start - b.start);

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  for (const token of tokens) {
    if (token.start < cursor) continue; // skip overlapping matches
    if (token.start > cursor) nodes.push(text.slice(cursor, token.start));
    nodes.push(token.node);
    cursor = token.end;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));

  return nodes;
}

/**
 * Processes the direct children of a markdown block element, enriching string
 * segments while leaving already-rendered React elements (bold, links, etc.)
 * untouched. Nested elements are handled by their own component renderers.
 */
export function enrichChildren(
  children: React.ReactNode,
  handlers: MessageEnrichHandlers,
  keyPrefix: string,
): React.ReactNode {
  return React.Children.map(children, (child, index) => {
    if (typeof child === "string") {
      return enrichString(child, handlers, `${keyPrefix}-${index}`);
    }
    return child;
  });
}
