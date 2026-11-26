/* claim.js — multi-step claim flow for /claim/ */

(function () {
  var params   = new URLSearchParams(location.search);
  var number   = params.get('n') || '';
  var name     = params.get('name') || '';
  var verified = params.get('verified') === '1';

  var AREAS = [
    'Finance and accounts payable',
    'Procurement',
    'Supplier relationships',
    'Sustainability and ESG',
    'Other',
  ];

  /* ── Populate dynamic text ──────────────────────────────────────────── */

  function populateCompany() {
    document.querySelectorAll('[data-co-name]').forEach(function (el) { el.textContent = name || number; });
    document.querySelectorAll('[data-co-number]').forEach(function (el) { el.textContent = number; });
    if (number) {
      document.querySelectorAll('[data-co-link]').forEach(function (el) {
        el.href = '/company/' + encodeURIComponent(number) + '/';
      });
    }
  }

  /* ── Progress bar ───────────────────────────────────────────────────── */

  var STEPS = ['search', 'about', 'check-email', 'profile', 'done'];

  function setProgress(step) {
    var idx = STEPS.indexOf(step);
    document.querySelectorAll('[data-progress-step]').forEach(function (el) {
      var n = parseInt(el.dataset.progressStep, 10);
      el.setAttribute('aria-current', n === idx + 1 ? 'step' : 'false');
      el.classList.toggle('gbp-step-active',   n === idx + 1);
      el.classList.toggle('gbp-step-complete',  n < idx + 1);
    });
  }

  /* ── Step visibility ────────────────────────────────────────────────── */

  function showStep(step) {
    document.querySelectorAll('[data-step]').forEach(function (el) {
      el.hidden = el.dataset.step !== step;
    });
    setProgress(step);
    populateCompany();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ── Error display ──────────────────────────────────────────────────── */

  function showError(formId, msg) {
    var el = document.getElementById(formId + '-error');
    if (el) { el.textContent = msg; el.hidden = false; }
  }

  function clearError(formId) {
    var el = document.getElementById(formId + '-error');
    if (el) { el.hidden = true; el.textContent = ''; }
  }

  /* ── Init ───────────────────────────────────────────────────────────── */

  if (!number) {
    showStep('search');
  } else if (verified) {
    showStep('profile');
  } else {
    showStep('about');
  }

  /* ── Step 1: search redirect ────────────────────────────────────────── */

  var searchForm = document.getElementById('claim-search-form');
  if (searchForm) {
    searchForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = searchForm.querySelector('[name=q]').value.trim();
      if (q) window.location.href = '/search/?q=' + encodeURIComponent(q) + '&claim=1';
    });
  }

  /* ── Step 2: about you ──────────────────────────────────────────────── */

  var aboutForm = document.getElementById('claim-about-form');
  if (aboutForm) {
    aboutForm.addEventListener('submit', function (e) {
      e.preventDefault();
      clearError('claim-about');
      var btn = aboutForm.querySelector('[type=submit]');
      btn.disabled = true;
      btn.textContent = 'Sending…';

      var optIn = aboutForm.querySelector('[name=briefing_opt_in]');

      fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number:          number,
          name:            name,
          full_name:       val(aboutForm, 'full_name'),
          job_title:       val(aboutForm, 'job_title'),
          email:           val(aboutForm, 'email'),
          area:            val(aboutForm, 'area'),
          linkedin_url:    val(aboutForm, 'linkedin_url'),
          briefing_opt_in: optIn ? optIn.checked : false,
        }),
      })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
        .then(function (res) {
          if (res.ok && res.data.ok) {
            showStep('check-email');
          } else {
            showError('claim-about', res.data.error || 'Something went wrong. Please try again.');
            btn.disabled = false;
            btn.textContent = 'Next: check your email';
          }
        })
        .catch(function () {
          showError('claim-about', 'Network error. Please check your connection and try again.');
          btn.disabled = false;
          btn.textContent = 'Next: check your email';
        });
    });
  }

  /* ── Step 4: profile ────────────────────────────────────────────────── */

  var profileForm = document.getElementById('claim-profile-form');
  if (profileForm) {
    // Character count for intro
    var introField = profileForm.querySelector('[name=intro]');
    var introCount = document.getElementById('intro-count');
    if (introField && introCount) {
      introField.addEventListener('input', function () {
        var left = 600 - introField.value.length;
        introCount.textContent = left + ' characters remaining';
        introCount.style.color = left < 50 ? 'var(--signal,#00ff7f)' : '';
      });
    }

    profileForm.addEventListener('submit', function (e) {
      e.preventDefault();
      clearError('claim-profile');
      var btn = profileForm.querySelector('[type=submit]');
      btn.disabled = true;
      btn.textContent = 'Saving…';

      // Collect per-period comments
      var commentInputs = profileForm.querySelectorAll('[name^=comment_]');
      var comments = {};
      commentInputs.forEach(function (inp) {
        var rid = inp.name.replace('comment_', '');
        if (inp.value.trim()) comments[rid] = inp.value.trim();
      });

      var payload = {
        website:            val(profileForm, 'website'),
        intro:              val(profileForm, 'intro'),
        getting_paid_rules: val(profileForm, 'getting_paid_rules'),
        getting_paid_portal:val(profileForm, 'getting_paid_portal'),
        getting_paid_email: val(profileForm, 'getting_paid_email'),
        comments:           comments,
      };

      var logoFile = profileForm.querySelector('[name=logo]') && profileForm.querySelector('[name=logo]').files[0];

      var step1 = logoFile
        ? uploadLogo(logoFile).then(function (res) {
            if (!res.ok) throw new Error(res.error || 'Logo upload failed');
            return res;
          })
        : Promise.resolve(null);

      step1
        .then(function () {
          return fetch('/api/profile/' + encodeURIComponent(number), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
        .then(function (res) {
          if (res.ok && res.data.ok) {
            showStep('done');
          } else {
            showError('claim-profile', res.data.error || 'Something went wrong. Please try again.');
            btn.disabled = false;
            btn.textContent = 'Submit for review';
          }
        })
        .catch(function (err) {
          showError('claim-profile', err.message || 'Network error. Please try again.');
          btn.disabled = false;
          btn.textContent = 'Submit for review';
        });
    });
  }

  function uploadLogo(file) {
    return fetch('/api/logo/' + encodeURIComponent(number), {
      method: 'POST',
      headers: { 'Content-Type': file.type },
      body: file,
    }).then(function (r) { return r.json(); });
  }

  function val(form, name) {
    var el = form.querySelector('[name=' + name + ']');
    return el ? el.value.trim() : '';
  }
})();
