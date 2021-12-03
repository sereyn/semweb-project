import got from 'got'
import zlib from 'zlib'
import papa from 'papaparse'

const links = {
	basics: 'https://datasets.imdbws.com/title.basics.tsv.gz'
}

function main() {
	const gunzip = zlib.createGunzip()

	papa.parse<any>(got.stream(links.basics).pipe(gunzip) as any, {
		header: true,
		delimiter: '\t',
		step: res => console.log(res.data)
	})
}

main()
