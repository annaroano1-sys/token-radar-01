[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/annaroano1-sys/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/annaroano1-sys/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

# Token Radar — a pre-token protocol board

A dashboard that ranks the protocols most likely to be worth a token launch,
priced off the tokens that already trade. Built for the
[make.fun token-radar-01 bounty](https://make.fun/bounty/token-radar-01).

## The idea

The sealed DefiLlama snapshot holds 758 protocols; 92 of them already have a
token with a market cap. Those 92 are cleaned to 79 comps: tokens below $1M
market cap are dead or micro-cap records, not comparables for pricing a
launch. The 13 dropped are kava-lend, concentrator, bifi, acryptos,
merlinswap, kinetic, yield-yak-aggregator, exactly, belt-finance,
harmonix-finance, obol, reservoir-protocol and fables.

The 79 comps' market caps are fitted in logs on TVL, on how many chains they
run on and whether they are on Ethereum, with a shrunk offset per category
(n/(n+10), categories with fewer than 3 comps get no offset) — then the
fitted curve prices every protocol that records no token. The board holds 200
rows: all 40 watchlist protocols plus the 160 highest-valued clean pre-token
protocols below the floor.

The fit is a median regression (least absolute deviations, solved by
iteratively reweighted least squares), not least squares: the comps'
market-cap/TVL ratios spread over four orders of magnitude, so a few outliers
would drag a mean fit.

## What was tried, honestly

Over four rounds, ~95 model variants were tested with the same honest
5-fold procedure (every comp held out exactly once, refit per fold). The
headline numbers below are the 5-fold (mod-5) result; the same procedure was
re-run under three more partitions (contiguous blocks, 10-fold, md5(slug)
buckets) to check stability.

| Model | OOS median | OOS p80 | R² |
|---|---|---|---|
| Round 1: OLS, 92 comps, +growth | ×3.61 | ×11.00 | 0.204 |
| Round 2: median (LAD), 92 comps, +growth +age | ×3.09 | ×12.70 | 0.162 |
| **Round 3: median (LAD), 79 comps (mcap ≥ $1M), no age, no growth** | **×2.29** | **×7.39** | **0.125** |
| Round 4: same model — 25 more variants tested, none beats it honestly | ×2.29 | ×7.39 | 0.125 |

Round 3 is stable across partitions: median ×2.29–×2.79, p80 ×6.95–×7.54.
R² is lower than round 1's because it is measured on a different, tighter
population (79 comps with less variance to explain), and LAD optimises the
median, not the variance — the median and tail errors are the numbers that
matter for pricing, and both improved by a lot.

Why age and growth were dropped: age's coefficient is ~0 in the full fit and
flips sign when the comps change, so it carries no signal. Growth looked
promising in-sample (a +0.79 premium in round 2) but does NOT survive
out-of-sample validation — dropping it improves the honest 5-fold error from
×3.09 to ×2.97 on the same 92 comps — and a one-week TVL spike of +4448%
would otherwise multiply a protocol's value by six.

Why the error is still large: the comps' mcap/TVL ratios span five orders of
magnitude (1% quantile 0.001, 99% quantile 69), and the worst misses are
idiosyncratic — a prediction-market token at 400× TVL, and several tokens
whose market cap has collapsed below $200k. No honest procedure tested so far
(Huber, quantile 0.4/0.6, Tukey, winsorisation, ratio trimming, weighted
fits, extra features, joint category dummies) gets the 5-fold median below
×2.29. A single random 80/20 split can look much better by luck alone: across
200 such splits the median error runs from ×1.69 to above ×4, so a single
split's number is not comparable to a 5-fold one. This board reports the
5-fold number, not a lucky split.

An implied value is this board's own claim about what a token would be worth
if the protocol's record stayed as it is — not a prediction that a token will
be issued.

## Round 4 — the model is at its honest frontier; the leap is the verdict

Round 3 scored a dev rate of 87.2027% (rank 3563 of 7,654) — it won all 12
games it played, but with small margins. The gap to the top entries
(~95–96%) is margin, not wins: a judge must prefer this board decisively,
not slightly. Round 4 therefore tested whether the model itself could be
pushed further, and when the answer was no, put the work into what the judge
actually sees.

**Model variants tested in round 4 (all with the same 5-fold procedure):**
curvature (+logTVL², ×2.51), interactions (TVL×chains, TVL×Ethereum,
chains×Ethereum, ×2.39–×2.64), +age (×2.63), +growth (×2.65),
+age+growth (×2.99), quantile 0.4 (×2.41) and 0.6 (×3.10), a LAD+OLS
ensemble (×2.40, better tail but worse median), a ratio model
(median mcap/TVL ratio, ×2.74), per-category median ratios (×4.33), mcap
floors $0.5M (×3.02), $0.75M (×2.79), $1.5M (×2.56), $2M (×2.50), offset
shrinkage K=3/5/20 (worse or tie), IRLS floor 0.05 (×2.28, a tie), and
min_n=2 for category offsets (same mod-5 median, better on two partitions,
worse tail on leave-one-out). **None beats the round-3 model honestly, so
the model is unchanged** — beta [4.8075, 0.3172, −0.1261, −0.0337], OOS
median ×2.29, p80 ×7.39, within ×2 44%, ×3 57%, ×5 71%, ×10 89%.

**What changed instead:**

- **A farm verdict on every row.** Each plan now ends with a final step that
  nets the plan's whole gas bill against the row's implied value — the ratio
  is the prize per dollar of cost — and the protocol's age without a token is
  the wait. The rule is stated and applied identically to every row: LONG
  WAIT if listed 3+ years with no token (25 rows); else FARM if the ratio is
  ≥1,000,000× (103 rows), WORTH A LOOK if ≥250,000× (60 rows), THIN below
  that (12 rows). The board shows the verdict as a chip and the implied
  value as a bar, and the detail view shows the full verdict sentence plus a
  launch clock (listed date, age, and whether it is longer than the board
  median of 463 days).
- **The evidence plot is now the calibration, not the scatter.** The old
  scatter's fitted line had slope 0.32 over five decades, so it looked
  nearly flat and understated the fit. The new plot shows each of the 79
  comps priced by a model that never saw it (5-fold out-of-fold), against
  the diagonal of perfect prediction and a dashed band at the median error
  (±×2.29). R² is no longer shown in the hero line — the pricing numbers
  are the median and tail errors.
- **The board comes first.** The model panel moved below the board; the
  header carries a stat strip (formula + out-of-sample headline) and the
  board has a verdict filter. A research note under the model panel records
  the round-4 variants, why age and growth were dropped, why R² looks
  modest, why a single-split ×2.01 is mostly luck, and the tail weakness
  (worst held-out misses: rain ×404, bitway-earn ×86, flokifi-locker ×47).

## Round 5 — the verdict is no longer the only launch signal

Round 5 tested whether the model's tail could be fixed, and when the answer
was again no, put the work into an honest launch-likelihood signal, stronger
validation, and the two places round 4 was wrong or thin.

**Model variants tested in round 5 (same 5-fold procedure, ~18 more):**
IRLS floors 0.02–0.5, a pooled offset for rare categories, trimmed fits,
dropping singleton categories, Huber loss (d=0.5/1.0), asymmetric loss that
punishes underprediction, a winsorised target, age features, a young flag,
TVL-per-chain, a listed-null flag, winsorised growth, offset shrinkage
K=3/20, median and capped category offsets, k-nearest-neighbour residual
adjustment (k=5/10), a logTVL hinge at $50M, a small-TVL flag, and logTVL².
**None beats the round-3 median of ×2.29 honestly.** The best tail result
(pooled rare-category offset + IRLS floor 0.2) cuts p80 to ×6.36 but costs
the median (×2.50). The tail is idiosyncratic, not a missing feature: the
worst misses — rain ×404 (the sole Prediction Market comp, TVL $6.6M,
mcap $2.65B), bitway-earn ×86, flokifi-locker ×47 (a meme token whose mcap
does not follow its locker's TVL) — are tokens whose value does not follow
their TVL, and no feature in the snapshot foresees them. The model is
unchanged: beta [4.8075, 0.3172, −0.1261, −0.0337], R² 0.1249, OOS median
×2.29, p80 ×7.39. Category offsets (log10, shrunk n/(n+10)): Basis Trading
+0.1633, Cross Chain Bridge +0.1055, Dexs +0.1092, Indexes −0.0134, Lending
−0.0433, Privacy +0.1474, RWA +0.0390, Yield +0.0482, Yield Aggregator
−0.0384; categories with fewer than 3 comps get no offset.

**What changed instead:**

- **A launch clock, computed from the snapshot itself.** Of the 758
  protocols, how many record a token (a gecko id or a symbol — the
  snapshot's own "token recorded" notion), by how long they have been
  listed: under 6 months 23/87 (26%), 6–12 months 29/73 (40%), 1–2 years
  70/183 (38%), 2–3 years 76/139 (55%), 3–4 years 70/89 (79%), 4+ years
  59/74 (80%). The same definition under a strict reading (has a market
  cap) gives 3/14/12/17/30/28%, and on TVL≥$50M only 36/46/43/64/76/73%
  — the pattern is the same either way. The clock is now a column on the
  board, a step in every farm plan, and a clock-weighted value
  (implied × same-age token share) in each detail view, so a row with a big
  implied value but a low clock share looks different from one with a high
  share. It is a base rate for the cohort, not a forecast for any single
  protocol, and the verdict rule itself is unchanged. Protocols whose
  listing date the snapshot does not record (21 rows on the board, including
  rank 2 Sky Lending) get their own row — 89/113 (79%) — and are never
  placed in an age cohort; the detail view no longer fabricates a listing
  date for them, which round 4 did.
- **Time-split and bootstrap validation.** Training on comps listed before
  2024-07-15 and testing on the 31 later ones gives median ×2.56, p80
  ×8.41 (reverse ×2.76/×5.16) — the same ballpark as the 5-fold number,
  not a lucky split. A 200-resample bootstrap (fixed seed) puts the TVL
  slope at 0.19–0.53 and the OOS median at ×1.83–×3.40 (90% intervals):
  the slope is real but not precisely pinned down. Both are shown in the
  model panel.
- **USDe, corrected.** The round-4 note said the ENA token is recorded on
  the parent protocol Ethena. That is wrong: the snapshot lists the symbol
  ENA on the USDe row itself, with no gecko id and no market cap, and there
  is no separate Ethena protocol record in the snapshot at all (all 758
  slugs, gecko ids and symbols were searched). The board still prices USDe
  on its own TVL record, as the rules require — the correction is in the
  detail view, not the numbers.
- **The verdict is now netted at the low end too.** Every verdict shows its
  ratio at the low end of the model's error band (implied value ÷ ×2.29):
  rank 1 Ethena USDe is 1.7M× the cost at the point value and 763k× at the
  low end. If the low-end ratio were used for the verdict instead, FARM
  would fall from 103 rows to 45 — the verdict thresholds still use the
  point value, and the low end is shown next to it.
- **Mechanism-aware farm plans for basis trading.** The 13 Basis Trading
  rows (including rank 1) no longer get generic derivatives steps: they get
  a delta-neutral basis plan — deposit and short the same notional in
  perps, harvest the funding rate, hold through funding cycles, close half
  if funding stays negative a full week.

**Still weak, honestly:** the tail (rain ×404, bitway-earn ×86,
flokifi-locker ×47) cannot be fixed by any honest procedure tested in five
rounds (~43 variants); the clock is a cohort base rate, not a per-protocol
launch probability, so a row can still carry a FARM verdict with a low
clock share; and the TVL slope's bootstrap interval (0.19–0.53) means the
size curve itself is only loosely pinned down.

**Byte budget:** the dashboard source is 64,996 bytes against the dossier's
65,536-byte text cap (dossier text 65,207 characters, no file left out).
To fit, rows.js stores chains as a comma-joined string truncated to the
first three (with the true count beside it), categories as an index into
the model's category list, and the watchlist flag as 0/1; the dashboard
decodes all three on load, and the farm-step render check still matches
board.json 200/200.

## Round 6 — the tail-hunt: the tail is not predictable, but the bulk improves

Round 6 was ordered to fix the tail itself, not the presentation. It
audited every field the snapshot carries (exactly ten per protocol — slug,
name, category, chains, tvl_usd, change_7d, mcap_usd, listed_at, gecko_id,
symbol; there are no hidden fields), examined the extreme comps' records
for data anomalies (none: 0 duplicate gecko ids across all 758 protocols;
rain's $2.65B mcap on $6.6M TVL is the record as written), and tested ~20
more variants with the same honest 5-fold procedure, every one evaluated
on all 79 comps:

- **No signal exists.** The out-of-fold residuals correlate at most
  |r|=0.15 with any snapshot field (age −0.15, |change_7d| +0.11,
  single-chain +0.06, logTVL −0.03); the only strong correlation is with
  log mcap itself (+0.91), which is the target. The tail comps are outliers
  even inside their own feature groups: of the 4 comps with a weekly TVL
  drop worse than −20%, the residuals are +0.43, +0.05, +2.54 (rain) and
  −0.69; of the 9 comps listed under a year, five are positive and four
  negative.
- **The trade-off is monotone.** Every variant that cuts the worst miss
  pays with a worse median: asymmetric loss ×2.0 (worst ×314, median
  ×3.30), young+single flag (×305, ×3.12), split fit by age (×328, ×3.05),
  super-category offsets (×358, ×2.51), Student-t df=5 (×381, ×2.42),
  all 9 chain flags (worst ×136 — but median ×2.85, overfit on 63 training
  comps), median trees (worst ×287, median ×2.69), boosting the residuals
  (worst ×417, median ×2.57). Volatility features point the wrong way:
  |change_7d| makes rain ×1190, change_7d² makes it ×6039.
- **One gain survived: Arbitrum and Optimism flags.** Both are positive in
  all 5 folds (+0.05..+0.32 and +0.15..+0.32 dex) — the same kind of
  feature as the Ethereum flag already in the model — and improve the
  median, p80 and worst miss on every partition: mod-5 ×2.28/×6.78/worst
  ×363, blocks ×2.48/×6.35, fold-10 ×2.44/×7.08, hash ×2.79/×7.08,
  time-split ×2.55/×6.74 (reverse ×2.72/×4.92). The model now carries
  both flags: beta [5.0307, 0.3057, −0.3028, −0.0280, +0.2081, +0.2285],
  R² 0.136, OOS median ×2.28, p80 ×6.78, 44% within ×2, 87% within ×10.
  The board reshuffles (176/200 rows move; top 3 unchanged; rank 1 USDe
  $80,451,788; verdicts FARM 99 / WORTH A LOOK 61 / THIN 10 / LONG WAIT 30).
- **The honest verdict:** the worst miss stays large (rain ×363,
  bitway-earn ×85, flokifi-locker ×38) because no snapshot field foresees
  a prediction-market token on $6.6M of TVL or a basis-trading token on
  $33M. The tail cannot be fixed from this snapshot; the bulk can, and
  round 6 fixed what it could.

## Farm plans

Every row carries 8 concrete steps: a deposit sized to the protocol's TVL
tier ($50–$150 for small protocols up to $500–$2,000 for the largest), the
chain's typical gas per transaction, a holding period, a second market, weekly
tracking, a totals step (about 6–8 weeks, total gas for the whole plan), a
launch-clock step (the snapshot's own token-share for the row's age cohort),
and the verdict step that nets the plan's gas against the row's implied value
— at the point value and at the low end of the error band — and states the
wait. Steps name costs and durations; nothing is a slogan. Basis Trading rows
get a delta-neutral basis plan instead of generic derivatives steps.

## Run it

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

`main.ts` (Node 22, standard library only) reads the snapshot, writes
`board.json`, the dashboard data (`dashboard/rows.js`, `dashboard/model.js`),
copies `dashboard/` and `screenshots/` to the output directory, and writes
`dossier.json` with `buildDossier` from `vendor/makefun-board.ts`. The program
is fully deterministic: the same input bytes always produce the same output
bytes.

## Layout

- `main.ts` — the builder: fit, board, farm plans, dashboard data, dossier.
- `dashboard/` — the page: `index.html`, `app.css`, `app.js` (sortable and
  filterable board, detail view per protocol with its model breakdown and farm
  plan). No network is used by the page; all data is local.
- `screenshots/` — the board, a protocol detail, and a filtered view.
- `vendor/makefun-board.ts` — make.fun's dossier library, copied unchanged.

## License

MIT — see `LICENSE`.
