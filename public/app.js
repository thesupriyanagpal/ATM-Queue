'use strict';

const periods = [
  {name:'Morning', symbol:'◒', lambda:18, mu:25, color:'#087786', last:13},
  {name:'Afternoon', symbol:'☀︎', lambda:11, mu:16, color:'#9f461a', last:12},
  {name:'Evening', symbol:'☾', lambda:20, mu:25, color:'#7445a2', last:16}
];

function queue(lambda, mu) {
  const rho = lambda / mu;
  const spare = mu - lambda;
  if (spare <= 0) return {rho, spare, stable:false};
  const ls = lambda / spare;
  return {
    rho, spare, stable:true, ls, lq:ls - rho, ws:60 / spare, wq:60 * rho / spare,
    service:60 / mu, pmf:n => (1 - rho) * rho ** n, cdf:n => 1 - rho ** (n + 1),
    waitTail:minutes => rho * Math.exp(-spare * minutes / 60)
  };
}
periods.forEach(period => Object.assign(period, queue(period.lambda, period.mu)));

const $ = id => document.getElementById(id);
const fixed = (n, digits = 2) => n.toFixed(digits);
const percent = (n, digits = 1) => fixed(n * 100, digits) + '%';
const metric = (label, value) => '<div><strong>' + value + '</strong>' + label + '</div>';
const legend = rows => rows.map(p => '<span><i class="swatch" style="--color:' + p.color +
  '"></i>' + p.name + '</span>').join('');
const chartDrawers = new Map();

$('period-cards').innerHTML = periods.map(p => '<article class="card stat" style="--accent:' + p.color +
  '"><h3 class="icon-heading"><span class="icon" aria-hidden="true">' + p.symbol + '</span>' + p.name + '</h3><div class="big">' + fixed(p.wq) + ' <small>min</small></div>' +
  '<p class="muted small">Mean queue wait</p><dl><div><dt>Mean total visit</dt><dd>' + fixed(p.ws) +
  ' min</dd></div><div><dt>Utilization</dt><dd>' + percent(p.rho, p.name === 'Afternoon' ? 2 : 0) +
  '</dd></div><div><dt>Spare capacity</dt><dd>' + p.spare + ' customers/hour</dd></div></dl></article>').join('');

function chart(id, draw) {
  chartDrawers.set(id, draw);
  redraw(id);
}

function redraw(id) {
  const canvas = $(id);
  const {width, height} = canvas.getBoundingClientRect();
  if (!width || !height) return;
  const density = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * density);
  canvas.height = Math.round(height * density);
  const ctx = canvas.getContext('2d');
  ctx.scale(density, density);
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = '#564d69';
  chartDrawers.get(id)(ctx, width, height);
}

function straight(ctx, x, y, a, b, color) {
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(a, b);
  ctx.stroke();
}

const barProgress = new Map();
function barChart(id, rows, {max, ticks, format, unit, grouped = false}) {
  chart(id, (ctx, width, height) => {
    const left = width < 340 ? 65 : 79;
    const right = width - 19, bottom = height - 38;
    const x = value => left + (right - left) * value / max;
    ctx.textAlign = 'center';
    ticks.forEach(t => {
      straight(ctx, x(t), 8, x(t), bottom, '#eee1f3');
      ctx.fillStyle = '#564d69';
      ctx.fillText(format(t), x(t), bottom + 15);
    });
    ctx.fillText(unit, (left + right) / 2, height - 4);
    const progress = barProgress.get(id) ?? 1;
    const band = (bottom - 8) / rows.length;
    rows.forEach((row, i) => {
      const y = 8 + (i + .5) * band;
      ctx.fillStyle = '#473b5d';
      ctx.textAlign = 'right';
      ctx.fillText(row.name, left - 8, y + 4);
      let offset = 0;
      row.values.forEach(([value, color], j) => {
        ctx.fillStyle = color;
        const start = grouped ? 0 : offset;
        const top = grouped ? y - 17 + j * 18 : y - 10;
        const span = x(value * progress) - x(0);
        const startX = x(start * progress);
        const barHeight = grouped ? 14 : 20;
        ctx.fillRect(startX, top, span, barHeight);
        if (progress === 1) {
          const label = format(value);
          ctx.font = 'bold 10px system-ui, sans-serif';
          if (span >= ctx.measureText(label).width + 10) {
            ctx.textAlign = 'center';
            ctx.fillStyle = color === '#7445a2' ? '#fff' : '#252344';
            ctx.fillText(label, startX + span / 2, top + barHeight / 2 + 3.5);
          }
          ctx.font = '11px system-ui, sans-serif';
        }
        offset += value;
      });
    });
  });
}

