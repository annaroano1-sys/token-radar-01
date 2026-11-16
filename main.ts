// Token Radar — a pre-token protocol board, fitted from the snapshot's own figures.
//
// The program reads the sealed DefiLlama snapshot, fits a value model on the
// protocols that already have a token, prices every pre-token protocol with
// that model, and writes the ranked board, the dashboard data, the screenshots
// and the dossier. Standard library only, fully deterministic: the same input
// bytes always produce the same output bytes (no clock, no randomness).
//
// The fit is a median (least-absolute-deviation) regression on log market cap
// — the conditional median, not the conditional mean — because the comps'
// market-cap/TVL ratios spread over four orders of magnitude and a few
// outliers would drag a least-squares fit. It is solved by iteratively
// reweighted least squares (soft LAD: weight 1/max(|residual|, 0.1 dex)).
// Features: log10(TVL), log1p(chain count), and an Ethereum flag — plus a
// shrunk offset per category. Two features were tested and dropped, and the
// dashboard says so: the protocol's age (coefficient ~0 in the full fit, and
// its apparent effect flips sign when the comps change) and the 7-day TVL
// change (a +0.79 growth premium in round 2 that does NOT survive
// out-of-sample validation — dropping it improves the honest 5-fold error
// from x3.09 to x2.97 on the same 92 comps, and a one-week spike of +4448%
// would otherwise 6x a protocol's value). A token below $1M market cap is
// not a meaningful comparable for pricing a launch — those are dead or
// micro-cap records — so the comps are the 79 protocols with mcap >= $1M.
//
// Usage: node main.ts [--input <snapshot.json>]
//   Input  : --input <path>, or /input/snapshot.json by default.
//   Output : $MAKEFUN_OUTPUT_DIR, or /output by default.

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { buildDossier } from './vendor/makefun-board.ts';

// ------------------------------------------------------------------ types

interface Protocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: Protocol[];
  watchlist: string[];
}

// ------------------------------------------------------------------ constants

const AS_OF = '2026-11-14'; // snapshot date; age is measured against it, never the clock.
const BOARD_ROWS = 200; // 40 watchlist + 160 more pre-token protocols.
const TEXT_MAX_BYTES = 65536;

// Categories the house's watchlist rule treats as wrapped, staked or bridged
// products of a token that already trades. A protocol in one of these, with a
// versioned name, or with a wrapped/staked word in its name, is not a genuine
// pre-token candidate, so it is left out of the comps and of the board.
const EXCLUDED_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
]);
const VERSION_SUFFIX = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

function isExcluded(p: Protocol): boolean {
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return true;
  if (VERSION_SUFFIX.test(p.name)) return true;
  const words = p.name.toLowerCase().split(/[^a-z]+/);
  return words.includes('wrapped') || words.includes('staked') || words.includes('staking');
}

// ------------------------------------------------------------------ small helpers

function log10(x: number): number {
  return Math.log(x) / Math.LN10;
}

function ageDays(p: Protocol): number {
  if (p.listed_at === null) return 365; // unknown age: a neutral one year.
  const [y, m, d] = p.listed_at.split('-').map(Number);
  const listed = Date.UTC(y, m - 1, d);
  const [ay, am, ad] = AS_OF.split('-').map(Number);
  const asof = Date.UTC(ay, am - 1, ad);
  const days = Math.floor((asof - listed) / 86400000);
  return days < 0 ? 0 : days;
}

function nChains(p: Protocol): number {
  return p.chains.length;
}

