#!/usr/bin/env python3
"""
SHUTTLE SCRAPER — Runs as a GitHub Action
  - Reads EDONET_UID and EDONET_PW from GitHub Secrets
  - Logs in to えどねっと
  - Searches badminton slots for the 4 target halls
  - Saves results to slots_data.json (committed back to repo)
"""

import requests
import json
import os
import sys
import time
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from datetime import datetime, timezone

BASE_URL     = 'https://www.shisetsuyoyaku.city.edogawa.tokyo.jp'
HOME_URL     = BASE_URL + '/user/Home'
OUTPUT_FILE  = os.path.join(os.path.dirname(__file__), '..', 'slots_data.json')

TARGET_HALLS = [
    {'name': '臨海町コミュニティ会館', 'key': '臨海町'},
    {'name': '北葛西コミュニティ会館', 'key': '北葛西'},
    {'name': '西葛西コミュニティ会館', 'key': '西葛西'},
    {'name': '長島コミュニティ会館',   'key': '長島'},
]

# ── Helpers ──────────────────────────────────────────────────
def make_session():
    s = requests.Session()
    s.headers.update({
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                      'AppleWebKit/537.36 (KHTML, like Gecko) '
                      'Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ja,en-US;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    })
    return s

def get_hidden_fields(soup):
    hidden = {}
    for inp in soup.find_all('input', {'type': 'hidden'}):
        name = inp.get('name')
        if name:
            hidden[name] = inp.get('value', '')
    return hidden

def find_field(soup, field_type):
    for inp in soup.find_all('input'):
        if inp.get('type', '').lower() == field_type and inp.get('name'):
            return inp['name']
    return None

# ── Login ─────────────────────────────────────────────────────
def login(session, uid, pw):
    print(f'[scrape] Fetching home page…')
    r = session.get(HOME_URL, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, 'html.parser')

    hidden    = get_hidden_fields(soup)
    uid_field = find_field(soup, 'text')     or 'userId'
    pw_field  = find_field(soup, 'password') or 'password'

    # Find form action
    form = soup.find('form')
    action   = form.get('action', '') if form else ''
    post_url = urljoin(BASE_URL, action) if action else HOME_URL

    payload = {**hidden, uid_field: uid, pw_field: pw}

    # Add submit button if present
    submit = soup.find('input', {'type': 'submit'})
    if submit and submit.get('name'):
        payload[submit['name']] = submit.get('value', '')

    print(f'[scrape] Logging in as {uid}…')
    r2 = session.post(post_url, data=payload, timeout=30)
    r2.raise_for_status()

    soup2     = BeautifulSoup(r2.text, 'html.parser')
    page_text = soup2.get_text()

    if 'ログアウト' in page_text or 'マイメニュー' in page_text:
        print('[scrape] ✓ Login successful!')
        return session, soup2
    elif 'エラー' in page_text or 'error' in page_text.lower():
        raise Exception('Login failed — check EDONET_UID and EDONET_PW secrets')
    else:
        print('[scrape] ✓ Login response received (session active)')
        return session, soup2

# ── Search badminton slots ────────────────────────────────────
def search_slots(session, logged_in_soup):
    all_slots = []

    for hall in TARGET_HALLS:
        print(f'[scrape] Searching {hall["name"]}…')
        try:
            slots = search_hall_slots(session, hall)
            all_slots.extend(slots)
            print(f'[scrape]   → {len(slots)} slots found')
            time.sleep(1.0)  # polite delay
        except Exception as e:
            print(f'[scrape]   ⚠ Error for {hall["name"]}: {e}')

    return all_slots

def search_hall_slots(session, hall):
    slots = []

    # Step 1: Go back to home/search page
    r = session.get(HOME_URL, timeout=30)
    soup = BeautifulSoup(r.text, 'html.parser')
    hidden = get_hidden_fields(soup)

    # Step 2: Search by facility name using text input
    # The site has a 施設名から探す section
    search_payload = {
        **hidden,
        'facilityName': hall['key'],
    }

    # Look for a search button in the facility name section
    for btn in soup.find_all('input', {'type': 'submit'}):
        val = btn.get('value', '')
        if '検索' in val or 'search' in val.lower():
            if btn.get('name'):
                search_payload[btn['name']] = val
            break

    r2 = session.post(HOME_URL, data=search_payload, timeout=30)
    soup2 = BeautifulSoup(r2.text, 'html.parser')

    # Step 3: Look for facility in results and click it
    facility_links = []
    for a in soup2.find_all('a'):
        text = a.get_text(strip=True)
        if hall['key'] in text:
            facility_links.append(a)

    for a in soup2.find_all(['td', 'div', 'span', 'li']):
        text = a.get_text(strip=True)
        if hall['key'] in text and 'コミュニティ' in text:
            # Found the facility — try to find availability table nearby
            parent = a.find_parent('tr') or a.find_parent('div')
            if parent:
                cells = parent.find_all('td')
                row_text = [c.get_text(strip=True) for c in cells]
                if any(c in ['○', '×', '△'] for c in row_text):
                    available = row_text.count('○')
                    if available > 0:
                        slots.append({
                            'hall':       hall['name'],
                            'key':        hall['key'],
                            'info':       ' / '.join(t for t in row_text if t),
                            'available':  available,
                            'status':     'available',
                        })

    # Step 4: Parse availability grid if present
    tables = soup2.find_all('table')
    for table in tables:
        headers = [th.get_text(strip=True) for th in table.find_all('th')]
        for row in table.find_all('tr'):
            cells  = row.find_all('td')
            values = [c.get_text(strip=True) for c in cells]
            if not values:
                continue

            # Check if this row is about our hall
            row_text = ' '.join(values)
            if hall['key'] not in row_text and not any(hall['key'] in h for h in headers):
                continue

            for i, val in enumerate(values):
                if val == '○':  # available
                    header = headers[i] if i < len(headers) else f'Slot {i}'
                    slots.append({
                        'hall':      hall['name'],
                        'key':       hall['key'],
                        'info':      f'{header} — {" / ".join(v for v in values if v and v != "○")}',
                        'available': 1,
                        'status':    'available',
                    })

    # Deduplicate
    seen  = set()
    unique = []
    for s in slots:
        key = s['hall'] + s['info']
        if key not in seen:
            seen.add(key)
            unique.append(s)

    return unique

# ── Lottery application status ────────────────────────────────
def get_lottery_status(session):
    """Check current lottery applications from マイメニュー."""
    applications = []
    try:
        r = session.get(HOME_URL, timeout=30)
        soup = BeautifulSoup(r.text, 'html.parser')

        # Look for 抽選申込の確認 section
        for link in soup.find_all('a'):
            if '抽選' in link.get_text():
                href = link.get('href', '')
                if href:
                    r2 = session.get(urljoin(BASE_URL, href), timeout=30)
                    soup2 = BeautifulSoup(r2.text, 'html.parser')
                    tables = soup2.find_all('table')
                    for table in tables:
                        for row in table.find_all('tr'):
                            cells = [td.get_text(strip=True) for td in row.find_all('td')]
                            if cells and len(cells) >= 3:
                                applications.append({
                                    'info': ' / '.join(c for c in cells if c),
                                    'raw':  cells,
                                })
                    break
    except Exception as e:
        print(f'[scrape] ⚠ Could not fetch lottery status: {e}')

    return applications

# ── Save output ───────────────────────────────────────────────
def save_output(slots, applications, uid):
    now_utc = datetime.now(timezone.utc).isoformat()
    now_jst = datetime.now(timezone(timezone.utc.utcoffset(None)
                  if False else __import__('datetime').timezone(
                  __import__('datetime').timedelta(hours=9)))).strftime('%Y-%m-%d %H:%M JST')

    data = {
        'scraped_at':      now_utc,
        'scraped_at_jst':  now_jst,
        'user_id':         uid,
        'halls':           [h['name'] for h in TARGET_HALLS],
        'slots':           slots,
        'total_available': len(slots),
        'applications':    applications,
        'status':          'success',
    }

    out_path = os.path.abspath(OUTPUT_FILE)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f'[scrape] ✓ Saved {len(slots)} slots → {out_path}')
    return data

# ── Main ─────────────────────────────────────────────────────
def main():
    uid = os.environ.get('EDONET_UID', '').strip()
    pw  = os.environ.get('EDONET_PW',  '').strip()

    if not uid or not pw:
        print('[scrape] ✗ Missing EDONET_UID or EDONET_PW environment variables.')
        print('         Add them as GitHub Secrets in your repository settings.')
        sys.exit(1)

    print(f'[scrape] Starting Shuttle scraper — {datetime.now().strftime("%Y-%m-%d %H:%M")}')
    print(f'[scrape] Target halls: {", ".join(h["key"] for h in TARGET_HALLS)}')

    session = make_session()

    try:
        session, soup = login(session, uid, pw)
    except Exception as e:
        print(f'[scrape] ✗ Login error: {e}')
        sys.exit(1)

    slots        = search_slots(session, soup)
    applications = get_lottery_status(session)
    save_output(slots, applications, uid)

    print(f'[scrape] ✓ Done! {len(slots)} available slots found.')

if __name__ == '__main__':
    main()
