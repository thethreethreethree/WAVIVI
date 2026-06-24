# Data Quality Sweep — Pass 2 (external auditor)

Run: 2026-06-17T20:10:42.253Z

Counts: regions=6, stays=4893, restaurants=6611, experiences=2529, utilities=27103

## [HIGH] K. URL hygiene — restaurants
7 unparseable photo_url, 58 placeholder photos, 0 unparseable website, 0 unparseable google_maps_url.
```json
{
  "photo_bad_sample": [
    {
      "name": "Kenny Rogers Roasters - Quezon Avenue",
      "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAYAAA"
    },
    {
      "name": "Sangkalan Restaurant",
      "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAYAAA"
    },
    {
      "name": "Causeway Seafood Restaurant",
      "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAYAAA"
    },
    {
      "name": "Palm Grill: Authentic Southern Mindanaon Cuisine",
      "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAYAAA"
    },
    {
      "name": "Lansangan Restaurant",
      "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAYAAA"
    }
  ],
  "photo_placeholder_sample": [
    {
      "name": "Grace kitchen",
      "host": "streetviewpixels-pa.googleapis.com"
    },
    {
      "name": "Cebu's Tasty Lechon Lahug Branch",
      "host": "streetviewpixels-pa.googleapis.com"
    },
    {
      "name": "MWR KTV Bar / Pensionhouse",
      "host": "streetviewpixels-pa.googleapis.com"
    },
    {
      "name": "Kenny Rogers Roasters - Quezon Avenue",
      "host": ""
    },
    {
      "name": "Sociable Sports and Sunset Bar",
      "host": "streetviewpixels-pa.googleapis.com"
    }
  ],
  "website_bad_sample": []
}
```

## [HIGH] K. URL hygiene — experiences
1 unparseable photo_url, 33 placeholder photos, 0 unparseable website, 0 unparseable google_maps_url.
```json
{
  "photo_bad_sample": [
    {
      "name": "Border Trippers Travel and Tours, Inc.",
      "url": "Use a warm, inviting image of seniors enjoying a tour or cul"
    }
  ],
  "photo_placeholder_sample": [
    {
      "name": "Ssendive",
      "host": "streetviewpixels-pa.googleapis.com"
    },
    {
      "name": "Cebu Globalization ESL Center Banilad Inc Campus",
      "host": "streetviewpixels-pa.googleapis.com"
    },
    {
      "name": "Blue Dog Art Installation",
      "host": "streetviewpixels-pa.googleapis.com"
    },
    {
      "name": "SEVEN MACTAN CEBU TRAVEL AND TOURS CORP",
      "host": "streetviewpixels-pa.googleapis.com"
    },
    {
      "name": "Cebu Fortune Travel Incorporated",
      "host": "streetviewpixels-pa.googleapis.com"
    }
  ],
  "website_bad_sample": []
}
```

## [HIGH] K. URL hygiene — traveler_utilities
0 unparseable photo_url, 80 placeholder photos, 7 unparseable website, 0 unparseable google_maps_url.
```json
{
  "photo_bad_sample": [],
  "photo_placeholder_sample": [
    {
      "name": "HOLA Massage | Spa | Aesthetics",
      "host": "streetviewpixels-pa.googleapis.com"
    },
    {
      "name": "Puerto Princesa City - Office of the City Information",
      "host": "streetviewpixels-pa.googleapis.com"
    },
    {
      "name": "Dr. Lucas",
      "host": "streetviewpixels-pa.googleapis.com"
    },
    {
      "name": "Sabang bus station",
      "host": "streetviewpixels-pa.googleapis.com"
    },
    {
      "name": "I Touch Massage - Robinsons Palawan",
      "host": "streetviewpixels-pa.googleapis.com"
    }
  ],
  "website_bad_sample": [
    {
      "name": "IRON HOUSE Manhattan",
      "url": "htps://www.airbnb.com/h/ironhousemanhattan"
    },
    {
      "name": "FNS Customs",
      "url": "facebook/fns custom.com"
    },
    {
      "name": "CARD MRI Rizal Bank",
      "url": "cardmri.com"
    },
    {
      "name": "Gapan Drug",
      "url": "www.gapandrug.com"
    },
    {
      "name": "Zhagu",
      "url": "www.zhagumilktea.com"
    }
  ]
}
```

