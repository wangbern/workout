// Shared settings for the page. The Apps Script copy of the clock
// (timezone A and reset hour) lives in apps-script/Code.gs — keep them together.
//
// Timezone names were blank in the setup notes. Shelby and Bernice are on the
// US side, Auntie is in China, and the page copy says 美西 / 北京, so the
// anchor is Pacific Time and the other clock is China.
window.MONSTER_CONFIG = {
  players: [
    { id: "p1", en: "Auntie", zh: "Auntie", zone: "B" },
    { id: "p2", en: "Shelby", zh: "Shelby", zone: "A" },
    { id: "p3", en: "Bernice", zh: "Bernice", zone: "A" },
  ],
  timezoneA: "America/Los_Angeles",
  timezoneB: "Asia/Shanghai",
  zoneALabel: { en: "PT", zh: "美西" },
  zoneBLabel: { en: "CST", zh: "北京" },
  resetHour: 8,
  // Paste the Apps Script web app URL here after deploying.
  // It looks like https://script.google.com/macros/s/XXXX/exec
  scriptUrl: "https://script.google.com/macros/s/AKfycbyPe_UCmX0cYw2afaRiaMR_XH9gFj51aMBQC4bXnGqnMO5NeJKP7YvqQ3wZi6D85NaD/exec",
};
