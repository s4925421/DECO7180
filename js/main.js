(function () {
  "use strict";

  function closeDrawer() {
    var overlay = document.getElementById("menu-root");
    if (!overlay) return;
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function openDrawer() {
    var overlay = document.getElementById("menu-root");
    if (!overlay) return;
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function setupDrawer() {
    var overlay = document.getElementById("menu-root");
    var openBtn = document.getElementById("menu-open");
    if (overlay && openBtn) {
      openBtn.addEventListener("click", openDrawer);
      overlay.addEventListener("click", function (e) {
        if (e.target === overlay) closeDrawer();
      });
      var drawerLinks = overlay.querySelectorAll("a");
      for (var i = 0; i < drawerLinks.length; i++) {
        drawerLinks[i].addEventListener("click", closeDrawer);
      }
    }

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && overlay && overlay.classList.contains("is-open")) {
        closeDrawer();
      }
    });
  }

  function setupFilterChips() {
    var filterChips = document.querySelectorAll("[data-chip]");
    var allChip = document.querySelector('[data-chip][data-filter="all"]');

    function setChipPressed(el, on) {
      el.classList.toggle("is-selected", on);
      el.setAttribute("aria-pressed", on ? "true" : "false");
    }

    function anyAmenityChipSelected() {
      for (var k = 0; k < filterChips.length; k++) {
        var el = filterChips[k];
        if (el.getAttribute("data-filter") === "all") continue;
        if (el.classList.contains("is-selected")) return true;
      }
      return false;
    }

    function syncAllParksChip() {
      if (!allChip) return;
      var show = !anyAmenityChipSelected();
      setChipPressed(allChip, show);
    }

    for (var c = 0; c < filterChips.length; c++) {
      filterChips[c].addEventListener("click", function () {
        var f = this.getAttribute("data-filter");
        if (f === "all") {
          for (var j = 0; j < filterChips.length; j++) {
            var el = filterChips[j];
            if (el.getAttribute("data-filter") === "all") {
              setChipPressed(el, true);
            } else {
              setChipPressed(el, false);
            }
          }
        } else {
          var nowOn = !this.classList.contains("is-selected");
          setChipPressed(this, nowOn);
          syncAllParksChip();
        }
        document.dispatchEvent(new CustomEvent("parkquest:amenity-filter", { detail: { filter: f } }));
      });
    }
  }

  function renderActivityStream() {
    var root = document.getElementById("activity-stream-mount");
    if (!root || !window.PARKQUEST_DATA) return;

    var active = window.PARKQUEST_DATA.getAllActiveEvents();
    root.innerHTML = "";

    var head = document.createElement("div");
    head.className = "activity-stream__header";
    head.innerHTML =
      "<h3 class=\"activity-stream__title\">Happening today</h3>" +
      "<p class=\"activity-stream__sub\">Community activities — Brisbane parks</p>";
    root.appendChild(head);

    if (!active.length) {
      var empty = document.createElement("p");
      empty.className = "activity-stream__empty";
      empty.textContent = "No live windows right now — check back on weekends or early mornings.";
      root.appendChild(empty);
      return;
    }

    var sc = document.createElement("div");
    sc.className = "activity-stream__scroll no-scrollbar";
    sc.setAttribute("role", "list");

    for (var i = 0; i < active.length; i++) {
      (function (ev) {
        var place = window.PARKQUEST_DATA.placeById(ev.parkId);
        var name = place ? place.title : ev.parkId;
        var card = document.createElement("article");
        card.className = "activity-stream__card";
        card.setAttribute("role", "listitem");
        card.innerHTML =
          "<p class=\"activity-stream__card-park\">" +
          name +
          "</p>" +
          "<p class=\"activity-stream__card-title\">" +
          ev.title +
          "</p>" +
          "<span class=\"activity-stream__live\">Active now</span>";
        sc.appendChild(card);
      })(active[i]);
    }
    root.appendChild(sc);
  }

  function renderAmenitiesActiveNow() {
    var root = document.getElementById("amenities-active-now");
    if (!root || !window.PARKQUEST_DATA) return;

    var groups = window.PARKQUEST_DATA.countActiveGroupsTotal();
    var parks = window.PARKQUEST_DATA.countParksWithActiveEvents();

    root.className = "active-now-banner";
    root.setAttribute("role", "status");
    root.setAttribute("aria-live", "polite");

    if (groups === 0) {
      root.innerHTML =
        "<span class=\"material-symbols-outlined active-now-banner__icon\" aria-hidden=\"true\">event_busy</span>" +
        "<div><strong class=\"active-now-banner__title\">Active now</strong>" +
        "<p class=\"active-now-banner__text\">No scheduled groups in this time window. Facilities remain open.</p></div>";
      return;
    }

    root.innerHTML =
      "<span class=\"material-symbols-outlined active-now-banner__icon active-now-banner__icon--on\" aria-hidden=\"true\">groups</span>" +
      "<div><strong class=\"active-now-banner__title\">Active now</strong>" +
      "<p class=\"active-now-banner__text\">" +
      groups +
      " group" +
      (groups === 1 ? "" : "s") +
      " running across " +
      parks +
      " park" +
      (parks === 1 ? "" : "s") +
      " — the park feels lively and organised.</p></div>";
  }

  function setupFeaturedActiveTag() {
    var mount = document.getElementById("featured-active-tag");
    if (!mount || !window.PARKQUEST_DATA) return;

    var list = window.PARKQUEST_DATA.getActiveEventsForPark("botanic");
    if (!list.length) {
      mount.innerHTML =
        "<span class=\"featured-active-tag featured-active-tag--quiet\">No live event at the Gardens this hour</span>";
      return;
    }

    mount.innerHTML =
      "<span class=\"featured-active-tag featured-active-tag--live\" aria-label=\"Active now at this park\">" +
      list.length +
      " group" +
      (list.length === 1 ? "" : "s") +
      " active — " +
      list
        .map(function (e) {
          return e.title;
        })
        .join(" · ") +
      "</span>";
  }

  document.addEventListener("DOMContentLoaded", function () {
    setupDrawer();
    setupFilterChips();
    renderActivityStream();
    renderAmenitiesActiveNow();
    setupFeaturedActiveTag();
  });
})();