const asNumber = n => String(n);
barChart('rates', periods.map(p => ({name:p.name, values:[[p.lambda,'#7445a2'], [p.mu,'#9ed6dc']]})),
  {max:30, ticks:[0,10,20,30], format:asNumber, unit:'Customers per hour', grouped:true});
barChart('visits', periods.map(p => ({name:p.name, values:[[p.wq,'#7445a2'], [p.service,'#9ed6dc']]})),
  {max:12, ticks:[0,3,6,9,12], format:n => Number(n.toFixed(2)).toString(), unit:'Minutes per visit'});
barChart('people', periods.map(p => ({name:p.name, values:[[p.lq,'#7445a2'], [p.rho,'#9ed6dc']]})),
  {max:4, ticks:[0,1,2,3,4], format:n => Number(n.toFixed(2)).toString(), unit:'Mean number of customers'});
barChart('busy', periods.map(p => ({name:p.name, values:[[p.rho,'#7445a2'], [1-p.rho,'#eadcf2']]})),
  {max:1, ticks:[0,.25,.50,.75,1], format:n => percent(n,Number.isInteger(n*100) ? 0 : 2), unit:'Share of time'});

if (typeof IntersectionObserver === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const reveal = new IntersectionObserver(entries => {
    entries.filter(entry => entry.isIntersecting).forEach(entry => {
      const id = entry.target.id;
      reveal.unobserve(entry.target);
      let start;
      function grow(time) {
        start ??= time;
        const fraction = Math.min((time - start) / 570,1);
        barProgress.set(id,1 - .86 * (1 - fraction) ** 3);
        redraw(id);
        if (fraction < 1) window.requestAnimationFrame(grow);
      }
      window.requestAnimationFrame(grow);
    });
  },{threshold:.2});
  ['rates','visits'].forEach(id => reveal.observe($(id)));
}

const journeyMessages = [
  'A customer arrives while the ATM is busy. Their wait starts when they join the back of the line.',
  'The customer waits while people ahead of them are served. First come, first served means a later arrival joins behind them.',
  'When the customer reaches the front and the ATM becomes free, they start their transaction. Their queue wait ends here.',
  'The customer finishes their transaction and leaves. Total visit time equals time spent waiting plus time using the ATM.'
];
let journeyStage = 0;
let journeyTimer = null;
function showJourney(stage) {
  journeyStage = stage;
  Array.from($('journey-flow').children).forEach((item,index) => {
    const current = index === stage;
    item.classList.toggle('active',current);
    if (current) item.setAttribute('aria-current','step');
    else item.removeAttribute('aria-current');
  });
  $('journey-message').textContent = journeyMessages[stage];
}
function pauseJourney() {
  if (journeyTimer !== null) window.clearInterval(journeyTimer);
  journeyTimer = null;
  $('journey-play').textContent = 'Play journey';
  $('journey-next').disabled = false;
}
$('journey-next').addEventListener('click',() => showJourney((journeyStage + 1) % journeyMessages.length));
$('journey-play').addEventListener('click',() => {
  if (journeyTimer !== null) {
    pauseJourney();
    return;
  }
  showJourney(0);
  $('journey-play').textContent = 'Stop journey';
  $('journey-next').disabled = true;
  journeyTimer = window.setInterval(() => {
    showJourney(journeyStage+1);
    if (journeyStage === journeyMessages.length-1) pauseJourney();
  },1850);
});

