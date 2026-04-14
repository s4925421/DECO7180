(function () {
  "use strict";

  var API_URL =
    "https://data.brisbane.qld.gov.au/api/explore/v2.1/catalog/datasets/brisbane-parks-events/records?limit=50";
  var REFRESH_MS = 60000;
  var MAX_EVENTS_VISIBLE = 10;

  var liveCardsEl = null;
  var listEl = null;
  var updatedEl = null;
  var toastEl = null;
  var modalEl = null;
  var modalTitleEl = null;
  var modalBodyEl = null;

  var miniMap = null;
  var miniMapMarker = null;
  var refreshTimer = null;
  var isLoading = false;

  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("is-visible");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () {
      toastEl.classList.remove("is-visible");
    }, 3200);
  }

  function toDate(value) {
    if (!value) return null;
    var d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  function escapeHtml(v) {
    var d = document.createElement("div");
    d.textContent = v == null ? "" : String(v);
    return d.innerHTML;
  }

  function pick(rec, keys) {
    for (var i = 0; i < keys.length; i++) {
      var v = rec[keys[i]];
      if (v != null && String(v).trim() !== "") return v;
    }
    return "";
  }

  function parseLatLng(rec) {
    if (rec.geo_point_2d && typeof rec.geo_point_2d.lat === "number") {
      var g = rec.geo_point_2d;
      var lon = typeof g.lon === "number" ? g.lon : typeof g.lng === "number" ? g.lng : null;
      if (lon != null) return [g.lat, lon];
    }
    if (rec.geopoint && typeof rec.geopoint.lat === "number") {
      return [rec.geopoint.lat, rec.geopoint.lon];
    }
    if (typeof rec.latitude === "number" && typeof rec.longitude === "number") {
      return [rec.latitude, rec.longitude];
    }
    return null;
  }

  function classifyStatus(startDate, endDate, now) {
    if (startDate && endDate && now >= startDate && now <= endDate) {
      return {
        code: "live",
        label: "🟢 Live",
        className: "activity-status activity-status--live",
      };
    }
    if (startDate && now < startDate) {
      return {
        code: "upcoming",
        label: "🕒 Starting soon",
        className: "activity-status activity-status--soon",
      };
    }
    return {
      code: "other",
      label: "Completed",
      className: "activity-status activity-status--dim",
    };
  }

  function eventType(rec) {
    return (
      pick(rec, ["event_nature", "event_type", "category", "activity_type", "event_category"]) ||
      "Community"
    );
  }

  function expectedParticipants(rec) {
    return pick(rec, [
      "expected_participants",
      "expected_attendance",
      "participants",
      "attendance_estimate",
      "estimated_attendance",
    ]);
  }

  function locationHint(rec) {
    return (
      pick(rec, [
        "location_description",
        "location_details",
        "event_location",
        "venue_description",
        "site_notes",
      ]) || "Near the main entrance in a well-lit zone with clear sightlines."
    );
  }

  function normalizeEvent(rec, now) {
    var start = toDate(pick(rec, ["event_start_datetime", "start_datetime", "start_time"]));
    var end = toDate(pick(rec, ["event_end_datetime", "end_datetime", "end_time"]));
    var park = pick(rec, ["park_name", "item_name", "venue_name", "park"]);
    var title = pick(rec, ["event_name", "title", "name"]) || "Park activity";
    var status = classifyStatus(start, end, now);
    return {
      id: pick(rec, ["recordid", "id"]) || title + "-" + (start ? start.getTime() : Math.random()),
      title: title,
      park: park || "Brisbane Park",
      start: start,
      end: end,
      status: status,
      type: eventType(rec),
      expected: expectedParticipants(rec),
      locationHint: locationHint(rec),
      latLng: parseLatLng(rec),
    };
  }

  function cmpByStart(a, b) {
    var ta = a.start ? a.start.getTime() : Number.MAX_SAFE_INTEGER;
    var tb = b.start ? b.start.getTime() : Number.MAX_SAFE_INTEGER;
    return ta - tb;
  }

  function cmpByNearestNow(now) {
    return function (a, b) {
      var ta = a.start ? Math.abs(a.start.getTime() - now.getTime()) : Number.MAX_SAFE_INTEGER;
      var tb = b.start ? Math.abs(b.start.getTime() - now.getTime()) : Number.MAX_SAFE_INTEGER;
      if (ta !== tb) return ta - tb;
      return cmpByStart(a, b);
    };
  }

  function timeLabel(ev) {
    if (!ev.start) return "Time not listed";
    var opts = { weekday: "short", hour: "2-digit", minute: "2-digit" };
    return ev.start.toLocaleString("en-AU", opts);
  }

  function durationLabel(ev) {
    if (!ev.start || !ev.end) return "Duration not listed";
    var mins = Math.round((ev.end.getTime() - ev.start.getTime()) / 60000);
    if (mins <= 0) return "Duration not listed";
    if (mins < 60) return mins + " min";
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    return h + "h" + (m ? " " + m + "m" : "");
  }

  function openLocationModal(ev) {
    if (!modalEl || !modalTitleEl || !modalBodyEl) return;
    modalTitleEl.textContent = ev.park + " - location detail";
    modalBodyEl.textContent = ev.locationHint;
    if (typeof modalEl.showModal === "function") {
      modalEl.showModal();
    }
  }

  function ensureMiniMap() {
    var mapEl = document.getElementById("activity-mini-map");
    if (!mapEl || typeof L === "undefined") return null;
    if (miniMap) return miniMap;

    miniMap = L.map(mapEl, {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: false,
      dragging: true,
      tap: true,
    }).setView([-27.47, 153.025], 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(miniMap);

    return miniMap;
  }

  function focusMiniMap(ev) {
    var m = ensureMiniMap();
    if (!m || !ev.latLng) return;
    if (miniMapMarker) m.removeLayer(miniMapMarker);
    miniMapMarker = L.marker(ev.latLng, { title: ev.park + " - " + ev.title }).addTo(m);
    m.setView(ev.latLng, 15, { animate: true });
  }

  function renderLiveCards(events) {
    if (!liveCardsEl) return;
    var live = [];
    for (var i = 0; i < events.length; i++) {
      if (events[i].status.code === "live") live.push(events[i]);
    }
    if (!live.length) {
      liveCardsEl.innerHTML =
        '<p class="activity-empty">No events currently live. Upcoming sessions are shown below.</p>';
      return;
    }

    var html = "";
    for (var j = 0; j < live.length; j++) {
      var ev = live[j];
      var social = ev.expected
        ? "Expected participants: " + escapeHtml(ev.expected)
        : "Activity type: " + escapeHtml(ev.type);
      html +=
        '<article class="activity-live-card">' +
        '<p class="activity-live-card__park">' +
        escapeHtml(ev.park) +
        "</p>" +
        '<h3 class="activity-live-card__title">' +
        escapeHtml(ev.title) +
        "</h3>" +
        '<p class="activity-live-card__meta">' +
        social +
        "</p>" +
        '<span class="' +
        ev.status.className +
        '">' +
        ev.status.label +
        "</span>" +
        "</article>";
    }
    liveCardsEl.innerHTML = html;
  }

  function renderList(events) {
    if (!listEl) return;
    if (!events.length) {
      listEl.innerHTML = '<p class="activity-empty">No activity records available from BCC right now.</p>';
      return;
    }

    var html = "";
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      html +=
        '<button class="activity-item" type="button" data-event-id="' +
        escapeHtml(ev.id) +
        '">' +
        '<strong class="activity-item__title">' +
        escapeHtml(ev.title) +
        "</strong>" +
        '<p class="activity-item__park">' +
        escapeHtml(ev.park) +
        "</p>" +
        '<p class="activity-item__meta">' +
        escapeHtml(timeLabel(ev)) +
        " · " +
        escapeHtml(durationLabel(ev)) +
        "</p>" +
        '<p class="activity-item__social">' +
        "Activity type: " +
        escapeHtml(ev.type) +
        "</p>" +
        '<div class="activity-item__status-wrap"><span class="' +
        ev.status.className +
        '">' +
        ev.status.label +
        "</span></div>" +
        "</button>";
    }
    listEl.innerHTML = html;

    var items = listEl.querySelectorAll(".activity-item[data-event-id]");
    for (var j = 0; j < items.length; j++) {
      (function (btn) {
        btn.addEventListener("click", function () {
          var id = btn.getAttribute("data-event-id");
          for (var k = 0; k < events.length; k++) {
            if (String(events[k].id) === String(id)) {
              openLocationModal(events[k]);
              focusMiniMap(events[k]);
              break;
            }
          }
        });
      })(items[j]);
    }
  }

  function loadEvents() {
    if (isLoading) return;
    isLoading = true;
    fetch(API_URL)
      .then(function (r) {
        if (!r.ok) throw new Error("API status " + r.status);
        return r.json();
      })
      .then(function (json) {
        var now = new Date();
        var raw = (json && json.results) || [];
        var events = [];
        for (var i = 0; i < raw.length; i++) {
          events.push(normalizeEvent(raw[i], now));
        }
        events.sort(cmpByNearestNow(now));
        events = events.slice(0, MAX_EVENTS_VISIBLE);
        renderLiveCards(events);
        renderList(events);
        if (events.length && events[0].latLng) focusMiniMap(events[0]);
        if (updatedEl) {
          updatedEl.textContent = "Updated " + now.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
        }
      })
      .catch(function () {
        renderLiveCards([]);
        renderList([]);
        showToast("Could not load Brisbane parks events right now.");
      })
      .finally(function () {
        isLoading = false;
      });
  }

  function startAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(function () {
      loadEvents();
    }, REFRESH_MS);
  }

  document.addEventListener("DOMContentLoaded", function () {
    liveCardsEl = document.getElementById("activity-live-cards");
    listEl = document.getElementById("activity-event-list");
    updatedEl = document.getElementById("activity-last-updated");
    toastEl = document.getElementById("activity-toast");
    modalEl = document.getElementById("activity-location-modal");
    modalTitleEl = document.getElementById("activity-modal-title");
    modalBodyEl = document.getElementById("activity-modal-body");
    loadEvents();
    startAutoRefresh();

    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) loadEvents();
    });
  });
})();
