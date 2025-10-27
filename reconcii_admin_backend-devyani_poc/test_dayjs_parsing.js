const dayjs = require("dayjs");
const customParseFormat = require("dayjs/plugin/customParseFormat");
require("dayjs/locale/en");

dayjs.extend(customParseFormat);
dayjs.locale("en");

// This should work now
const input = "Sunday, 1 December 2024";
const parsed = dayjs(input, "dddd, D MMMM YYYY", "en"); // Strict

if (!parsed.isValid()) {
  console.log("Failed to parse:", input);
} else {
  console.log("Parsed date:", parsed.format("YYYY-MM-DD"));
}
