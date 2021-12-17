import got from 'got'
import fs from 'fs'
import { URL } from 'url'
import path from 'path'

const url = new URL("https://seafile.emse.fr/seafhttp/files/e9e5a465-a4b6-4976-841b-2d165a2123a9/20211116-daily-sensor-measures.csv")

got.stream(url)
.on("downloadProgress", p => console.log(p.percent))
.pipe(fs.createWriteStream(path.join(".", path.basename(url.pathname))))
