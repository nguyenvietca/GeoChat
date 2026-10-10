// One synchronous theme runtime, shared by the head bootstrap and React provider.
(function () {
  if (window.geochatTheme) return;
  var key = 'geochat-theme';
  var listeners = new Set();
  var media = null;
  try { media = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)'); } catch (_) {}
  function valid(value) { return ['light', 'dark', 'system'].includes(value) ? value : 'system'; }
  var preference = 'system';
  try { preference = valid(window.localStorage.getItem(key)); } catch (_) {}
  var snapshot;
  function apply() {
    var resolved = preference === 'system' ? media && media.matches ? 'dark' : 'light' : preference;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = resolved === 'dark' ? '#14221f' : '#f2f6f4';
    if (!snapshot || snapshot.preference !== preference || snapshot.resolved !== resolved) {
      snapshot = { preference: preference, resolved: resolved };
      listeners.forEach(function (listener) { listener(); });
    }
  }
  function systemChanged() { if (preference === 'system') apply(); }
  function storageChanged(event) {
    if (event.key === key || event.key === null) { preference = valid(event.newValue); apply(); }
  }
  if (media && media.addEventListener) media.addEventListener('change', systemChanged);
  else if (media && media.addListener) media.addListener(systemChanged);
  window.addEventListener('storage', storageChanged);
  window.geochatTheme = {
    getSnapshot: function () { return snapshot; },
    subscribe: function (listener) { listeners.add(listener); return function () { listeners.delete(listener); }; },
    setPreference: function (value) {
      preference = valid(value);
      try { window.localStorage.setItem(key, preference); } catch (_) {}
      apply();
    },
    destroy: function () {
      if (media && media.removeEventListener) media.removeEventListener('change', systemChanged);
      else if (media && media.removeListener) media.removeListener(systemChanged);
      window.removeEventListener('storage', storageChanged);
      listeners.clear();
      delete window.geochatTheme;
    },
  };
  apply();
})();