## [MEDIUM] K. URL hygiene — stays
0 unparseable photo_url, 54 placeholder photos, 0 unparseable website, 0 unparseable google_maps_url.
```json
{
  "photo_bad_sample": [],
  "photo_placeholder_sample": [
    {
      "name": "The Bricks Hotel",
      "host": "streetviewpixels-pa.googleapis.com"
    },
    {
      "name": "Residencia Orlina",
      "host": "streetviewpixels-pa.googleapis.com"
    },
    {
      "name": "Manhattan Suites Inn",
      "host": "streetviewpixels-pa.googleapis.com"
    },
    {
      "name": "New Cozy Home in Dumaguete",
      "host": "streetviewpixels-pa.googleapis.com"
    },
    {
      "name": "Vintage Inn",
      "host": "streetviewpixels-pa.googleapis.com"
    }
  ],
  "website_bad_sample": []
}
```

## [MEDIUM] M. Placeholder text — stays
1 rows whose name contains test/asdf/sample/lorem/placeholder/etc.
```json
[
  {
    "id": "54a47511",
    "name": "XXX"
  }
]
```

## [MEDIUM] M. Placeholder text — traveler_utilities
1 rows whose name contains test/asdf/sample/lorem/placeholder/etc.
```json
[
  {
    "id": "beff98cc",
    "name": "Cabancalan Test Market"
  }
]
```

## [MEDIUM] O. Contact format — traveler_utilities
43 phone values contain letters, 0 whatsapp values aren't wa.me URLs or phone-shaped, 0 instagram values are URLs (vs 0 bare handles — mixed convention).
```json
{
  "phone_alpha_sample": [
    {
      "name": "Rizal Medical Center",
      "phone": "+632 6719740-43 loc. 103;+632 6719616;+63936 1944238;+63932 6019341"
    },
    {
      "name": "Wendy's",
      "phone": "https://wendys.com.ph/tools/locations/locations/wendy-s-southwoods; 0956 352 3404"
    },
    {
      "name": "Chong Hua Hospital Mandaue",
      "phone": "+6332 2338000 loc. 8880"
    },
    {
      "name": "Quirino Memorial Medical Center",
      "phone": "+63 2 421 2250-55 loc.134-136;+63 2 913 4739"
    },
    {
      "name": "Hospital of the Infant Jesus Medical Center",
      "phone": "+632 7312771 loc. 151"
    }
  ],
  "wa_bad_sample": []
}
```

## [MEDIUM] Q. Coordinate cluster — stays
137 coordinate points shared by 2+ rows; 19 of those involve distinct names (geocoder probably returned a region centroid).
```json
[
  {
    "latlng": "14.578231,121.050934",
    "names": [
      "G AND A CONDOTEL",
      "Urban Nest PH",
      "Staycation Mandaluyong"
    ],
    "count": 3
  },
  {
    "latlng": "10.329872,123.908133",
    "names": [
      "Cebu IT Park",
      "Siempre Stays (Estudio La Vida, Vida Verde, and Estudio Basca at 38 Park Avenue & Casa Siempre at Avida Riala Towers)",
      "cozy home by michifusa"
    ],
    "count": 3
  },
  {
    "latlng": "14.483640,121.044645",
    "names": [
      "La Casa Ysabela - Azure Staycation",
      "Azure Cheap Thrills",
      "La Luna Azure Staycation"
    ],
    "count": 3
  },
  {
    "latlng": "9.934989,118.654541",
    "names": [
      "Villa Nagtabon",
      "Nagtabon Summer Cottages"
    ],
    "count": 2
  },
  {
    "latlng": "10.310151,123.954458",
    "names": [
      "Axis Pension Hotel",
      "RedDoorz @ Humayhumay Road Lapulapu"
    ],
    "count": 2
  },
  {
    "latlng": "14.603759,121.051074",
    "names": [
      "Greenhills Elan Hotel Modern - Newly Renovated",
      "Swire Elan Suites Condominium Corporation"
    ],
    "count": 2
  }
]
```

