# Emergency Directory — Data Policy & Maintenance

The hotline directory ([data/ph-hotlines.ts](../data/ph-hotlines.ts)) and the
evacuation-center tool ([lib/emergency/evac-centers.ts](../lib/emergency/evac-centers.ts))
feed BOTH the chat model's context and the Quick Access UI. A wrong digit here
reaches someone mid-emergency. These rules are not optional.

## Hotline rules

1. **Every entry carries `sources` and `verifiedAsOf`.** No entry ships from
   memory — only from an official agency page or an official republication
   (embassy, LGU, agency social account), captured in the entry.
2. **Number-format discipline.** The 2019 PLDT 8-digit migration applies to
   the (02) Metro Manila area code ONLY. Provincial landlines stay 7-digit
   (confirmed against OCD R7's own directory). Aggregators that show 8-digit
   provincial numbers have prepended digits erroneously — do not copy them.
3. **Conflicts resolve toward the agency's own page.** If two sources
   disagree and neither is the agency itself, omit the number. A missing
   local number degrades to 911 (unified nationwide since June 2026, per PIA);
   a wrong number strands a caller.
4. **The chat persona may state ONLY prompt-scripted numbers or numbers in an
   `EMERGENCY_HOTLINES` context block** (enforced in
   [aeris-character.ts](../lib/character/aeris-character.ts)). Adding a
   hotline to the dataset is the only correct way to let AERIS say it.
5. **Re-verify every 6 months** (next due: 2027-01) and after any LGU/agency
   reorganization. Update `verifiedAsOf` only after re-checking the source.

## Location tiers

`getHotlineDirectory(lat, lng)` resolves coordinates → nearest known city →
province → administrative region (including NIR, re-established 2024).
Display order and model preference: **city → regional → national**, with 911
always presented first for life-threatening situations. Coordinates more than
150 km from any known city (or outside PH) resolve to the national tier only —
we never guess a region.

## Evacuation centers

We deliberately do **NOT** hardcode evacuation-center lists. Official LGU
lists are activated per-event and go stale within months (the newest public
Marikina list found dates to 2012). Instead the `find_evac_centers` tool
queries OpenStreetMap live (Overpass API, 3 endpoint fallbacks, 10-minute
cache) for facilities tagged `emergency=evacuation_centre` or
`shelter_type=evacuation`:

- Unnamed and "Possible evacuation center" mappings are filtered out — we
  never send someone to a guess.
- Every response carries OSM attribution and the advisory to **confirm the
  center is open with the barangay/LGU before traveling**; the persona is
  required to relay it.
- When Overpass is unavailable, the model must fall back to referring the
  user to their barangay or city DRRMO (verified hotlines above) — tested
  behavior, not an accident.

## Quick Access UI

[HotlinesQuickAccess.tsx](../components/chat/HotlinesQuickAccess.tsx) (phone
icon, top-right) fetches `GET /api/hotlines?lat=&lng=` with the banner
location. City tier shows when the user is within 15 km of a city with
verified numbers; otherwise the regional tier is the default, national always
present. Numbers render as `tel:` links for one-tap dialing.
