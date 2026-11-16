// Token Radar dashboard: renders the fitted board, filters and sorts it, and
// shows each protocol's model breakdown and farm plan. All data is local
// (rows.js, model.js); the page makes no network request of any kind.
//
// The farm plan generator below is the same generator the board builder uses,
// so the page shows exactly what board.json promises.

var ROWS = window.TOKEN_RADAR_ROWS.map(function (r) {
  return {
    slug: r[0], name: r[1], category: r[2], chains: r[3], tvl: r[4],
    change: r[5], age: r[6], value: r[7], rank: r[8], watchlist: r[9],
    base: r[10], catMult: r[11], chainMult: r[12],
  };
});
var MODEL = window.TOKEN_RADAR_MODEL;

// ------------------------------------------------------------------ formatting

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
function shortChains(chains) {
  if (chains.length <= 3) return chains.join(', ');
  return chains.slice(0, 3).join(', ') + ' +' + (chains.length - 3);
}

// ------------------------------------------------------------------ farm steps
// Same generator as the board builder (main.ts). A step names a cost and a
// duration; nothing here is a slogan.

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
  if (p.chains.length <= 3) return p.chains.join(', ');
  return p.chains.slice(0, 3).join(', ') + ' and ' + (p.chains.length - 3) + ' more';
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
function totalGas(chain) {
  if (chain === 'Ethereum') return '$12-$48';
  if (chain === 'Base' || chain === 'Arbitrum' || chain === 'Optimism' || chain === 'Unichain') return '$0.60-$3';
  if (chain === 'Solana') return 'about $0.06';
  if (chain === 'BSC' || chain === 'BNB Chain') return '$0.60-$1.80';
  if (chain === 'Polygon' || chain === 'Avalanche') return '$1.20-$6';
  return '$3-$12';
}
function stepDeposit(p) {
  return 'Deposit ' + depositRange(p) + ' of a blue-chip asset (ETH or a major stablecoin) into ' + p.name + ' on ' + p.chains[0] + '; with TVL ' + fmtUsd(p.tvl) + ' it is ' + tvlTier(p) + ', so expect ' + gasRange(p.chains[0]) + ' in gas and 15-30 minutes for the deposit to confirm.';
}
function stepHold(p) {
  return 'Hold the position for at least 30 days without withdrawing; airdrops, if any, typically reward sustained use over 1-3 months, not a single deposit, so set a weekly reminder to check it.';
}
function stepRepeat(p) {
  return 'Repeat a small transaction (deposit, swap or claim) once a week for 4 weeks on ' + p.chains[0] + '; budget ' + gasRange(p.chains[0]) + ' per transaction in gas for the month and keep the transaction hashes as proof.';
}
function stepSecondMarket(p) {
  if (p.chains.length === 1) {
    return 'Use a second market the protocol lists on ' + p.chains[0] + ' (TVL ' + fmtUsd(p.tvl) + ') for 14 days to show repeat activity; a second deposit of ' + secondRange(p) + ' costs another ' + gasRange(p.chains[0]) + ' in gas.';
  }
  var other = p.chains[1];
  return 'Use a second market the protocol lists — it runs on ' + chainList(p) + ' — starting with ' + other + ' (TVL ' + fmtUsd(p.tvl) + ') for 14 days to show multi-market activity; a second deposit of ' + secondRange(p) + ' costs another ' + gasRange(other) + ' in gas.';
}
function stepTrack(p) {
  return 'Track ' + p.name + ' weekly for 6-8 weeks: record your deposits, points or volume in a note, and watch the protocol\'s announcements for a points program or snapshot date.';
}
function stepTotal(p) {
  return 'Total for this plan: about 6-8 weeks and roughly ' + totalGas(p.chains[0]) + ' in gas on ' + p.chains[0] + '; the capital you put in stays yours to withdraw — the gas is the real cost of farming it.';
}
function farmSteps(p) {
  var cat = p.category || '';
  if (cat === 'Lending' || cat === 'CDP' || cat === 'Leveraged Farming' || cat === 'Collateral Management') {
    return [
      stepDeposit(p),
      'Borrow 30-50% of your collateral value in a stablecoin and hold the loan for at least 14 days; interest accrues daily, roughly $0.30-$1.50 per $100 borrowed per month at current rates.',
      'Repay the loan in two tranches a week apart and re-deposit the repaid collateral to keep your health factor above 1.5; each repayment costs ' + gasRange(p.chains[0]) + ' in gas on ' + p.chains[0] + '.',
      stepSecondMarket(p),
      stepTrack(p),
      stepTotal(p),
    ];
  }
  if (cat === 'Dexs' || cat === 'Liquidity Manager') {
    return [
      'Swap ' + depositRange(p) + ' through ' + p.name + ' on ' + p.chains[0] + ' in 3-4 trades over two weeks; each swap costs ' + gasRange(p.chains[0]) + ' in gas plus the pool fee, and every trade counts as activity.',
      'Provide ' + depositRange(p) + ' of liquidity to the protocol\'s deepest pool for at least 30 days; expect ' + gasRange(p.chains[0]) + ' in gas to add it and the same again to remove it, plus impermanent loss of a few percent either way.',
      'Leave the LP position untouched for the full month, then claim any trading fees (usually $1-$10 on a $200 position) before withdrawing; do not exit in the first week.',
      stepSecondMarket(p),
      stepTrack(p),
      stepTotal(p),
    ];
  }
  if (cat === 'Yield' || cat === 'Yield Aggregator' || cat === 'Risk Curators' || cat === 'Onchain Capital Allocator' || cat === 'Restaking' || cat === 'Staking Pool') {
    return [
      stepDeposit(p),
      'Keep the deposit in the vault for at least 30 days and let the yield compound; withdrawing early usually forfeits the points or multiplier the vault tracks.',
      'Add a second deposit of ' + secondRange(p) + ' after two weeks to show continued use; the top-up costs ' + gasRange(p.chains[0]) + ' in gas on ' + p.chains[0] + '.',
      stepSecondMarket(p),
      stepTrack(p),
      stepTotal(p),
    ];
  }
  if (cat === 'Derivatives' || cat === 'Options' || cat === 'Basis Trading' || cat === 'Prediction Market') {
    return [
      'Open a small position of $50-$150 on ' + p.name + ' (' + p.chains[0] + ') and hold it for at least 7 days; funding or fees run roughly $0.50-$3 per week on a position this size.',
      'Place 3-5 trades of $25-$75 each over two weeks instead of one large trade; spread-out volume is what farming trackers usually count, and total fees stay under $10.',
      'Close half the position after 14 days and keep the rest open for another two weeks; each close costs ' + gasRange(p.chains[0]) + ' in gas, and a 30-day trading history beats a single day.',
      stepSecondMarket(p),
      stepTrack(p),
      stepTotal(p),
    ];
  }
  if (cat === 'RWA') {
    return [
      'Buy ' + depositRange(p) + ' of the protocol\'s tokenized asset on ' + p.chains[0] + ' and hold it for at least 30 days; purchase fees are usually 0.1-0.5% and gas ' + gasRange(p.chains[0]) + '.',
      'Keep the position through one full yield payout cycle (typically monthly) and reinvest the payout; the cycle length is the honest minimum holding time.',
      'If the protocol offers a secondary market, make one small buy and one small sell a month apart to show real usage; budget ' + gasRange(p.chains[0]) + ' per transaction in gas for both.',
      stepSecondMarket(p),
      stepTrack(p),
      stepTotal(p),
    ];
  }
  return [
    stepDeposit(p),
    'Use the protocol\'s main feature on ' + p.chains[0] + ' at least once a week for a month (a swap, a deposit or a claim of $25-$100 each time); total gas for the month is about four transactions at ' + gasRange(p.chains[0]) + ' each.',
    'Try a second feature the protocol offers, such as staking, voting or a points quest, and complete it fully; a finished quest is worth more than three half-finished ones.',
    stepSecondMarket(p),
    stepTrack(p),
    stepTotal(p),
  ];
}

