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

const METEOCIEL_URL = new URL(
    "https://www.meteociel.fr/temps-reel/obs_villes.php?code2=7475&jour2=16&mois2=10&annee2=2021"
)
const MAIN_TBODY_SELECTOR =
    "body > table:nth-child(1) > tbody > tr.texte > td:nth-child(2) > table > tbody > tr:nth-child(2) > td > table > tbody > tr > td > center:nth-child(14) > table:nth-child(3) > tbody"
const CACHE_FOLDER_PATH = path.join(".", "cache")

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

async function main() {
    // await initCacheFolder()
    // await cacheFile(METEOCIEL_URL)

    const $ = await createCheerioContext(METEOCIEL_URL)
    for (let i of iterMainTable($)) console.log(i)
}

main().catch(console.error)
