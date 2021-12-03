import got from 'got'

async function main() {
    const url = new URL('https://query.wikidata.org/sparql')
    url.searchParams.set('query', 'SELECT ?item WHERE { ?item wdt:P31 wd:Q11424 } LIMIT 10')
    const res = await got(url, {
        responseType: 'json'
    })
    var resList = (res.body as any).results.bindings.map((b: any) => b.item.value)
    resList.forEach((el: string) => {
        console.log(el.replace('http://www.wikidata.org/entity/','https://www.wikidata.org/wiki/Special:EntityData/') + ".rdf")
    })
}

main().catch(console.error)