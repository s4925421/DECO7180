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

  /** Brisbane City Council Open Data (Explore API v2.1) */
  var BCC_API_BASE =
    "https://data.brisbane.qld.gov.au/api/explore/v2.1/catalog/datasets/";
  var BCC_DATASET_TOILETS = "public-toilets-in-brisbane";
  var BCC_DATASET_FOUNTAINS = "park-drinking-fountain-tap-locations";
  var BCC_DATASET_SHADE = "park-shade-sails";
  var BCC_DATASET_SEATING = "park-seating";
  var BCC_FETCH_LIMIT = 100;

  /** In-memory cache: successful JSON per dataset (avoids repeat fetches e.g. if load runs again). */
  var bccApiCache = {};

  var bccToiletsLayer = null;
  var bccToiletsAccessibleLayer = null;
  var bccFountainsLayer = null;
  var bccShadeLayer = null;
  var bccSeatingLayer = null;
  var bccDataLoaded = false;

  function escapeHtml(s) {
    if (s == null || s === "") return "";
    var d = document.createElement("div");
    d.textContent = String(s);
    return d.innerHTML;
  }

  /**
   * Fetch records from BCC Explore API (cached per dataset after first success).
   * @param {string} datasetId e.g. public-toilets-in-brisbane
   */
  function fetchAmenities(datasetId, limit) {
    if (bccApiCache[datasetId] !== undefined) {
      return Promise.resolve(bccApiCache[datasetId]);
    }
    var lim = limit || BCC_FETCH_LIMIT;
    var url = BCC_API_BASE + encodeURIComponent(datasetId) + "/records?limit=" + lim;
    return fetch(url)
      .then(function (r) {
        if (!r.ok) {
          throw new Error("BCC API " + r.status);
        }
        return r.json();
      })
      .then(function (json) {
        bccApiCache[datasetId] = json;
        return json;
      });
  }

  function extractLatLng(rec) {
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

  function iconBccToilet() {
    return L.divIcon({
      className: "bcc-marker-icon",
      html:
        '<div class="bcc-marker bcc-marker--toilet"><span class="material-symbols-outlined" aria-hidden="true">wc</span></div>',
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -28],
    });
  }

  function iconBccFountain() {
    return L.divIcon({
      className: "bcc-marker-icon",
      html:
        '<div class="bcc-marker bcc-marker--fountain"><span class="material-symbols-outlined" aria-hidden="true">water_drop</span></div>',
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -28],
    });
  }

  function iconBccShade() {
    return L.divIcon({
      className: "bcc-marker-icon",
      html:
        '<div class="bcc-marker bcc-marker--shade"><span class="material-symbols-outlined" aria-hidden="true">wb_sunny</span></div>',
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -28],
    });
  }

  function iconBccSeat() {
    return L.divIcon({
      className: "bcc-marker-icon",
      html:
        '<div class="bcc-marker bcc-marker--seat"><span class="material-symbols-outlined" aria-hidden="true">event_seat</span></div>',
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -28],
    });
  }

  function bccParkTitle(rec) {
    return rec.park_name || rec.park || rec.name || rec.asset_name || "Park";
  }

  function bccLocationDescription(rec) {
    var v =
      rec.location_description ||
      rec.location_description_text ||
      rec.description ||
      rec.item_description ||
      rec.location ||
      "";
    return String(v).trim();
  }

  function bccSeatingMaterial(rec) {
    var v = rec.material || rec.Material || rec.seat_material || rec.item_material || rec.surface_material || "";
    return String(v).trim();
  }

  function buildBccToiletPopup(rec) {
    var name = rec.name || "Public toilet";
    var facility = rec.facilitytype || "";
    var hours = rec.openinghours || rec.opening_hours || "—";
    var accYes = rec.accessible === "True" || rec.accessible === true;
    var accText = accYes
      ? "Yes — accessible cubicle listed"
      : "Check on site — may have limited access";
    var addr = [rec.address1, rec.town].filter(Boolean).join(", ");
    return (
      '<div class="bcc-popup gm-iw-parkquest gm-iw-parkquest--glass">' +
      '<strong class="gm-iw-parkquest__title">' +
      escapeHtml(name) +
      "</strong>" +
      '<p class="gm-iw-parkquest__addr">' +
      escapeHtml(facility) +
      (addr ? "<br>" + escapeHtml(addr) : "") +
      "</p>" +
      '<p class="bcc-popup__highlight"><strong>Opening hours</strong><br>' +
      escapeHtml(hours) +
      "</p>" +
      '<p class="bcc-popup__highlight"><strong>Accessible toilet</strong><br>' +
      escapeHtml(accText) +
      "</p>" +
      '<p class="bcc-popup__source">Source: BCC Open Data · updates when Council publishes changes.</p>' +
      "</div>"
    );
  }

  function buildBccFountainPopup(rec) {
    var park = rec.park_name || "Park";
    var desc = rec.item_description || "";
    var typ = rec.item_type || "";
    return (
      '<div class="bcc-popup gm-iw-parkquest gm-iw-parkquest--glass">' +
      '<strong class="gm-iw-parkquest__title">' +
      escapeHtml(park) +
      "</strong>" +
      '<p class="gm-iw-parkquest__addr">' +
      escapeHtml(desc) +
      (typ ? " · " + escapeHtml(typ) : "") +
      "</p>" +
      '<p class="bcc-popup__highlight"><strong>Accessibility</strong><br>' +
      "Wheelchair access to the tap is <strong>not listed</strong> in this dataset — choose paved paths nearby.</p>" +
      '<p class="bcc-popup__source">Source: BCC Open Data · park drinking fountains &amp; taps.</p>' +
      "</div>"
    );
  }

  function buildBccShadePopup(rec) {
    var title = bccParkTitle(rec);
    var loc = bccLocationDescription(rec);
    var locHtml =
      loc !== ""
        ? '<p class="bcc-popup__highlight"><strong>Location</strong><br>' + escapeHtml(loc) + "</p>"
        : '<p class="bcc-popup__highlight"><strong>Location</strong><br>Not listed in dataset — check on site.</p>';
    return (
      '<div class="bcc-popup gm-iw-parkquest gm-iw-parkquest--glass">' +
      '<strong class="gm-iw-parkquest__title">' +
      escapeHtml(title) +
      "</strong>" +
      '<p class="gm-iw-parkquest__addr">Shade sail</p>' +
      locHtml +
      '<p class="bcc-popup__source">Source: BCC Open Data · park shade sails.</p>' +
      "</div>"
    );
  }

  function buildBccSeatingPopup(rec) {
    var title = bccParkTitle(rec);
    var loc = bccLocationDescription(rec);
    var mat = bccSeatingMaterial(rec);
    var locHtml =
      loc !== ""
        ? '<p class="bcc-popup__highlight"><strong>Location</strong><br>' + escapeHtml(loc) + "</p>"
        : '<p class="bcc-popup__highlight"><strong>Location</strong><br>Not listed in dataset — check on site.</p>';
    var matHtml =
      mat !== ""
        ? '<p class="bcc-popup__highlight"><strong>Material</strong><br>' +
          escapeHtml(mat) +
          " — metal or dark surfaces can feel very hot in summer; consider shade or timing.</p>"
        : '<p class="bcc-popup__highlight"><strong>Material</strong><br>Not listed — touch-test on hot days.</p>';
    return (
      '<div class="bcc-popup gm-iw-parkquest gm-iw-parkquest--glass">' +
      '<strong class="gm-iw-parkquest__title">' +
      escapeHtml(title) +
      "</strong>" +
      '<p class="gm-iw-parkquest__addr">Park seating</p>' +
      locHtml +
      matHtml +
      '<p class="bcc-popup__source">Source: BCC Open Data · park seating.</p>' +
      "</div>"
    );
  }

  function setBccLoading(on) {
    var el = document.getElementById("bcc-amenities-loading");
    if (!el) return;
    if (on) {
      el.removeAttribute("hidden");
      el.setAttribute("aria-busy", "true");
    } else {
      el.setAttribute("hidden", "");
      el.setAttribute("aria-busy", "false");
    }
  }

  function bindBccMarkerA11y(marker, label) {
    marker.on("add", function () {
      var el = marker.getElement();
      if (!el) return;
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", label);
    });
  }

  function populateBccLayers(toiletJson, fountainJson, shadeJson, seatingJson) {
    bccToiletsLayer = L.layerGroup();
    bccToiletsAccessibleLayer = L.layerGroup();
    bccFountainsLayer = L.layerGroup();
    bccShadeLayer = L.layerGroup();
    bccSeatingLayer = L.layerGroup();

    var tResults = (toiletJson && toiletJson.results) || [];
    var i;
    for (i = 0; i < tResults.length; i++) {
      (function (rec) {
        var ll = extractLatLng(rec);
        if (!ll) return;
        var m = L.marker(ll, { icon: iconBccToilet(), title: rec.name || "Toilet" });
        m.bindPopup(buildBccToiletPopup(rec), {
          maxWidth: 300,
          className: "parkquest-popup parkquest-popup--glass",
          closeButton: true,
        });
        var accYes = rec.accessible === "True" || rec.accessible === true;
        var a11y =
          "Public toilet, " +
          (rec.name || "") +
          ". Opening: " +
          (rec.openinghours || "unknown") +
          ". Accessible: " +
          (accYes ? "yes" : "check on site") +
          ".";
        bindBccMarkerA11y(m, a11y);
        m.addTo(bccToiletsLayer);
        if (accYes) {
          var m2 = L.marker(ll, { icon: iconBccToilet(), title: rec.name || "Toilet" });
          m2.bindPopup(buildBccToiletPopup(rec), {
            maxWidth: 300,
            className: "parkquest-popup parkquest-popup--glass",
            closeButton: true,
          });
          bindBccMarkerA11y(m2, a11y);
          m2.addTo(bccToiletsAccessibleLayer);
        }
      })(tResults[i]);
    }

    var fResults = (fountainJson && fountainJson.results) || [];
    for (i = 0; i < fResults.length; i++) {
      (function (rec) {
        var ll = extractLatLng(rec);
        if (!ll) return;
        var m = L.marker(ll, { icon: iconBccFountain(), title: rec.park_name || "Fountain" });
        m.bindPopup(buildBccFountainPopup(rec), {
          maxWidth: 300,
          className: "parkquest-popup parkquest-popup--glass",
          closeButton: true,
        });
        bindBccMarkerA11y(
          m,
          "Drinking fountain or tap at " + (rec.park_name || "park") + ". " + (rec.item_description || "")
        );
        m.addTo(bccFountainsLayer);
      })(fResults[i]);
    }

    var shadeResults = (shadeJson && shadeJson.results) || [];
    for (i = 0; i < shadeResults.length; i++) {
      (function (rec) {
        var ll = extractLatLng(rec);
        if (!ll) return;
        var t = bccParkTitle(rec);
        var m = L.marker(ll, { icon: iconBccShade(), title: t + " — shade" });
        m.bindPopup(buildBccShadePopup(rec), {
          maxWidth: 300,
          className: "parkquest-popup parkquest-popup--glass",
          closeButton: true,
        });
        bindBccMarkerA11y(m, "Shade sail at " + t + ". " + bccLocationDescription(rec));
        m.addTo(bccShadeLayer);
      })(shadeResults[i]);
    }

    var seatResults = (seatingJson && seatingJson.results) || [];
    for (i = 0; i < seatResults.length; i++) {
      (function (rec) {
        var ll = extractLatLng(rec);
        if (!ll) return;
        var t = bccParkTitle(rec);
        var m = L.marker(ll, { icon: iconBccSeat(), title: t + " — seating" });
        m.bindPopup(buildBccSeatingPopup(rec), {
          maxWidth: 300,
          className: "parkquest-popup parkquest-popup--glass",
          closeButton: true,
        });
        bindBccMarkerA11y(
          m,
          "Seating at " + t + ". " + bccLocationDescription(rec) + (bccSeatingMaterial(rec) ? ". Material: " + bccSeatingMaterial(rec) : "")
        );
        m.addTo(bccSeatingLayer);
      })(seatResults[i]);
    }
  }

  function applyBccLayerVisibility(filterKey) {
    if (!map || !bccDataLoaded) return;
    function removeL(layer) {
      if (layer && map.hasLayer(layer)) map.removeLayer(layer);
    }
    function addL(layer) {
      if (layer && !map.hasLayer(layer)) map.addLayer(layer);
    }
    removeL(bccToiletsLayer);
    removeL(bccToiletsAccessibleLayer);
    removeL(bccFountainsLayer);
    removeL(bccShadeLayer);
    removeL(bccSeatingLayer);

    if (filterKey === "all") {
      addL(bccToiletsLayer);
      addL(bccFountainsLayer);
      addL(bccShadeLayer);
      addL(bccSeatingLayer);
    } else if (filterKey === "accessible") {
      addL(bccToiletsAccessibleLayer);
    } else if (filterKey === "toilets") {
      addL(bccToiletsLayer);
    } else if (filterKey === "water") {
      addL(bccFountainsLayer);
    } else if (filterKey === "shade") {
      addL(bccShadeLayer);
    } else if (filterKey === "seat") {
      addL(bccSeatingLayer);
    }
  }

  function loadBccAmenitiesData() {
    setBccLoading(true);
    function emptyOnFail(p) {
      return p.catch(function () {
        return { results: [] };
      });
    }
    Promise.all([
      emptyOnFail(fetchAmenities(BCC_DATASET_TOILETS, BCC_FETCH_LIMIT)),
      emptyOnFail(fetchAmenities(BCC_DATASET_FOUNTAINS, BCC_FETCH_LIMIT)),
      emptyOnFail(fetchAmenities(BCC_DATASET_SHADE, BCC_FETCH_LIMIT)),
      emptyOnFail(fetchAmenities(BCC_DATASET_SEATING, BCC_FETCH_LIMIT)),
    ])
      .then(function (arr) {
        populateBccLayers(arr[0], arr[1], arr[2], arr[3]);
        bccDataLoaded = true;
        setBccLoading(false);
        applyBccLayerVisibility(getSelectedFilter());
      })
      .catch(function () {
        setBccLoading(false);
        bccDataLoaded = false;
        showToast("Could not load Brisbane Council facility data — parks still shown");
      });
  }

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
    applyBccLayerVisibility(filterKey);
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

    loadBccAmenitiesData();

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
