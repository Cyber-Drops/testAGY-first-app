import time
import re
from datetime import datetime
import xml.etree.ElementTree as ET
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
BASE_DOCS_URL = "https://docs.cloud.google.com"

# Simple in-memory cache to avoid hammering the endpoint repeatedly on page loads
_CACHE = {
    "data": None,
    "last_fetched": 0,
    "ttl_seconds": 300  # 5 minutes
}


def sanitize_html(html_str):
    """Clean and enrich HTML: ensure target="_blank" and absolute URLs."""
    if not html_str:
        return ""
    soup = BeautifulSoup(html_str, "html.parser")
    for a in soup.find_all("a"):
        href = a.get("href", "")
        if href.startswith("/"):
            a["href"] = urljoin(BASE_DOCS_URL, href)
        a["target"] = "_blank"
        a["rel"] = "noopener noreferrer"
    return str(soup)


def extract_items_from_entry(entry_id, date_title, entry_link, content_html):
    """
    Splits entry HTML into individual update items based on h2/h3/h4 tags.
    If no headings exist, treats entire entry as a single item.
    """
    if not content_html:
        return [{
            "id": f"{entry_id}-0",
            "date": date_title,
            "type": "General",
            "link": entry_link,
            "html": "",
            "plain_text": ""
        }]

    soup = BeautifulSoup(content_html, "html.parser")
    headings = soup.find_all(["h2", "h3", "h4"])

    items = []
    if headings:
        for idx, heading in enumerate(headings):
            tag_type = heading.get_text(strip=True) or "Update"
            elem = heading.next_sibling
            body_parts = []
            while elem and elem not in headings:
                if getattr(elem, "name", None):
                    body_parts.append(str(elem))
                elif isinstance(elem, str) and elem.strip():
                    body_parts.append(f"<p>{elem.strip()}</p>")
                elem = elem.next_sibling

            raw_body_html = "".join(body_parts)
            clean_html = sanitize_html(raw_body_html)
            text_soup = BeautifulSoup(raw_body_html, "html.parser")
            plain_text = text_soup.get_text(separator=" ", strip=True)

            items.append({
                "id": f"{entry_id}-{idx}",
                "date": date_title,
                "type": tag_type,
                "link": entry_link,
                "html": clean_html,
                "plain_text": plain_text
            })
    else:
        clean_html = sanitize_html(content_html)
        text_soup = BeautifulSoup(content_html, "html.parser")
        plain_text = text_soup.get_text(separator=" ", strip=True)
        items.append({
            "id": f"{entry_id}-0",
            "date": date_title,
            "type": "Update",
            "link": entry_link,
            "html": clean_html,
            "plain_text": plain_text
        })

    return items


def fetch_and_parse_feed(force_refresh=False):
    """Fetches the BigQuery Atom feed and returns structured release data."""
    now = time.time()
    if not force_refresh and _CACHE["data"] and (now - _CACHE["last_fetched"] < _CACHE["ttl_seconds"]):
        return _CACHE["data"], False

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) BigQueryReleaseNotesViewer/1.0"
    }
    response = requests.get(FEED_URL, headers=headers, timeout=12)
    response.raise_for_status()

    root = ET.fromstring(response.content)
    ns = {"atom": "http://www.w3.org/2005/Atom"}

    feed_title = ""
    title_el = root.find("atom:title", ns)
    if title_el is not None and title_el.text:
        feed_title = title_el.text.strip()

    feed_updated = ""
    updated_el = root.find("atom:updated", ns)
    if updated_el is not None and updated_el.text:
        feed_updated = updated_el.text.strip()

    entries_data = []
    all_individual_items = []

    for entry_idx, entry in enumerate(root.findall("atom:entry", ns)):
        entry_title = ""
        t_el = entry.find("atom:title", ns)
        if t_el is not None and t_el.text:
            entry_title = t_el.text.strip()

        entry_link = ""
        link_el = entry.find("atom:link", ns)
        if link_el is not None:
            entry_link = link_el.attrib.get("href", "")

        entry_updated = ""
        up_el = entry.find("atom:updated", ns)
        if up_el is not None and up_el.text:
            entry_updated = up_el.text.strip()

        raw_id = ""
        id_el = entry.find("atom:id", ns)
        if id_el is not None and id_el.text:
            raw_id = id_el.text.strip()
        else:
            raw_id = f"entry-{entry_idx}"

        safe_entry_id = re.sub(r"[^a-zA-Z0-9_\-]", "_", raw_id)

        content_html = ""
        content_el = entry.find("atom:content", ns)
        if content_el is not None and content_el.text:
            content_html = content_el.text

        sub_items = extract_items_from_entry(safe_entry_id, entry_title, entry_link, content_html)
        all_individual_items.extend(sub_items)

        entries_data.append({
            "id": safe_entry_id,
            "title": entry_title,
            "link": entry_link,
            "updated": entry_updated,
            "items_count": len(sub_items),
            "items": sub_items
        })

    result = {
        "title": feed_title or "BigQuery Release Notes",
        "feed_url": FEED_URL,
        "feed_updated": feed_updated,
        "fetched_at": datetime.now().isoformat(),
        "entries_count": len(entries_data),
        "total_items_count": len(all_individual_items),
        "entries": entries_data,
        "items": all_individual_items
    }

    _CACHE["data"] = result
    _CACHE["last_fetched"] = now

    return result, True


@app.route("/")
def index():
    """Renders the single-page application interface."""
    return render_template("index.html")


@app.route("/api/releases")
def api_releases():
    """Returns release notes JSON data with support for forced refresh."""
    force = request.args.get("refresh", "").lower() in ("true", "1", "yes")
    try:
        data, is_fresh = fetch_and_parse_feed(force_refresh=force)
        return jsonify({
            "status": "success",
            "is_fresh": is_fresh,
            "data": data
        })
    except requests.RequestException as e:
        return jsonify({
            "status": "error",
            "message": f"Errore durante il recupero del feed BigQuery: {str(e)}"
        }), 502
    except ET.ParseError as e:
        return jsonify({
            "status": "error",
            "message": f"Errore nell'interpretazione XML del feed: {str(e)}"
        }), 500
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Si è verificato un errore inatteso: {str(e)}"
        }), 500


@app.route("/api/health")
def api_health():
    return jsonify({"status": "healthy", "service": "BigQuery Release Notes Viewer"})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