function plot(id, options) {
  chart(id, (ctx, width, height) => {
    const {series, xMin, xMax, yMax, xTicks, yTicks, xFormat, yFormat, unit, marker, steps} = options;
    const labels = xTicks.map(xFormat);
    const leftLabel = Math.max(...yTicks.map(t => ctx.measureText(yFormat(t)).width));
    const left = Math.ceil(Math.max(36, leftLabel + 12, ctx.measureText(labels[0]).width / 2 + 4));
    const right = width - Math.ceil(Math.max(12, ctx.measureText(labels.at(-1)).width / 2 + 4));
    const top = 13, bottom = height - 40;
    const x = value => left + (right-left) * (value-xMin) / (xMax-xMin);
    const y = value => bottom - (bottom-top) * value / yMax;
    ctx.textAlign = 'right';
    yTicks.forEach(t => {
      straight(ctx,left,y(t),right,y(t),'#eee1f3');
      ctx.fillStyle = '#564d69';
      ctx.fillText(yFormat(t),left-7,y(t)+4);
    });
    ctx.textAlign = 'center';
    let labelEnd = -Infinity;
    const lastLabelStart = x(xTicks.at(-1)) - ctx.measureText(labels.at(-1)).width / 2;
    xTicks.forEach((t, i) => {
      const halfWidth = ctx.measureText(labels[i]).width / 2;
      if (i > 0 && i < xTicks.length - 1 &&
          (x(t) - halfWidth < labelEnd + 5 || x(t) + halfWidth > lastLabelStart - 5)) return;
      ctx.fillText(labels[i],x(t),bottom+17);
      labelEnd = x(t) + halfWidth;
    });
    ctx.fillText(unit,width/2,height-4,width-8);
    ctx.save();
    ctx.beginPath();
    ctx.rect(left-4, top-4, right-left+8, bottom-top+8);
    ctx.clip();
    series.forEach(({points, color, dots, dash}) => {
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.setLineDash(dash || []);
      ctx.lineWidth = 2.3;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      points.forEach(([a,b], i) => {
        if (!i) ctx.moveTo(x(a),y(b));
        else {
          if (steps) ctx.lineTo(x(a), y(points[i-1][1]));
          ctx.lineTo(x(a),y(b));
        }
      });
      ctx.stroke();
      if (dots) points.forEach(([a,b]) => {
        ctx.beginPath();
        ctx.arc(x(a),y(b),2.7,0,Math.PI*2);
        ctx.fill();
      });
    });
    if (marker) {
      ctx.setLineDash([4,4]);
      ctx.lineWidth = 1;
      straight(ctx,x(marker.x),top,x(marker.x),bottom,'#836993');
      const markerPoints = marker.values || (marker.y === undefined ? [] : [{y:marker.y,color:'#352351'}]);
      markerPoints.filter(point => point.y <= yMax).forEach(point => {
        ctx.fillStyle = point.color;
        ctx.beginPath();
        ctx.arc(x(marker.x),y(point.y),4.5,0,Math.PI*2);
        ctx.fill();
      });
    }
    ctx.restore();
  });
}

function setupSweep(id, {xTicks, yTicks, yFormat = asNumber, unit, color, estimate, readout}) {
  const from = xTicks[0];
  const to = xTicks.at(-1);
  const duration = 5000;
  const value = $(id + '-value');
  const marker = {x:from, y:estimate(from)};
  const points = Array.from({length:41}, (_, i) => {
    const x = from + i * (to - from) / 40;
    return [x, estimate(x)];
  });
  let frame = null;
  let startedAt = null;

  plot(id, {
    series:[{points,color}], xMin:from, xMax:to, yMax:yTicks.at(-1),
    xTicks, yTicks, xFormat:asNumber, yFormat, unit, marker
  });

  function updatePointer(progress) {
    marker.x = from + (to - from) * progress;
    marker.y = estimate(marker.x);
    value.textContent = readout(marker.x, marker.y);
    redraw(id);
  }

  function advance(time) {
    startedAt ??= time;
    const leg = (time - startedAt) % (2 * duration) / duration;
    updatePointer(1 - Math.abs(1 - leg));
    frame = window.requestAnimationFrame(advance);
  }

  updatePointer(0);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  if (typeof IntersectionObserver === 'function') {
    const observer = new IntersectionObserver(entries => {
      if (entries.at(-1).isIntersecting) {
        frame ??= window.requestAnimationFrame(advance);
      } else if (frame !== null) {
        window.cancelAnimationFrame(frame);
        frame = null;
      }
    });
    observer.observe($(id));
  } else {
    frame = window.requestAnimationFrame(advance);
  }
}

