// Admin → Site settings → SEO report (/admin/seo/report): the court SEO project. Settings
// (on/off, who gets the email, city page intros), the report itself (same data as the daily
// email), every change made to tracked pages and every job run. Built on ui.js.
import { escHtml } from '../layout.js';
import { pageHeader, section, badge, button, field, fieldGrid, toggleRow, banner, ago, emptyState, sparkline } from './ui.js';

const attr = s => escHtml(String(s ?? ''));
const fmtDay = ymd => (ymd ? new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '—');
const TONE = { reached: 'green', ontrack: 'green', behind: 'amber', waiting: 'gray' };

export function adminSeoReportBody({ report, settings, gscReady, cities, runs, changes, trendByQuery = {} }) {
  const r = report;
  const head = pageHeader({
    eyebrow: 'Search results',
    title: 'SEO report',
    sub: 'Court SEO project: Activate Hoop Arena first, then the Mandaluyong and Pasig city pages. Runs by itself every day; the email is the summary.',
    actionsHtml: `${button('Send today’s email now', { kind: 'secondary', size: 'sm', attrs: 'data-post-json="/admin/seo/report/send" data-done="Sent."' })}
      ${button('Run all jobs now', { kind: 'secondary', size: 'sm', attrs: 'data-post-json="/admin/seo/report/run" data-done="Done. Reload to see the results." data-confirm data-confirm-title="Run the SEO jobs now?" data-confirm-body="Pulls Search Console, checks the pages, asks Google about each page and rewrites the weekly court notes from the last 7 days. Sends the email. Takes up to two minutes." data-confirm-send="Run"' })}`,
  });

  const setup = gscReady ? '' : banner('warn', 'Search Console isn’t connected yet, so there are no rankings. The page checks and weekly notes still run. Setup: a Google service account with read access to the wkndbasketball.com property, then GSC_SERVICE_ACCOUNT_FILE and GSC_SITE_URL in .env (steps at the top of lib/seo-gsc.js).');

  const alerts = r.alerts.length
    ? `<div class="aui-panel">${r.alerts.map(a => `<p class="aseo-alert">${escHtml(a)}</p>`).join('')}</div>`
    : `<div class="aui-panel"><p class="aui-muted aseo-ok">All tracked pages up, nothing broken.</p></div>`;

  const targets = r.targets.length
    ? `<div class="aui-panel aseo-scroll"><table class="aseo-table"><thead><tr><th>Search</th><th>Position</th><th>Change</th><th>Seen</th><th>Clicks</th><th>Goal</th><th>Status</th><th>12 weeks</th></tr></thead><tbody>${r.targets.map(t => {
      const tr = trendByQuery[t.query] || [];
      return `<tr><td>${escHtml(t.query)}</td><td class="aseo-num">${t.position ?? '—'}</td><td>${t.change ? `<span class="aseo-${t.change > 0 ? 'up' : 'down'}">${t.change > 0 ? '▲' : '▼'}${Math.abs(t.change)}</span>` : ''}</td><td>${t.impressions}</td><td>${t.clicks}</td><td>Top ${t.goal} by ${fmtDay(t.by)}</td><td>${badge(t.status.label, TONE[t.status.key])}</td><td>${tr.length > 1 ? sparkline(tr.map(x => -x)) : ''}</td></tr>`;
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
    </style>`;
}
