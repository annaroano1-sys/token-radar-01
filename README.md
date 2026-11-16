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

Over three rounds, ~70 model variants were tested with the same honest
5-fold procedure (every comp held out exactly once, refit per fold). The
headline numbers below are the 5-fold (mod-5) result; the same procedure was
re-run under three more partitions (contiguous blocks, 10-fold, md5(slug)
buckets) to check stability.

| Model | OOS median | OOS p80 | R² |
|---|---|---|---|
| Round 1: OLS, 92 comps, +growth | ×3.61 | ×11.00 | 0.204 |
| Round 2: median (LAD), 92 comps, +growth +age | ×3.09 | ×12.70 | 0.162 |
| **Round 3: median (LAD), 79 comps (mcap ≥ $1M), no age, no growth** | **×2.29** | **×7.39** | **0.125** |

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

## Farm plans

Every row carries 6 concrete steps: a deposit sized to the protocol's TVL
tier ($50–$150 for small protocols up to $500–$2,000 for the largest), the
chain's typical gas per transaction, a holding period, a second market, weekly
tracking, and a totals step (about 6–8 weeks, total gas for the whole plan).
Steps name costs and durations; nothing is a slogan.

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
