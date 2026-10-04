"""Regression checks for future content updates; no network or browser required."""
import copy
import importlib.util
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]

class StudioContractTest(unittest.TestCase):
    def setUp(self):
        self.assertTrue((ROOT/'scripts/sync_studio.py').exists(), 'Shared studio synchronizer must exist')
        spec=importlib.util.spec_from_file_location('studio', ROOT/'scripts/sync_studio.py')
        self.module=importlib.util.module_from_spec(spec);spec.loader.exec_module(self.module)

    def test_new_work_updates_catalogue_count_and_home_consistently(self):
        data=self.module.load_works(ROOT)
        item=copy.deepcopy(data[-1]);item.update(id='future-work', title='新作 & 試作', featured=True)
        data.append(item)
        catalogue=self.module.render_cards(ROOT,data,False)
        home=self.module.render_cards(ROOT,data,True)
        self.assertIn('新作 &amp; 試作',catalogue)
        self.assertIn('新作 &amp; 試作',home)
        self.assertEqual(catalogue.count('data-work-id='),len(data))

    def test_article_body_is_preserved_and_sync_is_idempotent(self):
        path=ROOT/'investment/weekly/2026-10-03/index.html'
        source=path.read_text(encoding='utf-8')
        body=source.split('<article class="investment-article">')[1].split('</article>')[0]
        result=self.module.sync_page(ROOT,path,source)
        import re
        result_body=result.split('<article class="investment-article">')[1].split('</article>')[0]
        # The only permitted article-body markup change is table accessibility attributes.
        self.assertEqual(re.sub(r'<table\b[^>]*>','<table>',body),re.sub(r'<table\b[^>]*>','<table>',result_body))
        self.assertTrue(all('tabindex="0"' in tag for tag in re.findall(r'<table\b[^>]*>',result_body)))
        self.assertIn('studio-article',result)
        self.assertIn('UCqehwrFtFnoELNDt6xOuNPA',result)
        self.assertEqual(result,self.module.sync_page(ROOT,path,result))

    def test_duplicate_id_and_unsafe_url_are_rejected(self):
        data=self.module.load_works(ROOT)
        with self.assertRaises(ValueError):self.module.validate_works(data+[data[0]])
        data[0]['href']='javascript:alert(1)'
        with self.assertRaises(ValueError):self.module.validate_works(data)

    def test_missing_chrome_fails_and_extra_header_class_is_normalized(self):
        path=ROOT/'about/index.html';source=path.read_text(encoding='utf-8')
        import re
        missing=re.sub(r'<header class="site-header">.*?</header>','',source,flags=re.S)
        with self.assertRaises(ValueError):self.module.sync_page(ROOT,path,missing)
        variant=source.replace('class="site-header"','class="site-header extra"')
        self.assertIn('<header class="site-header">',self.module.sync_page(ROOT,path,variant))

    def test_article_body_attributes_survive(self):
        path=ROOT/'investment/weekly/2026-10-03/index.html'
        import re
        source=re.sub(r'<body[^>]*>','<body class="special-report" id="report" data-mode="long" dir="ltr">',path.read_text(encoding='utf-8'),count=1)
        result=self.module.sync_page(ROOT,path,source)
        self.assertIn('special-report',result)
        self.assertIn('id="report" data-mode="long" dir="ltr"',result)
        self.assertEqual(result,self.module.sync_page(ROOT,path,result))

if __name__=='__main__':unittest.main()
