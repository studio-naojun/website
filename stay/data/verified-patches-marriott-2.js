(function(){
  const curated=window.STAY_ATLAS_CURATED||(window.STAY_ATLAS_CURATED={version:0,checkedAt:'2026-08-07',patches:[]});
  curated.version=5;
  curated.checkedAt='2026-08-07';
  curated.patches.push(
    {
      match:{name_ja:'ウェスティンホテル東京'},
      patch:{
        name_en:'The Westin Tokyo',city:'目黒区',status:'open',official_url:'https://www.marriott.com/en-us/hotels/tyowi-the-westin-tokyo/overview/',
        facilities:{
          lounge:{raw:'〇 Westin Club（12歳以下はCocktail Time利用不可）',available:true},
          parking:{raw:'Self 1,200円/時・Valet 2,000円/日',has_info:true}
        }
      },
      verifications:{
        name_en:{label:'英語名',status:'verified',source_label:'Marriott official hotel page',source_url:'https://www.marriott.com/en-us/hotels/tyowi-the-westin-tokyo/overview/',checked_at:'2026-08-07'},
        city:{label:'所在地',status:'verified',source_label:'Marriott official hotel page',source_url:'https://www.marriott.com/en-us/hotels/tyowi-the-westin-tokyo/overview/',checked_at:'2026-08-07',note:'1-4-1 Mita, Meguro-ku, Tokyo。'},
        status:{label:'営業状態',status:'verified',source_label:'Marriott official hotel page',source_url:'https://www.marriott.com/en-us/hotels/tyowi-the-westin-tokyo/overview/',checked_at:'2026-08-07'},
        'facilities.lounge':{label:'ラウンジ',status:'verified',source_label:'Marriott official Westin Club page',source_url:'https://www.marriott.com/en-us/hotels/tyowi-the-westin-tokyo/rooms/club/',checked_at:'2026-08-07',note:'Westin Clubを確認。12歳以下はCocktail Timeの利用不可。'},
        'facilities.parking':{label:'駐車場',status:'verified',source_label:'Marriott official hotel page',source_url:'https://www.marriott.com/en-us/hotels/tyowi-the-westin-tokyo/overview/',checked_at:'2026-08-07',note:'Self parking 1,200円/時、Valet 2,000円/日。'}
      }
    },
    {
      match:{name_ja:'横浜ベイシェラトン ホテル&タワーズ'},
      patch:{
        name_en:'Yokohama Bay Sheraton Hotel & Towers',city:'横浜市',status:'open',official_url:'https://www.marriott.com/en-us/hotels/tyoys-yokohama-bay-sheraton-hotel-and-towers/overview/',
        facilities:{
          lounge:{raw:'〇 Sheraton Club Lounge',available:true},
          pool:{raw:'〇 室内プール',available:true},
          parking:{raw:'440円/時・1,900円/日',has_info:true}
        }
      },
      verifications:{
        name_en:{label:'英語名',status:'verified',source_label:'Marriott official hotel page',source_url:'https://www.marriott.com/en-us/hotels/tyoys-yokohama-bay-sheraton-hotel-and-towers/overview/',checked_at:'2026-08-07'},
        city:{label:'所在地',status:'verified',source_label:'Marriott official hotel page',source_url:'https://www.marriott.com/en-us/hotels/tyoys-yokohama-bay-sheraton-hotel-and-towers/overview/',checked_at:'2026-08-07',note:'1-3-23 Kitasaiwai, Nishi-Ku, Yokohama, Kanagawa。'},
        status:{label:'営業状態',status:'verified',source_label:'Marriott official hotel page',source_url:'https://www.marriott.com/en-us/hotels/tyoys-yokohama-bay-sheraton-hotel-and-towers/overview/',checked_at:'2026-08-07'},
        'facilities.lounge':{label:'ラウンジ',status:'verified',source_label:'Marriott official hotel page',source_url:'https://www.marriott.com/en-us/hotels/tyoys-yokohama-bay-sheraton-hotel-and-towers/overview/',checked_at:'2026-08-07',note:'Sheraton Club Loungeを確認。Platinum+対象記載あり。'},
        'facilities.pool':{label:'プール',status:'verified',source_label:'Marriott official hotel page',source_url:'https://www.marriott.com/en-us/hotels/tyoys-yokohama-bay-sheraton-hotel-and-towers/overview/',checked_at:'2026-08-07',note:'Indoor Poolを確認。'},
        'facilities.parking':{label:'駐車場',status:'verified',source_label:'Marriott official hotel page',source_url:'https://www.marriott.com/en-us/hotels/tyoys-yokohama-bay-sheraton-hotel-and-towers/overview/',checked_at:'2026-08-07',note:'Self parking 440円/時、1,900円/日。'}
      }
    },
    {
      match:{name_ja:'東京マリオットホテル'},
      patch:{
        name_en:'Tokyo Marriott Hotel',city:'品川区',status:'open',official_url:'https://www.marriott.com/en-us/hotels/tyomc-tokyo-marriott-hotel/overview/',
        facilities:{
          lounge:{raw:'〇 Executive Lounge',available:true},
          parking:{raw:'1,000円/時・2,000円/日',has_info:true}
        }
      },
      verifications:{
        name_en:{label:'英語名',status:'verified',source_label:'Marriott official hotel page',source_url:'https://www.marriott.com/en-us/hotels/tyomc-tokyo-marriott-hotel/overview/',checked_at:'2026-08-07'},
        city:{label:'所在地',status:'verified',source_label:'Marriott official hotel page',source_url:'https://www.marriott.com/en-us/hotels/tyomc-tokyo-marriott-hotel/overview/',checked_at:'2026-08-07',note:'4-7-36 Kitashinagawa, Shinagawa-ku, Tokyo。'},
        status:{label:'営業状態',status:'verified',source_label:'Marriott official hotel page',source_url:'https://www.marriott.com/en-us/hotels/tyomc-tokyo-marriott-hotel/overview/',checked_at:'2026-08-07'},
        'facilities.lounge':{label:'ラウンジ',status:'verified',source_label:'Marriott official rooms page',source_url:'https://www.marriott.com/en-us/hotels/tyomc-tokyo-marriott-hotel/rooms/',checked_at:'2026-08-07',note:'Upgraded rooms / suites向けExecutive Loungeを確認。'},
        'facilities.parking':{label:'駐車場',status:'verified',source_label:'Marriott official hotel page',source_url:'https://www.marriott.com/en-us/hotels/tyomc-tokyo-marriott-hotel/overview/',checked_at:'2026-08-07',note:'Self parking 1,000円/時、2,000円/日。'}
      }
    },
    {
      match:{name_ja:'大阪マリオット都ホテル'},
      patch:{
        name_en:'Osaka Marriott Miyako Hotel',city:'大阪市',status:'open',official_url:'https://www.marriott.com/en-us/hotels/osamc-osaka-marriott-miyako-hotel/overview/',
        facilities:{
          lounge:{raw:'〇 Club Lounge（小学生以下は17:30まで）',available:true},
          parking:{raw:'1,100円/時・3,000円/日',has_info:true}
        }
      },
      verifications:{
        name_en:{label:'英語名',status:'verified',source_label:'Marriott official hotel page',source_url:'https://www.marriott.com/en-us/hotels/osamc-osaka-marriott-miyako-hotel/overview/',checked_at:'2026-08-07'},
        city:{label:'所在地',status:'verified',source_label:'Marriott official hotel page',source_url:'https://www.marriott.com/en-us/hotels/osamc-osaka-marriott-miyako-hotel/overview/',checked_at:'2026-08-07',note:'1-1-43 Abeno-suji, Abeno-ku, Osaka。'},
        status:{label:'営業状態',status:'verified',source_label:'Marriott official hotel page',source_url:'https://www.marriott.com/en-us/hotels/osamc-osaka-marriott-miyako-hotel/overview/',checked_at:'2026-08-07'},
        'facilities.lounge':{label:'ラウンジ',status:'verified',source_label:'Marriott official rooms page',source_url:'https://www.marriott.com/en-us/hotels/osamc-osaka-marriott-miyako-hotel/rooms/',checked_at:'2026-08-07',note:'38階Club Lounge。小学生以下は17:30まで利用可。Platinum/Titanium/Ambassador + 同伴1名は無料。'},
        'facilities.parking':{label:'駐車場',status:'verified',source_label:'Marriott official hotel page',source_url:'https://www.marriott.com/en-us/hotels/osamc-osaka-marriott-miyako-hotel/overview/',checked_at:'2026-08-07',note:'On-site self parking 1,100円/時、3,000円/日。'}
      }
    }
  );
})();
