/**
 * Single source of truth: park places, labels, and simulated community events.
 */
(function () {
  "use strict";

  var PLACES = [
    {
      id: "roma",
      title: "Roma Street Parkland",
      lat: -27.4658,
      lng: 153.0235,
      amenities: ["toilets", "water", "shade", "seat", "accessible"],
      featured: false,
      address: "Parkland Blvd, Brisbane City",
      activationLevel: 0.82,
      highVisibility: true,
      visibilityRadiusM: 240,
      maintenance: {
        toilets: "cleaned_today",
        label: "Toilets cleaned today 🟢",
        fountains: "Checked this morning 🟢",
      },
      cptedNote: "Wide paths and clear sightlines near the Parkland Blvd entrance.",
      pathComfortNote:
        "Suggested walking route: well-lit main paths, gentle slopes, good visibility from seating areas.",
    },
    {
      id: "southbank",
      title: "South Bank Parklands",
      lat: -27.4753,
      lng: 153.0211,
      amenities: ["toilets", "water", "shade", "seat", "accessible"],
      featured: false,
      address: "Little Stanley St, South Brisbane",
      activationLevel: 0.92,
      highVisibility: true,
      visibilityRadiusM: 280,
      maintenance: {
        toilets: "cleaned_today",
        label: "Toilets cleaned today 🟢",
        fountains: "High-traffic area — serviced twice daily 🟢",
      },
      cptedNote: "Open riverfront, high natural surveillance from cafés and promenade.",
      pathComfortNote:
        "Main riverwalk is flat, paved, and brightly lit after dusk along the core strip.",
    },
    {
      id: "botanic",
      title: "City Botanic Gardens",
      lat: -27.4758,
      lng: 153.0306,
      amenities: ["toilets", "water", "shade", "seat", "accessible"],
      featured: true,
      address: "Alice St, Brisbane City",
      activationLevel: 0.78,
      highVisibility: true,
      visibilityRadiusM: 260,
      maintenance: {
        toilets: "cleaned_today",
        label: "Toilets cleaned today 🟢",
        fountains: "Drinking fountains checked 🟢",
      },
      cptedNote: "Historic lawns with open views; main gates stay visible from internal paths.",
      pathComfortNote:
        "Primary loop near Alice St: paved, shaded, and suitable for wheels and strollers.",
    },
    {
      id: "newfarm",
      title: "New Farm Park",
      lat: -27.468,
      lng: 153.0515,
      amenities: ["water", "shade", "seat"],
      featured: false,
      address: "Brunswick St, New Farm",
      activationLevel: 0.55,
      highVisibility: false,
      visibilityRadiusM: 180,
      maintenance: {
        toilets: "scheduled_afternoon",
        label: "Toilets: service scheduled this afternoon 🟡",
        fountains: "Fountain operational 🟢",
      },
      cptedNote: "Mix of open riverfront and tree cover; stay on main paths for best visibility.",
      pathComfortNote:
        "Riverside promenade is level; some internal paths are gravel — check map for paved links.",
    },
  ];

  /** Simulated Brisbane park activities (time-based, no backend). */
  var EVENTS = [
    {
      parkId: "botanic",
      title: "Community Tai Chi",
      weekday: true,
      startH: 6,
      endH: 8.5,
    },
    {
      parkId: "roma",
      title: "Morning walking group",
      weekday: true,
      startH: 7,
      endH: 9,
    },
    {
      parkId: "southbank",
      title: "Kids story & play (ages 4–8)",
      weekend: true,
      startH: 10,
      endH: 11.5,
    },
    {
      parkId: "southbank",
      title: "Riverside Tai Chi",
      weekend: true,
      startH: 7,
      endH: 8.5,
    },
    {
      parkId: "newfarm",
      title: "Family picnic meet-up",
      weekend: true,
      startH: 11,
      endH: 14,
    },
    {
      parkId: "botanic",
      title: "Nature sketching for families",
      weekend: true,
      startH: 9,
      endH: 11,
    },
  ];

  function placeById(id) {
    for (var i = 0; i < PLACES.length; i++) {
      if (PLACES[i].id === id) return PLACES[i];
    }
    return null;
  }

  function getLabels() {
    var o = {};
    for (var i = 0; i < PLACES.length; i++) {
      o[PLACES[i].id] = PLACES[i].title;
    }
    return o;
  }

  function isEventActive(ev) {
    var now = new Date();
    var d = now.getDay();
    var h = now.getHours() + now.getMinutes() / 60;
    var weekend = d === 0 || d === 6;
    if (ev.weekend && !weekend) return false;
    if (ev.weekday && weekend) return false;
    return h >= ev.startH && h < ev.endH;
  }

  function getActiveEventsForPark(parkId) {
    var out = [];
    for (var i = 0; i < EVENTS.length; i++) {
      if (EVENTS[i].parkId === parkId && isEventActive(EVENTS[i])) {
        out.push(EVENTS[i]);
      }
    }
    return out;
  }

  function getAllActiveEvents() {
    var out = [];
    for (var i = 0; i < EVENTS.length; i++) {
      if (isEventActive(EVENTS[i])) out.push(EVENTS[i]);
    }
    return out;
  }

  function countParksWithActiveEvents() {
    var seen = {};
    var n = 0;
    for (var i = 0; i < EVENTS.length; i++) {
      if (!isEventActive(EVENTS[i])) continue;
      if (!seen[EVENTS[i].parkId]) {
        seen[EVENTS[i].parkId] = true;
        n++;
      }
    }
    return n;
  }

  function countActiveGroupsTotal() {
    var c = 0;
    for (var i = 0; i < EVENTS.length; i++) {
      if (isEventActive(EVENTS[i])) c++;
    }
    return c;
  }

  window.PARKQUEST_DATA = {
    PLACES: PLACES,
    EVENTS: EVENTS,
    placeById: placeById,
    getLabels: getLabels,
    isEventActive: isEventActive,
    getActiveEventsForPark: getActiveEventsForPark,
    getAllActiveEvents: getAllActiveEvents,
    countParksWithActiveEvents: countParksWithActiveEvents,
    countActiveGroupsTotal: countActiveGroupsTotal,
  };
})();
