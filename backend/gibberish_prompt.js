/**
 * Keyboard smash / nonsense — answer instantly instead of calling the model.
 */

function isGibberishPrompt(message) {
  const raw = String(message || "").trim();
  if (!raw) return true;
  if (raw.length > 280) return false;
  if (/[\u0400-\u04FF\u0600-\u06FF\u3040-\u30FF\u3400-\u9FFF]/.test(raw)) {
    return false;
  }

  const lower = raw.toLowerCase();
  if (
    /\b(chart|birth|astro|sign|planet|sun|moon|mercury|venus|mars|jupiter|saturn|house|love|career|work|family|feel|life|job|hello|thanks|please|what|why|how|when|where|who|tell|explain|help|yes|no|ok|okay|hi|hey)\b/i.test(
      lower,
    )
  ) {
    return false;
  }

  if (/(.)\1{4,}/.test(raw)) return true;
  if (
    /qwerty|asdfgh|zxcvbn|asdf|qwer|zxcv|hjkl|uiop|12345|asdfjkl/i.test(lower)
  ) {
    return true;
  }

  const letters = lower.replace(/[^a-z]/g, "");
  const nonWord = raw.replace(/[a-zA-Z0-9\s'?.!,]/g, "");
  if (
    raw.length >= 3 &&
    nonWord.length / raw.length > 0.45 &&
    letters.length < 4
  ) {
    return true;
  }

  const tokens = lower.split(/[^a-z0-9']+/).filter(Boolean);
  function looksLikeWord(t) {
    if (t.length < 2 || t.length > 24) return false;
    if (!/[aeiouy]/.test(t)) return false;
    if (/(.)\1{3,}/.test(t)) return false;
    if (/[bcdfghjklmnpqrstvwxz]{5,}/.test(t)) return false;
    return true;
  }
  const realish = tokens.filter(looksLikeWord);
  const vowels = (letters.match(/[aeiouy]/g) || []).length;
  const vowelRatio = letters.length ? vowels / letters.length : 0;

  if (!letters.length && raw.length >= 2) return true;
  if (tokens.length <= 1 && letters.length >= 6 && vowelRatio < 0.3) return true;
  if (letters.length >= 6 && realish.length === 0) return true;
  if (
    tokens.length >= 2 &&
    letters.length >= 8 &&
    realish.length / tokens.length < 0.3
  ) {
    return true;
  }
  if (letters.length >= 10 && vowelRatio < 0.18) return true;
  return false;
}

function gibberishReply() {
  return "I didn't catch that. Try it in plain words — about you, the chart, or whatever you meant.";
}

module.exports = { isGibberishPrompt, gibberishReply };
