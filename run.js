// Modules
const fs = require('fs')
const readline = require('readline')
const execSync = require('child_process').execSync

// Constants
const stickerdir = "stickers"

// Command line argument 1: Data directory
const datadir = process.argv[2]
if (!datadir) console.error('Argument 1 missing: data directory')
// Command line argument 2: Date from
var date_from = process.argv[3]
// Command line argument 3: Date to
var date_to = process.argv[4]
date_from = date_from ? new Date(date_from) : 0
date_to = date_to ? new Date(date_to) : Infinity

console.log('Date range: ', date_from, date_to)

// Helper functions
const buf2text = buf => new TextDecoder().decode(buf)
const md5_rx = new RegExp('MD5 \\((?<path>.*?)\\) = (?<hash>.*?)$', 'gms')
// 'MD5 (data/00000533-STICKER-2021-04-10-22-50-21.webp) = 8ede3042147f97c960f83c89e92b904e',
const hash_files = paths => {
    const res = buf2text(execSync('md5 ' + paths.join(' ')))
    return [...res.matchAll(md5_rx)].map(m => ({ ...m.groups }))
}

// Read stickers to count and calculate their hash
var needles = fs.readdirSync(stickerdir)
console.log(`Stickers to count: ${needles.join(',')}`)
needles = needles
    .filter(a => a.endsWith('.webp'))
    .map(a => {
        const path = stickerdir + '/' + a
        return hash_files([path])[0]
    })

// Read directory and search for stickers
console.log(`Reading data directory: ${datadir}`)
var haystack = fs.readdirSync(datadir)
    .filter(a => a.includes('STICKER')) // Get stickers only
    .map(a => datadir + '/' + a)
console.log(`Found ${haystack.length} stickers`)
haystack = hash_files(haystack)

// Filter haystack hashes by hash of needles
const matches = haystack
    .filter(a => needles.findIndex(b => b.hash == a.hash) != -1)
    .map(a => a.path)

console.log(`Matching stickers ${matches.length}`)


// Read chat, stream based for speed
var authors = {}
const chat_path = datadir + '/' + '_chat.txt'
const chat_txt = fs.readFileSync(chat_path)
const msg_rx = new RegExp('.*?\\[(?<date>.*?), (?<time>.*?)\\] (?<author>.*?):.*?<attached: (?<attached>.*?)>', 'g')
// [05/02/2022, 01:13:44] John Doe: <attached: 00007563-STICKER-2022-02-05-01-13-44.webp
var chat = readline.createInterface({ input: fs.createReadStream(chat_path) })
.on('line', function (line) {
    // Parse the message on the line
    const result = [...line.matchAll(msg_rx)].map(m => ({ ...m.groups }))
    if (result.length == 0) return
    const { date, time, author, attached } = result[0]
    const [ dd, mm, yyyy ] = date.split('/')
    const date_obj = new Date(yyyy + '-' + mm + '-' + dd)

    // Filter date range
    if (date_obj < date_from || date_obj > date_to) return

    // Check if the attachment is n the matches
    if (matches.findIndex(v => v == attached) != -1) return

    // Increment author sticker count
    authors[author] = (authors[author] || 0) + 1
})
.on('close', function () {
    let names = Object.entries(authors)

    // Sort by amount of stickers
    names = names.sort((a, b) => b[1] - a[1])

    // Print
    names.forEach(n => console.log(n[1] + "\t" + n[0]))
})