## [MEDIUM] Q. Coordinate cluster — restaurants
54 coordinate points shared by 2+ rows; 54 of those involve distinct names (geocoder probably returned a region centroid).
```json
[
  {
    "latlng": "9.789016,126.162011",
    "names": [
      "Bar 150 Siargao",
      "Penong's Siargao Branch"
    ],
    "count": 2
  },
  {
    "latlng": "14.601132,121.054500",
    "names": [
      "717 DELI",
      "Cosmo Resto Bar",
      "Mien San Noodle House",
      "78-53-86 Greenhills"
    ],
    "count": 5
  },
  {
    "latlng": "10.330793,123.907044",
    "names": [
      "Gerry's IT Park Cebu (Gerry's Grill)",
      "Ultimate Sandwich Station Ayala Central Bloc",
      "zip n sip ayala central bloc",
      "Q-Cafe"
    ],
    "count": 5
  },
  {
    "latlng": "10.313179,123.890309",
    "names": [
      "Hideout Wings & Below Zero Beer",
      "SUKIDESU MODERN JAPANESE RESTAURANT"
    ],
    "count": 2
  },
  {
    "latlng": "14.466373,120.968218",
    "names": [
      "PUEBLO Las Piñas",
      "Destino Food Garden"
    ],
    "count": 2
  },
  {
    "latlng": "14.419580,121.042269",
    "names": [
      "Baker J",
      "Café Eight"
    ],
    "count": 2
  }
]
```

## [MEDIUM] Q. Coordinate cluster — experiences
14 coordinate points shared by 2+ rows; 14 of those involve distinct names (geocoder probably returned a region centroid).
```json
[
  {
    "latlng": "12.733579,121.895989",
    "names": [
      "EKAJI TRAVEL AND TOURS",
      "Trail Adventours",
      "Coron Island Tour",
      "Travelholics Travel and Tours"
    ],
    "count": 10
  },
  {
    "latlng": "14.523850,120.980761",
    "names": [
      "Red Lantern | Solaire Resort Entertainment City",
      "Waterside | Solaire Resort Entertainment City"
    ],
    "count": 2
  },
  {
    "latlng": "9.763843,118.747330",
    "names": [
      "Trippy Travel & Tours",
      "Olangoan Waterfalls"
    ],
    "count": 2
  },
  {
    "latlng": "10.330793,123.907044",
    "names": [
      "Wow Travel",
      "Access Direct Visa and Travel Services"
    ],
    "count": 2
  },
  {
    "latlng": "10.307672,124.013707",
    "names": [
      "JMC Travel Tour Consultancy Services",
      "BAL Tours Germany Cebu Corp. - Mactan Branch"
    ],
    "count": 2
  },
  {
    "latlng": "11.952444,121.929614",
    "names": [
      "White Beach",
      "White Beach Boracay Philippines"
    ],
    "count": 2
  }
]
```

## [MEDIUM] Q. Coordinate cluster — traveler_utilities
15 coordinate points shared by 2+ rows; 14 of those involve distinct names (geocoder probably returned a region centroid).
```json
[
  {
    "latlng": "11.179788,119.387585",
    "names": [
      "BEEHIVE EL NIDO",
      "Ulanday's Store"
    ],
    "count": 2
  },
  {
    "latlng": "10.713908,122.551487",
    "names": [
      "Huawei Experience Store SM Iloilo with Service Collection Point",
      "Kimbel International - SM Iloilo"
    ],
    "count": 2
  },
  {
    "latlng": "9.767036,118.748225",
    "names": [
      "I Touch Massage - Robinsons Palawan",
      "Robinsons Place Palawan",
      "WIKO Mobile Kiosk at Robinsons Palawan"
    ],
    "count": 3
  },
  {
    "latlng": "8.078719,117.105885",
    "names": [
      "Candaraman Island",
      "Pink Sand"
    ],
    "count": 2
  },
  {
    "latlng": "14.331013,121.050543",
    "names": [
      "Wendy's",
      "CoCo Fresh Tea & Juice"
    ],
    "count": 2
  },
  {
    "latlng": "12.048918,120.151901",
    "names": [
      "Coron Ferry Agency",
      "Bruno Vlogs Travel"
    ],
    "count": 2
  }
]
```

