(function(){
  const curated=window.STAY_ATLAS_CURATED||(window.STAY_ATLAS_CURATED={version:0,checkedAt:'2026-08-07',patches:[]});
  curated.version=4;
  curated.checkedAt='2026-08-07';
  curated.patches.push(
    {
      match:{name_ja:'ウェスティンホテル横浜'},
      patch:{
        name_en:'The Westin Yokohama',city:'横浜市',status:'open',official_url:'https://www.marriott.com/en-us/hotels/tyowy-the-westin-yokohama/overview/',
        facilities:{
          lounge:{raw:'〇 The Westin Club Lounge',available:true},
          pool:{raw:'〇 室内プール（大人3,300円 / 4〜11歳1,650円）',available:true},
          parking:{raw:'敷地内 6,000円/日・Valet 4,000円/日',has_info:true}
        }
      },
      verifications:{
        name_en:{label:'英語名',status:'verified',source_label:'Marriott official hotel page',source_url:'https://www.marriott.com/en-us/hotels/tyowy-the-westin-yokohama/overview/',checked_at:'2026-08-07'},
        city:{label:'所在地',status:'verified',source_label:'Marriott official hotel page',source_url:'https://www.marriott.com/en-us/hotels/tyowy-the-westin-yokohama/overview/',checked_at:'2026-08-07',note:'4-2-8 Minatomirai, Nishi Ku, Yokohama, Kanagawa。'},
        status:{label:'営業状態',status:'verified',source_label:'Marriott official hotel page',source_url:'https://www.marriott.com/en-us/hotels/tyowy-the-westin-yokohama/overview/',checked_at:'2026-08-07'},
        'facilities.lounge':{label:'ラウンジ',status:'verified',source_label:'Marriott official rooms / overview',source_url:'https://www.marriott.com/en-us/hotels/tyowy-the-westin-yokohama/rooms/',checked_at:'2026-08-07',note:'The Westin Club Loungeを確認。12歳以下は17:00以降利用不可。'},
        'facilities.pool':{label:'プール',status:'verified',source_label:'Marriott official hotel page',source_url:'https://www.marriott.com/en-us/hotels/tyowy-the-westin-yokohama/overview/',checked_at:'2026-08-07',note:'20m indoor pool。大人12歳以上3,300円、4〜11歳1,650円。子ども利用時間10:00〜18:00。'},
        'facilities.parking':{label:'駐車場',status:'verified',source_label:'Marriott official hotel page',source_url:'https://www.marriott.com/en-us/hotels/tyowy-the-westin-yokohama/overview/',checked_at:'2026-08-07',note:'On-site parking 6,000円/日、Valet 4,000円/日。'}
      }
    },
    {
      match:{name_ja:'シェラトン・グランデ・トーキョーベイ・ホテル'},
      patch:{
        name_en:'Sheraton Grande Tokyo Bay Hotel',city:'浦安市',status:'open',official_url:'https://www.marriott.com/en-us/hotels/tyosi-sheraton-grande-tokyo-bay-hotel/overview/',
        facilities:{
          pool:{raw:'〇 室内 / 屋外プール',available:true},
          parking:{raw:'1泊目3,100円・2泊目以降1,600円/泊',has_info:true}
        }
      },
      verifications:{
        name_en:{label:'英語名',status:'verified',source_label:'Marriott official hotel page',source_url:'https://www.marriott.com/en-us/hotels/tyosi-sheraton-grande-tokyo-bay-hotel/overview/',checked_at:'2026-08-07'},
        city:{label:'所在地',status:'verified',source_label:'Marriott official hotel details',source_url:'https://www.marriott.com/ja/hotels/tyosi-sheraton-grande-tokyo-bay-hotel/hotel-details/',checked_at:'2026-08-07',note:'千葉県浦安市舞浜1-9。'},
        status:{label:'営業状態',status:'verified',source_label:'Marriott official hotel page',source_url:'https://www.marriott.com/en-us/hotels/tyosi-sheraton-grande-tokyo-bay-hotel/overview/',checked_at:'2026-08-07'},
        'facilities.pool':{label:'プール',status:'verified',source_label:'Marriott official hotel page',source_url:'https://www.marriott.com/en-us/hotels/tyosi-sheraton-grande-tokyo-bay-hotel/overview/',checked_at:'2026-08-07',note:'Indoor Pool / Outdoor Poolを確認。公式FAQでは室内プールに年齢制限なし、未トイレトレーニング児はスイム用おむつ着用。'},
        'facilities.parking':{label:'駐車場',status:'verified',source_label:'Marriott official FAQ / hotel details',source_url:'https://www.marriott.com/en-us/hotels/tyosi-sheraton-grande-tokyo-bay-hotel/overview/',checked_at:'2026-08-07',note:'宿泊者は1泊目3,100円、2泊目以降1,600円/泊。通常時間料金は520円/時。'}
      }
    },
    {
      match:{name_ja:'富士マリオット・ホテル山中湖'},
      patch:{
        name_en:'Fuji Marriott Hotel Lake Yamanaka',city:'南都留郡山中湖村',status:'open',official_url:'https://www.marriott.com/en-us/hotels/mmjfj-fuji-marriott-hotel-lake-yamanaka/overview/',
        facilities:{
          onsen:{raw:'〇 温泉 / Hot Spring',available:true},
          parking:{raw:'〇 無料',has_info:true}
        }
      },
      verifications:{
        name_en:{label:'英語名',status:'verified',source_label:'Marriott official hotel page',source_url:'https://www.marriott.com/en-us/hotels/mmjfj-fuji-marriott-hotel-lake-yamanaka/overview/',checked_at:'2026-08-07'},
        city:{label:'所在地',status:'verified',source_label:'Marriott official hotel page',source_url:'https://www.marriott.com/en-us/hotels/mmjfj-fuji-marriott-hotel-lake-yamanaka/overview/',checked_at:'2026-08-07',note:'1256-1 Hirano, Yamanakako, Minamitsuru-gun, Yamanashi。'},
        status:{label:'営業状態',status:'verified',source_label:'Marriott official hotel page',source_url:'https://www.marriott.com/en-us/hotels/mmjfj-fuji-marriott-hotel-lake-yamanaka/overview/',checked_at:'2026-08-07'},
        'facilities.onsen':{label:'温泉',status:'verified',source_label:'Marriott official hotel page',source_url:'https://www.marriott.com/en-us/hotels/mmjfj-fuji-marriott-hotel-lake-yamanaka/overview/',checked_at:'2026-08-07',note:'Hot spring baths / Public Bathを公式確認。温泉付き客室もあり。'},
        'facilities.parking':{label:'駐車場',status:'verified',source_label:'Marriott official hotel page',source_url:'https://www.marriott.com/en-us/hotels/mmjfj-fuji-marriott-hotel-lake-yamanaka/overview/',checked_at:'2026-08-07',note:'Complimentary On-Site Parking。'}
      }
    },
    {
      match:{name_ja:'コートヤード・バイ・マリオット白馬'},
      patch:{
        name_en:'Courtyard by Marriott Hakuba',city:'白馬村',status:'open',official_url:'https://www.marriott.com/en-us/hotels/mmjch-courtyard-hakuba/overview/',
        facilities:{
          onsen:{raw:'〇 白馬姫川温泉',available:true},
          parking:{raw:'〇 無料',has_info:true}
        }
      },
      verifications:{
        name_en:{label:'英語名',status:'verified',source_label:'Marriott official hotel page',source_url:'https://www.marriott.com/en-us/hotels/mmjch-courtyard-hakuba/overview/',checked_at:'2026-08-07'},
        city:{label:'所在地',status:'verified',source_label:'Marriott official hotel page',source_url:'https://www.marriott.com/en-us/hotels/mmjch-courtyard-hakuba/overview/',checked_at:'2026-08-07',note:'2937 Hokujo, Hakuba-Mura, Nagano。'},
        status:{label:'営業状態',status:'verified',source_label:'Marriott official hotel page',source_url:'https://www.marriott.com/en-us/hotels/mmjch-courtyard-hakuba/overview/',checked_at:'2026-08-07'},
        'facilities.onsen':{label:'温泉',status:'verified',source_label:'Marriott official hotel page',source_url:'https://www.marriott.com/en-us/hotels/mmjch-courtyard-hakuba/overview/',checked_at:'2026-08-07',note:'Onsen - Hot Springとして白馬姫川温泉を公式確認。'},
        'facilities.parking':{label:'駐車場',status:'verified',source_label:'Marriott official hotel page',source_url:'https://www.marriott.com/en-us/hotels/mmjch-courtyard-hakuba/overview/',checked_at:'2026-08-07',note:'Complimentary On-Site Parking。'}
      }
    }
  );
})();
