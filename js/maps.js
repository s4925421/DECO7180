(function () {
  "use strict";

  var STORAGE_FAV = "parkquest_favorites";
  var STORAGE_LAST = "parkquest_map_last_view";
  var STORAGE_OFFLINE = "parkquest_offline";

  var BRISBANE = [-27.47, 153.025];
  var DEFAULT_ZOOM = 13;

  var map = null;
  var markersById = {};
  var searchMarker = null;
  var safetyLayerGroup = null;
  var safetyLayerVisible = false;

  function getPLACES() {
    return (window.PARKQUEST_DATA && window.PARKQUEST_DATA.PLACES) || [];
  }

  function placeById(id) {
    if (window.PARKQUEST_DATA && window.PARKQUEST_DATA.placeById) {
      return window.PARKQUEST_DATA.placeById(id);
    }
    var PL = getPLACES();
    for (var i = 0; i < PL.length; i++) {
      if (PL[i].id === id) return PL[i];
    }
    return null;
  }

  function getFavorites() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_FAV) || "[]");
    } catch (e) {
      return [];
    }
  }

  function setFavorites(ids) {
    localStorage.setItem(STORAGE_FAV, JSON.stringify(ids));
  }

  function isFavorite(id) {
    return getFavorites().indexOf(id) !== -1;
  }

  function toggleFavoriteId(id) {
    var list = getFavorites();
    var i = list.indexOf(id);
    if (i === -1) {
      list.push(id);
    } else {
      list.splice(i, 1);
    }
    setFavorites(list);
    return i === -1;
  }

  function setOffline(flag) {
    try {
      if (flag) {
        localStorage.setItem(STORAGE_OFFLINE, "1");
      } else {
        localStorage.removeItem(STORAGE_OFFLINE);
      }
    } catch (e) {}
    updateOfflineBanner();
  }

  function isOffline() {
    return localStorage.getItem(STORAGE_OFFLINE) === "1";
  }

  function updateOfflineBanner() {
    var el = document.getElementById("offline-banner");
    if (!el) return;
    if (isOffline()) {
      el.removeAttribute("hidden");
      el.setAttribute("aria-live", "polite");
    } else {
      el.setAttribute("hidden", "");
    }
  }

  function saveMapView() {
    if (!map) return;
    var c = map.getCenter();
    try {
      localStorage.setItem(
        STORAGE_LAST,
        JSON.stringify({ lat: c.lat, lng: c.lng, z: map.getZoom() })
      );
    } catch (e) {}
  }

  function loadMapView() {
    try {
      var raw = localStorage.getItem(STORAGE_LAST);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function showToast(message) {
    var el = document.getElementById("map-toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("is-visible");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () {
      el.classList.remove("is-visible");
    }, 3200);
  }

  function getExpectedActivityText(place) {
    var h = new Date().getHours();
    var al = typeof place.activationLevel === "number" ? place.activationLevel : 0.5;
    var peak = (h >= 7 && h <= 9) || (h >= 11 && h <= 14) || (h >= 17 && h <= 19);
    if (peak && al >= 0.75) {
      return "Expected activity now: High — busy with walkers and families.";
    }
    if (peak && al >= 0.5) {
      return "Expected activity now: Moderate — steady foot traffic.";
    }
    if (!peak && al >= 0.6) {
      return "Expected activity now: Calmer — quieter window.";
    }
    return "Expected activity now: Light — peaceful time to explore.";
  }

  function markerIcon(place) {
    var pulse =
      typeof place.activationLevel === "number" && place.activationLevel >= 0.65
        ? " leaflet-marker-pq__dot--pulse"
        : "";
    var feat = place.featured ? " leaflet-marker-pq__dot--featured" : "";
    return L.divIcon({
      className: "leaflet-marker-pq",
      html: '<div class="leaflet-marker-pq__dot' + feat + pulse + '"></div>',
      iconSize: place.featured ? [22, 22] : [18, 18],
      iconAnchor: place.featured ? [11, 11] : [9, 9],
      popupAnchor: [0, -10],
    });
  }

  function buildPopupHtml(place) {
    var fav = isFavorite(place.id);
    var maint = place.maintenance && place.maintenance.label ? place.maintenance.label : "Status: Routine checks 🟢";
    var activityLine = getExpectedActivityText(place);
    var osmView =
      "https://www.openstreetmap.org/?mlat=" +
      place.lat +
      "&mlon=" +
      place.lng +
      "#map=17/" +
      place.lat +
      "/" +
      place.lng;
    var osmDir =
      "https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=%3B" +
      place.lat +
      "%2C" +
      place.lng;
    var pathHint = place.pathComfortNote
      ? '<p class="gm-iw-parkquest__path-hint" role="note"><span class="gm-iw-parkquest__path-hint-icon" aria-hidden="true">✓</span> ' +
        place.pathComfortNote +
        "</p>"
      : "";

    return (
      '<div class="gm-iw-parkquest gm-iw-parkquest--glass">' +
      '<strong class="gm-iw-parkquest__title">' +
      place.title +
      "</strong>" +
      '<p class="gm-iw-parkquest__addr">' +
      place.address +
      "</p>" +
      '<div class="gm-iw-parkquest__status-block">' +
      '<p class="gm-iw-parkquest__maintenance"><span class="gm-iw-parkquest__badge">Maintenance</span> ' +
      maint +
      "</p>" +
      '<p class="gm-iw-parkquest__activity">' +
      activityLine +
      "</p>" +
      "</div>" +
      '<p class="gm-iw-parkquest__amenities">Amenities: ' +
      place.amenities.join(", ") +
      "</p>" +
      '<div class="gm-iw-parkquest__actions">' +
      '<a class="gm-iw-parkquest__link" href="' +
      osmView +
      '" target="_blank" rel="noopener">OpenStreetMap</a>' +
      '<a class="gm-iw-parkquest__link" href="' +
      osmDir +
      '" target="_blank" rel="noopener">Directions (OSRM)</a>' +
      "</div>" +
      pathHint +
      '<button type="button" class="gm-iw-parkquest__fav" data-fav-place="' +
      place.id +
      '">' +
      (fav ? "★ Saved" : "☆ Save park") +
      "</button>" +
      "</div>"
    );
  }

  function bindPopupFavoriteHandlers() {
    if (!map || bindPopupFavoriteHandlers._done) return;
    bindPopupFavoriteHandlers._done = true;
    map.on("popupopen", onPopupOpen);
  }

  function onPopupOpen(e) {
    setTimeout(function () {
      var container = e.popup.getElement();
      if (!container) return;
      var btn = container.querySelector(".gm-iw-parkquest__fav[data-fav-place]");
      if (!btn) return;
      var id = btn.getAttribute("data-fav-place");
      btn.addEventListener(
        "click",
        function () {
          var now = toggleFavoriteId(id);
          btn.textContent = now ? "★ Saved" : "☆ Save park";
          syncFeaturedFavoriteButton();
          showToast(now ? "Saved to your parks" : "Removed from saved");
          var p = placeById(id);
          if (p && markersById[id] && typeof markersById[id].setPopupContent === "function") {
            markersById[id].setPopupContent(buildPopupHtml(p));
          }
        },
        { once: true }
      );
    }, 0);
  }

  function openPopupForPlace(place) {
    var m = markersById[place.id];
    if (!m) return;
    m.setPopupContent(buildPopupHtml(place));
    m.openPopup();
  }

  function applyAmenityFilter(filterKey) {
    var PL = getPLACES();
    for (var i = 0; i < PL.length; i++) {
      var p = PL[i];
      var m = markersById[p.id];
      if (!m || !map) continue;
      var show;
      if (filterKey === "all") {
        show = true;
      } else if (filterKey === "accessible") {
        show = p.amenities && p.amenities.indexOf("accessible") !== -1;
      } else {
        show = p.amenities && p.amenities.indexOf(filterKey) !== -1;
      }
      if (show) {
        if (!map.hasLayer(m)) m.addTo(map);
      } else {
        if (map.hasLayer(m)) m.remove();
      }
    }
  }

  function getSelectedFilter() {
    var sel = document.querySelector("[data-chip].is-selected");
    return sel ? sel.getAttribute("data-filter") : "toilets";
  }

  function buildSafetyLayer() {
    safetyLayerGroup = L.layerGroup();
    var PL = getPLACES();
    for (var i = 0; i < PL.length; i++) {
      var p = PL[i];
      if (!p.highVisibility) continue;
      var r = p.visibilityRadiusM || 200;
      L.circle([p.lat, p.lng], {
        radius: r,
        color: "#2d6a4f",
        fillColor: "#95d4b3",
        fillOpacity: 0.18,
        weight: 1,
        opacity: 0.55,
        className: "pq-safety-circle",
      }).addTo(safetyLayerGroup);
    }
  }

  function setSafetyLayerVisible(on) {
    safetyLayerVisible = on;
    if (!map || !safetyLayerGroup) return;
    if (on) {
      map.addLayer(safetyLayerGroup);
    } else {
      map.removeLayer(safetyLayerGroup);
    }
    var chip = document.getElementById("chip-cpted-visibility");
    if (chip) {
      chip.classList.toggle("is-selected", on);
      chip.setAttribute("aria-pressed", on ? "true" : "false");
    }
  }

  function setupCptedChip() {
    var chip = document.getElementById("chip-cpted-visibility");
    if (!chip) return;
    chip.addEventListener("click", function () {
      setSafetyLayerVisible(!safetyLayerVisible);
      showToast(
        safetyLayerVisible ? "Showing high-visibility zones (CPTED)" : "High-visibility overlay off"
      );
    });
  }

  function syncFeaturedFavoriteButton() {
    var btn = document.getElementById("featured-fav");
    if (!btn) return;
    var on = isFavorite("botanic");
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.classList.toggle("is-saved", on);
    var icon = btn.querySelector(".material-symbols-outlined");
    if (icon) {
      icon.textContent = on ? "favorite" : "favorite_border";
      icon.classList.toggle("fill", on);
    }
  }

  var featuredCardSetup = false;

  function setupFeaturedCard() {
    if (featuredCardSetup) return;
    featuredCardSetup = true;
    var btn = document.getElementById("featured-fav");
    if (btn) {
      syncFeaturedFavoriteButton();
      btn.addEventListener("click", function () {
        var now = toggleFavoriteId("botanic");
        syncFeaturedFavoriteButton();
        showToast(now ? "City Botanic Gardens saved" : "Removed from saved");
        var botanic = placeById("botanic");
        if (botanic && markersById.botanic && map) {
          var pu = markersById.botanic.getPopup();
          if (pu && typeof pu.isOpen === "function" && pu.isOpen()) {
            markersById.botanic.setPopupContent(buildPopupHtml(botanic));
          }
        }
      });
    }

    var card = document.querySelector(".featured-card");
    if (card) {
      card.addEventListener("click", function (e) {
        var t = e.target;
        if (t.closest("a") || t.closest("button")) return;
        if (map && markersById.botanic) {
          var botanic = placeById("botanic");
          map.setView([botanic.lat, botanic.lng], Math.max(map.getZoom(), 15), { animate: true });
          openPopupForPlace(botanic);
        }
      });
    }
  }

  function setupSearch() {
    var input = document.querySelector('.map-ui input[type="search"], .map-ui input[name="q"]');
    if (!input || !map) return;

    input.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (isOffline()) {
        showToast("Offline — search unavailable. Browse saved parks from Rewards.");
        return;
      }
      var q = (input.value || "").trim();
      if (!q) return;

      var url =
        "https://photon.komoot.io/api/?q=" +
        encodeURIComponent(q + " Brisbane Australia") +
        "&limit=1&lat=-27.47&lon=153.02&lang=en";

      fetch(url)
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          setOffline(false);
          if (!data.features || !data.features.length) {
            showToast("No results — try another search");
            return;
          }
          var coords = data.features[0].geometry.coordinates;
          var lon = coords[0];
          var lat = coords[1];
          if (searchMarker) {
            map.removeLayer(searchMarker);
            searchMarker = null;
          }
          searchMarker = L.marker([lat, lon], {
            icon: L.divIcon({
              className: "leaflet-marker-pq leaflet-marker-pq--search",
              html: '<div class="leaflet-marker-pq__dot leaflet-marker-pq__dot--search"></div>',
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            }),
            title: "Search result",
          }).addTo(map);
          map.setView([lat, lon], 15, { animate: true });
          showToast("Showing search result");
        })
        .catch(function () {
          setOffline(true);
          showToast("You appear offline — showing saved parks only from Rewards");
        });
    });
  }

  function setupGeolocationFab() {
    var fab = document.getElementById("fab-my-location");
    if (!fab || !map) return;
    fab.addEventListener("click", function () {
      if (!navigator.geolocation) {
        showToast("Location not supported on this device");
        return;
      }
      fab.disabled = true;
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          fab.disabled = false;
          var lat = pos.coords.latitude;
          var lng = pos.coords.longitude;
          if (searchMarker) {
            map.removeLayer(searchMarker);
            searchMarker = null;
          }
          searchMarker = L.marker([lat, lng], {
            icon: L.divIcon({
              className: "leaflet-marker-pq leaflet-marker-pq--search",
              html: '<div class="leaflet-marker-pq__dot leaflet-marker-pq__dot--search"></div>',
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            }),
            title: "You are here",
          }).addTo(map);
          map.setView([lat, lng], 15, { animate: true });
          showToast("Centered on your location");
        },
        function () {
          fab.disabled = false;
          showToast("Could not get location — check permissions");
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
      );
    });
  }

  function setupFilterListener() {
    document.addEventListener("parkquest:amenity-filter", function (e) {
      var f = e.detail && e.detail.filter;
      if (f && map) {
        applyAmenityFilter(f);
      }
    });
  }

  function setMarkerA11y(marker, place) {
    marker.on("add", function () {
      var el = marker.getElement();
      if (!el) return;
      el.setAttribute("role", "button");
      var label =
        place.title +
        ". " +
        (place.cptedNote || "Park location.") +
        " Activation level " +
        Math.round((place.activationLevel || 0) * 100) +
        " percent.";
      el.setAttribute("aria-label", label);
    });
  }

  function initMarkers() {
    markersById = {};
    var PL = getPLACES();
    for (var i = 0; i < PL.length; i++) {
      (function (place) {
        var m = L.marker([place.lat, place.lng], {
          icon: markerIcon(place),
          title: place.title,
        });
        setMarkerA11y(m, place);
        m.bindPopup(buildPopupHtml(place), {
          maxWidth: 300,
          className: "parkquest-popup parkquest-popup--glass",
          closeButton: true,
        });
        m.addTo(map);
        m.on("click", function () {
          m.setPopupContent(buildPopupHtml(place));
        });
        markersById[place.id] = m;
      })(PL[i]);
    }
    applyAmenityFilter(getSelectedFilter());
  }

  function initLeafletMap() {
    if (typeof L === "undefined") {
      showToast("Map library failed to load");
      return;
    }

    var el = document.getElementById("park-map");
    if (!el) return;

    if (!getPLACES().length) {
      showToast("Park data not loaded");
      return;
    }

    var last = loadMapView();
    var center = last ? [last.lat, last.lng] : BRISBANE;
    var zoom = last && last.z ? last.z : DEFAULT_ZOOM;

    map = L.map(el, {
      zoomControl: true,
      attributionControl: true,
    }).setView(center, zoom);

    var tileUrl =
      (window.PARKQUEST_MAP_CONFIG && window.PARKQUEST_MAP_CONFIG.tileUrl) ||
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

    L.tileLayer(tileUrl, {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    buildSafetyLayer();
    initMarkers();
    bindPopupFavoriteHandlers();
    setupSearch();
    setupGeolocationFab();
    setupFilterListener();
    setupCptedChip();
    updateOfflineBanner();

    map.on("moveend", saveMapView);
    map.on("zoomend", saveMapView);

    window.addEventListener("resize", function () {
      if (map) map.invalidateSize();
    });

    setTimeout(function () {
      if (map) map.invalidateSize();
    }, 200);

    document.body.classList.add("map-ready");
    var stage = document.getElementById("map-stage");
    if (stage) stage.classList.remove("map-stage--fallback-no-key");
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!document.getElementById("park-map")) return;
    setupFeaturedCard();
    initLeafletMap();
  });
})();
