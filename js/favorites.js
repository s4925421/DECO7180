(function () {
  "use strict";

  var KEY = "parkquest_favorites";

  function getLabels() {
    if (window.PARKQUEST_DATA && typeof window.PARKQUEST_DATA.getLabels === "function") {
      return window.PARKQUEST_DATA.getLabels();
    }
    return {};
  }

  function renderSavedParks() {
    var mount = document.getElementById("saved-parks-mount");
    if (!mount) return;

    var ids;
    try {
      ids = JSON.parse(localStorage.getItem(KEY) || "[]");
    } catch (e) {
      ids = [];
    }

    var LABELS = getLabels();

    mount.innerHTML = "";
    if (!ids.length) {
      var empty = document.createElement("p");
      empty.className = "saved-parks__empty";
      empty.textContent = "Save parks from the map to see them here.";
      mount.appendChild(empty);
      return;
    }

    var ul = document.createElement("ul");
    ul.className = "saved-parks__list";
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      var li = document.createElement("li");
      li.className = "saved-parks__item";
      var a = document.createElement("a");
      a.href = "index.html";
      a.textContent = LABELS[id] || id;
      li.appendChild(a);
      ul.appendChild(li);
    }
    mount.appendChild(ul);
  }

  document.addEventListener("DOMContentLoaded", renderSavedParks);
})();
