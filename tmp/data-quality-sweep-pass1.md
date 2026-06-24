# Data Quality Sweep — Pass 1 (insider)

Run: 2026-06-17T20:08:24.975Z

Counts: regions=6, cities=95, stays=4893, restaurants=6611, experiences=2529, utilities=27103

## [HIGH] B. City geo health
65 of 95 cities lack centre + radius (rows in these cities fall back to the region's circle).
```json
[
  {
    "id": "09db31fd",
    "name": "Cainta, Calabarzon",
    "region": "metro_manila_manila_philippines"
  },
  {
    "id": "0e1e6dc9",
    "name": "Panique, Palawan",
    "region": "metro_manila_manila_philippines"
  },
  {
    "id": "1676b0c7",
    "name": "San Juan, Calabarzon",
    "region": "metro_manila_manila_philippines"
  },
  {
    "id": "16ae92d5",
    "name": "Mabini, Calabarzon",
    "region": "metro_manila_manila_philippines"
  },
  {
    "id": "19e85f44",
    "name": "Muntinlupa Alabang",
    "region": "metro_manila_manila_philippines"
  },
  {
    "id": "1c46ce4c",
    "name": "Kapatalan, Calabarzon",
    "region": "metro_manila_manila_philippines"
  },
  {
    "id": "2183d8a7",
    "name": "Makati",
    "region": "metro_manila_manila_philippines"
  },
  {
    "id": "3582895a",
    "name": "Looc, Calabarzon",
    "region": "metro_manila_manila_philippines"
  },
  {
    "id": "375f9c9c",
    "name": "Gibong, Western Visayas",
    "region": "metro_manila_manila_philippines"
  },
  {
    "id": "3e753248",
    "name": "Teresa, Calabarzon",
    "region": "metro_manila_manila_philippines"
  },
  {
    "id": "40579c67",
    "name": "Las Piñas",
    "region": "metro_manila_manila_philippines"
  },
  {
    "id": "40cb2b9b",
    "name": "Olongapo, Central Luzon",
    "region": "metro_manila_manila_philippines"
  },
  {
    "id": "415c103c",
    "name": "Dumaguete",
    "region": "apo_siquijor_philippines"
  },
  {
    "id": "438f6a94",
    "name": "Siquijor",
    "region": "apo_siquijor_philippines"
  },
  {
    "id": "467e4628",
    "name": "Marikina",
    "region": "metro_manila_manila_philippines"
  },
  {
    "id": "4782a4ee",
    "name": "El Nido, Palawan",
    "region": "metro_manila_manila_philippines"
  },
  {
    "id": "4e1b5f2a",
    "name": "Lumil, Calabarzon",
    "region": "metro_manila_manila_philippines"
  },
  {
    "id": "506b54e9",
    "name": "Isabang, Calabarzon",
    "region": "metro_manila_manila_philippines"
  },
  {
    "id": "513ee0ee",
    "name": "Pasig",
    "region": "metro_manila_manila_philippines"
  },
  {
    "id": "528c2206",
    "name": "San Luis, Central Luzon",
    "region": "metro_manila_manila_philippines"
  }
]
```

## [HIGH] C. Geofence dropout — stays
465 active stays rows would be CLAMPED OUT by withinRegionRadius (invisible on /stay /eat /todo even though admin sees them).
```json
[
  {
    "region": "apo_siquijor_philippines",
    "dropped": 149
  },
  {
    "region": "el_nido_el_nido_palawan",
    "dropped": 128
  },
  {
    "region": "6_cebu_philippines",
    "dropped": 103
  },
  {
    "region": "siargao_philippines",
    "dropped": 70
  },
  {
    "region": "metro_manila_manila_philippines",
    "dropped": 15
  }
]
```

## [HIGH] C. Geofence dropout — restaurants
318 active restaurants rows would be CLAMPED OUT by withinRegionRadius (invisible on /stay /eat /todo even though admin sees them).
```json
[
  {
    "region": "apo_siquijor_philippines",
    "dropped": 108
  },
  {
    "region": "6_cebu_philippines",
    "dropped": 85
  },
  {
    "region": "el_nido_el_nido_palawan",
    "dropped": 65
  },
  {
    "region": "siargao_philippines",
    "dropped": 60
  }
]
```

## [HIGH] C. Geofence dropout — experiences
225 active experiences rows would be CLAMPED OUT by withinRegionRadius (invisible on /stay /eat /todo even though admin sees them).
```json
[
  {
    "region": "apo_siquijor_philippines",
    "dropped": 74
  },
  {
    "region": "siargao_philippines",
    "dropped": 57
  },
  {
    "region": "el_nido_el_nido_palawan",
    "dropped": 38
  },
  {
    "region": "6_cebu_philippines",
    "dropped": 32
  },
  {
    "region": "metro_manila_manila_philippines",
    "dropped": 23
  },
  {
    "region": "western_visayas_philippines",
    "dropped": 1
  }
]
```

## [HIGH] C. Geofence dropout — traveler_utilities
934 active traveler_utilities rows would be CLAMPED OUT by withinRegionRadius (invisible on /stay /eat /todo even though admin sees them).
```json
[
  {
    "region": "el_nido_el_nido_palawan",
    "dropped": 675
  },
  {
    "region": "apo_siquijor_philippines",
    "dropped": 236
  },
  {
    "region": "metro_manila_manila_philippines",
    "dropped": 16
  },
  {
    "region": "siargao_philippines",
    "dropped": 6
  },
  {
    "region": "6_cebu_philippines",
    "dropped": 1
  }
]
```

## [HIGH] D. NULL essentials — stays
0 no-name, 0 active no-lat/lng, 125 active no-region_id.
```json
{
  "no_name": [],
  "no_geo": [],
  "no_region": [
    {
      "id": "01881cbe-7920-455c-b046-5ceb1e6e61a6",
      "name": "OYO 799 Ddd Habitat Iloilo"
    },
    {
      "id": "0448e911-77f2-4fa8-99a9-4913b2951074",
      "name": "The Muse Hotel Boracay"
    },
    {
      "id": "05d30153-a099-49ed-9001-bbcf967f6625",
      "name": "Sheridan Boutique Resort"
    },
    {
      "id": "06a28526-28b6-4a76-b2a2-adf9e6d6c15f",
      "name": "Boracay White Blue Diving Service Inc Resort"
    },
    {
      "id": "07182bf5-08b7-44c7-ad35-48eb2c279f36",
      "name": "Island Brasserie"
    }
  ]
}
```

## [HIGH] D. NULL essentials — restaurants
0 no-name, 0 active no-lat/lng, 153 active no-region_id.
```json
{
  "no_name": [],
  "no_geo": [],
  "no_region": [
    {
      "id": "01715f20-bbb4-4425-a7cc-529f5916b9e7",
      "name": "Drettea Food Hub"
    },
    {
      "id": "04c1a5e7-7c6c-4fad-8b37-eddac258a8a2",
      "name": "Chooks-to-Go - Roxas"
    },
    {
      "id": "05085789-376d-4334-8147-3f9105c20495",
      "name": "watersports cafe and restaurant"
    },
    {
      "id": "081a3378-cb67-4d94-86a3-70b27d635173",
      "name": "Cafe 830 Eight Thirty"
    },
    {
      "id": "086998eb-a372-4dda-993f-a84ed4c365a2",
      "name": "Globy"
    }
  ]
}
```

## [HIGH] D. NULL essentials — experiences
0 no-name, 0 active no-lat/lng, 135 active no-region_id.
```json
{
  "no_name": [],
  "no_geo": [],
  "no_region": [
    {
      "id": "0019bbbb-8c0c-443f-92f0-04ea78de4ff2",
      "name": "HAPPYQUEST TRAVEL AND TOURS"
    },
    {
      "id": "00ed66ff-0a85-45a9-b834-f56ff281fa5e",
      "name": "Palawan Peter Motorcycle and Rental"
    },
    {
      "id": "01554127-fddc-40c1-be1c-3fd232c29a64",
      "name": "Festive Walk Transport HUB"
    },
    {
      "id": "03423b8a-6f6b-4286-94ab-4c991ee94906",
      "name": "La Princesa Travel and Tours"
    },
    {
      "id": "0cd010db-320d-4c9c-bff8-f6fc83359312",
      "name": "2GO Travel"
    }
  ]
}
```

## [HIGH] J. Duplicate google_maps_url (any table)
903 maps URLs shared by 2+ rows — same physical place ingested more than once.
```json
[
  {
    "url": "https://maps.google.com/?q=14.56712,120.98714",
    "rows": [
      "stays:Casa Micarosa Hotel and Residences by RedDoorz",
      "stays:Casa Micarosa Hotel and Residences by RedDoorz"
    ]
  },
  {
    "url": "https://maps.google.com/?q=14.57823,121.05093",
    "rows": [
      "stays:G AND A CONDOTEL",
      "stays:Urban Nest PH",
      "stays:Staycation Mandaluyong"
    ]
  },
  {
    "url": "https://maps.google.com/?q=9.81366,126.16514",
    "rows": [
      "stays:Cloud 9 Surfing Area",
      "experiences:Cloud 9 Surfing Area"
    ]
  },
  {
    "url": "https://maps.google.com/?q=11.17907,119.39008",
    "rows": [
      "stays:Balay Paragua",
      "traveler_utilities:JB Pharmacy"
    ]
  },
  {
    "url": "https://maps.google.com/?q=9.78197,126.15589",
    "rows": [
      "stays:Pukaw Bistro",
      "stays:Pamana Homestay(Hostel)"
    ]
  },
  {
    "url": "https://maps.google.com/?q=14.55649,121.05229",
    "rows": [
      "stays:Grand Hyatt Manila",
      "stays:Grand Hyatt Manila"
    ]
  },
  {
    "url": "https://maps.google.com/?q=11.98874,121.91278",
    "rows": [
      "stays:Alta Vista de Boracay",
      "traveler_utilities:Metrobank ATM"
    ]
  },
  {
    "url": "https://maps.google.com/?q=10.28999,124.00687",
    "rows": [
      "stays:Tambuli Seaside Resort and Spa",
      "experiences:P S Q Divers"
    ]
  },
  {
    "url": "https://maps.google.com/?q=10.40952,119.17800",
    "rows": [
      "stays:Camp Backpackers Port Barton",
      "stays:Camp Backpackers Port Barton"
    ]
  },
  {
    "url": "https://maps.google.com/?q=9.78644,126.15866",
    "rows": [
      "stays:Dre's Place",
      "restaurants:Dre's Place"
    ]
  },
  {
    "url": "https://maps.google.com/?q=9.81026,123.36766",
    "rows": [
      "stays:Badian Canyoneering",
      "restaurants:Badian Canyoneering"
    ]
  },
  {
    "url": "https://maps.google.com/?q=9.16175,123.48886",
    "rows": [
      "stays:Euronet ATM",
      "traveler_utilities:Euronet ATM"
    ]
  }
]
```

## [MEDIUM] F. Within-table duplicates — stays
51 distinct (name,city) keys appearing 2+ times — likely the same place ingested twice.
```json
[
  {
    "name": "Camp Backpackers Port Barton",
    "city": "61791967",
    "count": 2,
    "ids": [
      "0589679c",
      "8047af6b"
    ]
  },
  {
    "name": "Euronet ATM",
    "city": "438f6a94",
    "count": 2,
    "ids": [
      "05ddb2ea",
      "3b77cb85"
    ]
  },
  {
    "name": "Paradise Garden Resort Hotel & Convention Center Boracay",
    "city": "bdab8985",
    "count": 2,
    "ids": [
      "06f01f38",
      "fe3cc558"
    ]
  },
  {
    "name": "OYO 514 Adelaida Pensionne Hotel",
    "city": "8501a18d",
    "count": 2,
    "ids": [
      "0a203a77",
      "fb232ca4"
    ]
  },
  {
    "name": "Hotel Capada",
    "city": "ee9d1254",
    "count": 2,
    "ids": [
      "0b5013ff",
      "c869021d"
    ]
  },
  {
    "name": "Lambug beach",
    "city": "94df2b45",
    "count": 2,
    "ids": [
      "0db63c12",
      "d4edcced"
    ]
  },
  {
    "name": "Princess of Coron Resort",
    "city": "f2147a31",
    "count": 2,
    "ids": [
      "0fdd8282",
      "1c9639e0"
    ]
  },
  {
    "name": "Casa Lily Hotel Quezon City",
    "city": "8d71b2ca",
    "count": 2,
    "ids": [
      "10fe88f8",
      "efaf54bf"
    ]
  }
]
```

## [MEDIUM] F. Within-table duplicates — restaurants
24 distinct (name,city) keys appearing 2+ times — likely the same place ingested twice.
```json
[
  {
    "name": "Max's Restaurant",
    "city": "e6df747e",
    "count": 3,
    "ids": [
      "1265968d",
      "58b9a1dd",
      "e282d767"
    ]
  },
  {
    "name": "Haim Chicken",
    "city": "04df736a",
    "count": 2,
    "ids": [
      "1a6a8880",
      "f6bb629c"
    ]
  },
  {
    "name": "Bo's Coffee",
    "city": "ee9d1254",
    "count": 3,
    "ids": [
      "1b9c0165",
      "a23d4a43",
      "a80ae629"
    ]
  },
  {
    "name": "The Lounge",
    "city": "9acc2934",
    "count": 2,
    "ids": [
      "2354bb0e",
      "d820f872"
    ]
  },
  {
    "name": "bean there. coffee",
    "city": "0d23d02d",
    "count": 2,
    "ids": [
      "252e3554",
      "a7447580"
    ]
  },
  {
    "name": "The Sunny Side Cafe",
    "city": "bdab8985",
    "count": 2,
    "ids": [
      "315197ad",
      "3af16b91"
    ]
  },
  {
    "name": "Bar 360",
    "city": "9acc2934",
    "count": 2,
    "ids": [
      "3b1e17ec",
      "8329f1ab"
    ]
  },
  {
    "name": "15th St. Coffee",
    "city": "5676ebae",
    "count": 2,
    "ids": [
      "3c02db49",
      "a3d1980f"
    ]
  }
]
```

## [MEDIUM] F. Within-table duplicates — experiences
10 distinct (name,city) keys appearing 2+ times — likely the same place ingested twice.
```json
[
  {
    "name": "El Nido Yachting Club",
    "city": "05f08c0b",
    "count": 2,
    "ids": [
      "0261d86e",
      "052317b3"
    ]
  },
  {
    "name": "Lio Beach",
    "city": "05f08c0b",
    "count": 2,
    "ids": [
      "1ea94dbd",
      "86ea05d9"
    ]
  },
  {
    "name": "MOALBOAL DIVE BAR PRO TRAINING CENTER",
    "city": "515e07e9",
    "count": 2,
    "ids": [
      "1ebe93eb",
      "bbd16b05"
    ]
  },
  {
    "name": "Bucas Grande Island",
    "city": "88f5cd73",
    "count": 2,
    "ids": [
      "367d17f3",
      "756cd9a1"
    ]
  },
  {
    "name": "Osmeña Peak",
    "city": "94df2b45",
    "count": 2,
    "ids": [
      "3a7ee13e",
      "8ab581cf"
    ]
  },
  {
    "name": "Eastern Goldtrans Tours, Inc.",
    "city": "691ed0da",
    "count": 2,
    "ids": [
      "45f0fdcd",
      "af03dd74"
    ]
  },
  {
    "name": "Coron, Palawan",
    "city": "f2147a31",
    "count": 2,
    "ids": [
      "4bb8804e",
      "de8afea2"
    ]
  },
  {
    "name": "Boracay",
    "city": "bdab8985",
    "count": 4,
    "ids": [
      "5781930a",
      "75b557f3",
      "8974b444",
      "a35b1992"
    ]
  }
]
```

## [MEDIUM] F. Within-table duplicates — traveler_utilities
49 distinct (name,city) keys appearing 2+ times — likely the same place ingested twice.
```json
[
  {
    "name": "Petron",
    "city": "0d23d02d",
    "count": 13,
    "ids": [
      "012cf792",
      "057a7920",
      "232ce982",
      "3a6ac01c",
      "6517fccd",
      "89127b98",
      "96426441",
      "a09b0149",
      "bebdb3a1",
      "d236d3be",
      "e4c84f79",
      "f75064f6",
      "f9f897d9"
    ]
  },
  {
    "name": "Original Biscocho Haus",
    "city": "0d23d02d",
    "count": 2,
    "ids": [
      "01793d3f",
      "b2fd43ad"
    ]
  },
  {
    "name": "HOLA Massage | Spa | Aesthetics",
    "city": "0d23d02d",
    "count": 2,
    "ids": [
      "01e4e154",
      "5def3242"
    ]
  },
  {
    "name": "Shell",
    "city": "0d23d02d",
    "count": 16,
    "ids": [
      "03273d36",
      "059acc2a",
      "0c3b6e7c",
      "2292b3db",
      "52bed026",
      "55c083b9",
      "570815c1",
      "5b056a41",
      "756bf909",
      "75c9ee8c",
      "84ffecc0",
      "85eb0609",
      "a888c5b8",
      "cc9db254",
      "f2dd1b7d",
      "f45d8201"
    ]
  },
  {
    "name": "Iloilo City",
    "city": "0d23d02d",
    "count": 3,
    "ids": [
      "04294262",
      "16149583",
      "3b8f8f50"
    ]
  },
  {
    "name": "PHL Post",
    "city": "0d23d02d",
    "count": 2,
    "ids": [
      "04502ae3",
      "434aff07"
    ]
  },
  {
    "name": "Star Oil",
    "city": "04df736a",
    "count": 2,
    "ids": [
      "0665eea6",
      "0ce23a5f"
    ]
  },
  {
    "name": "Washhouse Laundry Hub",
    "city": "0d23d02d",
    "count": 3,
    "ids": [
      "082178ab",
      "7efb8622",
      "9fc1e65a"
    ]
  }
]
```

## [MEDIUM] G. Cross-table duplicates
676 names appear in 2+ different tables — same place may have been ingested into the wrong bucket(s).
```json
[
  {
    "name": "Betty’s place",
    "where": [
      "stays:01190c",
      "traveler_utilities:f9513e"
    ]
  },
  {
    "name": "Seda Ayala Center Cebu",
    "where": [
      "stays:02486a",
      "traveler_utilities:53f883"
    ]
  },
  {
    "name": "Cloud 9 Surfing Area",
    "where": [
      "stays:027863",
      "experiences:b4ffe6"
    ]
  },
  {
    "name": "Bounty Beach",
    "where": [
      "stays:04e5c8",
      "experiences:00c171"
    ]
  },
  {
    "name": "Dre's Place",
    "where": [
      "stays:05ae0c",
      "restaurants:dc20ab"
    ]
  },
  {
    "name": "Badian Canyoneering",
    "where": [
      "stays:05d0ab",
      "restaurants:280b85"
    ]
  },
  {
    "name": "Euronet ATM",
    "where": [
      "stays:05ddb2",
      "stays:3b77cb",
      "experiences:b50b39",
      "traveler_utilities:33e493",
      "traveler_utilities:345b99",
      "traveler_utilities:659265",
      "traveler_utilities:917362",
      "traveler_utilities:ae02a0",
      "traveler_utilities:bbe6a2",
      "traveler_utilities:bc879f",
      "traveler_utilities:be1904",
      "traveler_utilities:d1cac2",
      "traveler_utilities:d7a67b",
      "traveler_utilities:db8de8",
      "traveler_utilities:f7ac5b"
    ]
  },
  {
    "name": "Batalla’s Lodging House",
    "where": [
      "stays:0691a9",
      "traveler_utilities:2ff4e6"
    ]
  },
  {
    "name": "Hill Myna Beach Cottage",
    "where": [
      "stays:06a83b",
      "traveler_utilities:1da32e"
    ]
  },
  {
    "name": "Island Brasserie",
    "where": [
      "stays:07182b",
      "restaurants:a110f4"
    ]
  },
  {
    "name": "Zhaya's Beach Cottages & Restobar",
    "where": [
      "stays:08adcc",
      "traveler_utilities:3d0566"
    ]
  },
  {
    "name": "Piece Lio, El Nido",
    "where": [
      "stays:09ca0a",
      "traveler_utilities:489429"
    ]
  }
]
```

## [LOW] H. Active no-contact — stays
1241 active rows with zero contact channels (phone/whatsapp/IG/FB/web all empty).
```json
[
  {
    "id": "002d6aea",
    "name": "Queensland Motel"
  },
  {
    "id": "003cf096",
    "name": "San Antonio De Padua Building"
  },
  {
    "id": "007a7606",
    "name": "Casa Micarosa Hotel and Residences by RedDoorz"
  },
  {
    "id": "00908780",
    "name": "Sir Felipe Suites"
  },
  {
    "id": "009e39cd",
    "name": "Residenciale Boutique Apartment"
  }
]
```

## [LOW] H. Active no-contact — restaurants
2108 active rows with zero contact channels (phone/whatsapp/IG/FB/web all empty).
```json
[
  {
    "id": "0007c366",
    "name": "Kain Peppers Parañaque"
  },
  {
    "id": "00178654",
    "name": "Chill Bar Bocobo - Korea Town Manila"
  },
  {
    "id": "00285a5e",
    "name": "Lil Bean Cafe"
  },
  {
    "id": "0050730f",
    "name": "SunStar KTV Bar"
  },
  {
    "id": "00cb42ba",
    "name": "Atina Cafe"
  }
]
```

## [LOW] H. Active no-contact — experiences
470 active rows with zero contact channels (phone/whatsapp/IG/FB/web all empty).
```json
[
  {
    "id": "00119db3",
    "name": "Tumalog Falls"
  },
  {
    "id": "0011aa60",
    "name": "Lumina Official | Affordable House and Lot in the Philippines"
  },
  {
    "id": "00c171bd",
    "name": "Bounty Beach"
  },
  {
    "id": "014ba8eb",
    "name": "Inter Asia & Travel Tours"
  },
  {
    "id": "018608ba",
    "name": "Dingfeng Travel and Tours Corp. 鼎丰国际旅行社"
  }
]
```

## [LOW] H. Active no-contact — traveler_utilities
23782 active rows with zero contact channels (phone/whatsapp/IG/FB/web all empty).
```json
[
  {
    "id": "00000571",
    "name": "RCBC"
  },
  {
    "id": "0001d115",
    "name": "Bathroom"
  },
  {
    "id": "0003d503",
    "name": "BPI"
  },
  {
    "id": "00049f60",
    "name": "Rhia Store"
  },
  {
    "id": "0009963a",
    "name": "Biñan Public Market"
  }
]
```

## [OK] A. Region geo health
0 active region(s) missing centre or positive radius_km.
```json
[]
```

## [OK] D. NULL essentials — traveler_utilities
0 no-name, 0 active no-lat/lng, 0 active no-region_id.
```json
{
  "no_name": [],
  "no_geo": [],
  "no_region": []
}
```

## [OK] E. Orphan city_id — stays
0 rows whose city_id is for a different region (or doesn't exist).
```json
[]
```

## [OK] E. Orphan city_id — restaurants
0 rows whose city_id is for a different region (or doesn't exist).
```json
[]
```

## [OK] E. Orphan city_id — experiences
0 rows whose city_id is for a different region (or doesn't exist).
```json
[]
```

## [OK] E. Orphan city_id — traveler_utilities
0 rows whose city_id is for a different region (or doesn't exist).
```json
[]
```

## [OK] I. Suspect ratings — stays
0 rated but 0 reviews, 0 0-rated but has reviews.
```json
{
  "rated_no_reviews": [],
  "reviews_no_rating": []
}
```

## [OK] I. Suspect ratings — restaurants
0 rated but 0 reviews, 0 0-rated but has reviews.
```json
{
  "rated_no_reviews": [],
  "reviews_no_rating": []
}
```

## [OK] I. Suspect ratings — experiences
0 rated but 0 reviews, 0 0-rated but has reviews.
```json
{
  "rated_no_reviews": [],
  "reviews_no_rating": []
}
```

## [OK] I. Suspect ratings — traveler_utilities
0 rated but 0 reviews, 0 0-rated but has reviews.
```json
{
  "rated_no_reviews": [],
  "reviews_no_rating": []
}
```