const evening = periods.find(period => period.name === 'Evening');
setupSweep('capacity-sweep', {
  xTicks:[25,27,29,31,33,35], yTicks:[0,1,2,3,4],
  unit:'Service capacity per hour', color:'#087786',
  estimate:capacity => queue(evening.lambda, capacity).lq,
  readout:(capacity, waiting) => fixed(capacity, 1) + ' services/hour · ' +
    fixed(waiting) + ' customers waiting on average'
});
setupSweep('arrival-sweep', {
  xTicks:[15,17,19,20,22], yTicks:[0,5,10,15,20],
  yFormat:minutes => minutes + ' min', unit:'Arrivals per hour', color:'#7445a2',
  estimate:arrivals => queue(arrivals, evening.mu).ws,
  readout:(arrivals, minutes) => fixed(arrivals, 1) + ' arrivals/hour · ' +
    fixed(minutes) + ' min average total visit'
});

let selected = 'All';
const selectedPeriods = () => selected === 'All' ? periods : periods.filter(p => p.name === selected);
const states = Array.from({length:17}, (_, i) => i);
const dashes = [[],[6,4],[2,3]];

function updateProbability() {
  const rows = selectedPeriods();
  document.querySelectorAll('.periods-legend').forEach(el => el.innerHTML = legend(rows));
  for (const mode of ['pmf','cdf']) {
    const cumulative = mode === 'cdf';
    const yMax = cumulative ? 1 : .35;
    const yTicks = cumulative ? [0,.25,.5,.75,1] : [0,.1,.2,.3];
    const series = rows.map(p => ({points:states.map(n => [n,p[mode](n)]), color:p.color, dots:true, dash:dashes[periods.indexOf(p)]}));
    plot(mode,{series,xMin:0,xMax:16,yMax,xTicks:[0,4,8,12,16],yTicks,xFormat:asNumber,
      yFormat:n => percent(n,0),unit:'Customers in the system (N)'});
  }
  $('pmf-text').textContent = rows.length === 1
    ? rows[0].name + ': the empty system has probability ' + percent(rows[0].pmf(0),2) + '. Each successive state has ' + percent(rows[0].rho,2) + ' of the previous state’s probability.'
    : 'An empty system is least likely in the evening (20%). The evening curve also falls most slowly as the number of customers rises.';
  $('cdf-text').textContent = 'Chance of five or fewer customers: ' +
    rows.map(p => p.name + ' ' + percent(p.cdf(5),1)).join(' · ') + '.';
  const headers = ['Period','N','Exactly n','At most n'];
  const data = rows.flatMap(p => states.map(n => [p.name,n,percent(p.pmf(n),3),percent(p.cdf(n),3)]));
  $('prob-table').innerHTML = '<thead><tr>' + headers.map(h => '<th scope="col">'+h+'</th>').join('') +
    '</tr></thead><tbody>' + data.map(row => '<tr>' + row.map(v => '<td>'+v+'</td>').join('') + '</tr>').join('') + '</tbody>';
  updateRisk();
}

