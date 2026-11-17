// Token Radar dashboard: renders the fitted board, filters and sorts it, and
// shows each protocol's model breakdown and farm plan. All data is local
// (rows.js, model.js); the page makes no network request of any kind.

var MODEL = window.TOKEN_RADAR_MODEL;
var ROWS = window.TOKEN_RADAR_ROWS.map(function (r) {
  return {
    slug: r[0], name: r[1], category: r[2] === null ? null : MODEL.categories[r[2]],
    chains: r[3].split(','), tvl: r[4],
    change: r[5], age: r[6], value: r[7], rank: r[8], watchlist: r[9] === 1,
    base: r[10], catMult: r[11], chainMult: r[12], nChains: r[13], noDate: r[14],
  };
});

// --- formatting

function fmtUsd(n) {
  return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function fmtPct(v) {
  if (v === null || v === undefined) return '—';
  return (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
}
function fmtAge(days) {
  if (days < 365) return Math.round(days) + 'd';
  return (days / 365).toFixed(1) + 'y';
}
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
// Long chain lists wrap badly in the table; show the first three and count the rest.
function shortChains(p) {
  if (p.nChains <= 3) return p.chains.join(', ');
  return p.chains.slice(0, 3).join(', ') + ' +' + (p.nChains - 3);
}

// --- farm steps (same generator as the board builder, main.ts)

function gasRange(chain) {
  if (chain === 'Ethereum') return '$2-$8';
  if (chain === 'Base' || chain === 'Arbitrum' || chain === 'Optimism' || chain === 'Unichain') return '$0.10-$0.50';
  if (chain === 'Solana') return 'about $0.01';
  if (chain === 'BSC' || chain === 'BNB Chain') return '$0.10-$0.30';
  if (chain === 'Polygon' || chain === 'Avalanche') return '$0.20-$1';
  return '$0.50-$2';
}
function tvlTier(p) {
  if (p.tvl >= 1e9) return 'one of the largest pre-token protocols';
  if (p.tvl >= 1e8) return 'a large pre-token protocol';
  if (p.tvl >= 1e7) return 'a mid-sized pre-token protocol';
  return 'a smaller pre-token protocol';
}
function chainList(p) {
  if (p.nChains <= 3) return p.chains.join(', ');
  return p.chains.slice(0, 3).join(', ') + ' and ' + (p.nChains - 3) + ' more';
}
function depositRange(p) {
  if (p.tvl >= 1e9) return '$500-$2,000';
  if (p.tvl >= 1e8) return '$200-$500';
  if (p.tvl >= 1e7) return '$100-$300';
  return '$50-$150';
}
function secondRange(p) {
  if (p.tvl >= 1e9) return '$250-$500';
  if (p.tvl >= 1e8) return '$100-$250';
  if (p.tvl >= 1e7) return '$50-$200';
  return '$25-$100';
}
function tradeRange(p) {
  if (p.tvl >= 1e9) return '$200-$500';
  if (p.tvl >= 1e8) return '$100-$300';
  if (p.tvl >= 1e7) return '$50-$150';
  return '$25-$75';
}
function totalGas(chain) {
  if (chain === 'Ethereum') return '$12-$48';
  if (chain === 'Base' || chain === 'Arbitrum' || chain === 'Optimism' || chain === 'Unichain') return '$0.60-$3';
  if (chain === 'Solana') return '$0.06';
  if (chain === 'BSC' || chain === 'BNB Chain') return '$0.60-$1.80';
  if (chain === 'Polygon' || chain === 'Avalanche') return '$1.20-$6';
  return '$3-$12';
}
function stepDeposit(p) {
  return 'Day 1 — Deposit ' + depositRange(p) + ' of a blue-chip asset (ETH or a major stablecoin) into ' + p.name + ' on ' + p.chains[0] + '; with TVL ' + fmtUsd(p.tvl) + ' it is ' + tvlTier(p) + ', so expect ' + gasRange(p.chains[0]) + ' in gas and 15-30 minutes for the deposit to confirm.';
}
function stepSecondMarket(p) {
  if (p.chains.length === 1) {
    return 'Day 14 — Use a second market the protocol lists on ' + p.chains[0] + ' (TVL ' + fmtUsd(p.tvl) + ') for 14 days to show repeat activity; a second deposit of ' + secondRange(p) + ' costs another ' + gasRange(p.chains[0]) + ' in gas.';
  }
  var other = p.chains[1];
  return 'Day 14 — Use a second market the protocol lists — it runs on ' + chainList(p) + ' — starting with ' + other + ' (TVL ' + fmtUsd(p.tvl) + ') for 14 days to show multi-market activity; a second deposit of ' + secondRange(p) + ' costs another ' + gasRange(other) + ' in gas.';
}
function stepTrack(p) {
  return 'Weeks 5–8 — Track ' + p.name + ' weekly: record your deposits, points or volume in a note, and watch the protocol\'s announcements for a points program or snapshot date.';
}
function stepTotal(p) {
  return 'Total for this plan: about 6-8 weeks and roughly ' + totalGas(p.chains[0]) + ' in gas on ' + p.chains[0] + '; the capital you put in stays yours to withdraw — the gas is the real cost of farming it.';
}
// The farm verdict, identical to main.ts: the plan's gas netted against the row's implied value.
var GAS_HIGH = { Ethereum: 48, Base: 3, Arbitrum: 3, Optimism: 3, Unichain: 3, Solana: 0.06, BSC: 1.8, 'BNB Chain': 1.8, Polygon: 6, Avalanche: 6 };
function gasHighNum(chain) { return GAS_HIGH[chain] !== undefined ? GAS_HIGH[chain] : 12; }
function fmtRatio(r) {
  if (r >= 1e6) { var m = r / 1e6; return (m >= 100 ? Math.round(m) : m.toFixed(1)) + 'M×'; }
  return Math.round(r / 1000) + 'k×';
}
function verdictFor(p) {
  if (p.age >= 3 * 365) return 'LONG WAIT';
  var ratio = p.value / gasHighNum(p.chains[0]);
  if (ratio >= 1e6) return 'FARM';
  if (ratio >= 250000) return 'WORTH A LOOK';
  return 'THIN';
}
function verdictStep(p) {
  var gas = totalGas(p.chains[0]);
  var ratio = p.value / gasHighNum(p.chains[0]);
  var lowRatio = p.value / MODEL.oos_median_factor / gasHighNum(p.chains[0]);
  var age = fmtAge(p.age);
  var v = verdictFor(p);
  var gn = gasHighNum(p.chains[0]);
  var be = gn < 1 ? '$' + gn.toFixed(2) : fmtUsd(gn);
  if (v === 'LONG WAIT') {
    return 'Verdict: LONG WAIT — ' + p.name + ' has run ' + age + ' with no token, one of the longest waits on the board, so a token, if it ever comes, is not near. The implied value is ' + fmtUsd(p.value) + ' (' + fmtUsd(p.value / MODEL.oos_median_factor) + ' at the low end) and the plan costs about ' + gas + ' in gas; farm it only if you already use it.';
  }
  var tail = v === 'FARM' ? 'The gas is trivial next to the prize; farm it.'
    : v === 'WORTH A LOOK' ? 'Worth doing if you already use it, but the prize per dollar is middling on this board.'
    : 'Only farm it if you already use it; the gas and the wait are real next to the prize.';
  return 'Verdict: ' + v + ' — the whole plan costs about ' + gas + ' in gas on ' + p.chains[0]
    + ' against a ' + fmtUsd(p.value) + ' implied value (' + fmtRatio(ratio) + ' the cost, ' + fmtRatio(lowRatio)
    + ' at the low end); break-even is any airdrop above ' + be + (v === 'THIN' ? ', the lowest ratio on the board,' : '')
    + ', and ' + p.name + ' has run ' + age + ' with no token. ' + tail;
}
// The launch clock, identical to main.ts: the snapshot's own token-share by age cohort.
var CLOCK_LABELS = ['under 6 months', '6–12 months', '1–2 years', '2–3 years', '3–4 years', '4+ years'];
function clockBucketIndex(p) {
  if (p.noDate) return 6;
  for (var i = 0; i < 6; i++) {
    var b = MODEL.clock[i];
    if (p.age >= b[0] && p.age < b[1]) return i;
  }
  return 5;
}
function clockRate(p) {
  var c = MODEL.clock[clockBucketIndex(p)];
  return Math.round(100 * c[3] / c[2]) + '%';
}
function clockStep(p) {
  var i = clockBucketIndex(p);
  var c = MODEL.clock[i];
  var n = c[2], has = c[3];
  var rate = Math.round(100 * has / n);
  if (p.noDate) {
    return 'Launch clock: ' + p.name + '\'s listing date is not recorded in the snapshot, so the clock cannot place it — ' + has + ' of ' + n + ' protocols with no date record a token (' + rate + '%), but that group is not an age cohort.';
  }
  var label = CLOCK_LABELS[i];
  var age = fmtAge(p.age);
  if (p.age >= 3 * 365) {
    return 'Launch clock: ' + has + ' of ' + n + ' protocols listed ' + label + ' record a token (' + rate + '%) — ' + p.name + ' is ' + age + ' old, in that cohort, and one of the ' + (100 - rate) + '% that do not.';
  }
  return 'Launch clock: ' + has + ' of ' + n + ' protocols listed ' + label + ' record a token (' + rate + '%) — ' + p.name + ' is ' + age + ' old, in that cohort.';
}
function farmSteps(p) {
  var cat = p.category || '';
  if (cat === 'Basis Trading') {
    return [
      'Day 1 — Open a delta-neutral basis position on ' + p.name + ': deposit ' + depositRange(p) + ' on ' + p.chains[0] + ' and short that notional in perps; the funding rate — not the price — is the harvest, roughly $0.50-$3 per $100 per week when funding is positive.',
      'Days 1–30 — Hold the basis through funding cycles; funding flips sign, so one week proves nothing — record each funding payment and net carry weekly.',
      'Day 14 — Close half if funding stays negative a full week; each close costs ' + gasRange(p.chains[0]) + ' in gas, and a 30-day basis history beats a single day.',
      stepSecondMarket(p),
      stepTrack(p),
      stepTotal(p),
      clockStep(p),
      verdictStep(p),
    ];
  }
  if (cat === 'Lending' || cat === 'CDP' || cat === 'Leveraged Farming' || cat === 'Collateral Management') {
    return [
      stepDeposit(p),
      'Days 1–14 — Borrow 30-50% of your collateral value in a stablecoin and hold the loan for at least 14 days; interest accrues daily, roughly $0.30-$1.50 per $100 borrowed per month at current rates.',
      'Days 14–21 — Repay the loan in two tranches a week apart and re-deposit the repaid collateral to keep your health factor above 1.5; each repayment costs ' + gasRange(p.chains[0]) + ' in gas on ' + p.chains[0] + '.',
      stepSecondMarket(p),
      stepTrack(p),
      stepTotal(p),
      clockStep(p),
      verdictStep(p),
    ];
  }
  if (cat === 'Dexs' || cat === 'Liquidity Manager') {
    return [
      'Days 1–14 — Swap ' + depositRange(p) + ' through ' + p.name + ' on ' + p.chains[0] + ' in 3-4 trades over two weeks; each swap costs ' + gasRange(p.chains[0]) + ' in gas plus the pool fee, and every trade counts as activity.',
      'Day 14 — Provide ' + depositRange(p) + ' of liquidity to the protocol\'s deepest pool for at least 30 days; expect ' + gasRange(p.chains[0]) + ' in gas to add it and the same again to remove it, plus impermanent loss of a few percent either way.',
      'Day 44 — Leave the LP position untouched for the full month, then claim any trading fees (usually $1-$10 on a $200 position) before withdrawing; do not exit in the first week.',
      stepSecondMarket(p),
      stepTrack(p),
      stepTotal(p),
      clockStep(p),
      verdictStep(p),
    ];
  }
  if (cat === 'Yield' || cat === 'Yield Aggregator' || cat === 'Risk Curators' || cat === 'Onchain Capital Allocator' || cat === 'Restaking' || cat === 'Staking Pool') {
    return [
      stepDeposit(p),
      'Days 1–30 — Keep the deposit in the vault and let the yield compound; withdrawing early usually forfeits the points or multiplier the vault tracks.',
      'Day 14 — Add a second deposit of ' + secondRange(p) + ' to show continued use; the top-up costs ' + gasRange(p.chains[0]) + ' in gas on ' + p.chains[0] + '.',
      stepSecondMarket(p),
      stepTrack(p),
      stepTotal(p),
      clockStep(p),
      verdictStep(p),
    ];
  }
  if (cat === 'Derivatives' || cat === 'Options' || cat === 'Prediction Market') {
    return [
      'Day 1 — Open a position of ' + tradeRange(p) + ' on ' + p.name + ' (' + p.chains[0] + ') and hold it for at least 7 days; funding or fees run roughly $0.50-$3 per week on a position this size.',
      'Days 1–14 — Place 3-5 trades of ' + tradeRange(p) + ' each over two weeks instead of one large trade; spread-out volume is what farming trackers usually count, and total fees stay under $10.',
      'Day 14 — Close half the position and keep the rest open for another two weeks; each close costs ' + gasRange(p.chains[0]) + ' in gas, and a 30-day trading history beats a single day.',
      stepSecondMarket(p),
      stepTrack(p),
      stepTotal(p),
      clockStep(p),
      verdictStep(p),
    ];
  }
  if (cat === 'RWA') {
    return [
      'Day 1 — Buy ' + depositRange(p) + ' of the protocol\'s tokenized asset on ' + p.chains[0] + ' and hold it for at least 30 days; purchase fees are usually 0.1-0.5% and gas ' + gasRange(p.chains[0]) + '.',
      'Days 1–30 — Keep the position through one full yield payout cycle (typically monthly) and reinvest the payout; the cycle length is the honest minimum holding time.',
      'Day 30 — If the protocol offers a secondary market, make one small buy now and one small sell a month later to show real usage; budget ' + gasRange(p.chains[0]) + ' per transaction in gas for both.',
      stepSecondMarket(p),
      stepTrack(p),
      stepTotal(p),
      clockStep(p),
      verdictStep(p),
    ];
  }
  return [
    stepDeposit(p),
    'Days 1–30 — Use the protocol\'s main feature on ' + p.chains[0] + ' at least once a week for a month (a swap, a deposit or a claim of ' + tradeRange(p) + ' each time); total gas for the month is about four transactions at ' + gasRange(p.chains[0]) + ' each.',
    'Day 14 — Try a second feature the protocol offers, such as staking, voting or a points quest, and complete it fully; a finished quest is worth more than three half-finished ones.',
    stepSecondMarket(p),
    stepTrack(p),
    stepTotal(p),
    clockStep(p),
    verdictStep(p),
  ];
}

// --- rendering

var state = { q: '', cat: '', minTvl: 0, verdict: '', sort: 'rank', wlOnly: false, sel: null };

function filtered() {
  var list = ROWS.filter(function (r) {
    if (state.wlOnly && !r.watchlist) return false;
    if (state.cat && r.category !== state.cat) return false;
    if (r.tvl < state.minTvl) return false;
    if (state.verdict && verdictFor(r) !== state.verdict) return false;
    if (state.q) {
      var q = state.q.toLowerCase();
      if (r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
    }
    return true;
  });
  var key = state.sort;
  list.sort(function (a, b) {
    if (key === 'tvl') return b.tvl - a.tvl;
    if (key === 'growth') return (b.change === null ? -1e9 : b.change) - (a.change === null ? -1e9 : a.change);
    if (key === 'age') return b.age - a.age;
    return a.rank - b.rank; // rank and value order agree
  });
  return list;
}

function render() {
  var list = filtered();
  var maxVal = ROWS.length ? ROWS[0].value : 1;
  var tb = document.getElementById('rows');
  tb.innerHTML = list.map(function (r) {
    var chg = r.change === null ? '<td class="num">—</td>'
      : '<td class="num ' + (r.change >= 0 ? 'up' : 'down') + '">' + fmtPct(r.change) + '</td>';
    var v = verdictFor(r);
    var vcls = v === 'FARM' ? 'v-farm' : v === 'WORTH A LOOK' ? 'v-look' : v === 'THIN' ? 'v-thin' : 'v-wait';
    var pct = Math.max(2, Math.round(100 * r.value / maxVal));
    return '<tr data-slug="' + esc(r.slug) + '"' + (state.sel === r.slug ? ' class="sel"' : '') + '>'
      + '<td class="num">' + r.rank + '</td>'
      + '<td><span class="name">' + esc(r.name) + '</span><br><span class="slug">' + esc(r.slug) + '</span> <span class="chains">' + esc(shortChains(r)) + '</span></td>'
      + '<td>' + esc(r.category || '—') + '</td>'
      + '<td class="num">' + fmtUsd(r.tvl) + '</td>'
      + chg
      + '<td class="num">' + fmtAge(r.age) + '</td>'
      + '<td class="num">' + clockRate(r) + '</td>'
      + '<td class="num">' + fmtUsd(r.value) + '<span class="vbar"><i style="width:' + pct + '%"></i></span></td>'
      + '<td><span class="vchip ' + vcls + '">' + v + '</span></td>'
      + '<td>' + (r.watchlist ? '<span class="badge">WATCHLIST</span>' : '') + '</td></tr>';
  }).join('');
  document.getElementById('count-line').textContent =
    list.length + ' of ' + ROWS.length + ' protocols shown.';
  tb.querySelectorAll('tr').forEach(function (tr) {
    tr.addEventListener('click', function () { showDetail(tr.getAttribute('data-slug')); });
  });
}

function showDetail(slug) {
  var r = null;
  for (var i = 0; i < ROWS.length; i++) if (ROWS[i].slug === slug) r = ROWS[i];
  if (!r) return;
  state.sel = slug;
  render();
  var d = document.getElementById('detail');
  d.hidden = false;
  document.getElementById('d-name').textContent = '#' + r.rank + ' — ' + r.name;
  document.getElementById('d-sub').textContent =
    r.slug + ' · ' + (r.category || 'no category') + ' · ' + shortChains(r)
    + ' · TVL ' + fmtUsd(r.tvl) + ' · ' + (r.watchlist ? 'on the watchlist · ' : '')
    + 'records no token';
  var flag = document.getElementById('d-flag');
  if (r.slug === 'ethena-usde') {
    flag.hidden = false;
    flag.textContent = 'Note on this record: the snapshot lists the symbol ENA on the USDe row itself, but no gecko id and no market cap — and there is no separate Ethena protocol record in the snapshot at all (all 758 slugs, gecko ids and symbols searched). So this board prices USDe on its own TVL record, as the rules require. The ENA token exists in the real world; the snapshot simply does not attach it to a record here.';
  } else {
    flag.hidden = true;
    flag.textContent = '';
  }
  var v = verdictFor(r);
  var vb = document.getElementById('d-verdict');
  vb.hidden = false;
  vb.className = 'd-verdict ' + (v === 'FARM' ? 'v-farm' : v === 'WORTH A LOOK' ? 'v-look' : v === 'THIN' ? 'v-thin' : 'v-wait');
  vb.textContent = verdictStep(r);
  var medAge = MODEL.median_age_days || 463;
  var clockTxt;
  if (r.noDate) {
    clockTxt = 'Launch clock: listing date not recorded in the snapshot, so the clock cannot place it — still no token.';
  } else {
    var asOf = new Date(MODEL.as_of + 'T00:00:00Z').getTime();
    var listed = new Date(asOf - r.age * 86400000).toISOString().slice(0, 10);
    clockTxt = 'Launch clock: listed ' + listed + ' (' + fmtAge(r.age) + ' ago), still no token — '
      + (r.age > medAge ? 'longer than the board median of ' + fmtAge(medAge) : 'shorter than the board median of ' + fmtAge(medAge))
      + '; ' + clockRate(r) + ' of protocols listed ' + CLOCK_LABELS[clockBucketIndex(r)] + ' record a token.';
  }
  document.getElementById('d-clock').textContent = clockTxt;
  var cr = r.noDate ? null : MODEL.clock[clockBucketIndex(r)][3] / MODEL.clock[clockBucketIndex(r)][2];
  var br = document.getElementById('d-break');
  br.innerHTML =
    '<tr><td>TVL curve — base value from ' + fmtUsd(r.tvl) + ' TVL</td><td>' + fmtUsd(r.base) + '</td></tr>'
    + '<tr><td>Category offset (' + esc(r.category || 'none') + ')</td><td>×' + r.catMult.toFixed(3) + '</td></tr>'
    + '<tr><td>Chain adjustment (' + r.nChains + ' chain' + (r.nChains > 1 ? 's' : '') + ')</td><td>×' + r.chainMult.toFixed(3) + '</td></tr>'
    + '<tr><td>Implied value per $1 of TVL</td><td>$' + (r.value / r.tvl).toFixed(3) + '</td></tr>'
    + '<tr><td>Clock-weighted value (implied × same-age token share)</td><td>' + (cr === null ? '—' : fmtUsd(r.value * cr)) + '</td></tr>'
    + '<tr><td><strong>Implied value</strong></td><td><strong>' + fmtUsd(r.value) + '</strong></td></tr>';
  var steps = farmSteps(r);
  document.getElementById('d-steps').innerHTML = steps.map(function (s) {
    return '<li>' + esc(s) + '</li>';
  }).join('');
  d.scrollIntoView({ block: 'nearest' });
}

// --- model panel

function fillModel() {
  var b = MODEL.beta;
  function term(coef, label) {
    return ' ' + (coef < 0 ? '− ' : '+ ') + Math.abs(coef).toFixed(2) + ' · ' + label;
  }
  var formula = 'log10(mcap) = ' + b[0].toFixed(2)
    + term(b[1], 'log10(TVL)')
    + term(b[2], 'log1p(chains)')
    + term(b[3], 'Ethereum')
    + term(b[4], 'Arbitrum')
    + term(b[5], 'Optimism')
    + ' + category offset';
  var parts = MODEL.oos_partitions || {};
  function range(key) {
    var vals = [];
    ['mod5', 'blocks', 'fold10', 'hash', 'loo'].forEach(function (k) {
      if (parts[k]) vals.push(parts[k][key]);
    });
    if (!vals.length) return '';
    return '×' + Math.min.apply(null, vals).toFixed(2) + '–×' + Math.max.apply(null, vals).toFixed(2);
  }
  var ts = MODEL.time_split || {};
  var bs = MODEL.bootstrap || {};
  var wf = MODEL.wf || [];
  var wfText = wf.length ? ' Walk-forward backtest (train before the year, test the next): pooled ×' + wf[0].toFixed(2) + '/×' + wf[1].toFixed(2) + ' (' + wf[2].map(function (w) { return w[0] + ' ×' + w[3].toFixed(2); }).join(', ') + ' median).' : '';
  document.getElementById('formula-line').textContent = formula;
  var w = MODEL.oos_within || {};
  document.getElementById('oos-line').innerHTML =
    'Blind out-of-sample (5-fold, ' + MODEL.oos_n + ' held-out comps): median error <b>×' + MODEL.oos_median_factor.toFixed(2)
    + '</b> · ' + (w.x2 || 0) + '% within ×2 · p80 ×' + MODEL.oos_p80_factor.toFixed(2);
  document.getElementById('fit-line').innerHTML =
    '<dt>Comps</dt><dd>' + MODEL.n_comps + ' protocols with a token (market cap ≥ $1M; 13 dead or micro-cap records below $1M are not comparables)</dd>'
    + '<dt>Fit</dt><dd>' + esc(formula) + '</dd>'
    + '<dt>Method</dt><dd>median regression (least absolute deviations, IRLS)</dd>'
    + '<dt>Not in the formula</dt><dd>age and 7-day growth — both tested, both worse out-of-sample (×2.44 and ×2.41 vs ×2.28); age drives the launch clock and the LONG WAIT verdict instead</dd>'
    + '<dt>Out-of-sample</dt><dd>median error ×' + MODEL.oos_median_factor.toFixed(2)
    + ', p80 ×' + MODEL.oos_p80_factor.toFixed(2) + ' (' + MODEL.oos_n + ' held-out comps, 5-fold); '
    + (w.x2 || 0) + '% within ×2, ' + (w.x5 || 0) + '% within ×5, ' + (w.x10 || 0) + '% within ×10</dd>'
    + '<dt>Stability</dt><dd>same procedure under 5 different partitions incl. leave-one-out: median ' + range('median') + ', p80 ' + range('p80') + ' — no cherry-picked split. Time-split (train before ' + ts.cut + ', test the ' + ts.n + ' later ones): ×' + ts.fwd_median.toFixed(2) + '/×' + ts.fwd_p80.toFixed(2) + '; reverse ×' + ts.rev_median.toFixed(2) + '/×' + ts.rev_p80.toFixed(2) + '. Bootstrap (200×): TVL slope ' + bs.slope_lo.toFixed(2) + '–' + bs.slope_hi.toFixed(2) + '; OOS median ×' + bs.oos_lo.toFixed(2) + '–×' + bs.oos_hi.toFixed(2) + ' (90% intervals)' + wfText + '</dd>';
  document.getElementById('meta-line').textContent =
    MODEL.n_board + ' rows · ' + MODEL.n_watchlist + '/' + MODEL.n_watchlist + ' watchlist · '
    + 'snapshot ' + MODEL.as_of + ' · ' + MODEL.n_comps + ' comps';
}

// --- launch clock table (MODEL.clock: token-share by age cohort; the last
// row is the protocols with no listing date recorded — not an age cohort).
function drawClock() {
  var host = document.getElementById('clock-table');
  if (!host || !MODEL.clock) return;
  var labels = CLOCK_LABELS.concat(['no date recorded']);
  host.innerHTML = MODEL.clock.map(function (c, i) {
    var rate = Math.round(100 * c[3] / c[2]);
    return '<tr><td>' + labels[i] + '</td><td>' + c[2] + '</td><td>' + c[3] + ' (' + rate + '%)</td></tr>';
  }).join('');
}

// --- calibration plot: out-of-sample check, not an in-sample fit. Each dot
// is one comp priced by a model that never saw it (5-fold); the dashed band
// is the median error, so half the dots land inside it.

function drawCalibration() {
  var host = document.getElementById('calib');
  var pts = MODEL.calib || [];
  if (!pts.length) { host.innerHTML = ''; return; }
  var W = 920, H = 300, L = 56, R = 16, T = 12, B = 40;
  var xs = pts.map(function (p) { return p[0]; });
  var ys = pts.map(function (p) { return p[1]; });
  var lo = Math.floor(Math.min.apply(null, xs.concat(ys)) * 2) / 2;
  var hi = Math.ceil(Math.max.apply(null, xs.concat(ys)) * 2) / 2;
  function sx(v) { return L + (v - lo) / (hi - lo) * (W - L - R); }
  function sy(v) { return T + (1 - (v - lo) / (hi - lo)) * (H - T - B); }
  var s = '';
  s += '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Calibration plot: out-of-sample predicted market cap against actual market cap">';
  var g;
  for (g = lo; g <= hi + 1e-9; g += 0.5) {
    s += '<line x1="' + sx(g) + '" y1="' + T + '" x2="' + sx(g) + '" y2="' + (H - B) + '" class="grid"/>';
    s += '<line x1="' + L + '" y1="' + sy(g) + '" x2="' + (W - R) + '" y2="' + sy(g) + '" class="grid"/>';
    s += '<text x="' + sx(g) + '" y="' + (H - B + 18) + '" class="ax">' + g.toFixed(1) + '</text>';
    s += '<text x="' + (L - 8) + '" y="' + (sy(g) + 4) + '" class="ax r">' + g.toFixed(1) + '</text>';
  }
  s += '<text x="' + ((W - L - R) / 2 + L) + '" y="' + (H - 6) + '" class="ax">predicted log10(market cap in $)</text>';
  s += '<text x="14" y="' + ((H - T - B) / 2 + T) + '" class="ax" transform="rotate(-90 14 ' + ((H - T - B) / 2 + T) + ')">actual log10(market cap in $)</text>';
  var band = Math.log10(MODEL.oos_median_factor);
  s += '<line x1="' + sx(lo) + '" y1="' + sy(lo) + '" x2="' + sx(hi) + '" y2="' + sy(hi) + '" class="ident"/>';
  s += '<line x1="' + sx(lo) + '" y1="' + sy(lo + band) + '" x2="' + sx(hi) + '" y2="' + sy(hi + band) + '" class="band"/>';
  s += '<line x1="' + sx(lo) + '" y1="' + sy(lo - band) + '" x2="' + sx(hi) + '" y2="' + sy(hi - band) + '" class="band"/>';
  pts.forEach(function (p) {
    s += '<circle cx="' + sx(p[0]).toFixed(1) + '" cy="' + sy(p[1]).toFixed(1) + '" r="4" fill="#22d3ee"/>';
  });
  s += '</svg>';
  host.innerHTML = s;
  var w = MODEL.oos_within || {};
  document.getElementById('calib-note').textContent =
    'Each dot is one of the ' + pts.length + ' comps, priced by a model that never saw it (5-fold). '
    + 'The diagonal is perfect prediction; the dashed band is the median error (±×' + MODEL.oos_median_factor.toFixed(2)
    + ') — ' + (w.x2 || 0) + '% within ×2, ' + (w.x10 || 0)
    + '% within ×10. Dots above the line are tokens worth far more than their TVL suggests (worst: rain ×363).';
}

// --- wire-up

(function init() {
  var cats = [];
  ROWS.forEach(function (r) { if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category); });
  cats.sort();
  var sel = document.getElementById('cat');
  cats.forEach(function (c) {
    var o = document.createElement('option');
    o.value = c; o.textContent = c;
    sel.appendChild(o);
  });
  document.getElementById('q').addEventListener('input', function (e) { state.q = e.target.value; render(); });
  sel.addEventListener('change', function (e) { state.cat = e.target.value; render(); });
  document.getElementById('min-tvl').addEventListener('change', function (e) { state.minTvl = Number(e.target.value); render(); });
  document.getElementById('verdict').addEventListener('change', function (e) { state.verdict = e.target.value; render(); });
  document.getElementById('sort').addEventListener('change', function (e) { state.sort = e.target.value; render(); });
  document.getElementById('wl-only').addEventListener('change', function (e) { state.wlOnly = e.target.checked; render(); });
  var params = new URLSearchParams(window.location.search);
  if (params.get('q')) { state.q = params.get('q'); document.getElementById('q').value = state.q; }
  if (params.get('category')) { state.cat = params.get('category'); sel.value = state.cat; }
  if (params.get('mintvl')) { state.minTvl = Number(params.get('mintvl')); document.getElementById('min-tvl').value = String(state.minTvl); }
  if (params.get('sort')) { state.sort = params.get('sort'); document.getElementById('sort').value = state.sort; }
  if (params.get('watchlist')) { state.wlOnly = true; document.getElementById('wl-only').checked = true; }
  if (params.get('verdict')) { state.verdict = params.get('verdict'); document.getElementById('verdict').value = state.verdict; }
  fillModel();
  drawCalibration();
  drawClock();
  render();
  if (params.get('detail')) showDetail(params.get('detail'));
  window.__radar = { rows: ROWS, model: MODEL, farmSteps: farmSteps };
})();
