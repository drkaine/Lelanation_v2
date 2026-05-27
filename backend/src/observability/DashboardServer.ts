import http from 'node:http'
import { metrics } from './MetricsCollector.js'
import { obsLogger } from './logger.js'

let server: http.Server | null = null

const DASHBOARD_HTML = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Poller Observability</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.3/chart.umd.min.js"></script>
  <style>
    body { font-family: system-ui, sans-serif; background: #111827; color: #e5e7eb; margin: 0; padding: 16px; }
    .card { background: #1f2937; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
    .title { font-size: 14px; opacity: .8; margin-bottom: 8px; }
    .bar { width: 100%; height: 14px; background: #374151; border-radius: 7px; overflow: hidden; }
    .bar-fill { height: 100%; transition: width .2s ease; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { padding: 6px 4px; border-bottom: 1px solid #374151; text-align: left; }
    .alerts { color: #fca5a5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="title">Rate limit courant</div>
    <div id="rlText"></div>
    <div class="bar"><div id="rlBar" class="bar-fill"></div></div>
  </div>
  <div class="card">
    <div class="title">Stages (60s)</div>
    <table id="stageTable">
      <thead><tr><th>Stage</th><th>ok</th><th>err</th><th>p95 ms</th><th>queue</th></tr></thead>
      <tbody></tbody>
    </table>
  </div>
  <div class="card">
    <div class="title">10 dernières fenêtres 120s</div>
    <canvas id="windowChart" height="100"></canvas>
  </div>
  <div class="card">
    <div class="title">Résumé horaire</div>
    <pre id="hourly"></pre>
  </div>
  <div class="card">
    <div class="title">Alertes actives</div>
    <pre id="alerts" class="alerts"></pre>
  </div>
  <script>
    let chart;
    async function refresh() {
      const res = await fetch('/api/metrics');
      const snap = await res.json();

      const rl = snap.rateLimitCurrent;
      const pct = rl.limit > 0 ? Math.min(100, Math.round((rl.requestsSent / rl.limit) * 100)) : 0;
      const bar = document.getElementById('rlBar');
      bar.style.width = pct + '%';
      bar.style.background = rl.headroom <= 6 ? '#ef4444' : (rl.headroom <= 12 ? '#f59e0b' : '#10b981');
      document.getElementById('rlText').textContent =
        'sent=' + rl.requestsSent + ' target=' + rl.target + ' limit=' + rl.limit +
        ' headroom=' + rl.headroom + ' 429=' + rl.count429 + ' queue=' + rl.queueDepth;

      const tbody = document.querySelector('#stageTable tbody');
      tbody.innerHTML = '';
      Object.entries(snap.stages).forEach(([stage, v]) => {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td>' + stage + '</td>' +
          '<td>' + v.itemsLast60s + '</td>' +
          '<td>' + v.failuresLast60s + '</td>' +
          '<td>' + Number(v.p95DurationMs).toFixed(1) + '</td>' +
          '<td>' + v.queueDepth + '</td>';
        tbody.appendChild(tr);
      });

      const labels = snap.windows120s.map((w) => new Date(w.start).toLocaleTimeString());
      const sent = snap.windows120s.map((w) => w.sent);
      if (!chart) {
        chart = new Chart(document.getElementById('windowChart'), {
          type: 'bar',
          data: { labels, datasets: [{ label: 'req/120s', data: sent, backgroundColor: '#60a5fa' }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
      } else {
        chart.data.labels = labels;
        chart.data.datasets[0].data = sent;
        chart.update();
      }

      document.getElementById('hourly').textContent = JSON.stringify(snap.hourly, null, 2);
      document.getElementById('alerts').textContent = snap.alerts.length ? JSON.stringify(snap.alerts, null, 2) : 'Aucune alerte active';
    }
    refresh();
    setInterval(refresh, 5000);
  </script>
</body>
</html>`

export function startDashboard(port = 9090): void {
  if (server) return
  server = http.createServer((req, res) => {
    if (req.url === '/api/metrics') {
      const snap = metrics.getSnapshot()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(snap))
      return
    }

    if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(DASHBOARD_HTML)
      return
    }

    res.writeHead(404)
    res.end('Not found')
  })

  server.listen(port, '127.0.0.1', () => {
    obsLogger.info(`[obs] Dashboard: http://127.0.0.1:${port}`)
  })
}

export function stopDashboard(): void {
  if (!server) return
  server.close()
  server = null
}
