# Emergency Directory — Data Policy & Maintenance

The hotline directory ([data/emergency-hotlines.ts](../data/emergency-hotlines.ts))
is the SINGLE source of truth feeding the EmergencyHotlinesModal UI, the
`GET /api/hotlines` endpoint, the chat model's `EMERGENCY_HOTLINES` context,
and the modal's location-aware quick-dial tiles
([lib/emergency/hotlines.ts](../lib/emergency/hotlines.ts) does the selection).
The evacuation-center tool lives in
[lib/emergency/evac-centers.ts](../lib/emergency/evac-centers.ts). A wrong
digit here reaches someone mid-emergency. These rules are not optional.

## Hotline rules

1. **Verified entries carry `sources` and `verifiedAsOf`.** Numbers added or
   corrected in 2026-07 all do; legacy entries without a stamp are inherited
   from the original directory and should gain sources as they are re-checked.
   No NEW entry ships from memory — only from an official agency page or an
   official republication (embassy, LGU, agency social account).
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

[EmergencyHotlinesModal.tsx](../components/chat/EmergencyHotlinesModal.tsx)
receives the banner location as a `position` prop and derives its locale via
`getHotlineLocale`: near Naga (≤25 km) the curated Naga quick-dial set and
"Naga City" tab are preserved unchanged; elsewhere the quick-dial tiles are
composed from the same verified directory (city rescue when within 15 km of a
covered city, regional OCD/MMDA, Red Cross, NDRRMC, PAGASA) and the default
region tab follows the user's region. The broad "NCR" area also holds
utilities/transport desks — those stay in the modal's full searchable list
but are excluded from the emergency tier the chat model and quick access use.
