/* Compound Media — NL/EN taaltoggle (shared across all pages)
   Pure vanilla JS. Visible HTML stays Dutch (fallback when JS is off).
   Each translatable element carries data-nl + data-en; we swap textContent.
   Choice persists in localStorage so the language holds across page-clicks. */
(function () {
  var KEY = 'compound_lang';

  // --- inject toggle styling once (keeps look identical, only adds the control)
  var css = '' +
    '.nav-right{display:flex;align-items:center;gap:18px;}' +
    '.lang-toggle{display:inline-flex;align-items:center;gap:8px;font-family:var(--font-body);' +
      'font-size:0.75rem;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;user-select:none;}' +
    '.lang-toggle button{font:inherit;letter-spacing:inherit;text-transform:inherit;color:var(--text-muted);' +
      '-webkit-text-fill-color:var(--text-muted);-webkit-appearance:none;appearance:none;' +
      'background:none;border:0;padding:2px;margin:0;cursor:pointer;transition:color 200ms,-webkit-text-fill-color 200ms;line-height:1;}' +
    '.lang-toggle button:hover{color:var(--text-secondary);-webkit-text-fill-color:var(--text-secondary);}' +
    '.lang-toggle button.active{color:var(--text-primary);-webkit-text-fill-color:var(--text-primary);}' +
    '.lang-toggle .sep{color:var(--text-muted);}' +
    '@media (max-width:900px){.nav-right{margin-left:auto;gap:14px;}}';
  var style = document.createElement('style');
  style.id = 'lang-toggle-style';
  style.textContent = css;
  document.head.appendChild(style);

  function apply(lang) {
    document.documentElement.setAttribute('lang', lang);
    var nodes = document.querySelectorAll('[data-en]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var en = el.getAttribute('data-en');
      var nl = el.getAttribute('data-nl');
      if (lang === 'en' && en !== null) el.textContent = en;
      else if (nl !== null) el.textContent = nl;
    }
    var btns = document.querySelectorAll('.lang-toggle [data-lang]');
    for (var j = 0; j < btns.length; j++) {
      btns[j].classList.toggle('active', btns[j].getAttribute('data-lang') === lang);
    }
  }

  function getLang() {
    try { return localStorage.getItem(KEY) || 'nl'; } catch (e) { return 'nl'; }
  }
  function setLang(lang) {
    try { localStorage.setItem(KEY, lang); } catch (e) {}
    apply(lang);
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('[data-lang]') : null;
    if (btn && btn.parentNode && btn.parentNode.classList.contains('lang-toggle')) {
      e.preventDefault();
      setLang(btn.getAttribute('data-lang'));
    }
  });

  apply(getLang());
})();
