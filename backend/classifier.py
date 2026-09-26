"""Auto-tagging of free-text event descriptions.

NOTE: This is NOT a machine-learning model. It is a deliberately simple
keyword / regex classifier for the prototype: each event type has a list of
patterns, and the type with the most pattern hits wins. Replace with a real
text classifier once enough labelled historical reports exist.
"""
import re

KEYWORD_RULES = {
    "mud_loss": [r"lost circulation", r"mud loss", r"\blosses?\b", r"loss(es)? to formation", r"\bLCM\b", r"returns? (dropped|lost)"],
    "stuck_pipe": [r"\bstuck\b", r"pipe stuck", r"differential(ly)? stick", r"\bjarr(ed|ing)\b", r"unable to (pull|rotate)"],
    "kick": [r"\bkick\b", r"\binflux\b", r"gas show", r"shut[- ]?in", r"pit gain"],
    "tight_hole": [r"tight hole", r"\boverpull\b", r"\bream(ed|ing)?\b", r"\bdrag\b"],
    "twist_off": [r"twist[- ]?off", r"parted string", r"\bfish(ing)?\b"],
}


def classify(text: str):
    """Return (suggested_type, confidence 0..1, matched_keywords)."""
    text = text or ""
    best, best_hits, best_matches = "info", 0, []
    for event_type, patterns in KEYWORD_RULES.items():
        matches = [m.group(0) for p in patterns for m in [re.search(p, text, re.I)] if m]
        if len(matches) > best_hits:
            best, best_hits, best_matches = event_type, len(matches), matches
    confidence = 0.0 if best_hits == 0 else min(1.0, 0.5 + 0.25 * (best_hits - 1))
    return best, confidence, best_matches
