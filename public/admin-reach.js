// Message players composer (views/admin/reach.js), browser side. Sending itself is the
// generic form[data-json-action] in public/admin-ui.js; this file keeps the page live:
//   • picking a group (or team, or players) refetches /admin/reach/count and refills
//     "Who it reaches", the summary and the Send button
//   • the bell and email previews follow what you type
//   • "Tap goes to" fills the email button text (until you change it yourself)
//   • Send test to me, and the confirm dialog's wording (type the number past 40 emails)
(function () {
  'use strict';
  var ui = function () { return window.adminUi || { toast: function (t) { alert(t); } }; };
  var plural = function (n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); };

  function init() {
    var form = document.getElementById('reach-form');
    if (!form || form.__reach) return;
    form.__reach = true;
    var links = [];
    try { links = JSON.parse(form.getAttribute('data-links') || '[]'); } catch (e) { /* none */ }
    var q = function (sel) { return form.querySelector(sel); };
    var qa = function (sel) { return [].slice.call(form.querySelectorAll(sel)); };
    var counts = null, label = '', seq = 0, ctaTouched = false;

    function val(name) { var el = q('[name="' + name + '"]:checked') || q('[name="' + name + '"]:not([type=radio])'); return el ? el.value : ''; }
    function ids() { return qa('input[name="ids[]"]').map(function (i) { return i.value; }).filter(Boolean); }
    function params() { return { seg: val('seg'), team: val('team'), ch: val('ch'), ids: ids().join(',') }; }

    function showHide() {
      var p = params();
      qa('[data-reach-show]').forEach(function (el) { el.hidden = el.getAttribute('data-reach-show') !== p.seg; });
      qa('[data-reach-show-email]').forEach(function (el) { el.hidden = p.ch !== 'both'; });
      var other = q('[data-reach-other]');
      if (other) other.hidden = val('link') !== '__other__';
    }

    function render() {
      var p = params(), both = p.ch === 'both';
      var title = (q('[data-reach-title]').value || '').trim();
      var send = q('[data-reach-send]');
      var sum = q('[data-reach-summary]');
      if (!counts) { sum.textContent = 'Counting…'; send.disabled = true; return; }
      var n = counts.bell, e = both ? counts.email : 0;
      qa('[data-reach-n]').forEach(function (b) {
        var k = b.getAttribute('data-reach-n');
        b.textContent = (!both && (k === 'email' || k === 'bellOnly' || k === 'capped')) ? '—' : String(counts[k]);
      });
      var who = label ? '“' + label + '”' : 'this group';
      sum.textContent = !n ? 'Nobody in ' + who + ' can be reached.'
        : both ? plural(n, 'bell') + ' and ' + plural(e, 'email') + ' to ' + who
        : plural(n, 'bell') + ' to ' + who + ', no email';
      send.textContent = !n ? 'Send' : both ? 'Send to ' + plural(n, 'player') : 'Send ' + plural(n, 'bell');
      send.disabled = !n;
      form.setAttribute('data-confirm-title', 'Send “' + (title || 'this message') + '” to ' + plural(n, 'player') + '?');
      form.setAttribute('data-confirm-body', both
        ? 'Bell to ' + n + ', email to ' + e + '. Emails go out 0.6 s apart; this can’t be unsent.'
        : 'Bell to ' + n + '. No email. This can’t be unsent.');
      form.setAttribute('data-confirm-send', both ? 'Send to ' + plural(n, 'player') : 'Send ' + plural(n, 'bell'));
      if (e > 40) form.setAttribute('data-confirm-type', String(e)); else form.removeAttribute('data-confirm-type');
    }

    function refetch() {
      var p = params(), my = ++seq;
      counts = null;
      render();
      var u = new URL(location.href);
      ['seg', 'team', 'ch', 'ids'].forEach(function (k) { if (p[k]) u.searchParams.set(k, p[k]); else u.searchParams.delete(k); });
      if (p.seg !== 'team') u.searchParams.delete('team');
      if (p.seg !== 'pick') u.searchParams.delete('ids');
      history.replaceState(history.state, '', u.pathname + u.search);
      fetch('/admin/reach/count?' + new URLSearchParams(p).toString(), { credentials: 'same-origin' })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (my !== seq) return;
          counts = d; label = d.label || '';
          var cell = q('[data-seg-n="' + p.seg + '"]');
          if (cell) cell.textContent = String(d.bell);
          render();
        })
        .catch(function () { if (my === seq) ui().toast('Couldn’t count that group.', { tone: 'error' }); });
    }

    function previews() {
      var title = (q('[data-reach-title]').value || '').trim();
      var body = (q('[data-reach-body]').value || '').trim();
      var cta = (q('[data-reach-cta]') || {}).value || '';
      document.querySelectorAll('[data-prev-title]').forEach(function (el) { el.textContent = title || 'Your headline'; });
      var first = document.querySelector('[data-prev-first]');
      if (first) first.textContent = body.split('\n')[0] || 'The first line of your message';
      var full = document.querySelector('[data-prev-body]');
      if (full) full.textContent = body || 'Your message';
      var c = document.querySelector('[data-prev-cta]');
      if (c) c.textContent = cta.trim() || 'Open WKND';
      var bc = q('[data-reach-bodycount]');
      if (bc) bc.textContent = String(q('[data-reach-body]').value.length);
    }

    form.addEventListener('change', function (e) {
      var n = e.target.name;
      if (n === 'link') {
        var l = links.filter(function (x) { return x.value === e.target.value; })[0];
        var cta = q('[data-reach-cta]');
        if (l && cta && !ctaTouched) cta.value = l.cta;
        showHide(); previews();
        return;
      }
      if (n === 'seg' || n === 'team' || n === 'ch' || (e.target.closest && e.target.closest('[data-picker]'))) {
        showHide();
        if (n === 'ch') render(); else refetch();
      }
    });
    form.addEventListener('input', function (e) {
      if (e.target.hasAttribute('data-reach-cta')) ctaTouched = true;
      previews();
      if (e.target.hasAttribute('data-reach-title')) render();
    });

    q('[data-reach-test]').addEventListener('click', function () {
      var btn = this, text = btn.textContent;
      var data = {};
      new FormData(form).forEach(function (v, k) { if (k.slice(-2) !== '[]') data[k] = v; });
      btn.disabled = true; btn.textContent = 'Sending…';
      fetch('/admin/reach/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok || d.error) throw new Error(d.error || 'The test didn’t go out.'); return d; }); })
        .then(function (d) { ui().toast(d.message || 'Test sent.'); })
        .catch(function (err) { ui().toast(err.message, { tone: 'error' }); })
        .then(function () { btn.disabled = false; btn.textContent = text; });
    });

    showHide();
    previews();
    refetch();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  document.addEventListener('admin:updated', init);
})();