function updateRisk() {
  const minutes = Number($('threshold').value);
  const rows = selectedPeriods();
  $('threshold-value').textContent = minutes + ' min';
  $('risk-values').innerHTML = rows.map(p => metric(p.name,percent(p.waitTail(minutes)))).join('');
  const highest = rows.reduce((a,b) => a.waitTail(minutes) >= b.waitTail(minutes) ? a : b);
  $('risk-note').textContent = highest.name + ' customers have a ' + percent(highest.waitTail(minutes)) +
    ' chance of waiting longer than ' + minutes + ' min' +
    (rows.length > 1 ? ' for service, the highest of the three periods.' : ' for service.');
  const series = rows.map(p => ({points:Array.from({length:41},(_,t) => [t,p.waitTail(t)]),
    color:p.color, dash:dashes[periods.indexOf(p)]}));
  plot('risk',{series,xMin:0,xMax:40,yMax:1,xTicks:[0,10,20,30,40],yTicks:[0,.25,.5,.75,1],
    xFormat:asNumber,yFormat:n => percent(n,0),unit:'Queue wait threshold (min)',
    marker:{x:minutes,values:rows.map(p => ({y:p.waitTail(minutes),color:p.color}))}});
}
$('prob-controls').addEventListener('click', event => {
  if (!event.target.dataset.period) return;
  selected = event.target.dataset.period;
  $('prob-controls').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.period === selected)));
  updateProbability();
});
$('threshold').addEventListener('input',updateRisk);
updateProbability();

const baselineHeadings = ['Period','Arrivals / hour','Capacity / hour','Idle','Mean waiting','Mean in system','Wait (min)','Visit (min)'];
$('baseline-table').innerHTML = '<thead><tr>' +
  baselineHeadings.map(label => '<th scope="col">' + label + '</th>').join('') +
  '</tr></thead><tbody>' + periods.map(p => '<tr><th scope="row">' + p.name + '</th>' +
    [p.lambda,p.mu,percent(p.pmf(0),2),fixed(p.lq),fixed(p.ls),fixed(p.wq),fixed(p.ws)]
      .map(value => '<td>' + value + '</td>').join('') + '</tr>').join('') + '</tbody>';

function downloadCSV(filename, rows) {
  const blob = new Blob([rows.map(row => row.join(',')).join('\r\n') + '\r\n'], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url),1000);
}
$('download').addEventListener('click', () => downloadCSV('atm_probabilities.csv',[
  ['period','n_in_system','p_exact','p_at_most','within_published_table_range'],
  ...selectedPeriods().flatMap(p => states.map(n => [p.name,n,p.pmf(n),p.cdf(n),n <= p.last]))
]));
$('download-baselines').addEventListener('click', () => downloadCSV('atm_baselines.csv',[
  ['period','reported_arrivals_per_hour','reported_service_per_hour','utilization','p_empty','mean_system_count',
    'mean_queue_count','mean_system_minutes','mean_queue_minutes','mean_service_minutes'],
  ...periods.map(p => [p.name,p.lambda,p.mu,p.rho,p.pmf(0),p.ls,p.lq,p.ws,p.wq,p.service])
]));

$('sim-period').innerHTML = periods.map(p => '<option>' + p.name + '</option>').join('');
$('sim-period').value = 'Evening';
let sim, timer = null;

function exponential(rate) {
  sim.seed = (Math.imul(1664525, sim.seed) + 1013904223) >>> 0;
  const u = (sim.seed + .5) / 4294967296;
  return -Math.log1p(-u) * 60 / rate;
}

function startService(customer) {
  sim.active = customer;
  sim.active.wait = sim.time - customer.arrival;
  sim.departure = sim.time + exponential(sim.period.mu);
}

function nextEvent() {
  if (sim.arrival < sim.departure) {
    sim.time = sim.arrival;
    const customer = {id:++sim.arrived, arrival:sim.time};
    sim.arrival = sim.time + exponential(sim.period.lambda);
    if (sim.active) {
      sim.queue.push(customer);
      sim.message = '#' + customer.id + ' joined the line.';
    } else {
      startService(customer);
      sim.message = '#' + customer.id + ' arrived and started service.';
    }
  } else {
    sim.time = sim.departure;
    sim.totalWait += sim.active.wait;
    sim.completed++;
    sim.message = '#' + sim.active.id + ' finished after waiting ' + fixed(sim.active.wait,1) + ' min.';
    sim.active = null;
    sim.departure = Infinity;
    if (sim.queue.length) {
      startService(sim.queue.shift());
      sim.message += ' #' + sim.active.id + ' started service.';
    }
  }
  sim.history.push({
    time:sim.time, waiting:sim.queue.length, arrived:sim.arrived, completed:sim.completed,
    meanWait:sim.completed ? sim.totalWait/sim.completed : null
  });
  if (sim.history.length > 45) sim.history.shift();
  sim.log.unshift(fixed(sim.time,1) + ' min · ' + sim.message);
  if (sim.log.length > 4) sim.log.pop();
  renderSim();
}

