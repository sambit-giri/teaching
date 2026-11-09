// Light/dark switch for the hand-written pages. Follows the system setting until the reader
// clicks the button (or presses T); the choice is then remembered for the whole site.
(function () {
  const root = document.documentElement;
  const system = matchMedia("(prefers-color-scheme: light)");
  let saved = null;
  try { saved = localStorage.getItem("theme"); } catch (e) {}
  root.dataset.theme = saved || (system.matches ? "light" : "dark");
  // a PDF export of the slides (?print-pdf) is always light: dark pages need "background graphics"
  if (/print-pdf/.test(location.search)) { root.dataset.theme = "light"; return; }
  system.addEventListener("change", (e) => {
    if (!saved) root.dataset.theme = e.matches ? "light" : "dark";
  });

  function toggle() {
    saved = root.dataset.theme === "light" ? "dark" : "light";
    root.dataset.theme = saved;
    try { localStorage.setItem("theme", saved); } catch (e) {}
  }

  document.addEventListener("DOMContentLoaded", () => {
    const b = document.createElement("button");
    b.id = "themeToggle";
    b.type = "button";
    b.title = "Switch light/dark (T)";
    b.setAttribute("aria-label", "Switch between light and dark mode");
    b.innerHTML =
      '<svg class="sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/>' +
      '<path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>' +
      '<svg class="moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.6A8.2 8.2 0 1 1 9.4 4a6.6 6.6 0 0 0 10.6 10.6z"/></svg>';
    b.addEventListener("click", toggle);
    document.body.appendChild(b);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "t" && !e.metaKey && !e.ctrlKey && !e.altKey &&
        !/input|textarea|select/i.test(e.target.tagName)) toggle();
  });
})();
