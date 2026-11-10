/* Client-side search over the pre-built INDEX array.
   Each entry: {n: "00519500", name: "Tesco Stores Limited", end: "2026-08-30", sector: "..."} */

(function () {
  var input   = document.getElementById('search-input');
  var form    = document.getElementById('search-form');
  var results = document.getElementById('results-inner');

  if (!input || !results || typeof INDEX === 'undefined') return;

  var ARROW = '<svg class="gbp-results-arrow" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg>';

  // Show results for any query in the URL on page load
  var params = new URLSearchParams(window.location.search);
  var initial = params.get('q') || '';
  if (initial) {
    input.value = initial;
    render(initial, search(initial));
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var q = input.value.trim();
    history.replaceState(null, '', q ? '/?q=' + encodeURIComponent(q) : '/');
    render(q, search(q));
  });

  input.addEventListener('input', function () {
    var q = input.value.trim();
    history.replaceState(null, '', q ? '/?q=' + encodeURIComponent(q) : '/');
    render(q, search(q));
  });

  function normalise(s) {
    return s.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function search(q) {
    if (!q || q.length < 2) return null;
    var n = normalise(q);
    var out = [];
    for (var i = 0; i < INDEX.length; i++) {
      var item = INDEX[i];
      var nameLow = normalise(item.name);
      if (item.n.startsWith(n) || nameLow.includes(n)) {
        out.push(item);
        if (out.length >= 50) break;
      }
    }
    return out;
  }

  function fmtDate(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso + 'T00:00:00Z');
      return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', timeZone: 'UTC' });
    } catch (e) {
      return iso;
    }
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function render(q, items) {
    if (items === null) { results.innerHTML = ''; return; }

    var qEsc = esc(q);
    var limited = items.length === 50;

    if (items.length === 0) {
      results.innerHTML = '<p class="gbp-results-empty">No companies match &ldquo;' + qEsc + '&rdquo;. Try a different name or the company number.</p>';
      return;
    }

    var count = limited
      ? 'First 50 companies match &ldquo;' + qEsc + '&rdquo;'
      : items.length + ' ' + (items.length === 1 ? 'company matches' : 'companies match') + ' <strong>&ldquo;' + qEsc + '&rdquo;</strong>';

    var rows = items.map(function (item) {
      var meta = '<span>Company no. ' + esc(item.n) + ' &middot; </span>'
        + '<span>Period ending ' + fmtDate(item.end) + '</span>'
        + (item.sector ? '<span> &middot; ' + esc(item.sector) + '</span>' : '');
      return '<li class="gbp-results-item">'
        + '<a class="gbp-results-link" href="/company/' + esc(item.n) + '/">'
        + '<span class="gbp-results-text">'
        + '<span class="gbp-results-name">' + esc(item.name) + '</span>'
        + '<span class="gbp-results-meta">' + meta + '</span>'
        + '</span>'
        + ARROW
        + '</a></li>';
    });

    var note = limited
      ? '<p class="gbp-results-note">Showing the first 50 matches. Add more of the name, or use the company number, to narrow it down.</p>'
      : '';

    results.innerHTML =
      '<p class="gbp-results-count">' + count + '</p>'
      + '<ul class="gbp-results-list">' + rows.join('') + '</ul>'
      + note;
  }
})();