function setTokens(element, customers, extra, isQueue) {
  const seen = new Map(Array.from(element.children, node => [node.dataset.key,node]));
  const labels = customers.map(customer => [String(customer.id), '#' + customer.id]);
  if (extra) labels.push(['extra','+' + extra]);
  if (!labels.length) labels.push(['empty',isQueue ? 'Empty' : 'Idle']);
  const wanted = new Set(labels.map(([key]) => key));
  for (const [key,node] of seen) if (!wanted.has(key)) node.remove();
  labels.forEach(([key,label], i) => {
    const node = seen.get(key) || document.createElement('span');
    node.dataset.key = key;
    node.className = key === 'empty' ? 'small' : 'token' + (isQueue ? ' wait' : '');
    node.textContent = label;
    if (element.children[i] !== node) element.insertBefore(node,element.children[i] || null);
  });
}

function renderSim() {
  setTokens($('sim-queue'),sim.queue.slice(0,12),Math.max(0,sim.queue.length-12),true);
  setTokens($('sim-server'),sim.active ? [sim.active] : [],0,false);
  $('sim-values').innerHTML = [
    metric('Simulated time',fixed(sim.time,1) + ' min'),metric('Waiting',sim.queue.length),
    metric('Completed',sim.completed),metric('Arrived',sim.arrived),
    metric('Run mean wait',sim.completed ? fixed(sim.totalWait/sim.completed,2) + ' min' : '—'),
    metric('Model mean wait',fixed(sim.period.wq,2) + ' min')
  ].join('');
  $('sim-status').textContent = sim.message;
  $('trace-note').textContent = 'At ' + fixed(sim.time,1) + ' simulated minutes: ' +
    sim.queue.length + ' waiting and ' + (sim.active ? '1 using the ATM.' : 'the ATM is idle.');
  $('throughput-note').textContent = sim.arrived + ' arrivals · ' + sim.completed +
    ' completed visits · ' + (sim.arrived-sim.completed) + ' still in the system.';
  const modelEstimate = fixed(sim.period.wq) + ' min model estimate.';
  $('wait-trace-note').textContent = sim.completed
    ? fixed(sim.totalWait/sim.completed) + ' min mean queue wait across ' +
      sim.completed + (sim.completed === 1 ? ' completed visit' : ' completed visits') + ' · ' + modelEstimate
    : 'The simulated average appears after the first completed visit. ' + modelEstimate;
  $('sim-status').setAttribute('aria-live', timer === null ? 'polite' : 'off');
  $('events').replaceChildren(...sim.log.map(line => {
    const li = document.createElement('li');
    li.textContent = line;
    return li;
  }));
  renderSimCharts();
}

function renderSimCharts() {
  const xMin = sim.history[0].time;
  const xMax = Math.max(xMin+5,Math.ceil(sim.time));
  const xTicks = [0,1,2,3,4].map(n => xMin+(xMax-xMin)*n/4);
  const teal = '#087786';
  const toPoints = key => sim.history.filter(event => event[key] !== null).map(event => [event.time,event[key]]);

  function drawTrace(id, series, peak, yFormat, unit) {
    const yStep = Math.max(1,Math.ceil(peak/4));
    const yMax = Math.ceil(Math.max(peak,2)/yStep)*yStep;
    plot(id,{series,xMin,xMax,yMax,xTicks,
      yTicks:Array.from({length:yMax/yStep+1},(_,i) => i*yStep),
      xFormat:n => fixed(n,n < 10 ? 1 : 0),yFormat,unit,steps:true});
  }

  const waiting = toPoints('waiting');
  drawTrace('trace',[{points:waiting,color:teal,dots:true}],Math.max(...waiting.map(([,n]) => n)),
    asNumber,'Simulated minutes');
  drawTrace('throughput-trace',[
    {points:toPoints('arrived'),color:teal},
    {points:toPoints('completed'),color:'#7445a2',dash:[6,4],dots:sim.history.length === 1}
  ],sim.arrived,asNumber,'Simulated minutes');
  const waits = toPoints('meanWait');
  const modelWait = sim.period.wq;
  drawTrace('wait-trace',[
    {points:[[xMin,modelWait],[xMax,modelWait]],color:'#9f461a',dash:[6,4]},
    {points:waits,color:teal,dots:waits.length === 1}
  ],Math.max(modelWait,...waits.map(([,n]) => n)),n => n + 'm','Simulated minutes');
}

