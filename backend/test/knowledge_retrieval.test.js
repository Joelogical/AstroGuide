const assert = require("assert");
const {
  selectAlanLeoModuleIds,
  buildAlanLeoKnowledgeBlock,
} = require("../knowledge/alan-leo/loader");
const { getSource, listSources } = require("../knowledge/source_registry");

function test() {
  const source = getSource("alan-leo-esoteric-astrology");
  assert.ok(source);
  assert.equal(source.author, "Alan Leo");
  assert.equal(source.doctrinal, true);
  assert.equal(listSources().length, 1);

  const aspect = selectAlanLeoModuleIds({
    question: "What does Venus opposite Saturn mean in my chart?",
    aspectMode: true,
    preferredMode: "advanced",
  });
  assert.ok(aspect.indexOf("aspects") !== -1);
  assert.ok(aspect.indexOf("planets") !== -1);
  assert.equal(aspect.indexOf("houses"), -1);
  assert.equal(aspect.indexOf("doctrine"), -1);

  const house = selectAlanLeoModuleIds({
    question: "What does my 7th house show?",
    preferredMode: "advanced",
    unknownBirthTime: false,
  });
  assert.ok(house.indexOf("houses") !== -1);

  const progressedHouses = selectAlanLeoModuleIds({
    question: "Tell me about my chart",
    chartAnalysisMode: true,
    preferredMode: "advanced",
    unknownBirthTime: true,
    structures: { houses: true, planets: ["saturn"] },
    progressionFocus: "house_axes",
    progressionPhase: "breadth",
  });
  assert.equal(progressedHouses.indexOf("houses"), -1);

  const esoteric = selectAlanLeoModuleIds({
    question: "Explain the esoteric doctrine of reincarnation in this chart",
    preferredMode: "advanced",
  });
  assert.ok(esoteric.indexOf("doctrine") !== -1);

  const factual = selectAlanLeoModuleIds({
    question: "What degree is Saturn?",
    preferredMode: "advanced",
  });
  assert.ok(factual.indexOf("doctrine") === -1);
  assert.ok(factual.indexOf("methodology") === -1);
  assert.ok(factual.length <= 1);

  const focused = selectAlanLeoModuleIds({
    question: "Tell me about my chart",
    chartAnalysisMode: true,
    preferredMode: "advanced",
    structures: {
      aspects: true,
      houses: true,
      elements: true,
      planets: ["saturn", "sun"],
    },
    progressionFocus: "aspect_topology",
    progressionPhase: "breadth",
  });
  assert.ok(focused.indexOf("aspects") !== -1);
  assert.equal(focused.indexOf("houses"), -1);
  assert.equal(focused.indexOf("signs"), -1);
  assert.equal(focused.indexOf("advancedRules"), -1);

  const block = buildAlanLeoKnowledgeBlock({
    question: "What does Venus opposite Saturn mean?",
    aspectMode: true,
    preferredMode: "beginner",
  });
  assert.ok(block.indexOf("Alan Leo, Esoteric Astrology, 1913") !== -1);
  assert.ok(block.indexOf("Aspect Framework") !== -1);
  assert.equal(block.indexOf("Houses and Angles"), -1);

  const chartAnalysis = buildAlanLeoKnowledgeBlock({
    question: "Tell me about my chart",
    chartAnalysisMode: true,
    preferredMode: "advanced",
    structures: { planets: ["saturn"], aspects: true },
  });
  assert.ok(chartAnalysis.indexOf("Horoscope as an integrated system") !== -1);
  assert.ok(chartAnalysis.indexOf("Do not assign equal weight") !== -1);
  assert.equal(chartAnalysis.indexOf("A final synthesis should state"), -1);
  assert.equal(chartAnalysis.indexOf("## Whole-chart conclusion"), -1);
  assert.equal(chartAnalysis.indexOf("How Leo applies a factor"), -1);
  assert.equal(chartAnalysis.indexOf("Prioritize, when available"), -1);

  const synthesis = buildAlanLeoKnowledgeBlock({
    question: "Tell me about myself",
    thesisMode: true,
    preferredMode: "advanced",
    structures: { planets: ["saturn"] },
  });
  assert.ok(synthesis.indexOf("A final synthesis should state") !== -1);
  assert.ok(synthesis.indexOf("How Leo applies a factor") !== -1);
  assert.ok(synthesis.indexOf("Prioritize, when available") !== -1);
  assert.ok(synthesis.indexOf("Horoscope as an integrated system") !== -1);
}

module.exports = test;
