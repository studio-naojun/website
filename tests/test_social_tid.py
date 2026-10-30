"""Regression for production rejection of a non-TID Bluesky post record key."""
import sys
import unittest
from pathlib import Path
from datetime import datetime, timezone
from urllib.error import HTTPError
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import social_publish as p

class ProtocolRegression(unittest.TestCase):
    def test_key_has_official_tid_format_and_campaign_date(self):
        item={'id':'ametsuta-play-20261030','url':'https://naojun.jp/works/ametsuta/','title':'Ametsuta','text':'Free game'}
        key=p.record_key(item)
        self.assertRegex(key,r'^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$')
        self.assertEqual(key,p.record_key(dict(item)))
        alphabet='234567abcdefghijklmnopqrstuvwxyz'; value=0
        for ch in key:value=(value<<5)|alphabet.index(ch)
        stamp=(value>>10)/1000000
        self.assertGreaterEqual(stamp,datetime(2026,10,29,15,tzinfo=timezone.utc).timestamp())
        self.assertLess(stamp,datetime(2026,10,30,15,tzinfo=timezone.utc).timestamp())
    def test_definite_400_is_not_disguised_as_transport_uncertainty(self):
        calls=[]
        def fake(endpoint,payload=None,token=None):
            calls.append(endpoint)
            if 'getRecord' in endpoint:raise p.RecordMissing()
            raise HTTPError(endpoint,400,'Bad Request',{},None)
        with self.assertRaises(HTTPError):
            p.publish_one(p.Client('https://example.invalid',request=fake),'t','did:plc:test',{'id':'x','url':'https://naojun.jp/','title':'X','text':'X'},datetime.now(timezone.utc),sleeper=lambda _:None)
        self.assertEqual(len(calls),2)
if __name__=='__main__':unittest.main()
