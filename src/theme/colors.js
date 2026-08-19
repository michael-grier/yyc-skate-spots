// Single source of truth for the app's palette ("full matte graphite").
// Plain CommonJS because tailwind.config.js must require() it at build time;
// app code imports it too, so the two can never drift.
const colors = {
  base: "#141517", // screen background
  card: "#1B1D20", // solid raised surfaces
  ink: "#F0F1F3", // primary text
  mute: "#989EA8", // secondary text
  silver: "#D9DDE3", // interactive accents (icons, links)
  ctagrey: "#2A2D31", // primary button fill
  bust: {
    low: "#7FBF9E",
    medium: "#D4B36F",
    high: "#D08C8C",
  },
  // Selected map pin is the one deliberately bright element on the map.
  pinSelected: "#E8EAEE",
  pinSelectedInk: "#17191D",
};

// Google Maps custom style palette; slightly lighter than `base` so floating
// controls still separate from the map without shadows.
const mapColors = {
  land: "#191B1E",
  road: "#282B30",
  roadMinor: "#202327",
  water: "#2A3844",
  park: "#1D231F",
  label: "#989EA8",
};

module.exports = { colors, mapColors };