function setRunning(running) {
  if (timer !== null) window.clearInterval(timer);
  timer = running ? window.setInterval(nextEvent,Number($('pace').value)) : null;
  $('play').textContent = running ? 'Pause' : 'Play';
  $('step').disabled = running;
  $('sim-status').setAttribute('aria-live',running ? 'off' : 'polite');
}

function resetSim() {
  setRunning(false);
  sim = {
    period:periods.find(p => p.name === $('sim-period').value),
    seed:2018, time:0, active:null, queue:[], arrived:0, completed:0, departure:Infinity,
    totalWait:0, history:[{time:0,waiting:0,arrived:0,completed:0,meanWait:null}],
    log:['0.0 min · The ATM is idle.'], message:'Ready at time zero. Press Play or Step event to begin.'
  };
  sim.arrival = exponential(sim.period.lambda);
  renderSim();
}

$('play').addEventListener('click', () => {
  const running = timer === null;
  setRunning(running);
  if (running) nextEvent();
});
$('step').addEventListener('click',nextEvent);
$('reset').addEventListener('click',resetSim);
$('sim-period').addEventListener('change',resetSim);
$('pace').addEventListener('change',() => { if (timer !== null) setRunning(true); });
resetSim();

function applyRates(lambda, mu) {
  $('lambda').value = lambda;
  $('mu').value = mu;
  updateScenario();
}

const rateColumns = [10,15,20,25,30,35];
const rateRows = [15,20,25,30,35,40];
$('heatmap').innerHTML = '<span class="key" aria-hidden="true">μ ∖ λ</span>' +
  rateColumns.map(n => '<span class="key" aria-hidden="true">' + n + '</span>').join('') +
  rateRows.map(mu => '<span class="key" aria-hidden="true">' + mu + '</span>' + rateColumns.map(lambda => {
    const q = queue(lambda,mu);
    const color = !q.stable ? '#dedbe6' : q.wq <= 5 ? '#cef0ef' : q.wq <= 10 ? '#e9dcfa' : q.wq <= 20 ? '#ffd8c6' : '#efadbe';
    const label = 'Arrivals ' + lambda + ', capacity ' + mu + ' per hour: ' +
      (q.stable ? fixed(q.wq,1) + ' minutes mean queue wait' : 'unstable');
    return '<button type="button" class="cell" style="background:' + color + '" data-lambda="' + lambda +
      '" data-mu="' + mu + '" aria-label="' + label + '" title="' + label + '">' + (q.stable ? fixed(q.wq,1) : '—') + '</button>';
  }).join('')).join('');

$('heatmap').addEventListener('click',event => {
  if (event.target.dataset.lambda) applyRates(event.target.dataset.lambda,event.target.dataset.mu);
});
$('presets').innerHTML = periods.map(p => '<button class="button" type="button" data-period="' + p.name + '">' + p.name + '</button>').join('');
$('presets').addEventListener('click',event => {
  const p = periods.find(entry => entry.name === event.target.dataset.period);
  if (p) applyRates(p.lambda,p.mu);
});

