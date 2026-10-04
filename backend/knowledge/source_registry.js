/**
 * Registered interpretive sources. Retrieval stays deterministic.
 * Adding a future author means registering another record here.
 * Sources are not merged into one consensus.
 */

const SOURCES = [
  {
    id: "alan-leo-esoteric-astrology",
    author: "Alan Leo",
    work: "Esoteric Astrology",
    year: 1913,
    tradition: ["esoteric", "theosophical"],
    topics: [
      "planets",
      "houses",
      "aspects",
      "signs",
      "polarities",
      "synthesis",
    ],
    doctrinal: true,
    loader: "alan-leo/loader.js",
  },
];

function listSources() {
  return SOURCES.slice();
}

function getSource(id) {
  return (
    SOURCES.filter(function (source) {
      return source.id === id;
    })[0] || null
  );
}

module.exports = {
  listSources,
  getSource,
};
