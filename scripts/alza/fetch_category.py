"""Alza.hu v2/products listing. Same request, retries, and pause as the verified category run.

Stdout is one JSON object per line. After each line the process waits for an "ok" ack on stdin
so the caller can store the page before the next HTTP request. Logs go to stderr.
"""
import json
import sys
import time
from datetime import datetime

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

from curl_cffi import requests

PAUSE_SECONDS = 1.25


class AccessBlocked(RuntimeError):
    """403, 429, or a body that is not JSON. The whole run stops, with no extra retry."""


def note(message):
    print(f"{datetime.now().astimezone().strftime('%H:%M:%S')} {message}", file=sys.stderr, flush=True)


def emit(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()
    ack = sys.stdin.readline()
    if ack == "":
        raise SystemExit(1)


def request_page(session, category_id, page):
    url = ("https://www.alza.hu/services/restservice.svc/v2/products"
           f"?categoryId={category_id}&country=HU")
    payload = {"filterParameters": {
        "id": category_id, "type": "CATEGORY", "typeId": 0,
        "orderBy": 5, "page": page, "availabilityType": 0,
        "selectedBranches": [], "sendPrices": False, "params": [],
        "producers": [], "useRatingThreshold": False,
    }}
    session.headers["Referer"] = f"https://www.alza.hu/{category_id}.htm"
    for attempt in range(3):
        started = time.perf_counter()
        try:
            response = session.post(url, json=payload, timeout=30)
        except Exception as exc:
            if attempt == 2:
                raise RuntimeError(f"Mrežna greška: {exc}") from exc
            note(f"  Mrežna greška na stranici {page}; pokušaj {attempt + 2}/3")
            time.sleep(3 * (attempt + 1))
            continue
        elapsed = time.perf_counter() - started
        content_type = response.headers.get("content-type", "")
        if response.status_code in (403, 429) or "json" not in content_type.lower():
            raise AccessBlocked(
                f"HTTP {response.status_code}, {content_type}; moguće ograničenje pristupa. "
                "Zaustavljeno bez novih pokušaja."
            )
        if response.status_code >= 500 and attempt < 2:
            note(f"  HTTP {response.status_code} na stranici {page}; pokušaj {attempt + 2}/3")
            time.sleep(3 * (attempt + 1))
            continue
        response.raise_for_status()
        data = response.json()
        if data.get("err") != 0 or data.get("countryID") != 10:
            raise RuntimeError(f"Neispravan odgovor: err={data.get('err')}, countryID={data.get('countryID')}")
        if not isinstance(data.get("data"), list) or data.get("data_cnt") != len(data["data"]):
            raise RuntimeError("Nedostaje lista proizvoda ili se data_cnt ne podudara")
        time.sleep(PAUSE_SECONDS)
        return data, f"HTTP 200 {elapsed:.2f}s"
    raise RuntimeError("Nije dobijen uspješan odgovor")


def product_row(product, category_id, page):
    values = (product.get("analytics") or {}).get("actions", {}).get("onClick", {}).get("reportAction", {}).get("value", [])
    brand = next((v.get("value") for v in values if v.get("name") == "item_brand"), None)
    return {
        "alza_id": product["id"],
        "code": product.get("code"),
        "name": product.get("name"),
        "price_huf": (product.get("priceInfo") or {}).get("priceNoCurrency"),
        "currency": "HUF",
        "availability": product.get("avail"),
        "can_buy": product.get("can_buy"),
        "url": product.get("url"),
        "image_url": product.get("img"),
        "category_id": category_id,
        "manufacturer": brand,
        "supplier_code": None if product.get("supplierCode") is None else str(product.get("supplierCode")),
        "variant_type": product.get("variant_type"),
        "source_page": page,
    }


def fetch_category(session, category_id):
    products = {}
    name = ""
    pages = 0
    try:
        for page in range(1, 10001):
            data, source = request_page(session, category_id, page)
            if not name:
                breadcrumbs = data.get("breadcrumbs") or []
                name = (breadcrumbs[-1].get("category") or {}).get("name", "") if breadcrumbs else ""
            new = 0
            rows = []
            for item in data["data"]:
                if item["id"] not in products:
                    new += 1
                row = product_row(item, category_id, page)
                products[item["id"]] = row
                rows.append(row)
            pages = page
            emit({
                "type": "page",
                "category_id": category_id,
                "name": name,
                "page": page,
                "count": len(data["data"]),
                "new_ids": new,
                "total": data["total"],
                "has_next": data["has_next"],
                "source": source,
                "products": rows,
            })
            note(f"  str. {page} | +{new} | ukupno {len(products)} / prijavljeno {data['total']} | {source}")
            if not data["has_next"]:
                emit({
                    "type": "category_done",
                    "category_id": category_id,
                    "name": name,
                    "complete": True,
                    "pages": pages,
                    "unique_products": len(products),
                })
                return True
            if new == 0:
                raise RuntimeError("Stranica ne dodaje nove proizvode")
        raise RuntimeError("Dostignut zaštitni limit testnog ciklusa")
    except AccessBlocked as exc:
        message = str(exc)
        note(f"  STOP: {message}")
        emit({
            "type": "error",
            "category_id": category_id,
            "name": name,
            "message": message,
            "blocked": True,
            "pages": pages,
            "unique_products": len(products),
        })
        raise
    except Exception as exc:
        message = str(exc)
        note(f"  STOP: {message}")
        emit({
            "type": "error",
            "category_id": category_id,
            "name": name,
            "message": message,
            "blocked": False,
            "pages": pages,
            "unique_products": len(products),
        })
        return False


def main():
    if len(sys.argv) < 2:
        note("Nedostaje category id")
        return 1
    category_ids = []
    for raw in sys.argv[1:]:
        category_ids.append(int(raw))
    session = requests.Session(impersonate="chrome", headers={
        "Accept": "application/json",
        "Accept-Language": "hu-HU,hu;q=0.9,en;q=0.8",
        "Origin": "https://www.alza.hu",
    })
    note(f"POČETAK: {len(category_ids)} kategorija; pauza {PAUSE_SECONDS}s između HTTP zahtjeva")
    complete_count = 0
    try:
        for index, category_id in enumerate(category_ids, 1):
            note(f"KATEGORIJA {index}/{len(category_ids)} ID={category_id}")
            if fetch_category(session, category_id):
                complete_count += 1
    except AccessBlocked:
        session.close()
        return 2
    session.close()
    note(f"KRAJ: {complete_count}/{len(category_ids)} kategorija potpuno")
    return 0 if complete_count == len(category_ids) else 1


if __name__ == "__main__":
    sys.exit(main())
