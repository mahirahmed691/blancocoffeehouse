/* House handles. Word.word, never a real name. */

var WORDS = [
  "amber",
  "beige",
  "bloom",
  "booth",
  "case",
  "cocoa",
  "cream",
  "crema",
  "drift",
  "dusk",
  "ember",
  "foam",
  "frost",
  "gelato",
  "gold",
  "grain",
  "grove",
  "hush",
  "karak",
  "latte",
  "linen",
  "loft",
  "marble",
  "matcha",
  "mist",
  "nook",
  "noon",
  "oat",
  "pale",
  "paper",
  "parade",
  "pour",
  "quiet",
  "river",
  "slow",
  "spice",
  "steam",
  "stone",
  "stool",
  "swirl",
  "veil",
  "warm"
];

function hash(str) {
  var h = 2166136261;
  var i;
  for (i = 0; i < String(str).length; i++) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function fromIndex(userId, index) {
  var h = hash(String(userId) + ":" + String(index));
  var a = WORDS[h % WORDS.length];
  var b = WORDS[(Math.floor(h / 17) + index + 3) % WORDS.length];
  if (a === b) b = WORDS[(h + 11) % WORDS.length];
  if (index % 5 === 4) return a + "." + String(10 + (h % 90));
  return a + "." + b;
}

function isValid(handle) {
  var value = String(handle || "").trim().toLowerCase();
  var match = value.match(/^([a-z]{3,10})\.([a-z]{3,10}|[0-9]{2,3})$/);
  if (!match) return false;
  if (WORDS.indexOf(match[1]) < 0) return false;
  if (/^[0-9]+$/.test(match[2])) return true;
  return WORDS.indexOf(match[2]) >= 0;
}

function suggestions(userId, taken, count) {
  var out = [];
  var seen = {};
  var i = 0;
  var n = count || 8;
  taken = taken || {};
  while (out.length < n && i < 200) {
    var next = fromIndex(userId, i);
    i += 1;
    if (seen[next] || taken[next]) continue;
    seen[next] = true;
    out.push(next);
  }
  return out;
}

async function ensure(sb, userId) {
  var existing = await sb(
    "/rest/v1/member_handles?clerk_user_id=eq." + encodeURIComponent(userId) + "&select=handle"
  );
  if (existing && existing[0] && existing[0].handle) return String(existing[0].handle);
  var i;
  for (i = 0; i < 80; i++) {
    var cand = fromIndex(userId, i);
    var clash = await sb(
      "/rest/v1/member_handles?handle=eq." + encodeURIComponent(cand) + "&select=handle"
    );
    if (clash && clash[0]) continue;
    try {
      await sb("/rest/v1/member_handles", {
        method: "POST",
        body: JSON.stringify({ clerk_user_id: userId, handle: cand })
      });
      return cand;
    } catch (err) {
      continue;
    }
  }
  return "oat." + String(10 + (Date.now() % 90));
}

module.exports = {
  WORDS: WORDS,
  fromIndex: fromIndex,
  isValid: isValid,
  suggestions: suggestions,
  ensure: ensure
};
