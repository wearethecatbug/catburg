const runtimeBaseUrl = process.env.SAFE_CAT_BASE_URL || "http://127.0.0.1:3213";
const fixedClockStart = new Date("2024-01-01T00:00:00.000Z");
const viewportCases = [
  [1175, 1098], [1440, 900], [768, 900], [390, 844], [320, 844], [1280, 600],
];

module.exports = { runtimeBaseUrl, fixedClockStart, viewportCases };