## [LOW] R. Name length — restaurants
0 empty, 1 single-character, 0 >200 chars (probable scraper grabbed the whole snippet block).
```json
{
  "empty": [],
  "tooShort": [
    {
      "id": "4cd74f59-0247-4d1a-b792-bec4ee075f39",
      "name": "1"
    }
  ],
  "tooLong": []
}
```

## [LOW] S. No address — stays
1071 active rows have no address. The list/detail card will render a blank location line.
```json
[
  {
    "id": "002d6aea",
    "name": "Queensland Motel"
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
  },
  {
    "id": "00d8684a",
    "name": "G AND A CONDOTEL"
  }
]
```

## [LOW] S. No address — restaurants
1194 active rows have no address. The list/detail card will render a blank location line.
```json
[
  {
    "id": "000bcc18",
    "name": "Bucas Grande"
  },
  {
    "id": "00178654",
    "name": "Chill Bar Bocobo - Korea Town Manila"
  },
  {
    "id": "0050730f",
    "name": "SunStar KTV Bar"
  },
  {
    "id": "006416ce",
    "name": "Koneksiyon Bistro Café - Marikina"
  },
  {
    "id": "00cb42ba",
    "name": "Atina Cafe"
  }
]
```

## [LOW] S. No address — experiences
230 active rows have no address. The list/detail card will render a blank location line.
```json
[
  {
    "id": "0011aa60",
    "name": "Lumina Official | Affordable House and Lot in the Philippines"
  },
  {
    "id": "00c171bd",
    "name": "Bounty Beach"
  },
  {
    "id": "01884cd9",
    "name": "Mary Immaculate Parish Nature Church"
  },
  {
    "id": "03ab03f6",
    "name": "Thrillscape at Okada Manila"
  },
  {
    "id": "05a5cfa0",
    "name": "GLADEX TRAVEL AND TOURS | BINONDO MAIN OFFICE"
  }
]
```

