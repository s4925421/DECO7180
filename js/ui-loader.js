/**
 * Injects shared drawer (map page only) and bottom navigation without a build step.
 * Set on <body>: data-parkquest-nav="map|activity|progress|settings"
 * Optional: data-parkquest-drawer="true" for hamburger menu markup.
 */
(function () {
  "use strict";

  var DRAWER_HTML =
    '<div id="menu-root" class="drawer-overlay" aria-hidden="true">' +
    '<nav class="drawer" aria-label="Main menu">' +
    '<p class="drawer__title">Explore</p>' +
    '<ul class="drawer__list">' +
    '<li><a class="drawer__link" href="amenities.html"><span class="material-symbols-outlined" aria-hidden="true">wc</span>Amenities near you</a></li>' +
    '<li><a class="drawer__link" href="activity.html"><span class="material-symbols-outlined" aria-hidden="true">local_activity</span>Live activity</a></li>' +
    '<li><a class="drawer__link" href="progress.html"><span class="material-symbols-outlined" aria-hidden="true">military_tech</span>Rewards &amp; progress</a></li>' +
    '<li><a class="drawer__link" href="settings.html"><span class="material-symbols-outlined" aria-hidden="true">settings</span>Settings</a></li>' +
    "</ul></nav></div>";

  function navLink(href, icon, label, active, iconFill) {
    var cls = "bottom-nav__link" + (active ? " is-active" : "");
    var fill = iconFill ? ' fill' : "";
    return (
      '<a class="' +
      cls +
      '" href="' +
      href +
      '">' +
      '<span class="material-symbols-outlined' +
      fill +
      '" aria-hidden="true">' +
      icon +
      "</span>" +
      label +
      "</a>"
    );
  }

  function buildBottomNav(active) {
    return (
      '<nav class="bottom-nav" aria-label="Primary navigation">' +
      navLink("index.html", "map", "Map", active === "map", active === "map") +
      navLink(
        "activity.html",
        "local_activity",
        "Activity",
        active === "activity",
        active === "activity"
      ) +
      navLink("progress.html", "military_tech", "Rewards", active === "progress", active === "progress") +
      navLink("settings.html", "settings", "Settings", active === "settings", active === "settings") +
      "</nav>"
    );
  }

  document.addEventListener("DOMContentLoaded", function () {
    var active = document.body.getAttribute("data-parkquest-nav") || "map";
    var drawerMount = document.getElementById("parkquest-drawer-root");
    var navMount = document.getElementById("parkquest-bottom-nav-root");

    if (drawerMount && document.body.getAttribute("data-parkquest-drawer") === "true") {
      drawerMount.innerHTML = DRAWER_HTML;
    }

    if (navMount) {
      navMount.innerHTML = buildBottomNav(active);
    }
  });
})();