function hasEthereum(p: Protocol): number {
  return p.chains.includes('Ethereum') ? 1 : 0;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 === 1 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

function fmtUsd(n: number): string {
  const whole = Math.round(n);
  return '$' + whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ------------------------------------------------------------------ the value model
//
// log10(market cap) is fitted on the comps (protocols whose token already
// trades) as a median regression: features are a constant, log10(TVL),
// log1p(chain count) and an Ethereum flag. Category offsets are the shrunk
// mean residual of each category (n / (n + 10)), so a category with few comps
// barely moves the price. The fit is solved by iteratively reweighted least
// squares for the conditional median (soft LAD: weight 1/max(|residual|,
// 0.1 dex), started from least squares, up to 60 rounds). A least-squares
// fit is the wrong centre here: the comps' market-cap/TVL ratios spread over
// four orders of magnitude, so a few outliers would drag the mean fit, while
// the median fit tracks the typical comp.
//
// The comps are the protocols with mcap >= $1,000,000 (79 of 92): below that
// a token is a dead or micro-cap record, not a comparable for pricing a
// launch. The 13 dropped are named in the README. Age and 7-day growth are
// NOT features (see the header): both were tested and neither improves
// out-of-sample error.

interface Fit {
  beta: number[]; // [const, logTVL, logChains, hasEth].
  offsets: Record<string, number>; // category -> dex offset, shrunk.
  r2: number;
  nComps: number;
}

function features(p: Protocol): number[] {
  return [1, log10(p.tvl_usd), Math.log1p(nChains(p)), hasEthereum(p)];
}

function solveLinear(a: number[][], b: number[]): number[] {
  const n = a.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[piv][c])) piv = r;
    const tmp = m[c];
    m[c] = m[piv];
    m[piv] = tmp;
    const d = m[c][c];
    for (let j = c; j <= n; j++) m[c][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r !== c && m[r][c] !== 0) {
        const f = m[r][c];
        for (let j = c; j <= n; j++) m[r][j] -= f * m[c][j];
      }
    }
  }
  return m.map((row) => row[n]);
}

function ols(rows: Protocol[]): number[] {
  const k = 4;
  const a: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));
  const b: number[] = new Array(k).fill(0);
  for (const p of rows) {
    const f = features(p);
    const y = log10(p.mcap_usd as number);
    for (let i = 0; i < k; i++) {
      b[i] += f[i] * y;
      for (let j = 0; j < k; j++) a[i][j] += f[i] * f[j];
    }
  }
  return solveLinear(a, b);
}

function wls(rows: Protocol[], weights: number[]): number[] {
  const k = 4;
  const a: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));
  const b: number[] = new Array(k).fill(0);
  rows.forEach((p, idx) => {
    const f = features(p);
    const y = log10(p.mcap_usd as number);
    const w = weights[idx];
    for (let i = 0; i < k; i++) {
      b[i] += w * f[i] * y;
      for (let j = 0; j < k; j++) a[i][j] += w * f[i] * f[j];
    }
  });
  return solveLinear(a, b);
}

// Median (least-absolute-deviation) regression by iteratively reweighted
// least squares, started from the least-squares fit. The weight floor of
// 0.1 dex keeps the iteration stable: residuals under it are weighted almost
// equally, larger ones by 1/|residual|, so the fit tracks the typical comp
// instead of the loudest outliers. Fully deterministic.
function irlsMedian(rows: Protocol[]): number[] {
  let beta = ols(rows);
  for (let it = 0; it < 60; it++) {
    const weights = rows.map((p) => {
      const f = features(p);
      const pred = beta.reduce((s, v, i) => s + v * (f[i] ?? 0), 0);
      const r = Math.abs(log10(p.mcap_usd as number) - pred);
      return 1 / Math.max(r, 0.1);
    });
    const next = wls(rows, weights);
    let maxD = 0;
    for (let i = 0; i < beta.length; i++) maxD = Math.max(maxD, Math.abs(next[i] - beta[i]));
    beta = next;
    if (maxD < 1e-10) break;
  }
  return beta;
}

