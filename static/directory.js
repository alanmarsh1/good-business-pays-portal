/* Good Business Partners directory — client-side filter / sort / paginate.
   Data is embedded as JSON in #dir-data. */

(function () {
  var dataEl = document.getElementById('dir-data');
  if (!dataEl) return;
  var DATA;
  try { DATA = JSON.parse(dataEl.textContent); } catch (e) { return; }
  if (!DATA || !DATA.length) return;

  var PER_PAGE = 12;

  var dirEl    = document.querySelector('.gbp-dir');
  var pagerEl  = document.querySelector('.gbp-pager');
  var countEl  = document.querySelector('.gbp-results-count');
  var sectorSel = document.getElementById('dir-sector');
  var sortSel  = document.getElementById('dir-sort');
  var toggles  = document.querySelectorAll('.gbp-toggle');

  var ARROW = '<svg class="gbp-dir-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg>';

  /* ── State ─────────────────────────────────────────────────────────── */

  function readParams() {
    var p = new URLSearchParams(location.search);
    return {
      sector: p.get('sector') || '',
      band:   p.get('band')   || '',
      sort:   p.get('sort')   || 'az',
      page:   Math.max(1, parseInt(p.get('page') || '1', 10)),
    };
  }

  function pushParams(s) {
    var p = new URLSearchParams();
    if (s.sector)             p.set('sector', s.sector);
    if (s.band)               p.set('band',   s.band);
    if (s.sort && s.sort !== 'az') p.set('sort', s.sort);
    if (s.page > 1)           p.set('page',   s.page);
    var qs = p.toString();
    history.replaceState(null, '', qs ? '?' + qs : location.pathname);
  }

  /* ── Filter + sort ──────────────────────────────────────────────────── */

  function applyFilters(s) {
    var rows = DATA;
    if (s.sector) rows = rows.filter(function (r) { return r.sector === s.sector; });
    if (s.band)   rows = rows.filter(function (r) { return r.band   === s.band;   });
    rows = rows.slice(); // copy before sort
    if (s.sort === 'avg') {
      rows.sort(function (a, b) { return (a.avg == null ? 9999 : a.avg) - (b.avg == null ? 9999 : b.avg); });
    } else if (s.sort === 'late') {
      rows.sort(function (a, b) { return (a.late == null ? 9999 : a.late) - (b.late == null ? 9999 : b.late); });
    } else {
      rows.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
    }
    return rows;
  }

  /* ── RAG helpers ────────────────────────────────────────────────────── */

  function avgRag(d) {
    if (d == null) return '';
    return d <= 30 ? 'gbp-rag-1' : d <= 60 ? 'gbp-rag-3' : 'gbp-rag-5';
  }
  function avgLabel(d) {
    if (d == null) return '';
    return d <= 30 ? 'Excellent' : d <= 60 ? 'Fair' : 'Very poor';
  }
  function lateRag(p) {
    if (p == null) return '';
    return p < 5 ? 'gbp-rag-1' : p <= 20 ? 'gbp-rag-3' : 'gbp-rag-5';
  }
  function lateLabel(p) {
    if (p == null) return '';
    return p < 5 ? 'Excellent' : p <= 20 ? 'Fair' : 'Very poor';
  }

  /* ── Formatting ─────────────────────────────────────────────────────── */

  function fmt(v) {
    if (v == null) return '—';
    return v % 1 === 0 ? String(v) : v.toFixed(1);
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function subLine(r) {
    var parts = [];
    if (r.reports) parts.push(r.reports + ' report' + (r.reports === 1 ? '' : 's'));
    if (r.since && r.trend) {
      parts.push(r.trend.charAt(0).toUpperCase() + r.trend.slice(1) + ' since ' + r.since);
    }
    return parts.join(' · ');
  }

  function chipHtml(band) {
    if (!band) return '';
    var label = band === 'Recognised' ? 'Recognised Fast Payer' : band + ' Fast Payer';
    return '<span class="gbp-chip">' + esc(label) + '</span>';
  }

  /* ── Render rows ────────────────────────────────────────────────────── */

  function renderRows(slice) {
    var html = '';
    for (var i = 0; i < slice.length; i++) {
      var r = slice[i];
      var avgBadge  = r.avg  != null ? '<span class="gbp-badge ' + avgRag(r.avg)   + '">' + avgLabel(r.avg)   + '</span>' : '';
      var lateBadge = r.late != null ? '<span class="gbp-badge ' + lateRag(r.late) + '">' + lateLabel(r.late) + '</span>' : '';
      html +=
        '<a class="gbp-dir-row" href="/company/' + esc(r.n) + '/" role="listitem">' +
          '<span class="gbp-dir-co">' +
            '<span class="gbp-dir-text">' +
              '<span class="gbp-dir-name">' + esc(r.name) + '</span>' +
              '<span class="gbp-dir-sub">'  + esc(subLine(r)) + '</span>' +
            '</span>' +
          '</span>' +
          '<span class="gbp-dir-num"><b>' + fmt(r.avg)  + '<span class="gbp-dir-k"> days to pay</span></b>' + avgBadge  + '</span>' +
          '<span class="gbp-dir-num"><b>' + fmt(r.late) + '%<span class="gbp-dir-k"> paid late</span></b>'  + lateBadge + '</span>' +
          '<span class="gbp-dir-rec">' + chipHtml(r.band) + '</span>' +
          ARROW +
        '</a>';
    }
    var head = dirEl.querySelector('.gbp-dir-head');
    dirEl.innerHTML = '';
    if (head) dirEl.appendChild(head);
    dirEl.insertAdjacentHTML('beforeend', html);
  }

  /* ── Render pager ───────────────────────────────────────────────────── */

  function renderPager(pg, totalPages, total, start, end) {
    if (totalPages <= 1) {
      pagerEl.innerHTML = '<span>Showing all ' + total + ' compan' + (total === 1 ? 'y' : 'ies') + '</span><nav aria-label="Pages"></nav>';
      return;
    }
    var nums = {};
    [1, totalPages, pg - 1, pg, pg + 1].forEach(function (n) {
      if (n >= 1 && n <= totalPages) nums[n] = true;
    });
    var sorted = Object.keys(nums).map(Number).sort(function (a, b) { return a - b; });
    var nav = '';
    var prev = 0;
    for (var i = 0; i < sorted.length; i++) {
      var n = sorted[i];
      if (n - prev > 1) nav += '<span>…</span>';
      if (n === pg) {
        nav += '<span class="gbp-on" aria-current="page">' + n + '</span>';
      } else {
        nav += '<a href="#" data-page="' + n + '">' + n + '</a>';
      }
      prev = n;
    }
    if (pg < totalPages) {
      nav += '<a href="#" data-page="' + (pg + 1) + '" aria-label="Next page">›</a>';
    }
    pagerEl.innerHTML = '<span>Showing ' + (start + 1) + ' to ' + end + ' of ' + total + '</span><nav aria-label="Pages">' + nav + '</nav>';
    pagerEl.querySelectorAll('[data-page]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        state.page = parseInt(a.dataset.page, 10);
        render();
        var mainEl = document.getElementById('main');
        if (mainEl) window.scrollTo({ top: mainEl.offsetTop - 20, behavior: 'smooth' });
      });
    });
  }

  /* ── Full render ────────────────────────────────────────────────────── */

  var state;

  function render() {
    var rows       = applyFilters(state);
    var total      = rows.length;
    var totalPages = Math.ceil(total / PER_PAGE) || 1;
    state.page     = Math.min(Math.max(1, state.page), totalPages);
    var start      = (state.page - 1) * PER_PAGE;
    var end        = Math.min(start + PER_PAGE, total);

    countEl.innerHTML = '<strong>' + total + ' compan' + (total === 1 ? 'y' : 'ies') + '</strong> · showing ' + (total ? start + 1 : 0) + ' to ' + end;
    renderRows(rows.slice(start, end));
    renderPager(state.page, totalPages, total, start, end);
    pushParams(state);
  }

  /* ── Sync UI ────────────────────────────────────────────────────────── */

  function syncUI() {
    if (sectorSel) sectorSel.value = state.sector || '';
    if (sortSel)   sortSel.value   = state.sort   || 'az';
    toggles.forEach(function (btn) {
      btn.setAttribute('aria-pressed', btn.dataset.band === state.band ? 'true' : 'false');
    });
  }

  /* ── Event listeners ────────────────────────────────────────────────── */

  if (sectorSel) {
    sectorSel.addEventListener('change', function () {
      state.sector = sectorSel.value;
      state.page   = 1;
      render();
    });
  }

  if (sortSel) {
    sortSel.addEventListener('change', function () {
      state.sort = sortSel.value;
      state.page = 1;
      render();
    });
  }

  toggles.forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.band = btn.dataset.band;
      state.page = 1;
      toggles.forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
      render();
    });
  });

  /* ── Init ────────────────────────────────────────────────────────────── */

  state = readParams();
  syncUI();
  render();
})();