## [LOW] S. No address — traveler_utilities
12391 active rows have no address. The list/detail card will render a blank location line.
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
    "id": "0009963a",
    "name": "Biñan Public Market"
  },
  {
    "id": "000adb8e",
    "name": "Medison Pharmacy"
  },
  {
    "id": "000befb3",
    "name": "Leah"
  }
]
```

## [OK] L. Off-world coordinates — stays
0 rows whose (lat,lng) sits outside [-90,90]/[-180,180] OR outside the Philippines bounding box.
```json
[]
```

## [OK] L. Off-world coordinates — restaurants
0 rows whose (lat,lng) sits outside [-90,90]/[-180,180] OR outside the Philippines bounding box.
```json
[]
```

## [OK] L. Off-world coordinates — experiences
0 rows whose (lat,lng) sits outside [-90,90]/[-180,180] OR outside the Philippines bounding box.
```json
[]
```

## [OK] L. Off-world coordinates — traveler_utilities
0 rows whose (lat,lng) sits outside [-90,90]/[-180,180] OR outside the Philippines bounding box.
```json
[]
```

## [OK] M. Placeholder text — restaurants
0 rows whose name contains test/asdf/sample/lorem/placeholder/etc.
```json
[]
```

## [OK] M. Placeholder text — experiences
0 rows whose name contains test/asdf/sample/lorem/placeholder/etc.
```json
[]
```

## [OK] N. HTML / markdown leakage — stays
0 descriptions contain HTML tags (script/iframe/a/img/style); 0 contain internal markdown links; 0 contain raw http URLs.
```json
{
  "html_sample": [],
  "md_sample": []
}
```

## [OK] N. HTML / markdown leakage — restaurants
0 descriptions contain HTML tags (script/iframe/a/img/style); 0 contain internal markdown links; 0 contain raw http URLs.
```json
{
  "html_sample": [],
  "md_sample": []
}
```

## [OK] N. HTML / markdown leakage — experiences
0 descriptions contain HTML tags (script/iframe/a/img/style); 0 contain internal markdown links; 0 contain raw http URLs.
```json
{
  "html_sample": [],
  "md_sample": []
}
```

## [OK] N. HTML / markdown leakage — traveler_utilities
0 descriptions contain HTML tags (script/iframe/a/img/style); 0 contain internal markdown links; 1 contain raw http URLs.
```json
{
  "html_sample": [],
  "md_sample": []
}
```

## [OK] O. Contact format — stays
0 phone values contain letters, 0 whatsapp values aren't wa.me URLs or phone-shaped, 1211 instagram values are URLs (vs 0 bare handles — mixed convention).
```json
{
  "phone_alpha_sample": [],
  "wa_bad_sample": []
}
```

## [OK] O. Contact format — restaurants
0 phone values contain letters, 0 whatsapp values aren't wa.me URLs or phone-shaped, 1907 instagram values are URLs (vs 0 bare handles — mixed convention).
```json
{
  "phone_alpha_sample": [],
  "wa_bad_sample": []
}
```

## [OK] O. Contact format — experiences
0 phone values contain letters, 0 whatsapp values aren't wa.me URLs or phone-shaped, 824 instagram values are URLs (vs 0 bare handles — mixed convention).
```json
{
  "phone_alpha_sample": [],
  "wa_bad_sample": []
}
```

## [OK] P. Rating sanity — stays
0 rows with rating > 5, 0 with negative rating or review_count, 0 with review_count > 100k (probable scraper bug).
```json
{
  "overFive": [],
  "negative": [],
  "huge": []
}
```

## [OK] P. Rating sanity — restaurants
0 rows with rating > 5, 0 with negative rating or review_count, 0 with review_count > 100k (probable scraper bug).
```json
{
  "overFive": [],
  "negative": [],
  "huge": []
}
```

## [OK] P. Rating sanity — experiences
0 rows with rating > 5, 0 with negative rating or review_count, 0 with review_count > 100k (probable scraper bug).
```json
{
  "overFive": [],
  "negative": [],
  "huge": []
}
```

## [OK] P. Rating sanity — traveler_utilities
0 rows with rating > 5, 0 with negative rating or review_count, 0 with review_count > 100k (probable scraper bug).
```json
{
  "overFive": [],
  "negative": [],
  "huge": []
}
```

## [OK] R. Name length — stays
0 empty, 0 single-character, 0 >200 chars (probable scraper grabbed the whole snippet block).
```json
{
  "empty": [],
  "tooShort": [],
  "tooLong": []
}
```

## [OK] R. Name length — experiences
0 empty, 0 single-character, 0 >200 chars (probable scraper grabbed the whole snippet block).
```json
{
  "empty": [],
  "tooShort": [],
  "tooLong": []
}
```

## [OK] R. Name length — traveler_utilities
0 empty, 0 single-character, 0 >200 chars (probable scraper grabbed the whole snippet block).
```json
{
  "empty": [],
  "tooShort": [],
  "tooLong": []
}
```

## [OK] T. Inactive but flagged — stays
0 rows are featured/top_pick BUT inactive — admin curation work that won't surface.
```json
[]
```

## [OK] T. Inactive but flagged — restaurants
0 rows are featured/top_pick BUT inactive — admin curation work that won't surface.
```json
[]
```

## [OK] T. Inactive but flagged — experiences
0 rows are featured/top_pick BUT inactive — admin curation work that won't surface.
```json
[]
```
