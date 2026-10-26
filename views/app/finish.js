// Finish the game (games admins, after the box score is saved): the POTG and its write-up, the
// recap, the cover and the YouTube link, in one screen with one Save. Everything posts to the
// site's own routes (/admin/games/:id/save, generate-potg, generate-recap, cover), so the site
// and the app can't drift apart: public/app.js initFinish. The recap is plain text here (a blank
// line starts a paragraph); a recap with the site editor's formatting is only sent when edited.
import { esc, appAvatar, backChev, icons } from './layout.js';

// d: server.js /app/admin/games/:id/finish. checks: [{ label, ok }] · cands: the winners' top
// five by PER (plus picks from outside it): [{ id, name, initials, photo, ring, line }]
export function appFinishGamePage({ back, missing = false, d = {} }) {
  const nav = `<div class="navbar"><a class="navbar__back" href="${esc(back.href)}">${backChev}${esc(back.label)}</a><span class="navbar__title">Finish the game</span><span></span></div>`;
  if (missing) return `${nav}<div class="empty" style="margin-top:12px">${esc(d.why || 'This game isn’t ready for its POTG and recap yet.')}</div>`;
  const g = d.game;
  const left = d.checks.filter(c => !c.ok).length;
  const chip = c => `<span class="fin-chip${c.ok ? ' is-ok' : ''}">${c.ok ? icons.check : '<i aria-hidden="true"></i>'}${esc(c.label)}</span>`;
  const order = [d.potg, d.co].filter(Boolean);
  const cand = p => {
    const i = order.indexOf(p.id);
    return `<button type="button" class="cell fin-cand${i !== -1 ? ' is-on' : ''}" data-fin-cand="${esc(p.id)}" data-name="${esc(p.name)}" aria-pressed="${i !== -1}">
      ${appAvatar({ playerId: p.id, initials: p.initials, ring: p.ring, photoUrl: p.photo })}
      <span class="cell__t">${esc(p.name)}<small>${esc(p.line)}</small></span>
      <span class="fin-tag" data-fin-tag>${i === 1 ? 'CO-POTG' : i === 0 ? 'POTG' : ''}</span>
      <span class="fin-tick" aria-hidden="true">${icons.check}</span></button>`;
  };
  const nameOf = id => (d.cands.find(p => p.id === id) || {}).name || '';
  const writeBox = (key, label, value, hidden) => `<div class="fc fin-box" data-fin-box="${key}"${hidden ? ' hidden' : ''}>
      <label class="fin-l" for="fin-${key}" data-fin-label="${key}">${esc(label)}</label>
      <textarea class="fin-ta" id="fin-${key}" rows="5" name="${key === 'potg' ? 'potg_writeup' : 'co_potg_writeup'}" placeholder="${key === 'potg' ? 'Why they were the player of the game…' : 'Why they shared the award…'}" data-fin-field>${esc(value)}</textarea>
      <button type="button" class="btn btn--ghost" data-fin-ai="${key}">✦ Write with AI</button>
      <p class="fin-status" data-fin-status="${key}" hidden></p>
    </div>`;
  return `${nav}
  <form class="fin" data-fin="${esc(g.id)}" data-fin-recap-formatted="${d.recapFormatted ? '1' : ''}" novalidate>
  <section class="fc fin-top">
    <span class="kick">Final · ${esc(g.day)}</span>
    <div class="fin-score"><span><i class="dot" style="--c:${esc(g.a.color)}"></i>${esc(g.a.name)}</span><b class="num">${g.a.score}–${g.b.score}</b><span>${esc(g.b.name)}<i class="dot" style="--c:${esc(g.b.color)}"></i></span></div>
    <div class="fin-chips">${d.checks.map(chip).join('')}</div>
    <p class="fin-sub">${left ? `${left} to go. The game page shows what’s in so far.` : 'All in. Edit anything and save again.'}</p>
  </section>

  <div class="sec">Player of the game</div>
  <p class="foot-note fin-hint" data-fin-hint>${esc(d.winner)} won: their top five by PER. Tap one, or two to share the award.</p>
  ${d.cands.length ? `<div class="group fin-cands">${d.cands.map(cand).join('')}</div>` : '<div class="empty">No stats to choose from.</div>'}
  <input type="hidden" name="potg_player_id" value="${esc(d.potg)}" data-fin-potg>
  <input type="hidden" name="co_potg_player_id" value="${esc(d.co)}" data-fin-co>
  ${writeBox('potg', `Write-up${d.potg ? ` · ${nameOf(d.potg)}` : ''}`, d.potgWriteup, false)}
  ${writeBox('copotg', `Write-up${d.co ? ` · ${nameOf(d.co)}` : ''}`, d.coWriteup, !d.co)}

  <div class="sec">Recap</div>
  <div class="fc fin-box">
    <label class="fin-l" for="fin-ctx">Extra context for the AI <span class="fin-opt">(optional, not saved)</span></label>
    <input class="adm-input" id="fin-ctx" type="text" maxlength="1500" placeholder="e.g. First game back for Kix. Focus on the Q4 defense." data-fin-ctx>
    <button type="button" class="btn btn--ghost" data-fin-ai="recap">✦ Write with AI</button>
    <p class="fin-status" data-fin-status="recap" hidden></p>
    <label class="fin-l" for="fin-recap">The recap · <span data-fin-words>${d.words}</span> words</label>
    ${d.recapFormatted ? '<p class="msg msg--info fin-msg">This recap has formatting from the site’s editor. It’s only sent from here if you change it, and then as plain paragraphs.</p>' : ''}
    <textarea class="fin-ta fin-ta--tall" id="fin-recap" rows="12" placeholder="Write the recap, or let the AI start it and edit it here. A blank line starts a new paragraph." data-fin-recap>${esc(d.recapText)}</textarea>
  </div>

  <div class="sec">Cover and video</div>
  <div class="fc fin-box">
    <div class="fin-cover adm-cover" data-adm-cover="${esc(g.id)}" data-adm-cover-url="/admin/games/${esc(encodeURIComponent(g.id))}/cover"${d.hasCover ? ' data-has-cover' : ''}>
      ${d.hasCover ? `<img src="${esc(d.coverUrl)}" alt="The game’s cover" decoding="async">` : `<span class="fin-cover__none">${icons.camera}No cover yet</span>`}
      <div class="adm-cover__drop" aria-hidden="true"><span>${icons.image}Drop the photo to use it as the cover</span></div>
      <input type="file" accept="image/*" hidden data-adm-cover-input>
      <button type="button" class="btn btn--ghost fin-cover__btn adm-cover__btn" data-adm-cover-btn>${icons.camera}<span>${d.hasCover ? 'Change photo' : 'Add a photo'}</span></button>
    </div>
    <label class="fin-l" for="fin-yt">YouTube link</label>
    <input class="adm-input" id="fin-yt" type="url" inputmode="url" name="youtube_url" value="${esc(d.youtube)}" placeholder="https://youtube.com/watch?v=…" data-fin-field>
  </div>

  <div class="sec">POTG video</div>
  <div class="group"><div class="cell fin-soon" aria-disabled="true"><span class="cell__t">Make the POTG video<small>Renders on the server. You’ll get a bell when it’s ready.</small></span><span class="pill">Coming soon</span></div></div>

  <div class="fin-bar"><button type="submit" class="btn" data-fin-save disabled>Save</button><p class="fin-sub" data-fin-note>Nothing goes out until you tap Save.</p></div>
  </form>`;
}
