/**
 * Hard ban on event prediction. Detects fortune-telling questions and
 * frames the reply as inner potential and life-as-it-is-now.
 */

function isPredictionQuestion(message) {
  const text = String(message || "").toLowerCase().trim();
  if (!text) return false;
  const patterns = [
    /\b(predict|prediction|predictions|forecast|fortune[\s-]?tell)/i,
    /\bwhat('s| is) (going to happen|my future|in (my|the) (future|cards))\b/,
    /\b(my|the) future\b/,
    /\bwhen will i\b/,
    /\bam i (ever )?going to\b/,
    /\bwill i (get|meet|marry|have|lose|die|win|find|move|be|fall|buy|sell)\b/,
    /\b(this|next) (year|month|week)\b.*\b(happen|meet|get|love|money|job|marry|pregnant|baby)\b/,
    /\bwhat happens in (20\d{2}|the next)\b/,
    /\bhoroscope for (today|tomorrow|this|next)\b/,
    /\b(saturn return|jupiter return).*\b(when|will|happen)\b/,
  ];
  return patterns.some(function (re) {
    return re.test(text);
  });
}

function getNoPredictionRules() {
  return (
    "NO EVENT PREDICTION (always on): This app does not forecast events, dates, outcomes, or “what will happen.” " +
    "Do not say someone will meet a person, get a job, marry, have a child, move, or die. " +
    "Do not use year/month timing, transits-as-events, or horoscope-style forecasts. " +
    "If a question sounds like a prediction, do not answer it as one.\n\n" +
    "WHAT TO DO INSTEAD: Talk about who they are and the life they are in right now. " +
    "If they asked about the future, treat that topic as potential that already lives in them—capacities, patterns, and what they tend to reach for—not a coming event. " +
    "Use language like “you carry,” “this is already in you,” “this is how it often shows up,” never “this will happen.”"
  );
}

function getPredictionQuestionRules() {
  return (
    "THE USER ASKED FOR A PREDICTION.\n" +
    "Open with one or two gentle sentences: this app is not meant for predicting what will happen. " +
    "It is for exploring themselves and the life they are in right now. " +
    "Then, if their question points at a life area (love, work, family, money), answer that area as potential they already hold—not as a future event. " +
    "Keep the tone warm and brief on the redirect; do not scold or lecture. " +
    "Do not add dates, years, or “you will.”"
  );
}

module.exports = {
  isPredictionQuestion,
  getNoPredictionRules,
  getPredictionQuestionRules,
};
