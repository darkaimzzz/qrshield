"""Hostname feature extraction. MUST stay identical to lib/engine/ml-features.ts.

tests/unit/ml-parity.test.ts checks the TypeScript implementation against vectors written by
train.py, so any divergence fails CI.
"""

from __future__ import annotations

import math
import re

ML_KEYWORDS = [
    "login", "signin", "verify", "account", "update", "secure", "security", "bank", "confirm",
    "password", "wallet", "support", "service", "billing", "payment", "auth", "webscr", "recover",
    "unlock", "alert", "free", "bonus", "gift", "claim", "online", "app", "web", "mail", "office",
    "help",
]

ML_TLDS = [
    "com", "org", "net", "de", "uk", "ru", "info", "io", "xyz", "top", "app", "dev", "ly", "me",
    "co", "in", "br", "jp", "fr", "au", "it", "nl", "pl", "ca", "es", "edu", "gov", "tk", "ml",
    "ga", "cf", "gq", "shop", "online", "site", "store", "live", "club", "vip", "cn",
]

VOWELS = set("aeiou")
_HOST_RE = re.compile(r"^[a-z][a-z0-9+.-]*://(?:[^@/?#]*@)?(\[[^\]]*\]|[^:/?#]*)", re.I)
_IPV4_RE = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")


def entropy(s: str) -> float:
    if not s:
        return 0.0
    counts: dict[str, int] = {}
    for ch in s:
        counts[ch] = counts.get(ch, 0) + 1
    h = 0.0
    for c in counts.values():
        p = c / len(s)
        h -= p * math.log2(p)
    return h


def ml_hostname(url: str) -> str | None:
    m = _HOST_RE.match(url.strip())
    if not m:
        return None
    host = m.group(1).lower()
    if host.endswith("."):
        host = host[:-1]
    if host.startswith("www."):
        host = host[4:]
    return host


def feature_names() -> list[str]:
    return [
        "host_length", "num_labels", "num_hyphens", "num_digits", "digit_ratio", "host_entropy",
        "longest_label", "mean_label", "tld_length", "is_ip", "has_punycode", "vowel_ratio",
        "max_consonant_run", "keyword_hits", "num_underscores", "hyphen_in_reg_label",
        "first_label_length", "repeated_char_max",
        *[f"tld_{t}" for t in ML_TLDS],
        "tld_other",
    ]


def extract_features(host: str) -> list[float]:
    labels = [l for l in host.split(".") if l]
    tld = labels[-1] if len(labels) > 1 else ""
    is_ip = 1 if (_IPV4_RE.match(host) or host.startswith("[")) else 0
    letters = [c for c in host if "a" <= c <= "z"]
    digits = sum(1 for c in host if "0" <= c <= "9")
    vowels = sum(1 for c in letters if c in VOWELS)

    max_run = run = max_repeat = repeat = 0
    prev = ""
    for c in host:
        if "a" <= c <= "z" and c not in VOWELS:
            run += 1
            max_run = max(max_run, run)
        else:
            run = 0
        repeat = repeat + 1 if c == prev else 1
        max_repeat = max(max_repeat, repeat)
        prev = c

    keyword_hits = sum(1 for k in ML_KEYWORDS if k in host)
    reg_label = labels[-2] if len(labels) >= 2 else (labels[0] if labels else "")
    label_lens = [len(l) for l in labels]

    return [
        float(len(host)),
        float(len(labels)),
        float(host.count("-")),
        float(digits),
        digits / len(host) if host else 0.0,
        entropy(host.replace(".", "")),
        float(max(label_lens)) if label_lens else 0.0,
        sum(label_lens) / len(label_lens) if label_lens else 0.0,
        float(len(tld)),
        float(is_ip),
        1.0 if "xn--" in host else 0.0,
        vowels / len(letters) if letters else 0.0,
        float(max_run),
        float(keyword_hits),
        float(host.count("_")),
        1.0 if "-" in reg_label else 0.0,
        float(len(labels[0])) if labels else 0.0,
        float(max_repeat),
        *[1.0 if tld == t else 0.0 for t in ML_TLDS],
        1.0 if (tld and tld not in ML_TLDS) else 0.0,
    ]
