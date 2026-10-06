const base='https://www.olympikus.com.br';
for(const path of [
'/api/catalog_system/pub/products/search?ft=OLYMPIKUS&_from=0&_to=49',
'/api/catalog_system/pub/products/search?ft=ADRENA%202&_from=0&_to=49',
'/api/catalog_system/pub/products/search?ft=ADRENA%202&_from=0&_to=9',
'/api/catalog_system/pub/products/search/tenis-olympikus-adrena-2-feminino-43344456-2-009/p'
]){
 const r=await fetch(base+path,{headers:{Accept:'application/json','User-Agent':'TennisPlacePriceAnalysis/1.0'},signal:AbortSignal.timeout(15000)});const t=await r.text();
 console.log(JSON.stringify({path,status:r.status,contentType:r.headers.get('content-type'),sample:t.slice(0,400)}));
}
