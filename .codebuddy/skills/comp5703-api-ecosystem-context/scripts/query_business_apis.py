"""Query the COMP5703 business_apis table on Supabase.

Usage:
    python query_business_apis.py [--token-file PATH] [--count-only]

Reads the PAT from a token file (default: .local/supabase-token.md relative to
the workspace), exchanges it for the project service_role key via the
Management API, then queries PostgREST.

A browser User-Agent is REQUIRED, otherwise Cloudflare returns 403 (error 1010).
"""

import argparse
import json
import re
import sys
import urllib.request

REF = "imwptiicwdzjyawpysss"
MGMT = "https://api.supabase.com/v1"
REST = f"https://{REF}.supabase.co/rest/v1/"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)


def request(url, headers):
    h = {"User-Agent": UA, "Accept": "application/json"}
    h.update(headers)
    req = urllib.request.Request(url, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, dict(r.headers), r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read().decode("utf-8", "replace")


def read_token(path):
    with open(path, encoding="utf-8") as f:
        text = f.read()
    m = re.search(r"sbp_[0-9a-f]+", text)
    if not m:
        sys.exit(f"PAT not found in {path}")
    return m.group(0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--token-file", default=".local/supabase-token.md")
    ap.add_argument("--count-only", action="store_true")
    args = ap.parse_args()

    token = read_token(args.token_file)

    status, _, body = request(
        f"{MGMT}/projects/{REF}/api-keys", {"Authorization": f"Bearer {token}"}
    )
    if status != 200:
        sys.exit(f"api-keys failed: {status} {body[:300]}")
    secret = next(k for k in json.loads(body) if k["name"] == "service_role")["api_key"]

    headers = {"apikey": secret, "Authorization": f"Bearer {secret}"}
    if args.count_only:
        headers.update({"Prefer": "count=exact", "Range": "0-0"})
        status, hdrs, _ = request(REST + "business_apis?select=id", headers)
        print(status, hdrs.get("content-range"))
        return

    status, hdrs, body = request(
        REST + "business_apis?select=*",
        {**headers, "Prefer": "count=exact", "Range": "0-99"},
    )
    print("status:", status, "| range:", hdrs.get("content-range"))
    rows = json.loads(body)
    print("rows:", len(rows))
    if rows:
        cols = list(rows[0].keys())
        print("columns:", len(cols))
        print(", ".join(cols))


if __name__ == "__main__":
    main()
