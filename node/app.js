const fs = require("fs")
const express  = require("express")
const fetch = require("node-fetch")
const geoip = require("geoip-ultralight")
const filestuff = require("./filestuff")
var   con       = require("./console")
const JSONdb = require("simple-json-db")
var   posts = require("./posts")
var   comments = require("./comments")
var   conf = require("./config")

// general TODO:
// config! ./config.js for some configuration in js just some form stuff
// posts.rank timer config'n stuff
// ip-tkn cleaner & conf ip-tks-cleaner
//
// comment functions (see ./comments.js)
// IP-tokens as "csrf", mby
//
// logging levels
// none - well none
// basic - access + creation of comments into logfile
// hacker - same same but in output
// paranoid - log everything (also shell)


const app = express()
const port = 5500

// express static stuff sites:
app.get("/", (req, res) => filestuff.readFS(req, res, "html/index.html", "text/html"))
app.use("/static", express.static("html"))

// console commands:
con.registercmd( "stop", () => shutdown() )
con.registercmd( "appeval", (arg) => {try {console.log(eval(arg.join(" ")))} catch {console.log("Couldn't execute!")}})

// comment command
con.registercmd( "comment", (arg => {
	let t
	let body
	sw:
	switch (arg[0]) {
		case "get":
			if (!arg[1]) return console.log("Nothing to get!")
			if (!arg[2]) {      console.log("No commentID, dumping all")
				let len = commentDB.get( arg[1] + "-len" )
				let ret = []
				for (let i = 0 ; i > len ; i++ ) {
					ret.push( commentDB.get( arg[1] + "-" + i ) )
				}
				return console.log(ret)
			} else {
				console.log( commentDB.get( arg[1] + "-" + arg[2] ) )
			}
			break

		case "push":
			if (!arg[1] || !arg[2] || !arg[3] || !arg[4]) {
				return console.log("Not all args specified!\nUsage: comment push <post> <time> <author> <content>...")
			}
			body = Object.assign([], arg)
			body.shift()
			body.shift()
			body.shift()
			body.shift()
			body.shift()

			let time = arg[2]
			if (arg[2] == "auto") {
				time = new Date().getTime()
				console.log( "Auto-time: using time: " + time)
			}
			console.log( comments.push(arg[1], {
			"time":  time,
			"author":arg[3],
			"body":  body.join(" ")
			}) )
			break

		case "set":
			if ( !arg[1] ) return console.log("No post ID specified!")
			if ( !arg[2] ) return console.log("No content specified!")

			body = Object.assign([], arg[3])
			body.shift()
			body.shift()

			console.log( comments.set( arg[1], { "body":body.join(" ") } ) )		
			break

		case "sync":
			console.log("syncing...")
			t = commetsDB.sync()
			if (t) console.log(t)
			console.log("DONE!")
			break

		default:
			console.log("Sub-command not found or not supplied!")
				

		case "?":
		case "h":
		case "help":
			console.log("Availible cmds: get, sync, push, set")
			break
	}
}))

con.registercmd( "post", (arg => {
	let t
	sw:
	switch (arg[0]) {
		case "get":
			if (!arg[1]) {
					console.log("Nothing to get!")
				} else {
					console.log(postsDB.get(arg[1]))
				}
				break
		
		case "ranking":
			if (arg[1]) {
				console.log(posts.ranking[arg[1]])
				break sw
			} else {
				let keys = Object.keys(posts.ranking)
				for ( let i = 0 ; i < keys.length ; i++ ) {
					console.log(keys[i] + ":")
					console.log(posts.ranking[keys[i]])
				}
				break sw
			}

		case "rank":
			console.log("Ranking...")
			t = posts.rank()
			if (t) console.log(t)
			console.log("DONE!")
			break

		case "sync":
			console.log("syncing...")
			t = postsDB.sync()
			if (t) console.log(t)
			console.log("DONE!")
			break

		default:
			console.log("Sub-command not found or not supplied!")
				

		case "?":
		case "h":
		case "help":
			console.log("Availible cmds: get, ranking, rank")
			break
	}
}))

// shutdown:
function shutdown() {
	process.exit(1)
}

// readout jsonDB:
const postsDB = new JSONdb("storage/posts.json")
posts.init(postsDB)
posts.rank()

// readout comments:
const commentDB = new JSONdb("storage/comments.json")
comments.init(commentDB)

// posts:
app.get("/posts", (req, res) => {
	if( typeof( req.query.api ) != "undefined" ) {
		res.type( "application/json" )
		if( ! ( req.query.len < 50 ) )  {
			res.status( 400 )
			res.end( JSON.stringify({"type":"err","text":"no len or to high specified"}) )		
		} else {
			res.status( 200 )
			res.send(`{"type":"s","content":${JSON.stringify(posts.read(10, "hot"))}}`)
		}
	} else {
		res.status( 200 )
		filestuff.readFSr(req, res, "html/posts/index.html", "text/html", "\"a\"//<!--POST-DATA-INJECT-->//", JSON.stringify(postsDB.get(req.query.post)))
	}
})

// comments:
app.use(express.json())
app.use(express.urlencoded({extended: true}))
app.all("/comments", (req, res) => {
	res.type("application/json")
	let ret
	let waiting
	if ( req.body.body && req.body.ip && req.body.post ) {
		console.log("commentetded!")
		// get ip from tkn
		waiting = true
		fetch("https://derzombiiie.com/getip.php?token="+req.body.ip).then(
			d => d.text()).then(data=>{
			if (data == "") {
				res.end(JSON.stringify({"type":"err","text":"ip-tkn"}))
				return
			}
			ret = comments.push(req.body.post, {
				"time":  new Date().getTime(),
				"author":data,
				"authorinfo":{"country":geoip.lookupCountry(data)},
				"body":  req.body.body
			})
			if ( ret.type == "err" ) res.status( 400 )
			res.end(JSON.stringify( ret ))
		})
	}
	
	if ( req.query.post ) {
		ret = comments.get(req.query.post, req.query.len ? req.query.len : undefined)
		if ( ret.type == "err" ) res.status( 400 )
		res.end( JSON.stringify(ret) )
	}
	if ( !res.finished && !waiting ) {
		res.status ( 501 )
		res.end(JSON.stringify({"type":"err","text":"not implemented!"}))
	}
})

// debug stuff:
app.get("/debug/:action", (req, res) => {
	if( !conf.debug ) return res.end( "NO DEBUG!" )
	switch ( req.params.action ) {
		case "ip":
			res.end(req.ip)
			break

		case "ips":
			res.end(JSON.stringify( req.ips ))
			break
	}
})

app.listen(port, () => {
	console.log(`Server listening on http://localhost:${port}`)
	con.init()
})
