(function () {
  "use strict";

  var overlay = document.getElementById("menu-root");
  var openBtn = document.getElementById("menu-open");

  function closeDrawer() {
    if (!overlay) return;
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function openDrawer() {
    if (!overlay) return;
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  if (overlay && openBtn) {
    openBtn.addEventListener("click", function () {
      openDrawer();
    });
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) {
        closeDrawer();
      }
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

  var filterChips = document.querySelectorAll("[data-chip]");
  for (var c = 0; c < filterChips.length; c++) {
    filterChips[c].addEventListener("click", function () {
      for (var j = 0; j < filterChips.length; j++) {
        filterChips[j].classList.remove("is-selected");
      }
      this.classList.add("is-selected");
      var f = this.getAttribute("data-filter");
      document.dispatchEvent(
        new CustomEvent("parkquest:amenity-filter", { detail: { filter: f } })
      );
    });
  }
})();
