window.STAY_ATLAS_CURATED = {
  version: 2,
  checkedAt: '2026-08-07',
  patches: [
    {
      match: { name_ja: 'ウォルドーフ・アストリア大阪' },
      patch: {
        name_en: 'Waldorf Astoria Osaka',
        city: '大阪市',
        status: 'open',
        opening_note: '営業中',
        official_url: 'https://www.hilton.com/en/hotels/osawawa-waldorf-astoria-osaka/',
        facilities: { pool: { raw: '〇 室内プール', available: true } }
      },
      verifications: {
        name_en: { label: '英語名', status: 'verified', source_label: 'Hilton official hotel page', source_url: 'https://www.hilton.com/en/hotels/osawawa-waldorf-astoria-osaka/', checked_at: '2026-08-07' },
        status: { label: '営業状態', status: 'verified', source_label: 'Hilton official hotel page', source_url: 'https://www.hilton.com/en/hotels/osawawa-waldorf-astoria-osaka/', checked_at: '2026-08-07', note: '公式ホテルページで営業中の施設情報・予約導線を確認。' },
        city: { label: '所在地', status: 'verified', source_label: 'Hilton official location page', source_url: 'https://www.hilton.com/en/hotels/osawawa-waldorf-astoria-osaka/hotel-location/', checked_at: '2026-08-07' },
        'facilities.pool': { label: 'プール', status: 'verified', source_label: 'Hilton official amenities page', source_url: 'https://www.hilton.com/en/hotels/osawawa-waldorf-astoria-osaka/amenities/', checked_at: '2026-08-07', note: 'Indoor Poolを確認。' }
      }
    },
    {
      match: { name_ja: 'キャノピーbyヒルトン沖縄宮古島リゾート' },
      patch: {
        name_en: 'Canopy by Hilton Okinawa Miyako Island Resort',
        city: '宮古島市',
        status: 'open',
        opening_note: '営業中',
        official_url: 'https://www.hilton.com/en/hotels/okapypy-canopy-okinawa-miyako-island-resort/',
        facilities: {
          pool: { raw: '〇 屋外プール', available: true },
          parking: { raw: '〇 セルフパーキング無料', has_info: true }
        }
      },
      verifications: {
        name_en: { label: '英語名', status: 'verified', source_label: 'Hilton official hotel page', source_url: 'https://www.hilton.com/en/hotels/okapypy-canopy-okinawa-miyako-island-resort/', checked_at: '2026-08-07' },
        status: { label: '営業状態', status: 'verified', source_label: 'Hilton official hotel page', source_url: 'https://www.hilton.com/en/hotels/okapypy-canopy-okinawa-miyako-island-resort/', checked_at: '2026-08-07', note: '公式ホテルページに客室・施設・連絡先・予約導線あり。' },
        city: { label: '所在地', status: 'verified', source_label: 'Hilton official location page', source_url: 'https://www.hilton.com/en/hotels/okapypy-canopy-okinawa-miyako-island-resort/hotel-location/', checked_at: '2026-08-07' },
        'facilities.pool': { label: 'プール', status: 'verified', source_label: 'Hilton official hotel page', source_url: 'https://www.hilton.com/en/hotels/okapypy-canopy-okinawa-miyako-island-resort/', checked_at: '2026-08-07', note: 'Outdoor poolを確認。' },
        'facilities.parking': { label: '駐車場', status: 'verified', source_label: 'Hilton official hotel info', source_url: 'https://www.hilton.com/en/hotels/okapypy-canopy-okinawa-miyako-island-resort/hotel-info/', checked_at: '2026-08-07', note: 'Self-parking complimentaryを確認。' }
      }
    },
    {
      match: { name_ja: 'ウォルドーフ・アストリア東京日本橋' },
      patch: {
        name_en: 'Waldorf Astoria Tokyo Nihonbashi',
        prefecture: '東京都',
        region: '関東',
        city: '中央区',
        status: 'planned',
        opening_note: '2027年開業予定'
      },
      verifications: {
        name_en: { label: '英語名', status: 'verified', source_label: 'Hilton Stories', source_url: 'https://stories.hilton.com/releases/hilton-luxury-growth-in-japan-signing-of-conrad-kobe', checked_at: '2026-08-07' },
        status: { label: '開業予定', status: 'verified', source_label: 'Hilton Stories (2026)', source_url: 'https://stories.hilton.com/releases/hilton-luxury-growth-in-japan-signing-of-conrad-kobe', checked_at: '2026-08-07', note: '2026年公開のHilton情報では2027年開業予定。旧表の2026年予定を更新。' },
        city: { label: '所在地', status: 'verified', source_label: 'Hilton Stories', source_url: 'https://stories.hilton.com/apac/releases/waldorf-astoria-to-make-japanese-debut-in-tokyo', checked_at: '2026-08-07' }
      }
    },
    {
      match: { name_ja: 'コンラッド横浜' },
      patch: {
        name_en: 'Conrad Yokohama',
        prefecture: '神奈川県',
        region: '関東',
        city: '横浜市',
        status: 'planned',
        opening_note: '2027年開業予定'
      },
      verifications: {
        name_en: { label: '英語名', status: 'verified', source_label: 'Hilton Stories', source_url: 'https://stories.hilton.com/releases/hilton-to-expand-luxury-portfolio-in-japan-with-conrad-yokohama', checked_at: '2026-08-07' },
        status: { label: '開業予定', status: 'verified', source_label: 'Hilton Stories', source_url: 'https://stories.hilton.com/releases/hilton-to-expand-luxury-portfolio-in-japan-with-conrad-yokohama', checked_at: '2026-08-07', note: '公式発表で2027年開業予定を確認。旧表の「2027年5月」の月まではこのSourceでは確認できないため月情報は採用しない。' },
        city: { label: '所在地', status: 'verified', source_label: 'Hilton Stories', source_url: 'https://stories.hilton.com/releases/hilton-to-expand-luxury-portfolio-in-japan-with-conrad-yokohama', checked_at: '2026-08-07' }
      }
    },
    {
      match: { name_ja: 'コンラッド名古屋' },
      patch: {
        name_en: 'Conrad Nagoya',
        prefecture: '愛知県',
        region: '中部',
        city: '名古屋市',
        status: 'planned',
        opening_note: '公式Hiltonでは2026-07-31以降予約受付。ただし検索一覧はComing Soon表示のため営業開始状態を再確認中。',
        official_url: 'https://www.hilton.com/en/hotels/ngocici-conrad-nagoya/',
        quality: 'needs_review',
        facilities: { lounge: { raw: '〇 Executive lounge', available: true }, pool: { raw: '〇 室内プール', available: true }, parking: { raw: '有料', has_info: true } }
      },
      verifications: {
        name_en: { label: '英語名', status: 'verified', source_label: 'Hilton official hotel page', source_url: 'https://www.hilton.com/en/hotels/ngocici-conrad-nagoya/', checked_at: '2026-08-07' },
        status: { label: '営業状態', status: 'conflicting', source_label: 'Hilton official location listing', source_url: 'https://www.hilton.com/en/locations/japan/nagoya/conrad-hotels/', checked_at: '2026-08-07', note: '2026-07-31以降の予約を受け付ける一方、Hilton検索一覧はComing Soon表示。営業中とは断定せず再確認対象とする。' },
        city: { label: '所在地', status: 'verified', source_label: 'Hilton official hotel page', source_url: 'https://www.hilton.com/en/hotels/ngocici-conrad-nagoya/', checked_at: '2026-08-07' },
        'facilities.lounge': { label: 'ラウンジ', status: 'verified', source_label: 'Hilton official hotel info', source_url: 'https://www.hilton.com/en/hotels/ngocici-conrad-nagoya/hotel-info/', checked_at: '2026-08-07' },
        'facilities.pool': { label: 'プール', status: 'verified', source_label: 'Hilton official hotel info', source_url: 'https://www.hilton.com/en/hotels/ngocici-conrad-nagoya/hotel-info/', checked_at: '2026-08-07' },
        'facilities.parking': { label: '駐車場', status: 'verified', source_label: 'Hilton official hotel info', source_url: 'https://www.hilton.com/en/hotels/ngocici-conrad-nagoya/hotel-info/', checked_at: '2026-08-07', note: 'Self-parking / valet parkingとも有料。' }
      }
    },
    {
      match: { name_ja: 'ヒルトン東京' },
      patch: {
        name_en: 'Hilton Tokyo',
        city: '新宿区',
        status: 'open',
        official_url: 'https://www.hilton.com/en/hotels/tyohitw-hilton-tokyo/',
        child: { raw: '6歳未満は添い寝無料（6歳以上は大人扱い）', allowed: true, rule_type: 'age_under', max_age: 5 },
        facilities: {
          lounge: { raw: '〇 Executive lounge', available: true },
          pool: { raw: '〇 室内プール', available: true },
          parking: { raw: '1泊1,500円', has_info: true }
        }
      },
      verifications: {
        name_en: { label: '英語名', status: 'verified', source_label: 'Hilton official hotel page', source_url: 'https://www.hilton.com/en/hotels/tyohitw-hilton-tokyo/', checked_at: '2026-08-07' },
        status: { label: '営業状態', status: 'verified', source_label: 'Hilton official hotel page', source_url: 'https://www.hilton.com/en/hotels/tyohitw-hilton-tokyo/', checked_at: '2026-08-07' },
        city: { label: '所在地', status: 'verified', source_label: 'Hilton official hotel page', source_url: 'https://www.hilton.com/en/hotels/tyohitw-hilton-tokyo/', checked_at: '2026-08-07' },
        'child.raw': { label: '添寝', status: 'verified', source_label: 'Hilton official hotel policy', source_url: 'https://www.hilton.com/en/hotels/tyohitw-hilton-tokyo/', checked_at: '2026-08-07', note: '6歳未満は保護者との添い寝で無料。6歳以上は大人料金。' },
        'facilities.lounge': { label: 'ラウンジ', status: 'verified', source_label: 'Hilton official hotel info', source_url: 'https://www.hilton.com/en/hotels/tyohitw-hilton-tokyo/hotel-info/', checked_at: '2026-08-07' },
        'facilities.pool': { label: 'プール', status: 'verified', source_label: 'Hilton official hotel info', source_url: 'https://www.hilton.com/en/hotels/tyohitw-hilton-tokyo/hotel-info/', checked_at: '2026-08-07', note: 'Indoor poolを確認。' },
        'facilities.parking': { label: '駐車場', status: 'verified', source_label: 'Hilton official hotel info', source_url: 'https://www.hilton.com/en/hotels/tyohitw-hilton-tokyo/hotel-info/', checked_at: '2026-08-07', note: 'Self-parking ¥1,500/day。' },
        'facilities.onsen': { label: '温泉', status: 'conflicting', source_label: 'Hilton official hotel page', source_url: 'https://www.hilton.com/en/hotels/tyohitw-hilton-tokyo/', checked_at: '2026-08-07', note: '公式情報ではSpa・sauna・bathを確認できるが、温泉としての記載は確認できない。旧表の「〇」は要再確認。' }
      }
    },
    {
      match: { name_ja: 'ヒルトン東京ベイ' },
      patch: {
        name_en: 'Hilton Tokyo Bay',
        city: '浦安市',
        status: 'open',
        official_url: 'https://www.hilton.com/en/hotels/tyotbtw-hilton-tokyo-bay/',
        facilities: {
          lounge: { raw: '〇 Executive lounge', available: true },
          pool: { raw: '〇 室内プール（通年） / 屋外プール（季節営業）', available: true },
          parking: { raw: '1泊3,100円 / 2泊4,700円 / 3泊以上6,300円', has_info: true }
        }
      },
      verifications: {
        name_en: { label: '英語名', status: 'verified', source_label: 'Hilton official hotel page', source_url: 'https://www.hilton.com/en/hotels/tyotbtw-hilton-tokyo-bay/', checked_at: '2026-08-07' },
        status: { label: '営業状態', status: 'verified', source_label: 'Hilton official hotel page', source_url: 'https://www.hilton.com/en/hotels/tyotbtw-hilton-tokyo-bay/', checked_at: '2026-08-07' },
        city: { label: '所在地', status: 'verified', source_label: 'Hilton official location page', source_url: 'https://www.hilton.com/en/hotels/tyotbtw-hilton-tokyo-bay/location/', checked_at: '2026-08-07' },
        'facilities.lounge': { label: 'ラウンジ', status: 'verified', source_label: 'Hilton official resort page', source_url: 'https://www.hilton.com/en/hotels/tyotbtw-hilton-tokyo-bay/resort/', checked_at: '2026-08-07' },
        'facilities.pool': { label: 'プール', status: 'verified', source_label: 'Hilton official resort page', source_url: 'https://www.hilton.com/en/hotels/tyotbtw-hilton-tokyo-bay/resort/', checked_at: '2026-08-07', note: 'Indoor poolは通年。Garden Pool Restaurantは季節営業。' },
        'facilities.parking': { label: '駐車場', status: 'verified', source_label: 'Hilton official location page', source_url: 'https://www.hilton.com/en/hotels/tyotbtw-hilton-tokyo-bay/location/', checked_at: '2026-08-07', note: '1泊¥3,100、2泊¥4,700、3泊以上¥6,300。' },
        'facilities.onsen': { label: '温泉', status: 'conflicting', source_label: 'Hilton official resort page', source_url: 'https://www.hilton.com/en/hotels/tyotbtw-hilton-tokyo-bay/resort/', checked_at: '2026-08-07', note: '公式情報ではbath・dry saunaを確認できるが、温泉としての記載は確認できない。旧表の「〇」は要再確認。' }
      }
    },
    {
      match: { name_ja: 'ヒルトン大阪' },
      patch: {
        name_en: 'Hilton Osaka',
        city: '大阪市',
        status: 'open',
        official_url: 'https://www.hilton.com/en/hotels/osahitw-hilton-osaka/',
        child: { raw: '12歳未満は添い寝無料（12歳以上は大人扱い）', allowed: true, rule_type: 'age_under', max_age: 11 },
        facilities: {
          lounge: { raw: '〇 Executive lounge', available: true },
          pool: { raw: '〇 室内プール', available: true },
          parking: { raw: '1泊7,200円', has_info: true }
        }
      },
      verifications: {
        name_en: { label: '英語名', status: 'verified', source_label: 'Hilton official hotel page', source_url: 'https://www.hilton.com/en/hotels/osahitw-hilton-osaka/', checked_at: '2026-08-07' },
        status: { label: '営業状態', status: 'verified', source_label: 'Hilton official hotel page', source_url: 'https://www.hilton.com/en/hotels/osahitw-hilton-osaka/', checked_at: '2026-08-07' },
        city: { label: '所在地', status: 'verified', source_label: 'Hilton official hotel page', source_url: 'https://www.hilton.com/en/hotels/osahitw-hilton-osaka/', checked_at: '2026-08-07' },
        'child.raw': { label: '添寝', status: 'verified', source_label: 'Hilton official hotel policy', source_url: 'https://www.hilton.com/en/hotels/osahitw-hilton-osaka/', checked_at: '2026-08-07', note: '12歳未満は保護者との添い寝で無料。12歳以上は大人扱い。' },
        'facilities.lounge': { label: 'ラウンジ', status: 'verified', source_label: 'Hilton official hotel info', source_url: 'https://www.hilton.com/en/hotels/osahitw-hilton-osaka/hotel-info/', checked_at: '2026-08-07' },
        'facilities.pool': { label: 'プール', status: 'verified', source_label: 'Hilton official hotel info', source_url: 'https://www.hilton.com/en/hotels/osahitw-hilton-osaka/hotel-info/', checked_at: '2026-08-07', note: 'Indoor poolを確認。' },
        'facilities.parking': { label: '駐車場', status: 'verified', source_label: 'Hilton official hotel info', source_url: 'https://www.hilton.com/en/hotels/osahitw-hilton-osaka/hotel-info/', checked_at: '2026-08-07', note: 'Self-parking ¥7,200/day。' },
        'facilities.onsen': { label: '温泉', status: 'conflicting', source_label: 'Hilton official hotel info', source_url: 'https://www.hilton.com/en/hotels/osahitw-hilton-osaka/hotel-info/', checked_at: '2026-08-07', note: '公式AmenitiesではIndoor pool / fitness centerを確認できるが、温泉としての記載は確認できない。旧表の「〇」は要再確認。' }
      }
    },
    {
      match: { name_ja: 'コンラッド東京' },
      patch: {
        name_en: 'Conrad Tokyo',
        city: '港区',
        status: 'open',
        official_url: 'https://www.hilton.com/en/hotels/tyocici-conrad-tokyo/',
        facilities: {
          lounge: { raw: '〇 Executive lounge', available: true },
          pool: { raw: '〇 25m室内プール', available: true }
        }
      },
      verifications: {
        name_en: { label: '英語名', status: 'verified', source_label: 'Conrad Tokyo official page', source_url: 'https://www.hilton.com/en/hotels/tyocici-conrad-tokyo/', checked_at: '2026-08-07' },
        status: { label: '営業状態', status: 'verified', source_label: 'Conrad Tokyo official page', source_url: 'https://www.hilton.com/en/hotels/tyocici-conrad-tokyo/', checked_at: '2026-08-07' },
        city: { label: '所在地', status: 'verified', source_label: 'Conrad Tokyo official page', source_url: 'https://www.hilton.com/en/hotels/tyocici-conrad-tokyo/', checked_at: '2026-08-07', note: '東京都港区東新橋1-9-1。' },
        'facilities.lounge': { label: 'ラウンジ', status: 'verified', source_label: 'Conrad Tokyo rooms page', source_url: 'https://www.hilton.com/en/hotels/tyocici-conrad-tokyo/rooms/', checked_at: '2026-08-07', note: 'Executive rooms等の宿泊者向けExecutive Loungeを確認。' },
        'facilities.pool': { label: 'プール', status: 'verified', source_label: 'Conrad Tokyo official page', source_url: 'https://www.hilton.com/en/hotels/tyocici-conrad-tokyo/', checked_at: '2026-08-07', note: 'Mizuki Spa & Fitnessの25m poolを確認。' },
        'facilities.onsen': { label: '温泉', status: 'conflicting', source_label: 'Conrad Tokyo amenities page', source_url: 'https://www.hilton.com/en/hotels/tyocici-conrad-tokyo/amenities/', checked_at: '2026-08-07', note: '公式情報ではSpaと室内プールを確認できるが、温泉としての記載は確認できない。旧表の「〇」は要再確認。' }
      }
    }
  ]
};