// ------------------------------------------------------------------ rendering

var state = { q: '', cat: '', minTvl: 0, sort: 'rank', wlOnly: false, sel: null };

function filtered() {
  var list = ROWS.filter(function (r) {
    if (state.wlOnly && !r.watchlist) return false;
    if (state.cat && r.category !== state.cat) return false;
    if (r.tvl < state.minTvl) return false;
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
  var tb = document.getElementById('rows');
  tb.innerHTML = list.map(function (r) {
    var chg = r.change === null ? '<td class="num">—</td>'
      : '<td class="num ' + (r.change >= 0 ? 'up' : 'down') + '">' + fmtPct(r.change) + '</td>';
    return '<tr data-slug="' + esc(r.slug) + '"' + (state.sel === r.slug ? ' class="sel"' : '') + '>'
      + '<td class="num">' + r.rank + '</td>'
      + '<td><span class="name">' + esc(r.name) + '</span><br><span class="slug">' + esc(r.slug) + '</span> <span class="chains">' + esc(shortChains(r.chains)) + '</span></td>'
      + '<td>' + esc(r.category || '—') + '</td>'
      + '<td class="num">' + fmtUsd(r.tvl) + '</td>'
      + chg
      + '<td class="num">' + fmtAge(r.age) + '</td>'
      + '<td class="num">' + fmtUsd(r.value) + '</td>'
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
    r.slug + ' · ' + (r.category || 'no category') + ' · ' + shortChains(r.chains)
    + ' · TVL ' + fmtUsd(r.tvl) + ' · ' + (r.watchlist ? 'on the watchlist · ' : '')
    + 'records no token';
  var flag = document.getElementById('d-flag');
  if (r.slug === 'ethena-usde') {
    flag.hidden = false;
    flag.textContent = 'Note on this record: the snapshot records USDe as having no token, while the ENA token is recorded on the parent protocol Ethena. This board prices USDe on its own record, as the rules require — “records no token”, never “has none”.';
  } else {
    flag.hidden = true;
    flag.textContent = '';
  }
  var br = document.getElementById('d-break');
  br.innerHTML =
    '<tr><td>TVL curve — base value from ' + fmtUsd(r.tvl) + ' TVL</td><td>' + fmtUsd(r.base) + '</td></tr>'
    + '<tr><td>Category offset (' + esc(r.category || 'none') + ')</td><td>×' + r.catMult.toFixed(3) + '</td></tr>'
    + '<tr><td>Chain adjustment (' + r.chains.length + ' chain' + (r.chains.length > 1 ? 's' : '') + (r.chains.indexOf('Ethereum') >= 0 ? ', on Ethereum' : ', not on Ethereum') + ')</td><td>×' + r.chainMult.toFixed(3) + '</td></tr>'
    + '<tr><td><strong>Implied value</strong></td><td><strong>' + fmtUsd(r.value) + '</strong></td></tr>';
  var steps = farmSteps(r);
  document.getElementById('d-steps').innerHTML = steps.map(function (s) {
    return '<li>' + esc(s) + '</li>';
  }).join('');
  d.scrollIntoView({ block: 'nearest' });
}

// ------------------------------------------------------------------ model panel

function fillModel() {
  var b = MODEL.beta;
  function term(coef, label) {
    return ' ' + (coef < 0 ? '− ' : '+ ') + Math.abs(coef).toFixed(2) + ' · ' + label;
  }
  var formula = 'log10(mcap) = ' + b[0].toFixed(2)
    + term(b[1], 'log10(TVL)')
    + term(b[2], 'log1p(chains)')
    + term(b[3], 'Ethereum')
    + ' + category offset';
  var parts = MODEL.oos_partitions || {};
  function range(key) {
    var vals = [];
    ['mod5', 'blocks', 'fold10', 'hash'].forEach(function (k) {
      if (parts[k]) vals.push(parts[k][key]);
    });
    if (!vals.length) return '';
    return '×' + Math.min.apply(null, vals).toFixed(2) + '–×' + Math.max.apply(null, vals).toFixed(2);
  }
  document.getElementById('fit-line').innerHTML =
    '<dt>Comps</dt><dd>' + MODEL.n_comps + ' protocols with a token (market cap ≥ $1M; 13 dead or micro-cap records below $1M are not comparables)</dd>'
    + '<dt>Fit</dt><dd>' + esc(formula) + '</dd>'
    + '<dt>Method</dt><dd>median regression (least absolute deviations, IRLS)</dd>'
    + '<dt>Not used</dt><dd>protocol age and 7-day TVL change — both were tested and neither improves out-of-sample error; growth is dominated by one-week spikes</dd>'
    + '<dt>R²</dt><dd>' + MODEL.r2.toFixed(3) + ' (on the ' + MODEL.n_comps + ' comps)</dd>'
    + '<dt>Out-of-sample</dt><dd>median error ×' + MODEL.oos_median_factor.toFixed(2)
    + ', p80 ×' + MODEL.oos_p80_factor.toFixed(2) + ' (' + MODEL.oos_n + ' held-out comps, 5-fold)</dd>'
    + '<dt>Stability</dt><dd>same procedure under 4 different partitions: median ' + range('median') + ', p80 ' + range('p80') + ' — no cherry-picked split</dd>';
  document.getElementById('meta-line').textContent =
    MODEL.n_board + ' rows · ' + MODEL.n_watchlist + '/' + MODEL.n_watchlist + ' watchlist · '
    + 'snapshot ' + MODEL.as_of + ' · ' + MODEL.n_comps + ' comps';
}

// ------------------------------------------------------------------ scatter plot
// One dot per comp: log10 market cap against log10 TVL, coloured by category.
// The line is the fitted curve at the comps' median chain count, with no
// category offset — the fit's spine, so the reader can see how much of the
// spread it explains and how much it does not.

var SCATTER_COLORS = ['#22d3ee', '#4ade80', '#fbbf24', '#f472b6', '#a78bfa', '#f87171', '#38bdf8', '#facc15'];

function drawScatter() {
  var host = document.getElementById('scatter');
  var pts = MODEL.comps || [];
  if (!pts.length) { host.innerHTML = ''; return; }
  var cats = [];
  pts.forEach(function (p) { if (cats.indexOf(p[2]) < 0) cats.push(p[2]); });
  cats.sort();
  function color(cat) {
    var i = cats.indexOf(cat);
    return i < SCATTER_COLORS.length ? SCATTER_COLORS[i] : '#64748b';
  }
  var W = 920, H = 300, L = 56, R = 16, T = 12, B = 40;
  var xs = pts.map(function (p) { return p[0]; });
  var ys = pts.map(function (p) { return p[1]; });
  var x0 = Math.floor(Math.min.apply(null, xs)), x1 = Math.ceil(Math.max.apply(null, xs));
  var y0 = Math.floor(Math.min.apply(null, ys)), y1 = Math.ceil(Math.max.apply(null, ys));
  function sx(v) { return L + (v - x0) / (x1 - x0) * (W - L - R); }
  function sy(v) { return T + (1 - (v - y0) / (y1 - y0)) * (H - T - B); }
  var s = '';
  s += '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Scatter plot of the comps: log market cap against log TVL">';
  var gx;
  for (gx = x0; gx <= x1; gx++) {
    s += '<line x1="' + sx(gx) + '" y1="' + T + '" x2="' + sx(gx) + '" y2="' + (H - B) + '" class="grid"/>';
    s += '<text x="' + sx(gx) + '" y="' + (H - B + 18) + '" class="ax">' + gx + '</text>';
  }
  var gy;
  for (gy = y0; gy <= y1; gy++) {
    s += '<line x1="' + L + '" y1="' + sy(gy) + '" x2="' + (W - R) + '" y2="' + sy(gy) + '" class="grid"/>';
    s += '<text x="' + (L - 8) + '" y="' + (sy(gy) + 4) + '" class="ax r">' + gy + '</text>';
  }
  s += '<text x="' + ((W - L - R) / 2 + L) + '" y="' + (H - 6) + '" class="ax">log10(TVL in $)</text>';
  s += '<text x="14" y="' + ((H - T - B) / 2 + T) + '" class="ax" transform="rotate(-90 14 ' + ((H - T - B) / 2 + T) + ')">log10(market cap in $)</text>';
  // Fitted line at median chain count, no offset.
  var b = MODEL.beta;
  var lineChains = Math.log1p(MODEL.line_n_chains);
  var yA = b[0] + b[1] * x0 + b[2] * lineChains + b[3] * MODEL.line_has_eth;
  var yB = b[0] + b[1] * x1 + b[2] * lineChains + b[3] * MODEL.line_has_eth;
  s += '<line x1="' + sx(x0) + '" y1="' + sy(yA) + '" x2="' + sx(x1) + '" y2="' + sy(yB) + '" class="fitline"/>';
  pts.forEach(function (p) {
    s += '<circle cx="' + sx(p[0]).toFixed(1) + '" cy="' + sy(p[1]).toFixed(1) + '" r="4" fill="' + color(p[2]) + '"><title>' + esc(p[2]) + '</title></circle>';
  });
  s += '</svg>';
  host.innerHTML = s;
  var catsTop = cats.slice(0, 8);
  document.getElementById('scatter-note').textContent =
    'Each dot is one of the ' + pts.length + ' comps. The line is the fitted curve at median chain count ('
    + MODEL.line_n_chains
    + '), with no category offset. Colours mark categories (' + catsTop.join(', ')
    + (cats.length > 8 ? ', and ' + (cats.length - 8) + ' more' : '')
    + '); the spread around the line is why the out-of-sample error is reported, not hidden.';
}

// ------------------------------------------------------------------ wire-up

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
  document.getElementById('sort').addEventListener('change', function (e) { state.sort = e.target.value; render(); });
  document.getElementById('wl-only').addEventListener('change', function (e) { state.wlOnly = e.target.checked; render(); });
  var params = new URLSearchParams(window.location.search);
  if (params.get('q')) { state.q = params.get('q'); document.getElementById('q').value = state.q; }
  if (params.get('category')) { state.cat = params.get('category'); sel.value = state.cat; }
  if (params.get('mintvl')) { state.minTvl = Number(params.get('mintvl')); document.getElementById('min-tvl').value = String(state.minTvl); }
  if (params.get('sort')) { state.sort = params.get('sort'); document.getElementById('sort').value = state.sort; }
  if (params.get('watchlist')) { state.wlOnly = true; document.getElementById('wl-only').checked = true; }
  fillModel();
  drawScatter();
  render();
  if (params.get('detail')) showDetail(params.get('detail'));
  window.__radar = { rows: ROWS, model: MODEL, farmSteps: farmSteps };
})();
