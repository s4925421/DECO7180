(function () {
  "use strict";

  var STORAGE_RATINGS = "parkquest_park_ratings";
  var STORAGE_COMMENTS = "parkquest_park_comments";

  var SURVEY_NAMES = [
    "perception_open",
    "hygiene_cleanliness",
    "fitness_suitability",
    "amenity_wayfinding",
    "social_activation",
  ];

  var selectedParkId = null;

  function getPlaces() {
    return (window.PARKQUEST_DATA && window.PARKQUEST_DATA.PLACES) || [];
  }

  function placeById(id) {
    if (window.PARKQUEST_DATA && window.PARKQUEST_DATA.placeById) {
      return window.PARKQUEST_DATA.placeById(id);
    }
    return null;
  }

  function escapeHtml(s) {
    if (s == null) return "";
    var d = document.createElement("div");
    d.textContent = String(s);
    return d.innerHTML;
  }

  function getRatings() {
    try {
      var raw = localStorage.getItem(STORAGE_RATINGS);
      if (!raw) return {};
      var o = JSON.parse(raw);
      return typeof o === "object" && o ? o : {};
    } catch (e) {
      return {};
    }
  }

  function saveRatings(obj) {
    try {
      localStorage.setItem(STORAGE_RATINGS, JSON.stringify(obj));
    } catch (e) {}
  }

  function getCommentsMap() {
    try {
      var raw = localStorage.getItem(STORAGE_COMMENTS);
      if (!raw) return {};
      var o = JSON.parse(raw);
      return typeof o === "object" && o ? o : {};
    } catch (e) {
      return {};
    }
  }

  function saveCommentsMap(obj) {
    try {
      localStorage.setItem(STORAGE_COMMENTS, JSON.stringify(obj));
    } catch (e) {}
  }

  function seedScore(place) {
    var al = typeof place.activationLevel === "number" ? place.activationLevel : 0.65;
    return Math.round((2.7 + al * 2.2) * 10) / 10;
  }

  function displayScoreForPark(parkId, place) {
    var r = getRatings()[parkId];
    if (r && r.count > 0) {
      return Math.round((r.sum / r.count) * 10) / 10;
    }
    return seedScore(place);
  }

  function ratingMeta(parkId) {
    var r = getRatings()[parkId];
    if (r && r.count > 0) {
      return "Survey average · " + r.count + (r.count === 1 ? " rating" : " ratings");
    }
    return "Seed score · be the first to rate";
  }

  function recordRating(parkId, submissionAvg) {
    var all = getRatings();
    if (!all[parkId]) all[parkId] = { sum: 0, count: 0 };
    all[parkId].sum += submissionAvg;
    all[parkId].count += 1;
    saveRatings(all);
  }

  function sortPlacesByScore(places) {
    var copy = places.slice();
    copy.sort(function (a, b) {
      var sa = displayScoreForPark(a.id, a);
      var sb = displayScoreForPark(b.id, b);
      if (sb !== sa) return sb - sa;
      return (a.title || "").localeCompare(b.title || "", "en");
    });
    return copy;
  }

  function matchesQuery(place, q) {
    if (!q) return true;
    var nq = q.toLowerCase().trim();
    var t = (place.title || "").toLowerCase();
    var addr = (place.address || "").toLowerCase();
    return t.indexOf(nq) !== -1 || addr.indexOf(nq) !== -1;
  }

  function showToast(msg) {
    var el = document.getElementById("rewards-toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("is-visible");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () {
      el.classList.remove("is-visible");
    }, 3200);
  }

  function renderLeaderboard() {
    var mount = document.getElementById("leaderboard-mount");
    var emptyEl = document.getElementById("leaderboard-empty");
    if (!mount) return;

    var qEl = document.getElementById("leaderboard-search");
    var q = qEl ? qEl.value : "";
    var places = getPlaces();
    var filtered = [];
    for (var i = 0; i < places.length; i++) {
      if (matchesQuery(places[i], q)) filtered.push(places[i]);
    }
    var sorted = sortPlacesByScore(filtered);

    mount.innerHTML = "";
    if (!sorted.length) {
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;

    var ol = document.createElement("ol");
    ol.className = "leaderboard-list";
    for (var r = 0; r < sorted.length; r++) {
      var place = sorted[r];
      var rank = r + 1;
      var li = document.createElement("li");
      li.className = "leaderboard-list__row";

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "leaderboard-list__item" + (selectedParkId === place.id ? " is-selected" : "");
      btn.setAttribute("data-park-id", place.id);
      var name = place.title || place.id;
      var score = displayScoreForPark(place.id, place);
      btn.innerHTML =
        '<span class="leaderboard-list__rank" aria-hidden="true">' +
        rank +
        "</span>" +
        '<div class="leaderboard-list__body">' +
        '<p class="leaderboard-list__name">' +
        escapeHtml(name) +
        "</p>" +
        '<p class="leaderboard-list__meta">' +
        escapeHtml(ratingMeta(place.id)) +
        "</p></div>" +
        '<span class="leaderboard-list__score" aria-label="Score ' +
        score +
        '">' +
        score +
        "</span>";

      (function (pid) {
        btn.addEventListener("click", function () {
          selectPark(pid);
        });
      })(place.id);

      li.appendChild(btn);
      ol.appendChild(li);
    }
    mount.appendChild(ol);
  }

  function selectPark(parkId) {
    selectedParkId = parkId;
    var place = placeById(parkId);
    var wrap = document.getElementById("survey-comments-wrap");
    var form = document.getElementById("rewards-survey-form");
    var hidden = document.getElementById("survey-park-id");
    var titleEl = document.getElementById("survey-selected-title");
    var subEl = document.getElementById("survey-selected-sub");

    if (!place || !wrap || !form) return;

    form.reset();
    if (hidden) hidden.value = parkId;

    if (titleEl) titleEl.textContent = place.title || "";
    if (subEl) subEl.textContent = place.address || "";

    wrap.hidden = false;

    renderLeaderboard();
    renderComments(parkId);
  }

  function getSurveyAverage(form) {
    var sum = 0;
    for (var i = 0; i < SURVEY_NAMES.length; i++) {
      var checked = form.querySelector('input[name="' + SURVEY_NAMES[i] + '"]:checked');
      if (!checked) return null;
      sum += parseInt(checked.value, 10);
    }
    return sum / SURVEY_NAMES.length;
  }

  function resetSurveyRadios(form) {
    for (var i = 0; i < SURVEY_NAMES.length; i++) {
      var radios = form.querySelectorAll('input[name="' + SURVEY_NAMES[i] + '"]');
      for (var j = 0; j < radios.length; j++) radios[j].checked = false;
    }
  }

  function onSurveySubmit(e) {
    e.preventDefault();
    var form = e.target;
    var hidden = document.getElementById("survey-park-id");
    var parkId = hidden ? hidden.value : "";
    if (!parkId || !placeById(parkId)) {
      showToast("Choose a park from the list first");
      return;
    }
    var avg = getSurveyAverage(form);
    if (avg == null) {
      showToast("Please answer all 5 questions");
      return;
    }
    recordRating(parkId, avg);
    showToast("Thanks — scores updated the leaderboard");
    resetSurveyRadios(form);
    if (hidden) hidden.value = parkId;
    renderLeaderboard();
  }

  function renderComments(parkId) {
    var list = document.getElementById("park-comments-list");
    if (!list) return;
    var map = getCommentsMap();
    var arr = (map[parkId] || []).slice();
    arr.sort(function (a, b) {
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    if (!arr.length) {
      list.innerHTML =
        '<p class="park-comments__empty">No comments yet — add one below. (Visible to everyone using this browser; prototype demo.)</p>';
      return;
    }

    var html = "";
    for (var i = 0; i < arr.length; i++) {
      var c = arr[i];
      var d = c.createdAt ? new Date(c.createdAt) : new Date();
      var timeStr = d.toLocaleString("en-AU", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      html +=
        '<article class="park-comment-card">' +
        '<p class="park-comment-card__meta">Visitor · ' +
        escapeHtml(timeStr) +
        "</p>" +
        '<p class="park-comment-card__body">' +
        escapeHtml(c.body || "") +
        "</p></article>";
    }
    list.innerHTML = html;
  }

  function onCommentSubmit(e) {
    e.preventDefault();
    if (!selectedParkId) {
      showToast("Select a park first");
      return;
    }
    var ta = document.getElementById("park-comment-input");
    if (!ta) return;
    var text = (ta.value || "").trim();
    if (!text) {
      showToast("Please enter a comment");
      return;
    }
    if (text.length > 800) {
      showToast("Comments are limited to 800 characters");
      return;
    }
    var map = getCommentsMap();
    if (!map[selectedParkId]) map[selectedParkId] = [];
    map[selectedParkId].push({
      id: "c_" + Date.now(),
      body: text,
      createdAt: Date.now(),
    });
    saveCommentsMap(map);
    ta.value = "";
    showToast("Comment posted");
    renderComments(selectedParkId);
  }

  function init() {
    var search = document.getElementById("leaderboard-search");
    if (search) {
      search.addEventListener("input", function () {
        renderLeaderboard();
      });
    }

    var form = document.getElementById("rewards-survey-form");
    if (form) form.addEventListener("submit", onSurveySubmit);

    var cform = document.getElementById("park-comment-form");
    if (cform) cform.addEventListener("submit", onCommentSubmit);

    renderLeaderboard();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
