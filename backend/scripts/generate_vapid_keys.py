"""One-off script: generate a VAPID key pair for Web Push.

Run with `uv run python scripts/generate_vapid_keys.py` and copy the output
into backend/.env (VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY) and the frontend's
NEXT_PUBLIC_VAPID_PUBLIC_KEY (same public key value). Re-running invalidates
any existing browser push subscriptions (they're tied to the public key that
created them).

Both keys are raw, base64url-encoded values (no PEM headers) — this is the
format py_vapid's Vapid.from_string()/from_raw() expect, and what pywebpush
uses under the hood when sending a push.
"""

import base64

from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from py_vapid import Vapid

v = Vapid()
v.generate_keys()

priv_int = v.private_key.private_numbers().private_value
priv_b64 = base64.urlsafe_b64encode(priv_int.to_bytes(32, "big")).rstrip(b"=").decode()

raw_public = v.public_key.public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
public_b64 = base64.urlsafe_b64encode(raw_public).rstrip(b"=").decode()

print(f"VAPID_PRIVATE_KEY={priv_b64}")
print(f"VAPID_PUBLIC_KEY={public_b64}")
