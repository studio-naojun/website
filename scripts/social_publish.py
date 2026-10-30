"""Owned Bluesky broadcasts: persistent identity, bounded delivery, hourly recovery.

No replies, mentions, follows, likes, paid APIs, or third-party credentials.
The PDS record is the durable publication receipt; a lost response never
causes an unkeyed second post. Human traffic is not inferred from post counts.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PDS = 'https://bsky.social'
OWNER_DID = 'did:plc:i7bmtrkfyadjjakfdsqdjwqv'
COLLECTION = 'app.bsky.feed.post'
JST = timezone(timedelta(hours=9))
MAX_DAILY = 3
MIN_GAP_HOURS = 4


class RecordMissing(Exception):
    pass


class PublicationUncertain(Exception):
    pass


def dt(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=JST)


def canonical(url: str) -> str:
    parts = urllib.parse.urlsplit(url.rstrip('.,);'))
    return urllib.parse.urlunsplit((parts.scheme.lower(), parts.netloc.lower(), parts.path or '/', '', ''))


def record_key(item: dict) -> str:
    identity = str(item['id']) + '\n' + canonical(item['url'])
    return 'nj-' + hashlib.sha256(identity.encode('utf-8')).hexdigest()[:32]


def valid_item(item: dict) -> bool:
    try:
        url = urllib.parse.urlsplit(item['url'])
        text = str(item['text']).strip()
        return bool(item['id'] and item.get('title') and text and
                    url.scheme == 'https' and url.netloc == 'naojun.jp' and
                    not url.username and not re.search(r'@[\w.-]+', text) and
                    '\ufffd' not in text and '????' not in text and
                    len(str(item['id'])) <= 120)
    except (KeyError, TypeError, ValueError):
        return False


def history_values(records: list[dict]) -> list[dict]:
    return [r.get('value', r) for r in records]


def publication_slot(history: list[dict], now: datetime, maximum=MAX_DAILY, gap=MIN_GAP_HOURS) -> bool:
    times = []
    for value in history_values(history):
        try:
            times.append(dt(value['createdAt']))
        except (KeyError, TypeError, ValueError):
            continue
    today = now.astimezone(JST).date()
    daily = sum(t.astimezone(JST).date() == today for t in times)
    return daily < maximum and (not times or now - max(times) >= timedelta(hours=gap))


def select_pending(items: list[dict], records: list[dict], now: datetime) -> list[dict]:
    seen_urls, seen_keys = set(), set()
    for row in records:
        seen_keys.add(str(row.get('uri', '')).rsplit('/', 1)[-1])
        value = row.get('value', row)
        urls = re.findall(r'https?://[^\s<>]+', str(value.get('text', '')))
        external = value.get('embed', {}).get('external', {})
        if external.get('uri'):
            urls.append(external['uri'])
        for facet in value.get('facets', []):
            urls.extend(f.get('uri', '') for f in facet.get('features', []) if f.get('uri'))
        seen_urls.update(canonical(url) for url in urls)
    pending, ids = [], set()
    for item in items:
        if not valid_item(item) or item['id'] in ids:
            continue
        try:
            if item.get('not_before') and dt(item['not_before']) > now:
                continue
            if item.get('expires_at') and dt(item['expires_at']) <= now:
                continue
        except ValueError:
            continue
        if record_key(item) in seen_keys or canonical(item['url']) in seen_urls:
            continue
        ids.add(item['id'])
        pending.append(item)
    return sorted(pending, key=lambda x: (int(x.get('priority', 50)), x.get('published_at', '')), reverse=True)


def make_record(item: dict, now: datetime) -> dict:
    if not valid_item(item):
        raise ValueError('invalid owned publication item')
    parts = urllib.parse.urlsplit(canonical(item['url']))
    query = urllib.parse.urlencode({'utm_source': 'bluesky', 'utm_medium': 'organic_social', 'utm_campaign': item['id']})
    url = urllib.parse.urlunsplit(parts._replace(query=query))
    room = 300 - len(url) - 2
    if room < 30:
        raise ValueError('campaign URL leaves insufficient room')
    copy = str(item['text']).strip()
    if len(copy) > room:
        copy = copy[:room - 1].rstrip() + '\u2026'
    text = copy + '\n\n' + url
    start = len((copy + '\n\n').encode('utf-8'))
    return {'$type': COLLECTION, 'text': text, 'langs': ['ja'],
            'facets': [{'index': {'byteStart': start, 'byteEnd': len(text.encode('utf-8'))},
                        'features': [{'$type': 'app.bsky.richtext.facet#link', 'uri': url}]}],
            'embed': {'$type': 'app.bsky.embed.external', 'external': {'uri': url, 'title': item['title'], 'description': copy}},
            'createdAt': now.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')}


def request_json(url: str, payload=None, token=None) -> dict:
    headers = {'User-Agent': 'NAOJUN-Publisher/2.0', 'Accept': 'application/json'}
    data = None
    if payload is not None:
        headers['Content-Type'] = 'application/json'
        data = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(url, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as exc:
        body = exc.read(2048)
        if 'getRecord?' in url and exc.code in (400, 404):
            try:
                error = json.loads(body).get('error')
            except (ValueError, AttributeError):
                error = None
            if error in ('RecordNotFound', 'NotFound'):
                raise RecordMissing() from None
        raise


class Client:
    def __init__(self, pds=PDS, request=request_json):
        self.pds, self.request = pds, request

    def get_record(self, did, key, token):
        query = urllib.parse.urlencode({'repo': did, 'collection': COLLECTION, 'rkey': key})
        return self.request(self.pds + '/xrpc/com.atproto.repo.getRecord?' + query, token=token)

    def history(self, did, token):
        rows, cursor, seen = [], None, set()
        for _ in range(20):
            params = {'repo': did, 'collection': COLLECTION, 'limit': 100}
            if cursor:
                params['cursor'] = cursor
            result = self.request(self.pds + '/xrpc/com.atproto.repo.listRecords?' + urllib.parse.urlencode(params), token=token)
            rows.extend(result.get('records', []))
            cursor = result.get('cursor')
            if not cursor:
                return rows
            if cursor in seen:
                raise RuntimeError('history cursor cycle')
            seen.add(cursor)
        raise RuntimeError('publication history incomplete; do not blindly repost')


def receipt(status, item, response):
    uri = response['uri']
    key = uri.rsplit('/', 1)[-1]
    return {'status': status, 'campaign': item['id'], 'uri': uri,
            'post_url': 'https://bsky.app/profile/naojun.jp/post/' + key,
            'landing_url': canonical(item['url'])}


def publish_one(client, token, did, item, now, sleeper=time.sleep):
    key = record_key(item)
    try:
        return receipt('already_published', item, client.get_record(did, key, token))
    except RecordMissing:
        pass
    record = make_record(item, now)
    payload = {'repo': did, 'collection': COLLECTION, 'rkey': key, 'record': record}
    uncertain = False
    try:
        client.request(client.pds + '/xrpc/com.atproto.repo.createRecord', payload, token)
    except urllib.error.HTTPError as exc:
        if exc.code in (401, 403):
            raise
        uncertain = True
    except (urllib.error.URLError, TimeoutError, ConnectionError):
        uncertain = True
    # A GET proves delivery; no blind reissue of a timed-out POST.
    for wait in (0, 2, 5):
        sleeper(wait)
        try:
            result = client.get_record(did, key, token)
            if result.get('value', {}).get('text') != record['text']:
                raise PublicationUncertain('stored record does not match the submitted text')
            return receipt('reconciled' if uncertain else 'published', item, result)
        except (RecordMissing, urllib.error.URLError, TimeoutError, ConnectionError):
            continue
    raise PublicationUncertain('post outcome unknown; next run reconciles the same deterministic record key')


def load_candidates(root, now):
    queue = root / 'content/social.json'
    items = json.loads(queue.read_text(encoding='utf-8')).get('items', []) if queue.exists() else []
    for section in ('admissions', 'investment', 'ai-dev'):
        path = root / section / 'feed.json'
        if not path.exists():
            continue
        entries = json.loads(path.read_text(encoding='utf-8')).get('entries', [])
        for row in entries:
            published = row.get('first_published_at', row.get('published_at', ''))
            try:
                if now - dt(published) > timedelta(days=7) or dt(published) > now:
                    continue
            except ValueError:
                continue
            relative = str(row.get('path', '')).strip('/')
            if not relative or '..' in relative.split('/'):
                continue
            title, summary = str(row.get('title', '')).strip(), str(row.get('summary', '')).strip()
            items.append({'id': section + '-' + str(row.get('id', relative.replace('/', '-'))),
                          'url': 'https://naojun.jp/' + section + '/' + relative + '/',
                          'title': title, 'text': title + '\n' + summary, 'topic': section,
                          'published_at': published, 'priority': 70})
    return items


def target_is_live(url):
    req = urllib.request.Request(canonical(url), method='HEAD', headers={'User-Agent': 'NAOJUN-Publisher-LiveCheck/2.0'})
    with urllib.request.urlopen(req, timeout=20) as response:
        return response.status == 200 and canonical(response.url) == canonical(url)


def write_result(result):
    path = Path(os.environ.get('NAOJUN_SOCIAL_RECEIPT', '/tmp/naojun-social-result.json'))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False))
    summary = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary, 'a', encoding='utf-8') as handle:
            handle.write('## NAOJUN distribution\n\n```json\n' + json.dumps(result, ensure_ascii=False, indent=2) + '\n```\n')


def main(argv=None, *, environ=None, root=ROOT):
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args(argv)
    env = os.environ if environ is None else environ
    now = datetime.now(timezone.utc)
    result = {'observed_at': now.isoformat(), 'goal': '100 estimated real visitors per JST day', 'published': [], 'traffic_effect': 'not_inferred'}
    try:
        items = load_candidates(root, now)
        if args.dry_run:
            result.update(status='dry_run', candidates=[{'id': i['id'], 'record': make_record(i, now)} for i in select_pending(items, [], now)])
            write_result(result)
            return 0
        handle, password = env.get('BSKY_HANDLE', ''), env.get('BSKY_APP_PASSWORD', '')
        if not handle or not password:
            result.update(status='needs_auth', reason='existing Bluesky credentials unavailable')
            write_result(result)
            return 2
        client = Client()
        session = client.request(PDS + '/xrpc/com.atproto.server.createSession', {'identifier': handle, 'password': password})
        if session.get('did') != OWNER_DID:
            raise ValueError('authenticated account is not the verified NAOJUN account')
        token = session['accessJwt']
        records = client.history(OWNER_DID, token)
        pending = select_pending(items, records, now)
        if not pending:
            result.update(status='up_to_date', pending=0)
        elif not 7 <= now.astimezone(JST).hour < 23 or not publication_slot(records, now):
            result.update(status='next_slot', pending=len(pending), maximum_daily=MAX_DAILY, minimum_gap_hours=MIN_GAP_HOURS)
        else:
            unavailable = []
            for item in pending:
                try:
                    if not target_is_live(item['url']):
                        unavailable.append(item['id']); continue
                except (urllib.error.URLError, TimeoutError):
                    unavailable.append(item['id']); continue
                result['published'].append(publish_one(client, token, OWNER_DID, item, now))
                break
            result.update(status='published' if result['published'] else 'targets_unavailable', pending=len(pending), unavailable=unavailable)
        write_result(result)
        return 1 if result['status'] == 'targets_unavailable' else 0
    except Exception as exc:
        result.update(status='delivery_pending', error_type=type(exc).__name__)
        if isinstance(exc, urllib.error.HTTPError):
            result['http_status'] = exc.code
        write_result(result)
        return 2 if isinstance(exc, urllib.error.HTTPError) and exc.code in (401, 403) else 1


if __name__ == '__main__':
    raise SystemExit(main())
