(function(){
  const curated=window.STAY_ATLAS_CURATED||(window.STAY_ATLAS_CURATED={version:0,checkedAt:'2026-08-07',patches:[]});
  curated.version=3;
  curated.checkedAt='2026-08-07';
  curated.patches.push(
    {
      match:{name_ja:'ヒルトン東京お台場'},
      patch:{
        name_en:'Hilton Tokyo Odaiba',city:'港区',status:'open',official_url:'https://www.hilton.com/en/hotels/tyotohi-hilton-tokyo-odaiba/',
        facilities:{lounge:{raw:'〇 Executive lounge',available:true},pool:{raw:'〇 室内プール / indoor・outdoor whirlpool',available:true},parking:{raw:'1泊2,000円',has_info:true}}
      },
      verifications:{
        name_en:{label:'英語名',status:'verified',source_label:'Hilton official hotel page',source_url:'https://www.hilton.com/en/hotels/tyotohi-hilton-tokyo-odaiba/',checked_at:'2026-08-07'},
        city:{label:'所在地',status:'verified',source_label:'Hilton official hotel info',source_url:'https://www.hilton.com/en/hotels/tyotohi-hilton-tokyo-odaiba/hotel-info/',checked_at:'2026-08-07',note:'東京都港区台場1-9-1。'},
        status:{label:'営業状態',status:'verified',source_label:'Hilton official hotel page',source_url:'https://www.hilton.com/en/hotels/tyotohi-hilton-tokyo-odaiba/',checked_at:'2026-08-07'},
        'families.booking_age':{label:'子どもの予約上の年齢区分',status:'verified',source_label:'Hilton official Family Policy',source_url:'https://www.hilton.com/en/hotels/tyotohi-hilton-tokyo-odaiba/',checked_at:'2026-08-07',note:'5歳以下は無料、6歳以上は大人として予約。添寝条件そのものとは分けて保持。'},
        'facilities.lounge':{label:'ラウンジ',status:'verified',source_label:'Hilton official dining page',source_url:'https://www.hilton.com/en/hotels/tyotohi-hilton-tokyo-odaiba/dining/',checked_at:'2026-08-07',note:'Executive Room / Suite宿泊者等向けExecutive Loungeを確認。'},
        'facilities.pool':{label:'プール',status:'verified',source_label:'Hilton official spa page',source_url:'https://www.hilton.com/en/hotels/tyotohi-hilton-tokyo-odaiba/spa/',checked_at:'2026-08-07',note:'An Spa TOKYOにindoor poolとindoor/outdoor whirlpoolを確認。'},
        'facilities.parking':{label:'駐車場',status:'verified',source_label:'Hilton official hotel info',source_url:'https://www.hilton.com/en/hotels/tyotohi-hilton-tokyo-odaiba/hotel-info/',checked_at:'2026-08-07',note:'Self-parking ¥2,000/day。'},
        'facilities.onsen':{label:'温泉',status:'conflicting',source_label:'Hilton official spa page',source_url:'https://www.hilton.com/en/hotels/tyotohi-hilton-tokyo-odaiba/spa/',checked_at:'2026-08-07',note:'公式ではspa / whirlpool / saunaを確認できるが温泉表記は確認できない。旧表の「〇ジャグジー」は温泉Fieldとして再整理が必要。'}
      }
    },
    {
      match:{name_ja:'ダブルツリーbyヒルトン東京有明'},
      patch:{
        name_en:'DoubleTree by Hilton Tokyo Ariake',city:'江東区',status:'open',official_url:'https://www.hilton.com/en/hotels/tyoardi-doubletree-tokyo-ariake/',
        child:{raw:'12歳未満は添い寝無料（12歳以上は大人扱い）',allowed:true,rule_type:'age_under',max_age:11},
        facilities:{breakfast:{raw:'0〜5歳無料 / 6〜11歳は有料',has_info:true},parking:{raw:'× 駐車場なし',has_info:true}}
      },
      verifications:{
        name_en:{label:'英語名',status:'verified',source_label:'Hilton official hotel page',source_url:'https://www.hilton.com/en/hotels/tyoardi-doubletree-tokyo-ariake/',checked_at:'2026-08-07'},
        city:{label:'所在地',status:'verified',source_label:'Hilton official hotel page',source_url:'https://www.hilton.com/en/hotels/tyoardi-doubletree-tokyo-ariake/',checked_at:'2026-08-07',note:'東京都江東区有明3-7-3。'},
        status:{label:'営業状態',status:'verified',source_label:'Hilton official hotel page',source_url:'https://www.hilton.com/en/hotels/tyoardi-doubletree-tokyo-ariake/',checked_at:'2026-08-07'},
        'child.raw':{label:'添寝',status:'verified',source_label:'Hilton official Family Policy',source_url:'https://www.hilton.com/en/hotels/tyoardi-doubletree-tokyo-ariake/',checked_at:'2026-08-07',note:'12歳未満は保護者との添い寝で無料。12歳以上は大人扱い。'},
        'facilities.breakfast':{label:'朝食',status:'verified',source_label:'Hilton official Family Policy',source_url:'https://www.hilton.com/en/hotels/tyoardi-doubletree-tokyo-ariake/',checked_at:'2026-08-07',note:'0〜5歳は朝食無料、6〜11歳は朝食料金が必要。'},
        'facilities.parking':{label:'駐車場',status:'verified',source_label:'Hilton official hotel info',source_url:'https://www.hilton.com/en/hotels/tyoardi-doubletree-tokyo-ariake/hotel-info/',checked_at:'2026-08-07',note:'Self-parking / valet parkingともNot available。'}
      }
    },
    {
      match:{name_ja:'ヒルトン小田原リゾート＆スパ'},
      patch:{
        name_en:'Hilton Odawara Resort & Spa',city:'小田原市',status:'open',official_url:'https://www.hilton.com/en/hotels/tyoodhi-hilton-odawara-resort-and-spa/',
        child:{raw:'6歳未満は添い寝無料（6歳以上は大人扱い）',allowed:true,rule_type:'age_under',max_age:5},
        facilities:{onsen:{raw:'〇 Hot Spring',available:true},pool:{raw:'〇 室内 / 屋外プール',available:true},parking:{raw:'〇 無料',has_info:true}}
      },
      verifications:{
        name_en:{label:'英語名',status:'verified',source_label:'Hilton official hotel page',source_url:'https://www.hilton.com/en/hotels/tyoodhi-hilton-odawara-resort-and-spa/',checked_at:'2026-08-07'},
        city:{label:'所在地',status:'verified',source_label:'Hilton official hotel page',source_url:'https://www.hilton.com/en/hotels/tyoodhi-hilton-odawara-resort-and-spa/',checked_at:'2026-08-07'},
        status:{label:'営業状態',status:'verified',source_label:'Hilton official hotel page',source_url:'https://www.hilton.com/en/hotels/tyoodhi-hilton-odawara-resort-and-spa/',checked_at:'2026-08-07'},
        'child.raw':{label:'添寝',status:'verified',source_label:'Hilton official Family Policy',source_url:'https://www.hilton.com/en/hotels/tyoodhi-hilton-odawara-resort-and-spa/',checked_at:'2026-08-07',note:'6歳未満は保護者との添い寝で無料。6歳以上は大人扱い。'},
        'facilities.onsen':{label:'温泉',status:'verified',source_label:'Hilton official spa page',source_url:'https://www.hilton.com/en/hotels/tyoodhi-hilton-odawara-resort-and-spa/spa/',checked_at:'2026-08-07',note:'Spa & Hot Spring / Baths & Hot Springを公式確認。'},
        'facilities.pool':{label:'プール',status:'verified',source_label:'Hilton official hotel info',source_url:'https://www.hilton.com/en/hotels/tyoodhi-hilton-odawara-resort-and-spa/hotel-info/',checked_at:'2026-08-07',note:'Indoor pool / Outdoor poolを確認。'},
        'facilities.parking':{label:'駐車場',status:'verified',source_label:'Hilton official hotel info',source_url:'https://www.hilton.com/en/hotels/tyoodhi-hilton-odawara-resort-and-spa/hotel-info/',checked_at:'2026-08-07',note:'Self-parking complimentary。'},
        'facilities.lounge':{label:'ラウンジ',status:'conflicting',source_label:'Hilton official hotel info',source_url:'https://www.hilton.com/en/hotels/tyoodhi-hilton-odawara-resort-and-spa/hotel-info/',checked_at:'2026-08-07',note:'現行公式AmenitiesにExecutive loungeの記載を確認できない。旧表の「13歳以上のみ利用可」は要再確認。'}
      }
    },
    {
      match:{name_ja:'ヒルトン名古屋'},
      patch:{
        name_en:'Hilton Nagoya',city:'名古屋市',status:'open',official_url:'https://www.hilton.com/en/hotels/naghitw-hilton-nagoya/',quality:'needs_review',
        facilities:{lounge:{raw:'〇 Executive lounge / 6〜12歳 3,500円',available:true},breakfast:{raw:'6〜12歳 2,500円',has_info:true},pool:{raw:'〇 室内プール',available:true},parking:{raw:'1泊3,000円',has_info:true}}
      },
      verifications:{
        name_en:{label:'英語名',status:'verified',source_label:'Hilton official hotel page',source_url:'https://www.hilton.com/en/hotels/naghitw-hilton-nagoya/',checked_at:'2026-08-07'},
        city:{label:'所在地',status:'verified',source_label:'Hilton official hotel info',source_url:'https://www.hilton.com/en/hotels/naghitw-hilton-nagoya/hotel-info/',checked_at:'2026-08-07'},
        status:{label:'営業状態',status:'verified',source_label:'Hilton official hotel page',source_url:'https://www.hilton.com/en/hotels/naghitw-hilton-nagoya/',checked_at:'2026-08-07'},
        'child.raw':{label:'添寝',status:'conflicting',source_label:'Hilton official Family Policy',source_url:'https://www.hilton.com/en/hotels/naghitw-hilton-nagoya/',checked_at:'2026-08-07',note:'公式は12歳以上を大人扱いとする一方、6〜12歳の添い寝時食事料金や追加寝具に関する記述が併存。旧表の「17歳まで」とは整合せず、添寝上限は要再確認。'},
        'facilities.lounge':{label:'ラウンジ',status:'verified',source_label:'Hilton official Family Policy / amenities',source_url:'https://www.hilton.com/en/hotels/naghitw-hilton-nagoya/',checked_at:'2026-08-07',note:'Executive loungeあり。Family Policyに6〜12歳のAccess料金¥3,500記載。'},
        'facilities.breakfast':{label:'朝食',status:'verified',source_label:'Hilton official Family Policy',source_url:'https://www.hilton.com/en/hotels/naghitw-hilton-nagoya/',checked_at:'2026-08-07',note:'6〜12歳 Breakfast plan ¥2,500。'},
        'facilities.pool':{label:'プール',status:'verified',source_label:'Hilton official hotel info',source_url:'https://www.hilton.com/en/hotels/naghitw-hilton-nagoya/hotel-info/',checked_at:'2026-08-07',note:'Indoor poolを確認。'},
        'facilities.parking':{label:'駐車場',status:'verified',source_label:'Hilton official hotel info',source_url:'https://www.hilton.com/en/hotels/naghitw-hilton-nagoya/hotel-info/',checked_at:'2026-08-07',note:'Self-parking ¥3,000/day。'}
      }
    }
  );
})();
