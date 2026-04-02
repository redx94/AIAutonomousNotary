const path = require("path");
const { ensureDirectory, writeJson } = require("../../utils/fileSystem");

function exportBundle(bundle, outputRoot) {
  const bundleDirectory = ensureDirectory(path.join(outputRoot, bundle.manifest.bundleId));
  writeJson(path.join(bundleDirectory, "manifest.json"), bundle.manifest.toJSON());

  Object.entries(bundle.sections).forEach(([fileName, payload]) => {
    writeJson(path.join(bundleDirectory, fileName), payload || {});
  });

  return {
    bundleId: bundle.manifest.bundleId,
    bundleDirectory,
    files: [
      "manifest.json",
      ...Object.keys(bundle.sections),
    ],
  };
}

module.exports = exportBundle;
