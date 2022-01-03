import * as cheerio from 'cheerio'
import got from 'got'
import fs, { PathLike } from 'fs'
import path from 'path'
import { URL } from 'url'

const url = new URL("https://www.meteociel.fr/temps-reel/obs_villes.php?code2=7475&jour2=16&mois2=10&annee2=2021")
const selector = "body > table:nth-child(1) > tbody > tr.texte > td:nth-child(2) > table > tbody > tr:nth-child(2) > td > table > tbody > tr > td > center:nth-child(14) > table:nth-child(3) > tbody"
const filePath = path.join(".", "meteociel")


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

function grabElement(file: string, selector: string) {
    let $ = cheerio.load(file)
    console.log($(selector).each(el => {
        // TODO
    }))
}

function main() {
    fetchFile(url)
    .then(() => grabElement(filePath, selector))
    .catch(console.error)
}

main()