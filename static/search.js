/* Client-side search over the pre-built INDEX array.
   Each entry: {n: "00519500", name: "Tesco Stores Limited", end: "2026-08-30", sector: "..."} */

(function () {
  var input   = document.getElementById('search-input');
  var form    = document.getElementById('search-form');
  var results = document.getElementById('results-inner');

  if (!input || !results || typeof INDEX === 'undefined') return;

  // Show results for any query in the URL on page load
  var params = new URLSearchParams(window.location.search);
  var initial = params.get('q') || '';
  if (initial) {
    input.value = initial;
    render(search(initial));
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var q = input.value.trim();
    history.replaceState(null, '', q ? '/?q=' + encodeURIComponent(q) : '/');
    render(search(q));
  });

  input.addEventListener('input', function () {
    var q = input.value.trim();
    history.replaceState(null, '', q ? '/?q=' + encodeURIComponent(q) : '/');
    render(search(q));
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
      // Match: company number prefix, or name contains query
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
      return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', timeZone: 'UTC' });
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

  function render(items) {
    if (items === null) { results.innerHTML = ''; return; }
    if (items.length === 0) {
      results.innerHTML = '<p class="results-empty">No companies found. Try a different name or number.</p>';
      return;
    }
    var rows = items.map(function (item) {
      return '<li class="results-list__item">'
        + '<a class="results-list__link" href="/company/' + esc(item.n) + '/">'
        + '<span class="results-list__name">' + esc(item.name) + '</span>'
        + '<span class="results-list__meta">'
        + esc(item.n)
        + (item.sector ? ' &middot; ' + esc(item.sector) : '')
        + (item.end ? ' &middot; period ending ' + fmtDate(item.end) : '')
        + '</span>'
        + '</a></li>';
    });
    results.innerHTML =
      '<p class="results-count">' + items.length + (items.length === 50 ? '+' : '') + ' result' + (items.length === 1 ? '' : 's') + '</p>'
      + '<ul class="results-list">' + rows.join('') + '</ul>';
  }
})();