function categoryOffsets(
  rows: Protocol[],
  beta: number[],
  shrinkK = 10,
): Record<string, number> {
  const byCat = new Map<string, number[]>();
  for (const p of rows) {
    const f = features(p);
    const pred = beta.reduce((s, v, i) => s + v * (f[i] ?? 0), 0);
    const r = log10(p.mcap_usd as number) - pred;
    const cat = p.category ?? 'Uncategorized';
    const list = byCat.get(cat) ?? [];
    list.push(r);
    byCat.set(cat, list);
  }
  const offsets: Record<string, number> = {};
  for (const [cat, rs] of [...byCat.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
    if (rs.length < 3) continue; // too few comps: no offset at all.
    const mean = rs.reduce((s, v) => s + v, 0) / rs.length;
    offsets[cat] = (rs.length / (rs.length + shrinkK)) * mean;
  }
  return offsets;
}

function fitModel(rows: Protocol[]): Fit {
  const beta = irlsMedian(rows);
  const offsets = categoryOffsets(rows, beta);
  // R^2 of the full model (regression + offsets) on the comps.
  const ys = rows.map((p) => log10(p.mcap_usd as number));
  const mean = ys.reduce((s, v) => s + v, 0) / ys.length;
  let ssRes = 0;
  let ssTot = 0;
  for (const p of rows) {
    const y = log10(p.mcap_usd as number);
    ssTot += (y - mean) * (y - mean);
    ssRes += (y - predictWith(beta, offsets, p)) * (y - predictWith(beta, offsets, p));
  }
  return { beta, offsets, r2: 1 - ssRes / ssTot, nComps: rows.length };
}

function predictWith(beta: number[], offsets: Record<string, number>, p: Protocol): number {
  const f = features(p);
  let v = beta.reduce((s, b, i) => s + b * (f[i] ?? 0), 0);
  if (p.category !== null && offsets[p.category] !== undefined) v += offsets[p.category];
  return v;
}

interface OosStats {
  medianFactor: number;
  p80Factor: number;
  n: number;
}

// Out-of-sample validation under four different partitions of the comps, so
// the reported error cannot be a lucky split: mod-5 by sorted slug (the
// reported headline), contiguous blocks, 10-fold, and md5(slug) buckets. Each
// fold refits with the same procedure as the deployed model, so the reported
// error is the procedure's error. A single random 80/20 split is NOT
// reported: across 200 such splits the median error wanders from x1.69 to
// above x4, so any one split's number is mostly luck.
function validateOosOne(comps: Protocol[], foldOf: (i: number, p: Protocol, n: number) => number, nFolds: number): OosStats {
  const sorted = [...comps].sort((a, b) => (a.slug < b.slug ? -1 : 1));
  const errs: number[] = [];
  for (let fold = 0; fold < nFolds; fold++) {
    const test = sorted.filter((p, i) => foldOf(i, p, sorted.length) === fold);
    const train = sorted.filter((p, i) => foldOf(i, p, sorted.length) !== fold);
    const fit = fitModel(train);
    for (const p of test) {
      const pred = predictWith(fit.beta, fit.offsets, p);
      errs.push(Math.abs(log10(p.mcap_usd as number) - pred));
    }
  }
  errs.sort((a, b) => a - b);
  return {
    medianFactor: Math.pow(10, median(errs)),
    p80Factor: Math.pow(10, errs[Math.floor(0.8 * errs.length)]),
    n: errs.length,
  };
}

function md5Bucket(slug: string): number {
  const hex = createHash('md5').update(slug).digest('hex');
  return Number(BigInt('0x' + hex) % 5n);
}

function validateOos(comps: Protocol[]): Record<string, OosStats> {
  return {
    mod5: validateOosOne(comps, (i) => i % 5, 5),
    blocks: validateOosOne(comps, (i, _p, total) => Math.min(4, Math.floor((i * 5) / total)), 5),
    fold10: validateOosOne(comps, (i) => i % 10, 10),
    hash: validateOosOne(comps, (_i, p) => md5Bucket(p.slug), 5),
  };
}

// ------------------------------------------------------------------ farm steps
//
// Concrete steps per protocol, built from its own fields (name, chain,
// category, TVL). Each step names a cost and a duration. The dashboard's
// app.js carries the same generator so the page shows exactly what the board
// promises; a render check compares them row by row.

type StepFn = (p: Protocol) => string[];

function money(n: number): string {
  return fmtUsd(n);
}

// Typical gas for one ordinary transaction on the protocol's main chain, at
// the time of the snapshot. Ethereum is the expensive outlier; the big L2s
// and Solana cost cents. Used so every step names a cost that fits the chain
// it actually runs on.
function gasRange(chain: string): string {
  if (chain === 'Ethereum') return '$2-$8';
  if (chain === 'Base' || chain === 'Arbitrum' || chain === 'Optimism' || chain === 'Unichain') return '$0.10-$0.50';
  if (chain === 'Solana') return 'about $0.01';
  if (chain === 'BSC' || chain === 'BNB Chain') return '$0.10-$0.30';
  if (chain === 'Polygon' || chain === 'Avalanche') return '$0.20-$1';
  return '$0.50-$2';
}

// Size tier of a pre-token protocol, from its TVL. The tier sets the tone of
// the plan: a mega protocol is farmed like an institution would, a small one
// like an early user.
function tvlTier(p: Protocol): string {
  if (p.tvl_usd >= 1e9) return 'one of the largest pre-token protocols';
  if (p.tvl_usd >= 1e8) return 'a large pre-token protocol';
  if (p.tvl_usd >= 1e7) return 'a mid-sized pre-token protocol';
  return 'a smaller pre-token protocol';
}

// Deposit size follows the protocol's TVL tier: a mega protocol is farmed
// with real size, a small one with early-user size. The ranges are the same
// ones the dashboard's generator uses, so the page and the board agree.
function depositRange(p: Protocol): string {
  if (p.tvl_usd >= 1e9) return '$500-$2,000';
  if (p.tvl_usd >= 1e8) return '$200-$500';
  if (p.tvl_usd >= 1e7) return '$100-$300';
  return '$50-$150';
}

function secondRange(p: Protocol): string {
  if (p.tvl_usd >= 1e9) return '$250-$500';
  if (p.tvl_usd >= 1e8) return '$100-$250';
  if (p.tvl_usd >= 1e7) return '$50-$200';
  return '$25-$100';
}

// Total gas for the whole plan: about six transactions (deposit, four weekly
// touches, one second-market move) at the chain's typical gas.
function totalGas(chain: string): string {
  if (chain === 'Ethereum') return '$12-$48';
  if (chain === 'Base' || chain === 'Arbitrum' || chain === 'Optimism' || chain === 'Unichain') return '$0.60-$3';
  if (chain === 'Solana') return 'about $0.06';
  if (chain === 'BSC' || chain === 'BNB Chain') return '$0.60-$1.80';
  if (chain === 'Polygon' || chain === 'Avalanche') return '$1.20-$6';
  return '$3-$12';
}

function chainList(p: Protocol): string {
  if (p.chains.length <= 3) return p.chains.join(', ');
  return p.chains.slice(0, 3).join(', ') + ' and ' + (p.chains.length - 3) + ' more';
}

function stepDeposit(p: Protocol): string {
  return `Deposit ${depositRange(p)} of a blue-chip asset (ETH or a major stablecoin) into ${p.name} on ${p.chains[0]}; with TVL ${money(p.tvl_usd)} it is ${tvlTier(p)}, so expect ${gasRange(p.chains[0])} in gas and 15-30 minutes for the deposit to confirm.`;
}

function stepHold(p: Protocol): string {
  return `Hold the position for at least 30 days without withdrawing; airdrops, if any, typically reward sustained use over 1-3 months, not a single deposit, so set a weekly reminder to check it.`;
}

function stepRepeat(p: Protocol): string {
  return `Repeat a small transaction (deposit, swap or claim) once a week for 4 weeks on ${p.chains[0]}; budget ${gasRange(p.chains[0])} per transaction in gas for the month and keep the transaction hashes as proof.`;
}

function stepSecondMarket(p: Protocol): string {
  if (p.chains.length === 1) {
    return `Use a second market the protocol lists on ${p.chains[0]} (TVL ${money(p.tvl_usd)}) for 14 days to show repeat activity; a second deposit of ${secondRange(p)} costs another ${gasRange(p.chains[0])} in gas.`;
  }
  const other = p.chains[1];
  return `Use a second market the protocol lists — it runs on ${chainList(p)} — starting with ${other} (TVL ${money(p.tvl_usd)}) for 14 days to show multi-market activity; a second deposit of ${secondRange(p)} costs another ${gasRange(other)} in gas.`;
}

function stepTrack(p: Protocol): string {
  return `Track ${p.name} weekly for 6-8 weeks: record your deposits, points or volume in a note, and watch the protocol's announcements for a points program or snapshot date.`;
}

function stepTotal(p: Protocol): string {
  return `Total for this plan: about 6-8 weeks and roughly ${totalGas(p.chains[0])} in gas on ${p.chains[0]}; the capital you put in stays yours to withdraw — the gas is the real cost of farming it.`;
}

function farmSteps(p: Protocol): string[] {
  const cat = p.category ?? '';
  if (cat === 'Lending' || cat === 'CDP' || cat === 'Leveraged Farming' || cat === 'Collateral Management') {
    return [
      stepDeposit(p),
      `Borrow 30-50% of your collateral value in a stablecoin and hold the loan for at least 14 days; interest accrues daily, roughly $0.30-$1.50 per $100 borrowed per month at current rates.`,
      `Repay the loan in two tranches a week apart and re-deposit the repaid collateral to keep your health factor above 1.5; each repayment costs ${gasRange(p.chains[0])} in gas on ${p.chains[0]}.`,
      stepSecondMarket(p),
      stepTrack(p),
      stepTotal(p),
    ];
  }
  if (cat === 'Dexs' || cat === 'Liquidity Manager') {
    return [
      `Swap ${depositRange(p)} through ${p.name} on ${p.chains[0]} in 3-4 trades over two weeks; each swap costs ${gasRange(p.chains[0])} in gas plus the pool fee, and every trade counts as activity.`,
      `Provide ${depositRange(p)} of liquidity to the protocol's deepest pool for at least 30 days; expect ${gasRange(p.chains[0])} in gas to add it and the same again to remove it, plus impermanent loss of a few percent either way.`,
      `Leave the LP position untouched for the full month, then claim any trading fees (usually $1-$10 on a $200 position) before withdrawing; do not exit in the first week.`,
      stepSecondMarket(p),
      stepTrack(p),
      stepTotal(p),
    ];
  }
  if (cat === 'Yield' || cat === 'Yield Aggregator' || cat === 'Risk Curators' || cat === 'Onchain Capital Allocator' || cat === 'Restaking' || cat === 'Staking Pool') {
    return [
      stepDeposit(p),
      `Keep the deposit in the vault for at least 30 days and let the yield compound; withdrawing early usually forfeits the points or multiplier the vault tracks.`,
      `Add a second deposit of ${secondRange(p)} after two weeks to show continued use; the top-up costs ${gasRange(p.chains[0])} in gas on ${p.chains[0]}.`,
      stepSecondMarket(p),
      stepTrack(p),
      stepTotal(p),
    ];
  }
  if (cat === 'Derivatives' || cat === 'Options' || cat === 'Basis Trading' || cat === 'Prediction Market') {
    return [
      `Open a small position of $50-$150 on ${p.name} (${p.chains[0]}) and hold it for at least 7 days; funding or fees run roughly $0.50-$3 per week on a position this size.`,
      `Place 3-5 trades of $25-$75 each over two weeks instead of one large trade; spread-out volume is what farming trackers usually count, and total fees stay under $10.`,
      `Close half the position after 14 days and keep the rest open for another two weeks; each close costs ${gasRange(p.chains[0])} in gas, and a 30-day trading history beats a single day.`,
      stepSecondMarket(p),
      stepTrack(p),
      stepTotal(p),
    ];
  }
  if (cat === 'RWA') {
    return [
      `Buy ${depositRange(p)} of the protocol's tokenized asset on ${p.chains[0]} and hold it for at least 30 days; purchase fees are usually 0.1-0.5% and gas ${gasRange(p.chains[0])}.`,
      `Keep the position through one full yield payout cycle (typically monthly) and reinvest the payout; the cycle length is the honest minimum holding time.`,
      `If the protocol offers a secondary market, make one small buy and one small sell a month apart to show real usage; budget ${gasRange(p.chains[0])} per transaction in gas for both.`,
      stepSecondMarket(p),
      stepTrack(p),
      stepTotal(p),
    ];
  }
  return [
    stepDeposit(p),
    `Use the protocol's main feature on ${p.chains[0]} at least once a week for a month (a swap, a deposit or a claim of $25-$100 each time); total gas for the month is about four transactions at ${gasRange(p.chains[0])} each.`,
    `Try a second feature the protocol offers, such as staking, voting or a points quest, and complete it fully; a finished quest is worth more than three half-finished ones.`,
    stepSecondMarket(p),
    stepTrack(p),
    stepTotal(p),
  ];
}

// ------------------------------------------------------------------ main

function main(): void {
  const args = process.argv.slice(2);
  let inputPath = '/input/snapshot.json';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && i + 1 < args.length) inputPath = args[i + 1];
  }
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  const here = dirname(fileURLToPath(import.meta.url));

  const snap = JSON.parse(readFileSync(inputPath, 'utf8')) as Snapshot;
  const protocols = snap.protocols;
  const watchlist = new Set(snap.watchlist);

  // The comps: protocols whose token already trades, cleaned of the products
  // whose token value does not follow their TVL (exchanges, bridges, liquid
  // staking and versioned products), of records with no usable market cap,
  // and of tokens below $1M market cap — dead or micro-cap records that are
  // not meaningful comparables for pricing a launch (13 dropped; named in
  // the README).
  const comps = protocols.filter(
    (p) => p.mcap_usd !== null && p.mcap_usd >= 1_000_000 && !isExcluded(p),
  );
  const fit = fitModel(comps);
  const oos = validateOos(comps);

  // The board: every watchlist protocol, plus the highest-valued clean
  // pre-token protocols below the floor, to BOARD_ROWS rows in all.
  const cleanPre = protocols.filter((p) => p.mcap_usd === null && !isExcluded(p));
  const scored = cleanPre.map((p) => {
    const f = features(p);
    const base = fit.beta[0] + fit.beta[1] * f[1];
    const chainAdj = fit.beta[2] * f[2] + fit.beta[3] * f[3];
    const catOff = p.category !== null && fit.offsets[p.category] !== undefined ? fit.offsets[p.category] : 0;
    const logVal = base + chainAdj + catOff;
    const value = Math.max(1000, Math.round(Math.pow(10, logVal)));
    return {
      p,
      value,
      base: Math.round(Math.pow(10, base)),
      catMult: Math.pow(10, catOff),
      chainMult: Math.pow(10, chainAdj),
    };
  });
  scored.sort((a, b) => (b.value - a.value) || (a.p.slug < b.p.slug ? -1 : 1));
  const picked = new Map<string, (typeof scored)[number]>();
  for (const s of scored) if (watchlist.has(s.p.slug)) picked.set(s.p.slug, s);
  for (const s of scored) {
    if (picked.size >= BOARD_ROWS) break;
    if (!picked.has(s.p.slug)) picked.set(s.p.slug, s);
  }
  const board = [...picked.values()].sort((a, b) => (b.value - a.value) || (a.p.slug < b.p.slug ? -1 : 1));

  const rows = board.map((s, i) => {
    const p = s.p;
    return {
      slug: p.slug,
      name: p.name,
      rank: i + 1,
      implied_value_usd: s.value,
      farm_steps: farmSteps(p),
      model: {
        tvl_usd: p.tvl_usd,
        change_7d: p.change_7d,
        age_days: ageDays(p),
        category: p.category,
        chains: p.chains,
        watchlist: watchlist.has(p.slug),
        base_usd: s.base,
        category_mult: Number(s.catMult.toFixed(4)),
        chain_mult: Number(s.chainMult.toFixed(4)),
      },
    };
  });

  // The dashboard data: compact rows the page renders, plus the fitted model.
  const dashRows = rows.map((r) => [
    r.slug,
    r.name,
    r.model.category,
    r.model.chains,
    r.model.tvl_usd,
    r.model.change_7d,
    r.model.age_days,
    r.implied_value_usd,
    r.rank,
    r.model.watchlist,
    r.model.base_usd,
    r.model.category_mult,
    r.model.chain_mult,
  ]);
  // The scatter data for the dashboard's evidence plot: one point per comp
  // (log TVL, log market cap, category), plus the median covariates the
  // fitted line is drawn at (median chain count, no Ethereum, no category
  // offset). Compact on purpose: the dossier's text cap is 65,536 bytes.
  const compPoints = comps.map((p) => [
    Number(log10(p.tvl_usd).toFixed(3)),
    Number(log10(p.mcap_usd as number).toFixed(3)),
    p.category ?? 'Uncategorized',
  ]);
  const medChains = median(comps.map((p) => nChains(p)));
  const modelDoc = {
    as_of: snap.as_of,
    n_protocols: protocols.length,
    n_comps: fit.nComps,
    n_board: rows.length,
    n_watchlist: snap.watchlist.length,
    beta: fit.beta.map((v) => Number(v.toFixed(4))),
    offsets: Object.fromEntries(Object.entries(fit.offsets).map(([k, v]) => [k, Number(v.toFixed(4))])),
    r2: Number(fit.r2.toFixed(4)),
    oos_median_factor: Number(oos.mod5.medianFactor.toFixed(2)),
    oos_p80_factor: Number(oos.mod5.p80Factor.toFixed(2)),
    oos_n: oos.mod5.n,
    oos_partitions: Object.fromEntries(
      Object.entries(oos).map(([k, v]) => [k, {
        median: Number(v.medianFactor.toFixed(2)),
        p80: Number(v.p80Factor.toFixed(2)),
      }]),
    ),
    comps: compPoints,
    line_n_chains: medChains,
    line_has_eth: 0,
  };

  mkdirSync(outDir, { recursive: true });
  mkdirSync(join(outDir, 'dashboard'), { recursive: true });
  mkdirSync(join(outDir, 'screenshots'), { recursive: true });

  writeFileSync(join(outDir, 'board.json'), JSON.stringify({ rows }, null, 2) + '\n', 'utf8');

  // Copy the dashboard's own files, then write the generated data beside them.
  const dashSrc = join(here, 'dashboard');
  for (const f of readdirSync(dashSrc)) {
    cpSync(join(dashSrc, f), join(outDir, 'dashboard', f));
  }
  writeFileSync(
    join(outDir, 'dashboard', 'rows.js'),
    'window.TOKEN_RADAR_ROWS = ' + JSON.stringify(dashRows) + ';\n',
    'utf8',
  );
  writeFileSync(
    join(outDir, 'dashboard', 'model.js'),
    'window.TOKEN_RADAR_MODEL = ' + JSON.stringify(modelDoc) + ';\n',
    'utf8',
  );

  // Screenshots ride along when the repository holds them; on a first run
  // before any screenshot exists the dossier is skipped and the run says so.
  const shotsSrc = join(here, 'screenshots');
  const shots = existsSync(shotsSrc) ? readdirSync(shotsSrc).filter((f) => !f.startsWith('.')) : [];
  for (const f of shots) cpSync(join(shotsSrc, f), join(outDir, 'screenshots', f));
  if (shots.length > 0) {
    const dossier = buildDossier(outDir, { text_max_bytes: TEXT_MAX_BYTES });
    writeFileSync(join(outDir, 'dossier.json'), dossier);
  } else {
    console.log('no screenshots yet: dossier skipped (take the screenshots, then run again)');
  }

  console.log(
    `board: ${rows.length} rows, rank 1 ${rows[0].slug} ${fmtUsd(rows[0].implied_value_usd)}, ` +
      `rank ${rows.length} ${fmtUsd(rows[rows.length - 1].implied_value_usd)}`,
  );
  console.log(
    `model: n_comps=${fit.nComps} beta=[${fit.beta.map((v) => v.toFixed(4)).join(', ')}] ` +
      `R2=${fit.r2.toFixed(3)} ` +
      `OOS mod5 median x${oos.mod5.medianFactor.toFixed(2)} p80 x${oos.mod5.p80Factor.toFixed(2)} ` +
      `| blocks x${oos.blocks.medianFactor.toFixed(2)}/x${oos.blocks.p80Factor.toFixed(2)} ` +
      `| fold10 x${oos.fold10.medianFactor.toFixed(2)}/x${oos.fold10.p80Factor.toFixed(2)} ` +
      `| hash x${oos.hash.medianFactor.toFixed(2)}/x${oos.hash.p80Factor.toFixed(2)}`,
  );
  console.log(`watchlist covered: ${rows.filter((r) => r.model.watchlist).length}/${snap.watchlist.length}`);
}

main();
