import got from 'got'
import fs, { PathLike } from 'fs'
import { URL } from 'url'
import path from 'path'
import { parse, ParseResult } from 'papaparse'
import ObjectSet from './object-set'

const host = '192.168.1.106:3030'
const url = new URL("https://seafile.emse.fr/d/710ced68c2894189a6f4/files/?p=%2F20211116-daily-sensor-measures.csv&dl=1")
const filePath = path.join(".", path.basename(url.pathname))

const urlEmseKg = "https://territoire.emse.fr/kg/"

type ObjectContainingStrings = { [key: string]: string } | { [key: number]: string }

function getFirstNonEmptyProperty(obj: ObjectContainingStrings): string {
  for (let key in obj) if ((obj as any)[key] !== "") return key
  throw new Error("No non-empty key")
}

function fetchFile(url: URL) {
    return new Promise<void>((res,rej) => {
        console.log('Fetching status: started')
        
        // Fetch csv file
        got.stream(url)
        // .on("downloadProgress", p => console.log(`${(p.percent * 100).toFixed(2)}%`))
        .pipe(fs.createWriteStream(filePath))
        .on("finish", () => {
            console.log('Fetching status: done')
            res()
        })
        .on("error", rej)
    })
}

function createStringToSend(results: ParseResult<any>): string {
    let writer = `
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
    @prefix sosa: <http://www.w3.org/ns/sosa/> .
    @prefix seas: <https://w3id.org/seas/> .
    @prefix bot: <https://w3id.org/bot#>  .\n\n`

    let exploredIds = new Set<string>()
    let exploredSensors = new ObjectSet()
    results.data.forEach(x => {

        const elUri = '<' + urlEmseKg + x.id + '>'
        const fixedObject = { humidity: x.HMDT, temperature: x.TEMP, luminosity: x.LUMI }
        let nonEmptyProperty: string
        try {
            nonEmptyProperty = getFirstNonEmptyProperty(fixedObject)
        } catch {
            return
        }
        const nonEmptyPropertyUri = '<' + urlEmseKg + x.location + '#' + nonEmptyProperty +'>'

        if (!exploredIds.has(x.id)) {
            writer += `${elUri} a sosa:Sensor .\n
            ${'<' + urlEmseKg + x.location + '>'} bot:hasElement ${elUri} .\n`

            exploredIds.add(x.id)
        }

        if (!exploredSensors.has([x.id, nonEmptyProperty])) {
            writer += `${elUri} sosa:observes ${nonEmptyPropertyUri} .\n`
            
            exploredSensors.add([x.id, nonEmptyProperty])
        }
        
        writer += `${elUri}
            sosa:madeObservation [
                a sosa:Observation ;
                sosa:observedProperty ${ nonEmptyPropertyUri } ;
                sosa:hasSimpleResult ${ '\"' + (fixedObject as any)[nonEmptyProperty] + '\"^^xsd:decimal' } ;
                sosa:resultTime ${'\"' + new Date(x.time / 1000000).toISOString() + '\"^^xsd:dateTime'}
            ] .\n`
    })
    return writer
}

function parseData(filePath: PathLike) {
    parse<any>(fs.createReadStream(filePath), {
        header: true,
        complete: function(results) {
            const stringToSend = createStringToSend(results)
            
            // Send to Triple Store
            got(`http://${host}/emse`, {
                method: 'POST',
                headers: { 'Content-Type': 'text/turtle' },
                body: stringToSend,
            })
            .then(() => console.log('Sent'))
            .catch(console.error)
        },
        error: console.error,
    })
}

function main() {
    fetchFile(url)
    .then(() => parseData(filePath))
    .catch(console.error)
    parseData(filePath)
}

main()
