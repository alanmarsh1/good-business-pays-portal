/* profile.js — enriches a company page with live claimed-profile data.
   Runs on every company page; silently no-ops if the company is unclaimed. */

(function () {
  var main = document.getElementById('main');
  if (!main) return;
  var number = main.dataset.companyNumber;
  if (!number) return;

  // Cookieless visit beacon — fire once per page load, non-blocking
  fetch('/api/beacon/' + number, { method: 'POST' }).catch(function () {});

  fetch('/api/profile/' + number)
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (!data) return;
      if (data.isOwner) injectOwnerBar(data.visits);
      if (data.claimed && data.profile) injectClaimedState(data.profile, data.comments || []);
    })
    .catch(function () {});

  /* ── Owner bar ─────────────────────────────────────────────────────── */

  function injectOwnerBar(visits) {
    var v = Number(visits) || 0;
    var bar = document.createElement('aside');
    bar.className = 'gbp-ownerbar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Owner dashboard — only you can see this');
    bar.innerHTML =
      '<div class="gbp-container gbp-ownerbar__inner">' +
        '<div class="gbp-ownerbar__stats">' +
          '<b>Only you can see this.</b> ' +
          '<span>' + v + ' supplier visit' + (v === 1 ? '' : 's') + ' in the last 30 days</span>' +
        '</div>' +
        '<a href="/for-companies/" class="gbp-btn" style="font-size:13px;">Upgrade to Good Business Partner</a>' +
      '</div>';
    var header = document.querySelector('header.gbp-site-header');
    if (header) {
      document.body.insertBefore(bar, header);
    } else {
      document.body.prepend(bar);
    }
  }

  /* ── Claimed state ──────────────────────────────────────────────────── */

  function injectClaimedState(profile, comments) {
    injectVerifiedMark(profile);
    if (profile.intro || profile.getting_paid_rules || profile.getting_paid_portal || profile.getting_paid_email) {
      injectSupplyingSection(profile);
    }
    if (comments.length) injectComments(comments);
  }

  function injectVerifiedMark(profile) {
    var ph = document.querySelector('.gbp-hero__heading .gbp-ph');
    if (!ph) return;
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:8px 20px;margin-top:16px;';
    var claimedHtml =
      '<span style="display:inline-flex;align-items:center;gap:6px;font-size:14px;font-weight:600;color:#00ff7f;">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#00ff7f" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><path d="M22 4L12 14.01l-3-3"></path>' +
        '</svg>Claimed' +
      '</span>';
    var websiteHtml = '';
    if (profile.website) {
      var domain = profile.website.replace(/^https?:\/\//, '').replace(/\/$/, '').split('/')[0];
      websiteHtml =
        '<a href="' + esc(profile.website) + '" rel="noopener" style="font-size:14px;color:#b7cfc4;text-decoration:underline;text-underline-offset:3px;">' +
          esc(domain) +
        '</a>';
    }
    row.innerHTML = claimedHtml + websiteHtml;
    // Hide the unclaimed banner in the hero
    var banner = ph.querySelector('[data-unclaimed-banner]');
    if (!banner) {
      // Fall back: look for the unclaimed inline banner in the hero (sibling of .gbp-ph)
      var heroBanner = document.querySelector('.gbp-hero__inner > [data-unclaimed]');
      if (heroBanner) heroBanner.style.display = 'none';
    }
    ph.appendChild(row);
  }

  function injectSupplyingSection(profile) {
    var companyName = document.querySelector('.gbp-ph-title') ? document.querySelector('.gbp-ph-title').textContent.trim() : 'this company';
    var inner = document.querySelector('.gbp-main__inner');
    if (!inner) return;

    var section = document.createElement('section');
    section.className = 'gbp-section';
    section.setAttribute('aria-labelledby', 'gbp-supply-h');

    var html =
      '<div class="gbp-ph"><h2 id="gbp-supply-h" class="gbp-ph-title">Supplying ' + esc(companyName) + '</h2></div>' +
      '<section class="gbp-card"><div class="gbp-supply">';

    if (profile.intro) {
      html += '<div><p>' + escNl(profile.intro) + '</p></div>';
    }
    if (profile.getting_paid_rules) {
      html += '<div><h3>Getting paid</h3><p>' + escNl(profile.getting_paid_rules) + '</p></div>';
    }
    if (profile.getting_paid_portal) {
      html +=
        '<div><h3>Supplier portal</h3><p><a href="' + esc(profile.getting_paid_portal) +
        '" rel="noopener">' + esc(profile.getting_paid_portal) + '</a></p></div>';
    }
    if (profile.getting_paid_email) {
      html +=
        '<div><h3>Payment enquiries</h3><p><a href="mailto:' + esc(profile.getting_paid_email) +
        '">' + esc(profile.getting_paid_email) + '</a></p></div>';
    }

    html += '</div></section>';
    section.innerHTML = html;

    var firstSection = inner.querySelector('.gbp-section');
    if (firstSection) {
      inner.insertBefore(section, firstSection);
    } else {
      inner.prepend(section);
    }
  }

  function injectComments(comments) {
    // Build a lookup: report_id → comment
    var byId = {};
    for (var i = 0; i < comments.length; i++) {
      byId[comments[i].report_id] = comments[i].comment;
    }

    // Inject below any trend-col that carries a matching report_id
    var cols = document.querySelectorAll('.gbp-trend-col[data-report-id]');
    for (var j = 0; j < cols.length; j++) {
      var rid = cols[j].dataset.reportId;
      if (byId[rid]) {
        // Append a comment inside the col (shown below the bar)
        var note = document.createElement('div');
        note.className = 'gbp-trend-comment';
        note.innerHTML =
          '<p style="font-size:12px;line-height:16px;color:var(--ink-muted);margin:4px 0 0;text-align:center;">' +
          esc(byId[rid]) + '</p>';
        cols[j].appendChild(note);
      }
    }

    // Also inject a consolidated .gbp-reply block after the trend card
    var trendCard = document.querySelector('.gbp-card[data-trend-card]');
    if (trendCard) {
      var reply = document.createElement('div');
      reply.className = 'gbp-reply';
      var companyName = (document.querySelector('.gbp-ph-title') || {}).textContent || 'The company';
      var replyHtml = '<b>Comment from ' + esc(companyName.trim()) + '</b>';
      for (var k = 0; k < comments.length; k++) {
        replyHtml += '<p>' + escNl(comments[k].comment) + '</p>';
      }
      reply.innerHTML = replyHtml;
      trendCard.appendChild(reply);
    }
  }

  /* ── Helpers ─────────────────────────────────────────────────────────── */

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escNl(s) {
    return esc(s).replace(/\n/g, '<br>');
  }
})();
