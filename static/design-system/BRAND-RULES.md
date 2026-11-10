Good Business Pays is a social movement calling for an end to late and slow payments to SMEs. The brand should feel like a campaign, not a corporate: bold, a bit rough around the edges, and always positive about what paying sooner makes possible.

## Content fundamentals

**The core line.** Every hero headline uses the today/tomorrow construct: *Good business is … today, not tomorrow* or *Good business is … today, so … tomorrow*. Approved headlines:

- Good business is getting businesses paid today, not tomorrow.
- Good business is getting invoices paid today, not tomorrow.
- Good business is getting your business paid today, not tomorrow.
- Good business is paying today, so tomorrow's economy can grow.
- Good business is paying today, so suppliers can invest tomorrow.
- Good business is paying today, to keep suppliers open tomorrow.
- Good business is paying today, not in 30, 60, 90 or 120 days time.
- Good business is paying SMEs today, so they can thrive tomorrow.
- Good business is paying suppliers faster to build back a better economy.

**Tone.** Positive first: say what paying sooner makes possible (growth, jobs, staying open), not who is to blame. It is predominantly B2B, but it must not read like a stereotypical business campaign. It has an edge and a bit of bite; it is never polished or corporate. Negative stories (a business owner who had to borrow from family) are always set under a positive headline so Good Business Pays is the answer.

**Voice.** "We" is the movement; "you" is the reader. UK English. Short sentences. Facts over adjectives, and every number has a source:

- Over 50,000 SMEs close a year due to cash flow problems.
- SMEs account for 52% of UK enterprises and employ 61% of the workforce.
- It can take 90 days or more for a small business to get paid by larger corporates.

**Calls to action.** "Sign up to show your support." on posters; "Sign up" / "Sign up here" on buttons; "Join the movement" in body copy. Verb first, sentence case.

**Casing and spelling.** Headlines in uppercase artwork; the same lines in sentence case in body copy and page titles. SMEs, never SME's. The hashtag is #GoodBusinessPays in copy and #GOODBUSINESSPAYS on artwork. No emoji.

## Visual foundations

**Colour.** Two greens carry the brand. Set headlines in `headline` on `surface`: signal green on `deep` for the hero posters, `forest` on white for photography layouts. `sky` is a minor accent for the white logo only; any text on it is `forest`. Never set `signal` text on white.

**The key word.** Every headline highlights exactly one word (usually TODAY, or PAID, GROW, OPEN, ECONOMY). On dark grounds the word turns `keyword` (white) with a white brush underline. On white grounds it stays `forest` and gets a `mark` (signal) brush underline or a loose circular scribble. Use the `Headline` component; never highlight two words.

**Typography.** The campaign headline face is a condensed, distressed grotesque set uppercase and fully justified, so each line fills the measure. Here it is set in `display` (Oswald 700) with the `poster`, `headline-l` and `headline-m` styles. Body and UI are `sans` (Poppins): `lead`, `body`, `body-sm`, `label`. Quotes and the supporter line use `secondary` (Hind 700). When a headline has to sit beside the logo, the justified rule can break to make room.

**Texture.** Hero artwork carries a distressed print texture (see the Campaign group) over flat colour. Texture is for artwork only, never UI.

**Graphical elements.** The "P" from the logo, drawn as a thick open ring with a stem, frames people. Rings and quarter-arcs in `signal` or white bleed off the edges of layouts. Stroke width follows `space-6` at web scale.

**Imagery.** Real small business owners, cut out, looking at the camera, in their working clothes (aprons, workshop wear). Crop so part of the body, an arm or something they hold, overlaps the P frame. No stock handshakes, no offices.

**Illustration.** Hand-lettered illustrations that make the headline the picture (an hourglass, a rubber stamp, an open sign, a graph arrow). Simple block colours, the illustrator's hand visible, legible at small sizes, built in layers so they can be animated.

**Shape and layout.** Square edges (`radius-none`) on posters, banners, cards and social tiles. Buttons are the exception: `radius-pill` on the site, `radius-sm` on banners. Generous margins (`space-7` to `space-9`); headline left or centred, supporting copy beneath at `space-5`. No shadows.

**States.** Buttons darken nothing; hover underlines the label. Focus is a 2px `focus` ring with 2px offset on every surface.

## Portal and data

The portal is a tool, not a poster. Keep campaign energy in the hero and the closing call to action; keep the results area calm and readable.

