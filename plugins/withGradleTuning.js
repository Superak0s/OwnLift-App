// plugins/withGradleTuning.js

const { withGradleProperties } = require("@expo/config-plugins");

// Properties to force to a specific value (overwrites whatever prebuild wrote)
const FORCED_PROPERTIES = {
  "org.gradle.jvmargs":
    "-Xmx12g -Xms4g -XX:MaxMetaspaceSize=2g -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200",
  "org.gradle.parallel": "true",
  "org.gradle.workers.max": "12",
  "org.gradle.caching": "true",
  "org.gradle.configureondemand": "true",
  "org.gradle.daemon": "true",
  "kotlin.incremental": "true",
  "kotlin.daemon.jvm.options": "-Xmx4g",
};

// Properties removed if present (deprecated / conflicting)
const REMOVED_PROPERTIES = new Set(["android.enableBuildCache"]);

function setProperty(modResults, key, value) {
  const existing = modResults.find(
    (item) => item.type === "property" && item.key === key,
  );
  if (existing) {
    existing.value = value;
  } else {
    modResults.push({ type: "property", key, value });
  }
  return modResults;
}

const withGradleTuning = (config) => {
  return withGradleProperties(config, (config) => {
    let results = config.modResults;

    results = results.filter(
      (item) =>
        !(item.type === "property" && REMOVED_PROPERTIES.has(item.key)),
    );

    for (const [key, value] of Object.entries(FORCED_PROPERTIES)) {
      results = setProperty(results, key, value);
    }

    config.modResults = results;
    return config;
  });
};

module.exports = withGradleTuning;
