(function () {
  "use strict";

  var chips = document.querySelectorAll("[data-trail-filter]");
  var cards = document.querySelectorAll(".trail-card[data-category]");
  if (!chips.length || !cards.length) {
    return;
  }

  function applyFilter(key) {
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var cat = card.getAttribute("data-category") || "";
      var show = cat.indexOf(key) !== -1;
      card.hidden = !show;
      card.style.display = show ? "" : "none";
    }
  }

  for (var c = 0; c < chips.length; c++) {
    chips[c].addEventListener("click", function () {
      var key = this.getAttribute("data-trail-filter");
      for (var j = 0; j < chips.length; j++) {
        chips[j].classList.remove("is-selected");
      }
      this.classList.add("is-selected");
      if (key) {
        applyFilter(key);
      }
    });
  }
})();
