import got from 'got'
import { URL } from 'url'

const host = 'localhost:3030'

let exploredURIs = new Set<string>()
let nbDocs = 0

function printStatus() {
    process.stdout.write(`\rIRIs explored: ${[...exploredURIs].length} (${nbDocs} docs)`)
}

async function fetchAndFill(src: string): Promise<boolean> {
    if (exploredURIs.has(src)) return true
    exploredURIs.add(src)
    try {
        // Fetch file
        const res = await got(src, {
            method: 'POST',
            headers: { 'Content-Type': 'text/turtle' },
        })
        // Send to Triple Store
        await got(`http://${host}/emse`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/turtle' },
            body: res.body,
        })
        nbDocs++
        printStatus()
        return false
    } catch (e) {
        // If it's not a 404 error
        if (!(e instanceof got.HTTPError && e.response.statusCode === 404)) console.error(e)
        return true
    }
}

function getAllEntities() {
    const query = `
        SELECT ?s ?p ?o WHERE {
            ?s ?p ?o .
        }
    `
    return got(`http://${host}/emse?query=${encodeURIComponent(query)}`, {
        headers: {
            'Accept': 'application/sparql-results+json',
            'Content-Type': 'application/sparql-query',
        },
    })
}

// Explore the triple store, fetch'n fill and and make recursive calls
async function exploreTripleStore() {
    const allEntities = JSON.parse((await getAllEntities()).body)

    const links: Set<string> = new Set()
    for (let binding of allEntities.results.bindings) {
        const { s, p, o } = binding
        
        for (let e of [s, p, o]) {
            if (e.type === 'uri') {
                // Follow only internal links
                if (
                    !e.value.startsWith('http://territoire.emse.fr/kg') &&
                    !e.value.startsWith('https://territoire.emse.fr/kg')
                ) continue
    
                const uri = new URL(e.value)
                const fixedURI =
                    uri.pathname.endsWith('/') ? `${uri.protocol}//${uri.host}${uri.pathname + 'index.ttl'}` :
                    uri.pathname.endsWith('.ttl') ? `${uri.protocol}//${uri.host}${uri.pathname}` :
                    `${uri.protocol}//${uri.host}${uri.pathname}.ttl`
                
                links.add(fixedURI)
            }
        }
    }

    for (let link of links) {
        const error = await fetchAndFill(link)
        if (!error) await exploreTripleStore()
    }
}

async function main() {
    console.log('Fetching emse and filling Jena...')

    const fetchAndFillPromises = [
        fetchAndFill('https://territoire.emse.fr/kg/emse/index.ttl'),
        fetchAndFill('https://territoire.emse.fr/kg/ontology.ttl'),
        fetchAndFill('https://territoire.emse.fr/kg/emse/fayol/index.ttl'),
    ]

    printStatus()
    await Promise.all(fetchAndFillPromises)
    printStatus()

    await exploreTripleStore()
    
    console.log('\nDone!')
}

main()
.catch(console.error)



