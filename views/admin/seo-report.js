// Admin → Site settings → SEO report (/admin/seo/report): the court SEO project. Settings
// (on/off, who gets the email, city page intros), the report itself (same data as the daily
// email), every change made to tracked pages and every job run. Built on ui.js.
import { escHtml } from '../layout.js';
import { pageHeader, section, badge, button, field, fieldGrid, toggleRow, banner, ago, emptyState, sparkline } from './ui.js';

const attr = s => escHtml(String(s ?? ''));
const fmtDay = ymd => (ymd ? new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '—');
const TONE = { reached: 'green', ontrack: 'green', behind: 'amber', waiting: 'gray' };

export function adminSeoReportBody({ report, settings, gscReady, cities, runs, changes, trendByQuery = {}, running = false }) {
  const r = report;
  const head = pageHeader({
    eyebrow: 'Search results',
    title: 'SEO report',
    sub: 'Court SEO project: Activate Hoop Arena first, then the Mandaluyong and Pasig city pages. Runs by itself every day; the email is the summary.',
    actionsHtml: running ? `<span class="aseo-running" data-seo-running>Running the SEO jobs… this page updates when they finish.</span>`
      : `${button('Send today’s email now', { kind: 'secondary', size: 'sm', attrs: 'data-post-json="/admin/seo/report/send" data-done="Sent."' })}
      ${button('Run all jobs now', { kind: 'secondary', size: 'sm', attrs: 'data-post-json="/admin/seo/report/run" data-done="Started." data-confirm data-confirm-title="Run the SEO jobs now?" data-confirm-body="Pulls Search Console, checks every court and city page, checks the court rates and Claude, asks Google about each page and rewrites the weekly court notes from the last 7 days. Sends the email. Runs in the background; this page updates when it’s done." data-confirm-send="Run"' })}
      ${button('Run with monthly steps', { kind: 'secondary', size: 'sm', attrs: 'data-post-json="/admin/seo/report/run" data-body=\'{"monthly":true}\' data-done="Started." data-confirm data-confirm-title="Run everything, monthly steps too?" data-confirm-body="Everything “Run all jobs now” does, plus the venue link check, which venue sites link to us, and AI title suggestions for up to 3 pages. Sends the email." data-confirm-send="Run"' })}`,
  });

  const setup = gscReady ? '' : banner('warn', 'Search Console isn’t connected yet, so there are no rankings. The page checks and weekly notes still run. Setup: a Google service account with read access to the wkndbasketball.com property, then GSC_SERVICE_ACCOUNT_FILE and GSC_SITE_URL in .env (steps at the top of lib/seo-gsc.js).');

  const alertLine = a => (typeof a === 'string' ? { text: a } : a);
  const alerts = r.alerts.length
    ? `<div class="aui-panel">${r.alerts.map(alertLine).map(a => `<p class="aseo-alert">${a.href ? `<a href="${attr(a.href)}" target="_blank" rel="noopener">${escHtml(a.text)}</a>` : escHtml(a.text)}</p>`).join('')}</div>`
    : `<div class="aui-panel"><p class="aui-muted aseo-ok">All tracked pages up, nothing broken.</p></div>`;

  const list = (items, fn) => `<div class="aui-panel"><ul class="aseo-list">${items.map(x => `<li>${fn(x)}</li>`).join('')}</ul></div>`;
  const nearWins = r.nearWins.length
    ? list(r.nearWins, q => `<b>${escHtml(q.query)}</b> <span class="aui-muted">#${q.position} · ${q.impressions}× · ${escHtml(q.page)}</span>${q.missing.length ? `<br><span class="aseo-miss">Title and description don’t say: ${escHtml(q.missing.join(', '))}</span>` : ''}`)
    : emptyState({ title: 'No searches at positions 8–20 yet', sub: 'Needs 10+ times shown in 28 days.' });
  const competing = r.competing.length
    ? list(r.competing, c => `<b>${escHtml(c.query)}</b> ${c.isNew ? badge('New', 'amber') : ''}<br><span class="aui-muted">${escHtml(c.note)}</span>`)
    : emptyState({ title: 'No two pages competing', sub: 'Brand searches are left out.', done: true });
  const watch = r.watch.length
    ? `<div class="aui-panel aseo-scroll"><table class="aseo-table"><thead><tr><th>Page</th><th>Searches</th><th>Seen</th><th>Clicks</th><th>Best kind</th><th>Top search</th></tr></thead><tbody>${r.watch.map(w => `<tr><td><a href="${attr(w.path)}" target="_blank" rel="noopener">${escHtml(w.label)}</a></td><td>${w.searches}</td><td>${w.impressions}</td><td>${w.clicks}</td><td>${w.best ? `${escHtml(w.best.bucket)} <span class="aseo-num">#${w.best.position}</span>` : '—'}</td><td>${w.top ? `${escHtml(w.top.query)} <span class="aui-muted">#${w.top.position}</span>` : '—'}</td></tr>`).join('')}</tbody></table>
      <p class="aui-muted aseo-foot">Last 28 days. “Best kind” is the kind of search (rates, parking, reviews, hours, location, name) where the court page ranks highest, with 3+ times shown.</p></div>`
    : emptyState({ title: 'No watched pages yet' });
  const suggestions = r.suggestions.length
    ? list(r.suggestions, s => `<b>${escHtml(s.page)}</b>${s.options.map(o => `<br>· ${escHtml(o.title)}<br><span class="aui-muted">${escHtml(o.description)}</span>`).join('')}`)
      + `<p class="aui-muted aseo-foot">From ${r.suggestionsAt ? fmtDay(new Date(r.suggestionsAt + 8 * 3600e3).toISOString().slice(0, 10)) : 'the last monthly run'}. Nothing changes until you apply one (court admin → Search results).</p>`
    : emptyState({ title: 'No suggestions yet', sub: 'Written on the 1st of the month, or with “Run with monthly steps”.' });
  const extras = [
    r.outreach ? `<p class="aseo-alert"><b>Venue sites:</b> ${escHtml(r.outreach)}</p>` : '',
    r.caption ? `<p class="aseo-alert"><b>This week’s Facebook caption:</b><br>${escHtml(r.caption)}</p>` : '',
  ].filter(Boolean).join('');

  const targets = r.targets.length
    ? `<div class="aui-panel aseo-scroll"><table class="aseo-table"><thead><tr><th>Search</th><th>Position</th><th>Change</th><th>Seen</th><th>Clicks</th><th>Goal</th><th>Status</th><th>12 weeks</th></tr></thead><tbody>${r.targets.map(t => {
      const tr = trendByQuery[t.query] || [];
      return `<tr><td>${escHtml(t.query)}${t.shownPage ? `<br><span class="aui-muted aseo-sub">Google shows ${escHtml(t.shownPage)}</span>` : t.other ? `<br><span class="aui-muted aseo-sub">also ${escHtml(t.other.path)} #${t.other.position}</span>` : ''}</td><td class="aseo-num">${t.position ?? '—'}</td><td>${t.change ? `<span class="aseo-${t.change > 0 ? 'up' : 'down'}">${t.change > 0 ? '▲' : '▼'}${Math.abs(t.change)}</span>` : ''}</td><td>${t.impressions}</td><td>${t.clicks}</td><td>Top ${t.goal} by ${fmtDay(t.by)}</td><td>${badge(t.status.label, TONE[t.status.key])}</td><td>${tr.length > 1 ? sparkline(tr.map(x => -x)) : ''}</td></tr>`;
    }).join('')}</tbody></table>
      <p class="aui-muted aseo-foot">Last 7 days of Google data, through ${fmtDay(r.through)}. Position is Google’s average (1 is the top). Change compares with the 7 days before. The trend line goes up when we climb.</p></div>`
    : emptyState({ title: 'No ranking data yet', sub: 'Shows up the day after Search Console is connected (Google’s numbers run 2–3 days behind).' });

  const pages = `<div class="aui-panel aseo-scroll"><table class="aseo-table"><thead><tr><th>Page</th><th>Seen (7 days)</th><th>Week before</th><th>Clicks</th><th>Position</th><th>Our check</th><th>Google index</th></tr></thead><tbody>${r.pages.length ? r.pages.map(p => {
    const url = `${r.origin}${p.path === '/' ? '/' : p.path}`;
    const c = r.checks.find(x => x.url === url), g = r.inspect.find(x => x.url === url);
    return `<tr><td><a href="${attr(p.path)}" target="_blank" rel="noopener">${escHtml(p.path)}</a></td><td>${p.impressions}</td><td>${p.prevImpressions}</td><td>${p.clicks}</td><td class="aseo-num">${p.position ?? '—'}</td><td>${c ? (c.ok ? badge('OK', 'green') : badge(c.detail, 'red')) : '—'}</td><td>${g ? (g.ok ? badge('Indexed', 'green') : badge(g.detail || 'Not indexed', 'amber')) : '—'}</td></tr>`;
  }).join('') : r.checks.map(c => `<tr><td>${escHtml(c.url.replace(r.origin, '') || '/')}</td><td>—</td><td>—</td><td>—</td><td>—</td><td>${c.ok ? badge('OK', 'green') : badge(c.detail, 'red')}</td><td>—</td></tr>`).join('')}</tbody></table></div>`;

  const changeList = changes.length
    ? `<div class="aui-panel aseo-scroll"><table class="aseo-table"><thead><tr><th>When</th><th>Page</th><th>What</th><th>By</th><th>Before → after</th></tr></thead><tbody>${changes.map(c => `<tr><td>${ago(c.at)}</td><td>${escHtml(c.page)}</td><td>${escHtml(c.field)}</td><td>${escHtml(c.by)}</td><td><details><summary>Show</summary><p class="aseo-before">${escHtml(c.before) || '<i>empty</i>'}</p><p class="aseo-after">${escHtml(c.after) || '<i>empty</i>'}</p></details></td></tr>`).join('')}</tbody></table></div>`
    : emptyState({ title: 'No changes logged yet', sub: 'Every edit to a tracked page’s title, description, About text or weekly note lands here with its date.' });

  const runList = runs.length
    ? `<div class="aui-panel aseo-scroll"><table class="aseo-table"><thead><tr><th>When</th><th>Job</th><th></th><th>Result</th></tr></thead><tbody>${runs.map(x => `<tr><td>${ago(x.at)}</td><td>${escHtml(x.kind)}</td><td>${x.ok ? badge('OK', 'green') : badge('Failed', 'red')}</td><td>${escHtml(x.summary)}</td></tr>`).join('')}</tbody></table></div>`
    : emptyState({ title: 'No runs yet', sub: 'The jobs run on the live site only, every morning from 7am Manila.' });

  const settingsForm = `<form id="seo-settings" class="aui-panel" data-json-action="/admin/seo/report/settings" data-done="Saved." data-dirty-watch>
    ${toggleRow({ label: 'Run the SEO jobs', help: 'Daily at 7am Manila on the live site: Search Console pull, page checks, the email. Mondays: weekly court notes and Google index check. The 1st: link check and title suggestions.', name: 'seo_jobs_enabled', on: settings.enabled })}
    ${toggleRow({ label: 'Daily email', help: 'Off: Mondays only.', name: 'seo_email_daily', on: settings.daily })}
    ${toggleRow({ label: 'Weekly court notes', help: 'A dated “Lately at <court>” paragraph on each court page with games in the last 7 days, written from the scores and fact-checked. Never touches the About text.', name: 'seo_weekly_notes', on: settings.notes })}
    ${fieldGrid(field({ label: 'Send the report to', name: 'seo_report_email', type: 'email', value: settings.email, placeholder: settings.defaultEmail, help: `Blank = ${settings.defaultEmail}.` }))}
    ${fieldGrid(cities.map(c => field({ label: `Intro on /courts/${c.slug}`, name: `seo_city_intro_${c.slug}`, type: 'textarea', rows: 4, wide: true, value: c.intro, placeholder: `A few sentences about playing basketball in ${c.city}, written by a person. Blank = the page shows only the line built from the numbers.`, help: c.live ? `Live: ${c.n} court page${c.n === 1 ? '' : 's'} in ${c.city}.` : `No live court in ${c.city} yet, so the page doesn’t exist.` })).join(''))}
    <div class="aseo-actions">${button('Save', { kind: 'primary', size: 'sm', type: 'submit' })}</div>
  </form>`;

  return `${head}${setup}
    ${section({ title: 'Needs a look', bodyHtml: alerts })}
    ${section({ title: 'Target searches', note: 'The goals and dates from the plan. “Seen” is how often Google showed us for that search.', bodyHtml: targets })}
    ${section({ title: 'Tracked pages', bodyHtml: pages })}
    ${section({ title: 'Close to page 1', note: 'Positions 8–20 over 28 days, with the page that ranks and the search words its title and description lack.', bodyHtml: nearWins })}
    ${section({ title: 'Our pages competing', note: 'Two of our pages showing for the same search. “New” = not in last Monday’s email. Fix: the right page’s title says it, the other page links to it.', bodyHtml: competing })}
    ${section({ title: 'Every court and city page', bodyHtml: watch })}
    ${section({ title: 'Title suggestions', bodyHtml: suggestions })}
    ${extras ? section({ title: 'Outreach', bodyHtml: `<div class="aui-panel">${extras}</div>` }) : ''}
    ${section({ title: 'Change log', note: 'So a ranking move can be matched to what changed. Google takes 1–3 weeks to react.', bodyHtml: changeList })}
    ${section({ title: 'Job runs', bodyHtml: runList })}
    ${section({ title: 'Settings', bodyHtml: settingsForm })}
    <style>
      .aseo-scroll { overflow-x: auto; }
      .aseo-table { width: 100%; border-collapse: collapse; font-size: 13px; }
      .aseo-table th { text-align: left; font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--text-muted); padding: 8px 10px; border-bottom: 1px solid var(--border); white-space: nowrap; }
      .aseo-table td { padding: 9px 10px; border-bottom: 1px solid var(--border); vertical-align: middle; }
      .aseo-table td:first-child { white-space: nowrap; }
      .aseo-num { font-weight: 600; }
      .aseo-up { color: #22c55e; } .aseo-down { color: #ef4444; }
      .aseo-alert { margin: 0 0 6px; font-size: 13px; color: var(--text); }
      .aseo-alert:last-child, .aseo-ok { margin: 0; }
      .aseo-foot { margin: 10px 0 0; font-size: 12px; }
      .aseo-before, .aseo-after { margin: 6px 0 0; font-size: 12px; max-width: 520px; white-space: pre-wrap; }
      .aseo-before { color: var(--text-muted); text-decoration: line-through; }
      .aseo-actions { display: flex; justify-content: flex-end; margin-top: 12px; }
      .aseo-list { margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.6; }
      .aseo-list li + li { margin-top: 8px; }
      .aseo-miss { font-size: 12px; color: #f59332; }
      .aseo-sub { font-size: 11px; }
      .aseo-running { font-size: 13px; color: var(--text-muted); }
    </style>
    <script>
    // A background run: ask every 5 seconds and update the page in place when it's done. Inline
    // scripts don't re-run on an in-place update, so this listens for one (admin:updated).
    (function () {
      if (window.__seoPollInit) return;
      window.__seoPollInit = true;
      var timer = null;
      function stop() { clearInterval(timer); timer = null; }
      function tick() {
        if (!document.querySelector('[data-seo-running]')) return stop();
        fetch('/admin/seo/report/status', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (d) {
          if (d.running) return;
          stop();
          if (window.adminUi && window.adminUi.refresh) window.adminUi.refresh('SEO jobs done.'); else location.reload();
        }).catch(function () {});
      }
      function start() { if (!timer && document.querySelector('[data-seo-running]')) timer = setInterval(tick, 5000); }
      start();
      document.addEventListener('admin:updated', start);
    })();
    </script>`;
}