- **Headings.** Use `Headline` (with its key word) only for approved campaign lines, once per screen at most. Every other screen heading (a company name, "Search results", "Sector analysis") uses `PageHeading`: `page-heading` style, uppercase, no key word, no underline. Card titles use `card-title`, sentence case.
- **Search.** Use `SearchField`. The field is a white `radius-pill` with the pill button inside it, so field and button read as one shape. It sits on `deep` in the hero; on white grounds it carries a 2px `search-edge`.
- **Grounds.** Results sit on `surface` (white) with `DataCard`s on `surface-alt`. Cards and panels stay square (`radius-none`); only buttons and the search pill are round.
- **Numbers.** Lead with up to three `StatCallout`s, each with its comparison or source in the source line (for example, the sector average).
- **Charts.** Use `DistributionBar` for shares that add to 100% and `BarTrend` for a value over reporting periods. Series colours run `chart-1` (forest), `chart-2` (signal), `chart-3` (sky), in that order, and differ in lightness as well as hue. `chart-2` on white always carries the 2px `chart-edge`, because signal green alone is 1.35:1 on white. Label every segment and bar with its value; the legend repeats the words.
- **Ratings (RAG).** Performance is rated on a five-step scale: `rag-1` Excellent (green), `rag-2` Good (yellow), `rag-3` Fair (amber), `rag-4` Poor (red), `rag-5` Very poor (deep red), with text in the matching `on-rag-*` token. Green is the brand's `signal`, so "good" reads as Good Business Pays. Every rating colour is always paired with its word (in a `StatusBadge`, a pin or a legend), never colour alone. Use ratings only in the portal and reports, never in campaign artwork.
- **Keep ratings quiet.** Colour helps interpretation; it is not the design. Use the pastel `rag-*-soft` tints for context (other benchmark bands, distribution segments, badge chips, secondary dots) and the full `rag-*` colour only for the featured value: the company's own band, or the one emphasised point. Badges are a pale chip with a small full-colour dot, never a solid block. Big numbers, headings and buttons never take rating colours.
- **What earns which rating.** Benchmark bands map one to one, best band `rag-1` to worst `rag-5`. Payment timing and terms follow the pledge: 30 days or less is `rag-1`, 31 to 60 days `rag-3`, over 60 days `rag-5`. Give each `DataCard` that carries a judgement a `status` so the rating is visible before reading the chart.
- **Benchmarks.** To show where a company sits against other UK companies, use `BenchmarkScale`: five equal rating bands, the company's band taller with a forest edge and its value and rating in a pin above, "Faster" and "Slower" (or "Fewer late" and "More late") at the ends.
- **Ranges.** Show payment terms (minimum, standard, maximum) with `RangeLine` on a 0 to 120 day axis, the standard term emphasised, and the 30-day pledge marked as a dashed target line.
- **Performance first, reference second.** On a company report the performance data is the point. Put the identifying facts in the `PageHeading` meta, in `ink-muted`: company number, sector and registered address on the first line, the reporting period on its own second line. Then go straight to the performance report. Remaining reference details (business activity) sit below the data as a quiet reference block: a small section label and a `compact` `DetailList`, no card, no badge.
- **Facts.** Company details and other label/value facts use `DetailList`, never a table.
- **Header search.** On results screens put the compact `SearchField` (`size="sm"`, icon button) in the header so people can check another company without going back.
- **Third-party data.** Data from partners (such as Company Watch risk ratings) sits in its own clearly titled `DataCard`, credits the partner, and shows "Not available" rather than a dash when a value is missing. Long definitions go behind a "What these mean" disclosure.
- **Honesty.** Show the reporting period and the data source on every results screen. Mark sample or modelled numbers clearly.

## Logos

Use the files in the Logos group; never redraw the mark.

- `gbp-logo-reversed` (green mark, white words) on `deep` and `forest`. The default.
- `gbp-logo-colour` (green mark, forest words) on white and `paper`.
- `gbp-logo-forest` (all forest) on `signal`.
- `gbp-logo-white` (all white) on `sky` or photography.
- `gbp-mark-green` alone for avatars and favicons.

The `Logo` component reads these files from this system. On a page hosted anywhere else, upload the logo files there and either call `GBP.configure({ logos: { reversed: "<url>", colour: "<url>", forest: "<url>", white: "<url>", mark: "<url>" } })` once before rendering, or pass `src` to `Logo` (and `logoSrc` to `Banner` and `SupporterLockup`). Without that the logo will not load.

Clear space is the height of one loop of the mark on every side. The earlier rounded-square app-tile logo with "Good Business Pays" in title case is retired.

**Supporter lockups.** "We're a proud supporter of Good Business Pays" in `supporter`, wider than the two logos beneath it, the GBP logo always on the left, a `hairline` rule between the two logos. Use `SupporterLockup`.

## Iconography

The sources define no icon set. The brand uses illustration and the P motif instead of icons. If UI needs icons, use a simple 2px-stroke outline set in `ink` and keep them out of campaign artwork.

## Components

- `Button` for Sign up actions.
- `Logo` for every logo placement.
- `Headline` for any today/tomorrow line, with its one key word.
- `PageHeading` for every other screen heading.
- `SearchField` for company search.
- `DataCard`, `DistributionBar` and `BarTrend` for portal results.
- `BenchmarkScale`, `RangeLine` and `DetailList` for company reports.
- `StatusBadge` for a rating word in its RAG colour.
- `SupportBlock` for the stat, the ask and the hashtag under a headline.
- `StatCallout` for a single sourced number.
- `Banner` for the FSB-style three-stage leaderboard.
- `QuoteCard` for business-owner quotes on social.
- `StoryTitle` for Good Business Pays Stories video title cards.
- `SupporterLockup` for partner announcements.
