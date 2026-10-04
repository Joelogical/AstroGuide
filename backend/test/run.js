const tests = [
  ["./birth_input.test", require("./birth_input.test")],
  ["./architecture.test", require("./architecture.test")],
  ["./progression_baseline.test", require("./progression_baseline.test")],
  ["./intent_router.test", require("./intent_router.test")],
  ["./knowledge_retrieval.test", require("./knowledge_retrieval.test")],
  ["./prompt_assembly.test", require("./prompt_assembly.test")],
  ["./swiss.test", require("./swiss.test")],
];

async function main() {
  for (const pair of tests) {
    const name = pair[0];
    const run = pair[1];
    await run();
    console.log("ok " + name);
  }
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});
