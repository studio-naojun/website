import importlib.util
import json
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import URLError, HTTPError

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
try:
    import social_publish as p
except ModuleNotFoundError:
    p=None

class PublicationTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(p, 'independent resumable publisher is not implemented')
        self.now=datetime(2026,10,30,9,tzinfo=timezone.utc)
        self.item={'id':'test-ametsuta-v1','url':'https://naojun.jp/works/ametsuta/', 'text':'A small free browser game.', 'title':'Ametsuta','topic':'game'}

    def test_deterministic_key_and_canonical_identity(self):
        self.assertEqual(p.record_key(self.item),p.record_key(dict(self.item)))
        self.assertEqual(p.canonical('https://naojun.jp/works/ametsuta/?utm_source=bluesky#x'),'https://naojun.jp/works/ametsuta/')
        self.assertNotEqual(p.record_key(self.item),p.record_key({**self.item,'id':'different'}))

    def test_jst_daily_limit_and_short_retry_not_new_post(self):
        history=[{'createdAt':'2026-10-29T16:00:00Z'}, {'createdAt':'2026-10-30T00:00:00Z'}, {'createdAt':'2026-10-30T04:00:00Z'}]
        self.assertFalse(p.publication_slot(history,self.now,3,4))
        self.assertTrue(p.publication_slot(history[:1],self.now,3,4))
        self.assertFalse(p.publication_slot([{'createdAt':'2026-10-30T08:00:00Z'}],self.now,3,4))

    def test_same_owned_page_is_not_reannounced_from_legacy_post(self):
        records=[{'value':{'text':'Already live https://naojun.jp/works/ametsuta/?utm_source=old', 'createdAt':'2026-10-29T16:00:00Z'},'uri':'at://did/x/old'}]
        pending=p.select_pending([self.item],records,self.now)
        self.assertEqual(pending,[])

    def test_no_false_future_or_expired_campaign(self):
        items=[{**self.item,'not_before':'2026-11-01T00:00:00Z'}, {**self.item,'id':'expired','expires_at':'2026-10-20T00:00:00Z'},self.item]
        self.assertEqual(p.select_pending(items,[],self.now),[self.item])

    def test_record_uses_tagged_url_and_utf8_facet(self):
        record=p.make_record(self.item,self.now)
        self.assertIn('utm_source=bluesky',record['embed']['external']['uri'])
        a=record['facets'][0]['index']; raw=record['text'].encode()
        self.assertEqual(raw[a['byteStart']:a['byteEnd']].decode(),record['facets'][0]['features'][0]['uri'])
        self.assertLessEqual(len(record['text']),300)
        self.assertNotIn('reply',record)

    def test_reconcile_response_loss_without_duplicate_write(self):
        state={'writes':0,'record':None}
        def fake(endpoint,payload=None,token=None):
            if 'getRecord' in endpoint:
                if state['record'] is None: raise p.RecordMissing()
                return {'uri':'at://did:plc:test/app.bsky.feed.post/key','value':state['record']}
            if endpoint.endswith('createRecord'):
                state['writes']+=1; state['record']=payload['record']; raise URLError('lost response')
            raise AssertionError(endpoint)
        client=p.Client('https://example.invalid',request=fake)
        result=p.publish_one(client,'token','did:plc:test',self.item,self.now,sleeper=lambda _:None)
        self.assertEqual(result['status'],'reconciled')
        self.assertEqual(state['writes'],1)

    def test_existing_deterministic_post_does_not_write(self):
        def fake(endpoint,payload=None,token=None):
            if 'getRecord' in endpoint:return {'uri':'at://did/x/k','value':{'text':'previous'}}
            raise AssertionError('unexpected write')
        result=p.publish_one(p.Client('https://example.invalid',request=fake),'t','did:plc:test',self.item,self.now,sleeper=lambda _:None)
        self.assertEqual(result['status'],'already_published')

    def test_never_claim_published_without_readback(self):
        def fake(endpoint,payload=None,token=None):
            if 'getRecord' in endpoint:raise p.RecordMissing()
            return {'uri':'at://did/x/k'}
        with self.assertRaises(p.PublicationUncertain):
            p.publish_one(p.Client('https://example.invalid',request=fake),'t','did:plc:test',self.item,self.now,sleeper=lambda _:None)

    def test_explicit_write_denial_is_not_retried(self):
        calls=[]
        def fake(endpoint,payload=None,token=None):
            calls.append(endpoint)
            if 'getRecord' in endpoint: raise p.RecordMissing()
            raise HTTPError(endpoint,403,'Forbidden',{},None)
        with self.assertRaises(HTTPError):
            p.publish_one(p.Client('https://example.invalid',request=fake),'t','did:plc:test',self.item,self.now,sleeper=lambda _:None)
        self.assertEqual(len(calls),2)

    def test_missing_credentials_are_not_a_green_success(self):
        self.assertEqual(p.main(['--dry-run'],environ={},root=ROOT),0)
        self.assertEqual(p.main([],environ={},root=ROOT),2)

    def test_unowned_url_and_at_mentions_rejected(self):
        self.assertFalse(p.valid_item({**self.item,'url':'https://unknown.example/'}))
        self.assertFalse(p.valid_item({**self.item,'text':'@someone.example Try this'}))
        self.assertTrue(p.valid_item(self.item))

if __name__=='__main__':unittest.main()
