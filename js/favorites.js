(function () {
  "use strict";

  var KEY = "parkquest_favorites";
  var LABELS = {
    roma: "Roma Street Parkland",
    southbank: "South Bank Parklands",
    botanic: "City Botanic Gardens",
    newfarm: "New Farm Park",
  };

  function renderSavedParks() {
    var mount = document.getElementById("saved-parks-mount");
    if (!mount) return;

    var ids;
    try {
      ids = JSON.parse(localStorage.getItem(KEY) || "[]");
    } catch (e) {
      ids = [];
    }

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
