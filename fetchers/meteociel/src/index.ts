import * as cheerio from "cheerio"
import got from "got"
import fs, { promises as fsp } from "fs"
import path from "path"
import { URL } from "url"

interface MainTableRow {
    heureLocale: number;
    temperature: number;
    humidite: number;
    humidex: number;
    windchill: number;
    pression: number;
}

const HOST = "localhost:3030"
const METEOCIEL_URL = new URL(
    "https://www.meteociel.fr/temps-reel/obs_villes.php?code2=7475&jour2=16&mois2=10&annee2=2021"
)
const MAIN_TBODY_SELECTOR =
    "body > table:nth-child(1) > tbody > tr.texte > td:nth-child(2) > table > tbody > tr:nth-child(2) > td > table > tbody > tr > td > center:nth-child(14) > table:nth-child(3) > tbody"
const CACHE_FOLDER_PATH = path.join(".", "cache")

// Bounds:
// "2021-11-16T05:31:28.679Z"^^xsd:dateTime
// "2021-11-15T05:31:28.932Z"^^xsd:dateTime
const METEOCIEL_DATE = new Date(2021, 11 - 1, 16)

function getFilename(url: URL) {
    return url.toString().replace(/[^a-zA-Z0-9]/g, "_")
}

async function initCacheFolder() {
    let stat: fs.Stats | undefined = undefined
    try {
        stat = await fsp.stat(CACHE_FOLDER_PATH)
    } catch {
        await fsp.mkdir(CACHE_FOLDER_PATH, { recursive: true })
    }
    if (stat !== undefined && stat.isFile())
        throw new Error("Cache folder is a file")
}

function cacheFile(url: URL) {
    return new Promise<void>((res, rej) => {
        got
            .stream(url)
            .pipe(
                fs.createWriteStream(path.join(CACHE_FOLDER_PATH, getFilename(url)))
            )
            .on("finish", () => res())
            .on("error", rej)
    })
}

async function createCheerioContext(url: URL): Promise<cheerio.CheerioAPI> {
    let file = await fsp.readFile(
        path.join(CACHE_FOLDER_PATH, getFilename(url))
    )
    return cheerio.load(file.toString())
}

function iterMainTable($: cheerio.CheerioAPI): MainTableRow[] {
    const tbody = $(MAIN_TBODY_SELECTOR)
    const rows: MainTableRow[] = []

    const parseOneInt = (str: string) => parseInt(str.replace(/\D/g, ""), 10)
    const parseOneFloat = (str: string) => parseFloat(str.replaceAll(" ", "").replaceAll(",", ".").match(/\d+(\.\d+)?/)![0])

    const apply = (el: cheerio.Element, parser: (str: string) => number) => parser($(el).text())

    tbody.find("tr").each((i, tr) => {
        if (i === 0) return
        const row: Partial<MainTableRow> = {}
        $(tr).find("td").each((j, td) => {
            switch (j) {
                case 0:
                    row.heureLocale = apply(td, parseOneInt)
                    break
                case 4:
                    row.temperature = apply(td, parseOneFloat)
                    break
                case 5:
                    row.humidite = apply(td, parseOneInt)
                    break
                case 6:
                    row.humidex = apply(td, parseOneFloat)
                    break
                case 7:
                    row.windchill = apply(td, parseOneFloat)
                    break
                case 10:
                    row.pression = apply(td, parseOneFloat)
            }
        })
        rows.push(row as MainTableRow)
    })
    return rows
}

function rowsToTurtle(rows: MainTableRow[]) {
    let turtle = `
        @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
        @prefix sosa: <http://www.w3.org/ns/sosa/> .
        @prefix seas: <https://w3id.org/seas/> .
        @prefix bot: <https://w3id.org/bot#>  .
        @prefix ex: <http://example.com/> .

        <http://example.com/saintetienne#temperature>
            a seas:TemperatureProperty .
        
        <http://example.com/saintetienne#humidity>
            a seas:HumidityProperty .

        <http://example.com/saintetienne#atmosphericPressure>
            a seas:AtmosphericPressureProperty .
        
        ex:meteociel
            a sosa:Sensor ;
            sosa:observes
                <http://example.com/saintetienne#temperature> ,
                <http://example.com/saintetienne#humidity> ,
                <http://example.com/saintetienne#atmosphericPressure> .\n\n`

    for (let row of rows) {
        const rowDate = new Date(METEOCIEL_DATE.getTime())
        rowDate.setHours(row.heureLocale)
        turtle += `
            ex:meteociel sosa:madeObservation [
                a sosa:Observation ;
                sosa:observedProperty <http://example.com/saintetienne#temperature> ;
                sosa:hasSimpleResult "` + row.temperature + `"^^xsd:decimal ;
                sosa:resultTime "` + rowDate.toISOString() + `"^^xsd:dateTime
            ] .\n`
        turtle += `
            ex:meteociel sosa:madeObservation [
                a sosa:Observation ;
                sosa:observedProperty <http://example.com/saintetienne#humidity> ;
                sosa:hasSimpleResult "` + row.humidite + `"^^xsd:decimal ;
                sosa:resultTime "` + rowDate.toISOString() + `"^^xsd:dateTime
            ] .\n`
        turtle += `
            ex:meteociel sosa:madeObservation [
                a sosa:Observation ;
                sosa:observedProperty <http://example.com/saintetienne#atmosphericPressure> ;
                sosa:hasSimpleResult "` + row.pression + `"^^xsd:decimal ;
                sosa:resultTime "` + rowDate.toISOString() + `"^^xsd:dateTime
            ] .\n`
    }

    return turtle
}

async function main() {
    await initCacheFolder()
    await cacheFile(METEOCIEL_URL)

    const $ = await createCheerioContext(METEOCIEL_URL)
    const turtle = rowsToTurtle(iterMainTable($))
    await got(`http://${HOST}/emse`, {
        method: "POST",
        headers: { "Content-Type": "text/turtle" },
        body: turtle,
    })
}

main().catch(console.error)