function updateScenario() {
  const lambda = Number($('lambda').value), mu = Number($('mu').value);
  const q = queue(lambda,mu);
  $('lambda-value').textContent = lambda + ' / hour';
  $('mu-value').textContent = mu + ' / hour';
  $('scenario-status').classList.toggle('unstable',!q.stable);
  $('scenario-status').textContent = q.stable
    ? 'Stable at this load, with ' + fixed(q.spare,1) + ' customers/hour of spare capacity.'
    : 'At or above capacity. The M/M/1 steady-state means are undefined.';
  $('scenario-metrics').innerHTML = [
    metric('Offered load, λ/μ',percent(q.rho)),metric('Idle probability',q.stable ? percent(q.pmf(0)) : '—'),
    metric('Mean queue wait',q.stable ? fixed(q.wq) + ' min' : '—'),
    metric('Mean total visit',q.stable ? fixed(q.ws) + ' min' : '—'),
    metric('Mean queue count',q.stable ? fixed(q.lq) : '—'),metric('Mean system count',q.stable ? fixed(q.ls) : '—')
  ].join('');
  $('presets').querySelectorAll('button').forEach(b => {
    const p = periods.find(entry => entry.name === b.dataset.period);
    b.setAttribute('aria-pressed',String(p.lambda === lambda && p.mu === mu));
  });
  const onMap = rateColumns.includes(lambda) && rateRows.includes(mu);
  $('heatmap-status').textContent = onMap
    ? 'Selected: ' + lambda + ' arrivals and ' + mu + ' services per hour. ' +
      (q.stable ? fixed(q.wq,1) + ' min mean wait.' : 'At or above capacity, so the queue has no steady-state mean.')
    : 'For example, at 25 services/hour, increasing arrivals from 15 to 20 raises mean wait from 3.6 to 9.6 min.';
  $('heatmap').querySelectorAll('button').forEach(b => {
    const active = Number(b.dataset.lambda) === lambda && Number(b.dataset.mu) === mu;
    b.classList.toggle('current',active);
    b.setAttribute('aria-pressed',String(active));
  });
  const points = Array.from({length:100},(_,i) => [i/100,queue(i*mu/100,mu).wq]);
  const cap = 60;
  const aboveCap = points.findIndex(([,wait]) => wait > cap);
  const shown = aboveCap === -1 ? points : points.slice(0,aboveCap);
  if (aboveCap > 0) shown.push([cap * mu / (60 + cap * mu),cap]);
  const marker = q.rho < 1 ? {x:q.rho,y:q.wq} : {x:1};
  plot('sensitivity',{series:[{points:shown,color:'#7445a2'}],xMin:0,xMax:1,yMax:cap,
    xTicks:[0,.25,.50,.75,1],yTicks:[0,15,30,45,60],xFormat:n => percent(n,0),yFormat:n => n + 'm',
    unit:'Utilization at μ = ' + mu + ' per hour',marker});
  const wait80 = queue(.8 * mu,mu).wq;
  const wait90 = queue(.9 * mu,mu).wq;
  $('sensitivity-note').textContent = 'At the selected capacity, moving from 80% to 90% load raises mean wait from ' +
    fixed(wait80,1) + ' to ' + fixed(wait90,1) + ' min. ' +
    (!q.stable ? 'The dashed line marks the 100% stability boundary.' :
      q.wq > cap ? 'The selected wait exceeds the chart’s 60-min scale.' : 'The dot marks your current scenario.');
}
$('lambda').addEventListener('input',updateScenario);
$('mu').addEventListener('input',updateScenario);
updateScenario();

const changes = [['Evening baseline',20,25],['Two fewer arrivals/hour',18,25],['Three more services/hour',20,28],['Both changes',18,28]];
const baseline = queue(20,25).wq;
$('interventions').innerHTML = '<thead><tr><th scope="col">Scenario</th><th scope="col">λ / μ</th>' +
  '<th scope="col">Mean wait</th><th scope="col">Reduction</th></tr></thead><tbody>' +
  changes.map(([name,lambda,mu],i) => {
    const minutes = queue(lambda,mu).wq;
    return '<tr><th scope="row">' + name + '</th><td>' + lambda + ' / ' + mu + '</td><td>' + fixed(minutes) +
      ' min</td><td>' + (i ? percent(1-minutes/baseline) : '—') + '</td></tr>';
  }).join('') + '</tbody>';

let nextResize;
window.addEventListener('resize',() => {
  window.cancelAnimationFrame(nextResize);
  nextResize = window.requestAnimationFrame(() => chartDrawers.forEach((_,id) => redraw(id)));
});
