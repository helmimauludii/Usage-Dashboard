#!/usr/bin/env python3
"""Download Akamai scheduled-report CSV attachments from an IMAP mailbox.

Required environment variables:
  AKAMAI_IMAP_HOST
  AKAMAI_IMAP_USER
  AKAMAI_IMAP_PASSWORD

Optional environment variables:
  AKAMAI_IMAP_PORT            default: 993
  AKAMAI_IMAP_MAILBOX         default: INBOX
  AKAMAI_MAIL_SUBJECT_FILTER  default: Daily Usage Komdigi
  AKAMAI_SEARCH_SINCE_DAYS    default: 3
"""

from __future__ import annotations

import argparse
import datetime as dt
import email
import imaplib
import os
import re
import sys
from email.header import decode_header
from pathlib import Path


def env(name: str, default: str | None = None) -> str:
    value = os.environ.get(name)
    if value is None or value == "":
        value = default
    if value is None or value == "":
        raise SystemExit(f"Missing required environment variable: {name}")
    return value


def compact_secret(value: str) -> str:
    return "".join(value.split())


def decode_filename(value: str | None) -> str:
    if not value:
        return ""
    decoded = []
    for part, encoding in decode_header(value):
        if isinstance(part, bytes):
            decoded.append(part.decode(encoding or "utf-8", errors="replace"))
        else:
            decoded.append(part)
    return "".join(decoded)


def safe_filename(filename: str) -> str:
    return re.sub(r"[/\\\0]", "_", filename).strip()


def report_date_from_name(filename: str) -> str:
    match = re.search(r"(\d{4}-\d{2}-\d{2})", filename)
    if match:
        return match.group(1)
    return dt.date.today().isoformat()


def csv_kind(filename: str) -> str | None:
    lowered = filename.lower()
    if not lowered.endswith(".csv"):
        return None
    if "summary" in lowered:
        return "summary"
    if "daily usage" in lowered or "daily-usage" in lowered:
        return "daily"
    if "cp code" in lowered or "cp-code" in lowered:
        return "cp-code"
    return None


def search_messages(client: imaplib.IMAP4_SSL, subject_filter: str, since_days: int) -> list[bytes]:
    since_date = (dt.date.today() - dt.timedelta(days=since_days)).strftime("%d-%b-%Y")
    criteria = f'(SINCE "{since_date}" SUBJECT "{subject_filter}")'
    status, data = client.search(None, criteria)
    if status != "OK":
        raise RuntimeError(f"IMAP search failed: {status}")
    return data[0].split()


def fetch_message(client: imaplib.IMAP4_SSL, msg_id: bytes) -> email.message.Message:
    status, data = client.fetch(msg_id, "(RFC822)")
    if status != "OK":
        raise RuntimeError(f"IMAP fetch failed for message {msg_id!r}: {status}")
    return email.message_from_bytes(data[0][1])


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-root", default="data/raw", help="Root folder for dated raw attachment folders")
    args = parser.parse_args()

    host = env("AKAMAI_IMAP_HOST")
    port = int(env("AKAMAI_IMAP_PORT", "993"))
    user = env("AKAMAI_IMAP_USER")
    password = compact_secret(env("AKAMAI_IMAP_PASSWORD"))
    mailbox = env("AKAMAI_IMAP_MAILBOX", "INBOX")
    subject_filter = env("AKAMAI_MAIL_SUBJECT_FILTER", "Daily Usage Komdigi")
    since_days = int(env("AKAMAI_SEARCH_SINCE_DAYS", "3"))

    downloaded: dict[str, Path] = {}

    with imaplib.IMAP4_SSL(host, port) as client:
        client.login(user, password)
        client.select(mailbox)
        message_ids = search_messages(client, subject_filter, since_days)

        for msg_id in reversed(message_ids):
            message = fetch_message(client, msg_id)

            for part in message.walk():
                if part.get_content_maintype() == "multipart":
                    continue

                filename = safe_filename(decode_filename(part.get_filename()))
                kind = csv_kind(filename)
                if not filename or kind is None or kind in downloaded:
                    continue

                payload = part.get_payload(decode=True)
                if not payload:
                    continue

                report_date = report_date_from_name(filename)
                out_dir = Path(args.out_root) / report_date
                out_dir.mkdir(parents=True, exist_ok=True)
                out_path = out_dir / filename
                out_path.write_bytes(payload)
                downloaded[kind] = out_path

            if {"summary", "daily", "cp-code"}.issubset(downloaded):
                break

    missing = {"summary", "daily", "cp-code"} - set(downloaded)
    if missing:
        print(f"Missing required Akamai attachment(s): {', '.join(sorted(missing))}", file=sys.stderr)
        return 1

    github_output = os.environ.get("GITHUB_OUTPUT")
    lines = [f"{key}={path}" for key, path in sorted(downloaded.items())]
    if github_output:
        with open(github_output, "a", encoding="utf-8") as handle:
            for line in lines:
                handle.write(f"{line}\n")
    else:
        for line in lines:
            print(line)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
