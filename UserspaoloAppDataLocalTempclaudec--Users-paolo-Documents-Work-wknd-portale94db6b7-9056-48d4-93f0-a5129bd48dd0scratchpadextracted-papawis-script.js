
(function() {
  var gameId = "g1";
  var players = [];

  // ── Copy for Messenger ────────────────────────────────────────────────
  var gcMeta = {"date":"2026-08-10","start_time":"18:00","end_time":"20:00","location":"Court","max_slots":20};

  function pwCompactClock(hhmm) {
    var parts = hhmm.split(':');
    var h = Number(parts[0]), m = Number(parts[1]);
    var period = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return m === 0 ? (h12 + period) : (h12 + ':' + String(m).padStart(2, '0') + period);
  }

  // Reads straight off the current DOM order rather than a snapshot taken at page load —
  // drag-and-drop reorders and confirmed/waitlist moves update the DOM (and persist to the
  // server) without a page reload, so a baked-in array would silently go stale the moment
  // an admin reordered anything without refreshing first.
  function pwCurrentNames(status) {
    var list = document.getElementById('pw-list-' + status);
    if (!list) return [];
    return Array.prototype.slice.call(list.querySelectorAll('.pw-row')).map(function(li) { return li.dataset.name || ''; });
  }

  function buildMessengerText() {
    var d = new Date(gcMeta.date + 'T00:00:00');
    var dayName = d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
    var monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    var timeRange = (gcMeta.start_time && gcMeta.end_time)
      ? (pwCompactClock(gcMeta.start_time) + '-' + pwCompactClock(gcMeta.end_time))
      : '';
    var confirmedNames = pwCurrentNames('confirmed');
    var waitlistNames   = pwCurrentNames('waitlist');

    var lines = [];
    lines.push('Papawis sign-ups are open! 🏀');
    lines.push('Head to the WKND Portal (https://wkndbasketball.com/papawis), log in, and tap Join to grab a slot. First come, first served — once we hit the slot limit, extra names go on the waitlist.');
    lines.push('');
    lines.push('⚠ Not able to make it? Cancel on the portal at least 3 days before game day. After that, message an admin directly — no-shows without notice may affect future priority. ⚠');
    lines.push('');
    lines.push('🏀 PPWS : ' + dayName + ' : ' + timeRange + ' - ' + monthDay + ' 🏀');
    if (gcMeta.location) lines.push('📍 ' + gcMeta.location);
    lines.push('');
    for (var i = 0; i < gcMeta.max_slots; i++) {
      lines.push((i + 1) + '. ' + (confirmedNames[i] || ''));
    }
    if (waitlistNames.length) {
      lines.push('');
      lines.push('Waitlist:');
      waitlistNames.forEach(function(name, i) { lines.push((i + 1) + '. ' + name); });
    }
    lines.push('');
    lines.push('💸 After the game, you can settle up anytime through your Portal account — totally optional, you can always just send payment straight to an admin instead.');
    return lines.join('\n');
  }

  var lockBtn = document.getElementById('pw-lock-btn');
  if (lockBtn) {
    lockBtn.addEventListener('click', function() {
      var locked = lockBtn.dataset.locked === '1';
      var msg = locked
        ? 'Unlock this roster? You\'ll be able to edit signups and teams again.'
        : 'Lock this roster? Signups and teams become read-only until you unlock it.';
      if (!confirm(msg)) return;
      lockBtn.disabled = true;
      fetch('/admin/papawis/' + gameId + '/' + (locked ? 'unlock' : 'lock'), { method: 'POST' })
        .then(function(r) { return r.json(); })
        .then(function(d) { if (d.ok) location.reload(); else { alert(d.error || 'Failed'); lockBtn.disabled = false; } })
        .catch(function() { alert('Network error'); lockBtn.disabled = false; });
    });
  }

  var copyBtn = document.getElementById('pw-copy-messenger');
  if (copyBtn) {
    var copyBtnDefault = copyBtn.textContent;
    copyBtn.addEventListener('click', function() {
      var text = buildMessengerText();
      navigator.clipboard.writeText(text).then(function() {
        copyBtn.textContent = '✅ Copied!';
        setTimeout(function() { copyBtn.textContent = copyBtnDefault; }, 1800);
      }).catch(function() {
        alert('Could not copy automatically — copy the text below:\n\n' + text);
      });
    });
  }

  var pInput    = document.getElementById('pw-add-player-input');
  var pHidden   = document.getElementById('pw-add-player-id');
  var pDropdown = document.getElementById('pw-add-player-dropdown');

  if (pInput) {
    function renderDropdown() {
      var q = pInput.value.trim().toLowerCase();
      var matches = players.filter(function(p) {
        return !q || p.name.toLowerCase().indexOf(q) !== -1;
      }).slice(0, 8);
      if (!matches.length) { pDropdown.hidden = true; pDropdown.innerHTML = ''; return; }
      pDropdown.innerHTML = matches.map(function(p) {
        var div = document.createElement('div');
        div.className = 'px-3 py-2 text-sm text-slate-200 hover:bg-white/5 cursor-pointer';
        div.textContent = p.name;
        div.dataset.id = p.id;
        div.dataset.name = p.name;
        return div.outerHTML;
      }).join('');
      pDropdown.hidden = false;
    }
    pInput.addEventListener('focus', renderDropdown);
    pInput.addEventListener('input', function() { pHidden.value = ''; renderDropdown(); });
    pDropdown.addEventListener('mousedown', function(e) {
      var item = e.target.closest('[data-id]');
      if (!item) return;
      pHidden.value = item.dataset.id;
      pInput.value = item.dataset.name;
      pDropdown.hidden = true;
    });
    document.addEventListener('click', function(e) {
      if (e.target !== pInput && !pDropdown.contains(e.target)) pDropdown.hidden = true;
    });
  }

  // ── Confirmed/Waitlist: move buttons + drag-and-drop reorder ─────────────
  var pwLists = Array.prototype.slice.call(document.querySelectorAll('.pw-list'));

  function pwListEl(status) { return document.getElementById('pw-list-' + status); }

  function pwPersistOrder(status) {
    var list = pwListEl(status);
    if (!list) return Promise.resolve();
    var ids = Array.prototype.slice.call(list.querySelectorAll('.pw-row')).map(function(li) { return li.dataset.id; });
    if (!ids.length) return Promise.resolve();
    return fetch('/admin/papawis/' + gameId + '/signups/reorder', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: status, ids: ids })
    });
  }

  // Button-based move — the reliable path (also the only one that works on touch,
  // since native HTML5 drag-and-drop below is desktop/mouse only).
  document.querySelectorAll('[data-move]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var sid = btn.dataset.move, to = btn.dataset.to;
      btn.disabled = true;
      fetch('/admin/papawis/' + gameId + '/signups/' + sid + '/status', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: to })
      })
      .then(function(r) { return r.json(); })
      .then(function(d) { if (d.ok) location.reload(); else { alert(d.error || 'Could not move.'); btn.disabled = false; } })
      .catch(function() { alert('Network error'); btn.disabled = false; });
    });
  });

  document.querySelectorAll('[data-notify-team]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (!confirm('Send a one-time "you\'re on Team ' + btn.dataset.teamLabel + '" email now?')) return;
      var sid = btn.dataset.notifyTeam;
      btn.disabled = true; btn.textContent = 'Sending…';
      fetch('/admin/papawis/' + gameId + '/signups/' + sid + '/notify-team', { method: 'POST' })
        .then(function(r) { return r.json(); })
        .then(function(d) { if (d.ok) location.reload(); else { alert(d.error || 'Could not send.'); btn.disabled = false; btn.textContent = '✉ Notify Team'; } })
        .catch(function() { alert('Network error'); btn.disabled = false; btn.textContent = '✉ Notify Team'; });
    });
  });

  // Drag-and-drop: reorders within a list, or moves between the two (server has final
  // say on the confirmed-list cap — a rejected cross-list move just reloads to the
  // last-saved state instead of leaving the UI showing a drop that didn't actually stick).
  var draggingRow = null, draggingFrom = null;

  document.querySelectorAll('.pw-row[draggable="true"]').forEach(function(row) {
    row.addEventListener('dragstart', function() {
      draggingRow = row;
      draggingFrom = row.dataset.status;
      row.classList.add('is-dragging');
    });
    row.addEventListener('dragend', function() {
      row.classList.remove('is-dragging');
      pwLists.forEach(function(l) { l.classList.remove('is-drag-over'); l.classList.remove('is-drag-blocked'); });
      draggingRow = null; draggingFrom = null;
    });
  });

  function pwRowAfterPoint(list, y) {
    var rows = Array.prototype.slice.call(list.querySelectorAll('.pw-row:not(.is-dragging)'));
    var closest = null, closestOffset = -Infinity;
    rows.forEach(function(r) {
      var box = r.getBoundingClientRect();
      var offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closestOffset) { closestOffset = offset; closest = r; }
    });
    return closest;
  }

  pwLists.forEach(function(list) {
    list.addEventListener('dragover', function(e) {
      if (!draggingRow) return;
      // Only a cross-list drag actually adds a new row to Confirmed — reordering
      // within an already-full Confirmed list doesn't grow it, so that stays allowed.
      var isConfirmedList = list.dataset.status === 'confirmed';
      var wouldExceed = isConfirmedList && draggingFrom !== 'confirmed'
        && list.querySelectorAll('.pw-row:not(.is-dragging)').length >= gcMeta.max_slots;
      if (wouldExceed) {
        list.classList.remove('is-drag-over');
        list.classList.add('is-drag-blocked');
        return; // no preventDefault() — browser shows its native not-allowed cursor and blocks the drop
      }
      e.preventDefault();
      list.classList.remove('is-drag-blocked');
      list.classList.add('is-drag-over');
      var empty = list.querySelector('.pw-list__empty');
      if (empty) empty.remove();
      var after = pwRowAfterPoint(list, e.clientY);
      if (after == null) list.appendChild(draggingRow);
      else list.insertBefore(draggingRow, after);
    });
    list.addEventListener('dragleave', function(e) {
      if (e.target === list) { list.classList.remove('is-drag-over'); list.classList.remove('is-drag-blocked'); }
    });
    list.addEventListener('drop', function(e) {
      e.preventDefault();
      if (!draggingRow) return;
      list.classList.remove('is-drag-over');
      list.classList.remove('is-drag-blocked');
      var toStatus = list.dataset.status;
      var sid = draggingRow.dataset.id;
      if (draggingFrom === toStatus) {
        pwPersistOrder(toStatus);
      } else {
        draggingRow.dataset.status = toStatus;
        fetch('/admin/papawis/' + gameId + '/signups/' + sid + '/status', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: toStatus })
        })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          if (d.ok) return pwPersistOrder(toStatus).then(function() { location.reload(); });
          alert(d.error || 'Could not move.'); location.reload();
        })
        .catch(function() { alert('Network error'); location.reload(); });
      }
    });
  });

  document.querySelectorAll('[data-remove]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (!confirm('Remove this player from the papawis?')) return;
      var sid = btn.dataset.remove;
      btn.disabled = true;
      fetch('/admin/papawis/' + gameId + '/remove/' + sid, { method: 'POST' })
        .then(function(r) { return r.json(); })
        .then(function(d) { if (d.ok) location.reload(); else { alert(d.error || 'Failed'); btn.disabled = false; } })
        .catch(function() { alert('Network error'); btn.disabled = false; });
    });
  });

  function pwSetPaid(sid, paid, btn) {
    btn.disabled = true;
    fetch('/admin/papawis/' + gameId + '/signups/' + sid + '/paid', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paid: paid })
    })
      .then(function(r) { return r.json(); })
      .then(function(d) { if (d.ok) location.reload(); else { alert(d.error || 'Could not update.'); btn.disabled = false; } })
      .catch(function() { alert('Network error'); btn.disabled = false; });
  }
  document.querySelectorAll('[data-mark-paid]').forEach(function(btn) {
    btn.addEventListener('click', function() { pwSetPaid(btn.dataset.markPaid, true, btn); });
  });
  document.querySelectorAll('[data-unmark-paid]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (!confirm('Unmark as paid? This voids the recorded payment in the ledger.')) return;
      pwSetPaid(btn.dataset.unmarkPaid, false, btn);
    });
  });
  document.querySelectorAll('[data-link-payment]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var sid = btn.dataset.linkPayment, txId = btn.dataset.txId;
      btn.disabled = true;
      fetch('/admin/papawis/' + gameId + '/signups/' + sid + '/link-payment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tx_id: txId })
      })
        .then(function(r) { return r.json(); })
        .then(function(d) { if (d.ok) location.reload(); else { alert(d.error || 'Could not link.'); btn.disabled = false; } })
        .catch(function() { alert('Network error'); btn.disabled = false; });
    });
  });

  var sendEmailsBtn = document.getElementById('pw-send-emails-btn');
  if (sendEmailsBtn) {
    sendEmailsBtn.addEventListener('click', function() {
      if (!confirm('Email every confirmed player their total for this game?')) return;
      var msg = document.getElementById('pw-send-emails-msg');
      sendEmailsBtn.disabled = true;
      msg.textContent = 'Sending…';
      msg.className = 'text-xs mt-1.5 min-h-[16px] text-slate-500';
      fetch('/admin/papawis/' + gameId + '/send-payment-emails', { method: 'POST' })
        .then(function(r) { return r.json(); })
        .then(function(d) {
          sendEmailsBtn.disabled = false;
          if (!d.ok) { msg.textContent = d.error || 'Failed to send.'; msg.className = 'text-xs mt-1.5 min-h-[16px] text-error'; return; }
          msg.textContent = 'Sent to ' + d.sent + (d.sent === 1 ? ' player' : ' players') + (d.errors && d.errors.length ? ' (' + d.errors.length + ' failed)' : '.');
          msg.className = 'text-xs mt-1.5 min-h-[16px] text-emerald-400';
        })
        .catch(function() {
          sendEmailsBtn.disabled = false;
          msg.textContent = 'Network error.';
          msg.className = 'text-xs mt-1.5 min-h-[16px] text-error';
        });
    });
  }

  var addBtn = document.getElementById('pw-add-btn');
  if (addBtn) {
    addBtn.addEventListener('click', function() {
      var pid = pHidden.value;
      var status = document.getElementById('pw-add-status').value;
      var guestNames = document.getElementById('pw-guest-names').value;
      var msg = document.getElementById('pw-add-msg');
      msg.style.display = 'none';
      if (!pid) { msg.textContent = 'Select a player first.'; msg.style.display = 'block'; return; }
      addBtn.disabled = true;
      fetch('/admin/papawis/' + gameId + '/add', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: pid, status: status, guest_names: guestNames })
      })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.ok) { location.reload(); }
        else { msg.textContent = d.error || 'Failed to add.'; msg.style.display = 'block'; addBtn.disabled = false; }
      })
      .catch(function() { msg.textContent = 'Network error.'; msg.style.display = 'block'; addBtn.disabled = false; });
    });
  }

  var completeBtn = document.getElementById('pw-complete-btn');
  if (completeBtn) {
    completeBtn.addEventListener('click', function() {
      var price = document.getElementById('pw-price').value;
      var msg = document.getElementById('pw-complete-msg');
      msg.style.display = 'none';
      if (!price || Number(price) <= 0) { msg.textContent = 'Enter a valid price per player.'; msg.style.display = 'block'; return; }
      if (!confirm('Charge ₱' + price + ' to every confirmed player? This cannot be undone from here.')) return;
      completeBtn.disabled = true; completeBtn.textContent = 'Charging…';
      fetch('/admin/papawis/' + gameId + '/complete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price_per_player: Number(price) })
      })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.ok) { location.reload(); }
        else { msg.textContent = d.error || 'Failed.'; msg.style.display = 'block'; completeBtn.disabled = false; completeBtn.textContent = '<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7.5l3 3 6-7"/></svg> Confirm & charge'; }
      })
      .catch(function() { msg.textContent = 'Network error.'; msg.style.display = 'block'; completeBtn.disabled = false; });
    });
  }

  var cancelGameBtn = document.getElementById('pw-cancel-game-btn');
  if (cancelGameBtn) {
    cancelGameBtn.addEventListener('click', function() {
      if (!confirm('Cancel this papawis? No charges will be made.')) return;
      cancelGameBtn.disabled = true;
      fetch('/admin/papawis/' + gameId + '/cancel', { method: 'POST' })
        .then(function(r) { return r.json(); })
        .then(function(d) { if (d.ok) location.reload(); else { alert(d.error || 'Failed'); cancelGameBtn.disabled = false; } })
        .catch(function() { alert('Network error'); cancelGameBtn.disabled = false; });
    });
  }

  document.getElementById('pw-delete-btn').addEventListener('click', function() {
    if (!confirm('Delete this papawis entirely? This removes all signups and cannot be undone.')) return;
    var btn = this;
    btn.disabled = true;
    fetch('/admin/papawis/' + gameId, { method: 'DELETE' })
      .then(function(r) { if (r.ok) { window.location.href = '/admin/papawis'; } else { alert('Failed'); btn.disabled = false; } })
      .catch(function() { alert('Network error'); btn.disabled = false; });
  });
})();
