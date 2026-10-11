const assert = require("assert");
const {
  routeChatIntent,
  continuesEstablishedChartSubject,
  isVagueFollowUp,
  isEarlyCasualGate,
} = require("../intent_router");
const {
  isFactualQuestion,
  answerFactualQuestion,
} = require("../factual_questions");
const { conversationStateFromRoute } = require("../conversation_state");
const { buildAnalysisState } = require("../analysis_state");
const { buildChartArchitecture } = require("../chart_architecture");
const { selectChartAnalysisFocus } = require("../chart_analysis");
const { timedChart } = require("./fixtures");

function route(message, history) {
  return routeChatIntent({ message: message, history: history || [] });
}

function test() {
  assert.equal(route("Tell me about myself").primaryIntent, "PERSONAL_SYNTHESIS");
  assert.equal(route("Tell me about my chart").primaryIntent, "CHART_ANALYSIS");
  assert.equal(
    route("What stands out in my chart?").primaryIntent,
    "CHART_ANALYSIS",
  );
  assert.equal(route("Where is Saturn?").primaryIntent, "FACTUAL");
  assert.equal(route("What degree is Saturn?").primaryIntent, "FACTUAL");
  assert.equal(
    route("What does Venus opposite Saturn mean in my chart?").primaryIntent,
    "ASPECT",
  );
  assert.equal(route("What about relationships?").primaryIntent, "TOPIC");
  assert.equal(route("Tell me about Saturn").explicitSubject, "saturn");
  assert.notEqual(route("Tell me about Saturn").primaryIntent, "CHART_ANALYSIS");

  const prior = [{ role: "user", content: "Tell me about my chart" }];
  const more = route("Tell me more", prior);
  assert.equal(more.primaryIntent, "CHART_ANALYSIS");
  assert.equal(more.inheritedIntent, true);
  const deeper = route("Go deeper", prior);
  assert.equal(deeper.primaryIntent, "CHART_ANALYSIS");
  assert.equal(deeper.inheritedIntent, true);

  const history = [
    { role: "user", content: "Tell me about my chart" },
    { role: "assistant", content: "The chart is organized by Saturn." },
    { role: "user", content: "Tell me about my chart" },
  ];
  const second = route("Tell me about my chart", history);
  assert.equal(second.primaryIntent, "CHART_ANALYSIS");
  assert.equal(second.progressionEligible, true);
  const state = buildAnalysisState(
    buildChartArchitecture(timedChart()),
    second.priorConversation,
    second,
  );
  assert.equal(state.currentIntent, "CHART_ANALYSIS");
  assert.equal(state.progressionPhase, "breadth");
  assert.ok(state.currentFocus);
  assert.notEqual(state.currentFocus, "dominant_overview");

  const saturn = route("Tell me more about Saturn", prior);
  assert.equal(saturn.explicitSubject, "saturn");
  assert.equal(saturn.progressionEligible, false);

  const arch = buildChartArchitecture(timedChart());
  const continuations = ["Tell me more", "Tell me more", "Tell me more"];
  const assistantReplies = [
    "Saturn organizes this chart from Capricorn. The lights oppose one another and Mars squares that axis.",
    "The aspect network is dense around Mars. Jupiter is applying to the opposition while Saturn is separating from the Sun. Topology favors that square pattern.",
    "Angular structure is carried by Saturn on the first house. Aspects to the Ascendant and Midheaven stay quiet beside that angular planet.",
  ];
  const first = route("Tell me about my chart", [
    { role: "user", content: "Tell me about my chart" },
  ]);
  assert.equal(first.progressionEligible, true);
  const firstState = buildAnalysisState(arch, first.priorConversation, first);
  assert.equal(firstState.currentFocus, "dominant_overview");
  assert.equal(firstState.progressionPhase, "overview");

  let continuationHistory = [
    { role: "user", content: "Tell me about my chart" },
  ];
  const foci = [firstState.currentFocus];
  for (let i = 0; i < continuations.length; i++) {
    continuationHistory.push({
      role: "assistant",
      content: assistantReplies[i],
    });
    continuationHistory.push({
      role: "user",
      content: continuations[i],
    });
    const next = route(continuations[i], continuationHistory);
    assert.equal(next.primaryIntent, "CHART_ANALYSIS");
    assert.equal(
      next.progressionEligible,
      true,
      "continuation " + (i + 1) + " must stay progression-eligible",
    );
    const state = buildAnalysisState(arch, next.priorConversation, next);
    assert.ok(state.focus, "continuation " + (i + 1) + " must receive a focus");
    assert.ok(state.currentFocus);
    assert.notEqual(state.currentFocus, "dominant_overview");
    assert.ok(
      state.progressionPhase === "breadth" ||
        state.progressionPhase === "integration",
    );
    const expected = selectChartAnalysisFocus(arch, next.priorConversation);
    assert.equal(state.currentFocus, expected.id);
    assert.equal(state.progressionPhase, expected.phase);
    foci.push(state.currentFocus);
  }
  assert.equal(foci[0], "dominant_overview");
  assert.ok(foci[1]);

  const saturnHistory = [
    { role: "user", content: "Saturn Capricorn" },
    { role: "assistant", content: "Saturn in Capricorn carries the chart ruler." },
  ];
  const saturnMore = route("Tell me more", saturnHistory.concat([
    { role: "user", content: "Tell me more" },
  ]));
  assert.equal(saturnMore.primaryIntent, "PLACEMENT");
  assert.equal(saturnMore.chartMode, true);
  assert.equal(saturnMore.aspectMode, false);
  assert.equal(saturnMore.asked, "Tell me more");
  assert.ok(/saturn/i.test(saturnMore.questionForMode));
  assert.equal(
    continuesEstablishedChartSubject("Tell me more", saturnHistory.concat([
      { role: "user", content: "Tell me more" },
    ])),
    true,
  );
  const saturnAgain = route("Tell me more", saturnHistory.concat([
    { role: "user", content: "Tell me more" },
    { role: "assistant", content: "Saturn still organizes the Capricorn placements." },
    { role: "user", content: "Tell me more" },
  ]));
  assert.equal(saturnAgain.primaryIntent, "PLACEMENT");
  assert.equal(saturnAgain.asked, "Tell me more");
  assert.ok(/saturn/i.test(saturnAgain.questionForMode));
  assert.notEqual(saturnAgain.questionForMode, saturnAgain.asked);

  const aspectHistory = [
    { role: "user", content: "Mars square Saturn" },
    { role: "assistant", content: "Mars square Saturn is a tight frictional contact." },
  ];
  const aspectMore = route("Tell me more", aspectHistory.concat([
    { role: "user", content: "Tell me more" },
  ]));
  assert.equal(aspectMore.primaryIntent, "ASPECT");
  assert.equal(aspectMore.asked, "Tell me more");
  assert.equal(aspectMore.clickedAspect.planet1, "mars");
  assert.equal(aspectMore.clickedAspect.aspect, "square");
  assert.equal(aspectMore.clickedAspect.planet2, "saturn");
  const aspectWhy = route("why is that difficult?", aspectHistory.concat([
    { role: "user", content: "why is that difficult?" },
  ]));
  assert.equal(aspectWhy.primaryIntent, "ASPECT");
  assert.equal(aspectWhy.asked, "why is that difficult?");
  assert.notEqual(aspectWhy.questionForMode, aspectWhy.asked);
  assert.equal(aspectWhy.clickedAspect.planet1, "mars");
  assert.equal(aspectWhy.clickedAspect.aspect, "square");
  assert.equal(aspectWhy.clickedAspect.planet2, "saturn");
  const venus = route("Tell me about Venus", aspectHistory.concat([
    { role: "user", content: "Tell me about Venus" },
  ]));
  assert.equal(venus.explicitSubject, "venus");
  assert.equal(venus.primaryIntent, "PLACEMENT");
  assert.equal(venus.clickedAspect, null);
  assert.equal(venus.inheritedIntent, false);
  assert.equal(venus.asked, "Tell me about Venus");
  assert.equal(
    continuesEstablishedChartSubject("thanks", aspectHistory.concat([
      { role: "user", content: "thanks" },
    ])),
    false,
  );
  const thanks = route("thanks", aspectHistory.concat([
    { role: "user", content: "thanks" },
  ]));
  assert.equal(thanks.primaryIntent, "PERSONAL_SYNTHESIS");
  assert.equal(thanks.aspectMode, false);
  assert.equal(thanks.clickedAspect, null);

  const houseMore = route("Tell me more", [
    { role: "user", content: "House 10 Capricorn" },
    { role: "assistant", content: "The tenth house is packed with Capricorn." },
    { role: "user", content: "Tell me more" },
  ]);
  assert.equal(houseMore.primaryIntent, "PLACEMENT");
  assert.equal(houseMore.asked, "Tell me more");
  assert.ok(/house\s+10/i.test(houseMore.questionForMode));
  const angleMore = route("Tell me more", [
    { role: "user", content: "Ascendant Leo" },
    { role: "assistant", content: "Leo rises." },
    { role: "user", content: "Tell me more" },
  ]);
  assert.equal(angleMore.primaryIntent, "PLACEMENT");
  assert.ok(/ascendant/i.test(angleMore.questionForMode));

  const factualHistory = [
    { role: "user", content: "Where is Saturn?" },
    { role: "assistant", content: "Saturn is in Capricorn." },
    { role: "user", content: "Tell me more" },
  ];
  assert.equal(continuesEstablishedChartSubject("Tell me more", factualHistory), false);
  assert.equal(route("Where is Saturn?").primaryIntent, "FACTUAL");
  assert.equal(route("Tell me more", factualHistory).primaryIntent, "PERSONAL_SYNTHESIS");

  const placementChart = {
    planets: {
      saturn: { sign: "Capricorn", house: 10, degree: 3.25 },
    },
  };
  const interpretive = "Why is my Saturn in Capricorn difficult?";
  assert.equal(isFactualQuestion(interpretive), false);
  assert.equal(answerFactualQuestion(interpretive, placementChart), null);
  const interpretiveRoute = route(interpretive);
  assert.equal(interpretiveRoute.factual, false);
  assert.equal(interpretiveRoute.primaryIntent, "PLACEMENT");
  assert.equal(interpretiveRoute.asked, interpretive);
  assert.equal(route("What sign is my Saturn?").primaryIntent, "FACTUAL");
  assert.equal(route("What does Saturn in Capricorn mean?").factual, false);
  assert.notEqual(
    route("What does Saturn in Capricorn mean?").primaryIntent,
    "FACTUAL",
  );
  assert.equal(isFactualQuestion("How many planets are in house 10?"), true);
  assert.equal(isFactualQuestion("Where is my Saturn?"), true);

  assert.equal(isVagueFollowUp("why?"), true);
  assert.equal(isVagueFollowUp("Why?"), true);
  assert.equal(isVagueFollowUp("and?"), true);
  assert.equal(isVagueFollowUp("thanks!"), false);

  const saturnPrior = [
    { role: "user", content: "Saturn Capricorn" },
    { role: "assistant", content: "Saturn in Capricorn carries the chart ruler." },
  ];
  function followSaturn(message) {
    return route(message, saturnPrior.concat([{ role: "user", content: message }]));
  }

  const whyShort = followSaturn("why?");
  assert.equal(whyShort.primaryIntent, "PLACEMENT");
  assert.equal(whyShort.asked, "why?");
  assert.notEqual(whyShort.questionForMode, whyShort.asked);
  assert.ok(/saturn/i.test(whyShort.questionForMode));
  const andShort = followSaturn("and?");
  assert.equal(andShort.primaryIntent, "PLACEMENT");
  assert.equal(andShort.asked, "and?");
  assert.ok(/saturn/i.test(andShort.questionForMode));

  ["I don't understand", "I disagree", "that's wrong", "what do you mean?", "explain that?", "say that again", "can you repeat that?"].forEach(
    function (message) {
      const next = followSaturn(message);
      assert.equal(next.asked, message, message);
      assert.notEqual(next.questionForMode, message, message);
      assert.equal(next.primaryIntent, "PLACEMENT", message);
      assert.ok(/saturn/i.test(next.questionForMode), message);
    },
  );

  const affect = followSaturn("How does that affect my relationships?");
  assert.equal(affect.asked, "How does that affect my relationships?");
  assert.notEqual(affect.questionForMode, affect.asked);
  assert.ok(/saturn/i.test(affect.questionForMode));
  assert.equal(affect.primaryIntent, "PLACEMENT");
  assert.equal(affect.chartMode, true);
  assert.equal(affect.topicMode, false);
  assert.equal(affect.inheritedIntent, true);

  const aspectAffect = route("How does that affect my relationships?", [
    { role: "user", content: "Mars square Saturn" },
    { role: "assistant", content: "Mars square Saturn is a tight frictional contact." },
    { role: "user", content: "How does that affect my relationships?" },
  ]);
  assert.equal(aspectAffect.primaryIntent, "ASPECT");
  assert.equal(aspectAffect.asked, "How does that affect my relationships?");
  assert.notEqual(aspectAffect.questionForMode, aspectAffect.asked);
  assert.equal(aspectAffect.clickedAspect.planet1, "mars");
  assert.equal(aspectAffect.clickedAspect.aspect, "square");
  assert.equal(aspectAffect.clickedAspect.planet2, "saturn");
  assert.equal(aspectAffect.topicMode, false);

  const careerCut = followSaturn("Tell me more about my career");
  assert.equal(careerCut.primaryIntent, "TOPIC");
  assert.equal(careerCut.asked, "Tell me more about my career");
  assert.equal(careerCut.questionForMode, "Tell me more about my career");
  assert.equal(careerCut.inheritedIntent, false);

  const venusSwitch = followSaturn("Tell me about Venus");
  assert.equal(venusSwitch.explicitSubject, "venus");
  assert.equal(venusSwitch.primaryIntent, "PLACEMENT");
  assert.equal(venusSwitch.questionForMode, "Tell me about Venus");
  assert.equal(venusSwitch.inheritedIntent, false);

  const namedOverAspect = route(interpretive, [
    { role: "user", content: "Mars square Saturn" },
    { role: "user", content: interpretive },
  ]);
  assert.equal(namedOverAspect.factual, false);
  assert.equal(namedOverAspect.primaryIntent, "PLACEMENT");
  assert.equal(namedOverAspect.inheritedIntent, false);
  assert.equal(namedOverAspect.asked, interpretive);

  assert.equal(followSaturn("thanks!").primaryIntent, "PERSONAL_SYNTHESIS");
  assert.equal(
    continuesEstablishedChartSubject(
      "thanks!",
      saturnPrior.concat([{ role: "user", content: "thanks!" }]),
    ),
    false,
  );
  const afterThanks = route("Tell me more", [
    { role: "user", content: "Saturn Capricorn" },
    { role: "assistant", content: "Saturn in Capricorn carries the chart ruler." },
    { role: "user", content: "thanks!" },
    { role: "assistant", content: "You're welcome." },
    { role: "user", content: "Tell me more" },
  ]);
  assert.equal(afterThanks.primaryIntent, "PLACEMENT");
  assert.equal(afterThanks.asked, "Tell me more");
  assert.ok(/saturn/i.test(afterThanks.questionForMode));
  const afterOk = route("Tell me more", [
    { role: "user", content: "Saturn Capricorn" },
    { role: "user", content: "ok." },
    { role: "user", content: "Tell me more" },
  ]);
  assert.equal(afterOk.primaryIntent, "PLACEMENT");
  assert.ok(/saturn/i.test(afterOk.questionForMode));
  const afterDisagree = route("Tell me more", [
    { role: "user", content: "Saturn Capricorn" },
    { role: "user", content: "I disagree" },
    { role: "user", content: "Tell me more" },
  ]);
  assert.equal(afterDisagree.primaryIntent, "PLACEMENT");
  assert.ok(/saturn/i.test(afterDisagree.questionForMode));

  const birth = timedChart();
  birth.birthData = {
    date: "1990-01-15",
    time: "14:30",
    location: { latitude: 40.7, longitude: -74, timezone: -5 },
  };
  const storedSaturn = conversationStateFromRoute(
    route("Saturn Capricorn", [{ role: "user", content: "Saturn Capricorn" }]),
    birth,
  );
  const afterAckOnly = routeChatIntent({
    message: "Tell me more",
    history: [
      { role: "user", content: "ok." },
      { role: "user", content: "thanks!" },
      { role: "user", content: "Tell me more" },
    ],
    validatedState: storedSaturn,
  });
  assert.equal(afterAckOnly.asked, "Tell me more");
  assert.equal(afterAckOnly.questionForMode, "Saturn Capricorn");
  assert.equal(afterAckOnly.primaryIntent, "PLACEMENT");

  assert.equal(isEarlyCasualGate("hello"), true);
  assert.equal(isEarlyCasualGate("thanks!"), true);
  assert.equal(isEarlyCasualGate("ok."), true);
  assert.equal(isEarlyCasualGate("what about love?"), false);
  assert.equal(isEarlyCasualGate("my career"), false);
  assert.equal(isEarlyCasualGate("relationships?"), false);
  assert.equal(isEarlyCasualGate("will I marry?"), false);
  assert.equal(isEarlyCasualGate("my future"), false);
  assert.equal(isEarlyCasualGate("t-square"), false);
  assert.equal(isEarlyCasualGate("my chart"), false);
  assert.equal(isEarlyCasualGate("What stands out in my chart?"), false);
  assert.equal(isEarlyCasualGate("Where is Saturn?"), false);
  assert.equal(
    isEarlyCasualGate("why?", saturnPrior.concat([{ role: "user", content: "why?" }])),
    false,
  );
  assert.equal(isEarlyCasualGate("I disagree"), false);
  assert.equal(
    isEarlyCasualGate(
      "How does that affect my relationships?",
      saturnPrior.concat([
        { role: "user", content: "How does that affect my relationships?" },
      ]),
    ),
    false,
  );
}

module.exports = test;
