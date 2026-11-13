import { loadDictionary } from "./data.js";

const dict = loadDictionary();
console.log(`Last Word server: ${dict.size} words, ${dict.properties.size} properties loaded.`);
console.log("No rooms yet; networking arrives in milestone M2.");
