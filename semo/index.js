const express = require('express')
const engine = require('ejs-locals')
const app = express()
const http = require('http').Server(app)
const io = require('socket.io')(http)
const bodyParser = require('body-parser')
const path = require('path')
const mysql = require('mysql')
const cheerio = require('cheerio')

const db = mysql.createConnection({
	host: 'localhost',
	user: 'cs_semo',
	password: '',
	database: 'cs_semo',
	dateStrings: true,
})

db.connect()

var getCount = (type, search) => {
	// search : cate_id, keyword
	if(type == 'category') {
		return new Promise(function(resolve, reject) {
			db.query('SELECT count(post_idx) as count FROM posts WHERE post_title IS NOT NULL AND post_cate = ?', search, (error, results, fields) => {
				if(error) throw error
				resolve(results[0].count)
			})
		})
	} else if(type == 'keyword') {
		return new Promise(function(resolve, reject) {
			db.query('SELECT count(post_idx) as count FROM posts WHERE post_title IS NOT NULL AND post_title like "%' + search + '%"', (error, results, fields) => {
				if(error) throw error
				resolve(results[0].count)
			})
		})
	}
}

var viewCountUp = (post_idx) => {
	db.query('UPDATE posts SET post_view_count = post_view_count + 1 WHERE post_idx = ?', post_idx, (error, results, fields) => {})
}

var insertChatLog = (message) => {
	db.query('INSERT INTO messages SET ? ', {msg_content: message} , function(error, results, fields) {
		if(error) throw error
	})
}

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use('/assets', express.static(path.join(__dirname, 'assets')))
app.engine('ejs', engine)
app.set('view engine', 'ejs')

app.get('/robots.txt', function (req, res) {
    res.type('text/plain');
    res.send("User-agent: *\nAllow: /");
});

app.get('/', (req, res) => {
	db.query('SELECT * FROM `posts` WHERE post_date >= DATE(NOW()) - INTERVAL 14 DAY ORDER BY post_view_count DESC limit 5', function(error, results, fields) {
		if(error) throw error
		res.render(__dirname + '/views/main.ejs', {recommended: results})
	})
})

app.get('/intro', (req, res) => {
	res.render(__dirname + '/views/intro.ejs')
})

app.get('/main', (req, res) => {
	db.query('SELECT * FROM `posts` WHERE post_date >= DATE(NOW()) - INTERVAL 14 DAY ORDER BY post_source_view_count DESC limit 5', function(error, results, fields) {
		if(error) throw error
		res.render(__dirname + '/views/main.ejs', {recommended: results})
	})
})

app.get('/recommended', (req, res) => {
	db.query('SELECT * FROM `posts` WHERE post_date >= DATE(NOW()) - INTERVAL 14 DAY ORDER BY post_source_view_count DESC', function(error, results, fields) {
		if(error) throw error
		res.render(__dirname + '/views/postList.ejs', {type: 2, keyword: '추천 포스트', data: results, pagination: false})
	})
})

app.get('/postList/', (req, res) => {
	let categoryId = 1

	res.redirect('/postList/' + categoryId + '/1')
})

app.get('/postList/:categoryId/', (req, res) => {
	let categoryId = req.params.categoryId

	if(!categoryId) {
		categoryId = 1
	}

	res.redirect('/postList/' + categoryId + '/1')
})

app.get('/postList/:categoryId/:pageNumber', (req, res) => {
	let categoryId = parseInt(req.params.categoryId)
	let pageNumber = parseInt(req.params.pageNumber)
	let postsPerPage = 15

	if(!isNaN(categoryId) && !isNaN(pageNumber)) {
		if(!categoryId) { categoryId = 1 }
		if(!pageNumber) { pageNumber = 1 }
		let offset = (pageNumber - 1) * postsPerPage

		getCount('category', categoryId)
		.then((maxCount) => {
			let maxPage = parseInt(maxCount / postsPerPage) + 1
			let pagesPerPage = 5
			let currentPage = pageNumber
			let firstPage = currentPage % pagesPerPage == 0 ? currentPage - pagesPerPage + 1 : parseInt(currentPage / pagesPerPage) * 5 + 1
			let lastPage = firstPage + pagesPerPage - 1
			let prevActive = currentPage <= pagesPerPage ? false : true
			let nextActive = currentPage > (parseInt(maxPage / pagesPerPage) * pagesPerPage) ? false : true

			let pagination = {
				categoryId: categoryId,
				maxPage: maxPage,
				pagesPerPage: pagesPerPage,
				currentPage: currentPage,
				firstPage: firstPage,
				lastPage: lastPage,
				prevActive: prevActive,
				nextActive: nextActive
			}

			db.query('SELECT * FROM posts, categories WHERE post_title IS NOT NULL AND post_cate = ? AND post_cate = cate_idx ORDER BY post_date DESC LIMIT ?, ?', [categoryId, offset, postsPerPage], (error, results, fields) => {
				if(error) throw error
				res.render(__dirname + '/views/postList.ejs', {type: 0, data: results, pagination: pagination})
			})
		})
	} else {
		res.redirect('/')
	}
})

app.get('/postSearch/:keyword/:pageNumber', (req, res) => {
	let keyword = req.params.keyword
	let pageNumber = parseInt(req.params.pageNumber)

	if(!isNaN(pageNumber)) {
		let postsPerPage = 15

		if(!keyword) { keyword = "" }
		if(!pageNumber) { pageNumber = 1 }
		let offset = (pageNumber - 1) * postsPerPage

		getCount("keyword", keyword)
		.then((maxCount) => {
			let maxPage = parseInt(maxCount / postsPerPage) + 1
			let pagesPerPage = 5
			let currentPage = pageNumber
			let firstPage = currentPage % pagesPerPage == 0 ? currentPage - pagesPerPage + 1 : parseInt(currentPage / pagesPerPage) * 5 + 1
			let lastPage = firstPage + pagesPerPage - 1
			let prevActive = currentPage <= pagesPerPage ? false : true
			let nextActive = currentPage > (parseInt(maxPage / pagesPerPage) * pagesPerPage) ? false : true

			let pagination = {
				keyword: keyword,
				maxPage: maxPage,
				pagesPerPage: pagesPerPage,
				currentPage: currentPage,
				firstPage: firstPage,
				lastPage: lastPage,
				prevActive: prevActive,
				nextActive: nextActive
			}

			db.query('SELECT * FROM posts, categories WHERE post_title IS NOT NULL AND post_title like "%' + keyword + '%" AND post_cate = cate_idx ORDER BY post_date DESC LIMIT ?, ?', [offset, postsPerPage], (error, results, fields) => {
				if(error) throw error
				res.render(__dirname + '/views/postList.ejs', {type: 1, keyword: keyword, data: results, pagination: pagination})
			})
		})
	} else {
		res.redirect('/')
	}
})

app.get('/postContent/:postId', (req, res) => {
	var postId = parseInt(req.params.postId)
	if(!isNaN(postId)) {
		db.query('SELECT * FROM posts, categories WHERE post_title IS NOT NULL AND post_idx = ? AND post_cate = cate_idx ORDER BY post_date DESC LIMIT 1', postId, (error, results, fields) => {
			if(error) throw error
			let result = results[0]
			if(result.cate_source_type == null) {
				result.post_original_url = '/'
			} else {
				if(result.cate_source_type == 0) {
					result.post_original_url = 'http://board.sejong.ac.kr/boardview.do?pkid=' + result.post_source_idx + '&siteGubun=19&bbsConfigFK=' + result.cate_source_idx
				} else if(result.cate_source_type == 1) {
					result.post_original_url = 'http://library.sejong.ac.kr/bbs/Detail.ax?bbsID=' + result.cate_source_idx + '&articleID=' + result.post_source_idx
				} else {
					result.post_original_url = '/'
				}	
			}


			result.post_attach = JSON.parse(result.post_attach)
			for(let i = 0 ; i < result.post_attach.length ; i++) {
				result.post_attach[i].url = 'http://board.sejong.ac.kr/' + result.post_attach[i].url
			}
			result.post_content = JSON.parse(result.post_content)
			result.post_content = result.post_content.replace(/src="\//g, "src=\"http://board.sejong.ac.kr/")
			$ = cheerio.load(result.post_content)
			//result.post_short_content = escape($.text()).slice(0, 61)
			viewCountUp(postId)
			res.render(__dirname + '/views/postContent.ejs', {data: result})
		})
	} else {
		res.redirect('/')
	}
})

app.get('/events', (req, res) => {
	db.query('SELECT event_idx, event_title, YEAR(event_start) as start_year, MONTH(event_start) as start_month, DAY(event_start) as start_day, YEAR(event_end) as end_year, MONTH(event_end) as end_month, DAY(event_end) as end_day FROM `events` GROUP BY event_idx, event_title, YEAR(event_start), MONTH(event_start), DAY(event_start), YEAR(event_end), MONTH(event_end), DAY(event_end)', (error, results, fields) => {
		if(error) throw error
		res.render(__dirname + '/views/events.ejs', {events: results})
	})
})

app.get('/help', (req, res) => {
	res.render(__dirname + '/views/help.ejs')
})

app.get('/contact', (req, res) => {
	res.render(__dirname + '/views/contact.ejs')
})

const curse = ["시발", "시1발", "새끼", "럼들", "시부럴", "시뷰럴", "씨부럴", "ㅅㅂ", "ㅂㅅ", "개새", "개새끼", "병신", "병신새끼", "븅신"]
const developers = ["김광현", "안홍섭", "유창현", "정원경"]
function getRandomInt(min, max) {
	return Math.floor(Math.random() * (max - min)) + min;
}

io.on('connection', (socket) => {
	socket.on('search', (data) => {
		if(data.message.length >= 2) {
			insertChatLog(data.message)
			var messageWithoutSpace = data.message.replace(/\s/g, '')
			if(messageWithoutSpace.includes("학사일정")) {
				if(messageWithoutSpace.includes("이번달") && messageWithoutSpace.includes("학사일정")) {
					db.query('SELECT event_idx, event_title, YEAR(event_start) as start_year, MONTH(event_start) as start_month, DAY(event_start) as start_day, YEAR(event_end) as end_year, MONTH(event_end) as end_month, DAY(event_end) as end_day FROM `events` WHERE YEAR(event_start) = YEAR(NOW()) AND MONTH(event_start) = MONTH(NOW()) GROUP BY event_idx, event_title, YEAR(event_start), MONTH(event_start), DAY(event_start), YEAR(event_end), MONTH(event_end), DAY(event_end)',  (error, results, fields) => {
						if(error) throw error
						socket.emit('search', {keyword: data.message, type: 1, results: results})
					})
				} else if((messageWithoutSpace.includes("저번달") || messageWithoutSpace.includes("지난달")) && messageWithoutSpace.includes("학사일정")) {
					let d = new Date()
					d.setMonth(d.getMonth() - 1)
					db.query('SELECT event_idx, event_title, YEAR(event_start) as start_year, MONTH(event_start) as start_month, DAY(event_start) as start_day, YEAR(event_end) as end_year, MONTH(event_end) as end_month, DAY(event_end) as end_day FROM `events` WHERE YEAR(event_start) = ' + d.getFullYear() + ' AND MONTH(event_start) = ' + (d.getMonth() + 1) + ' GROUP BY event_idx, event_title, YEAR(event_start), MONTH(event_start), DAY(event_start), YEAR(event_end), MONTH(event_end), DAY(event_end)',  (error, results, fields) => {
						if(error) throw error
						socket.emit('search', {keyword: data.message, type: 1, results: results})
					})
				} else if((messageWithoutSpace.includes("다음달") || messageWithoutSpace.includes("내달")) && messageWithoutSpace.includes("학사일정")) {
					let d = new Date()
					d.setMonth(d.getMonth() + 1)
					db.query('SELECT event_idx, event_title, YEAR(event_start) as start_year, MONTH(event_start) as start_month, DAY(event_start) as start_day, YEAR(event_end) as end_year, MONTH(event_end) as end_month, DAY(event_end) as end_day FROM `events` WHERE YEAR(event_start) = ' + d.getFullYear() + ' AND MONTH(event_start) = ' + (d.getMonth() + 1) + ' GROUP BY event_idx, event_title, YEAR(event_start), MONTH(event_start), DAY(event_start), YEAR(event_end), MONTH(event_end), DAY(event_end)',  (error, results, fields) => {
						if(error) throw error
						socket.emit('search', {keyword: data.message, type: 1, results: results})
					})
				} else if(messageWithoutSpace.includes("월") && messageWithoutSpace.includes("학사일정")) {
					let d = new Date()
					db.query('SELECT event_idx, event_title, YEAR(event_start) as start_year, MONTH(event_start) as start_month, DAY(event_start) as start_day, YEAR(event_end) as end_year, MONTH(event_end) as end_month, DAY(event_end) as end_day FROM `events` WHERE YEAR(event_start) = ' + d.getFullYear() + ' AND MONTH(event_start) = ' + messageWithoutSpace.match(/\d+/g)[0] + ' GROUP BY event_idx, event_title, YEAR(event_start), MONTH(event_start), DAY(event_start), YEAR(event_end), MONTH(event_end), DAY(event_end)',  (error, results, fields) => {
						if(error) throw error
						socket.emit('search', {keyword: data.message, type: 1, results: results})
					})
				} else {
					db.query('SELECT event_idx, event_title, YEAR(event_start) as start_year, MONTH(event_start) as start_month, DAY(event_start) as start_day, YEAR(event_end) as end_year, MONTH(event_end) as end_month, DAY(event_end) as end_day FROM `events` WHERE YEAR(event_start) = YEAR(NOW()) AND MONTH(event_start) = MONTH(NOW()) GROUP BY event_idx, event_title, YEAR(event_start), MONTH(event_start), DAY(event_start), YEAR(event_end), MONTH(event_end), DAY(event_end)',  (error, results, fields) => {
						if(error) throw error
						socket.emit('search', {keyword: data.message, type: 1, results: results})
					})
				}
			} else if(curse.indexOf(messageWithoutSpace) > -1) {
				let answer = [
					"세모도 사이버감정노동자랍니다.. 저에게 욕을 하지 말아주세요 ㅠㅠ",
					"심한 말은 하지 말아주세요!",
					"바른말 고운말을 사용합시다 :)",
					"세모는 당신을 사랑해요."
				]
				socket.emit('search', {keyword: data.message, type: 0, results: [{post_title: answer[getRandomInt(0, answer.length)]}]})
			} else if(developers.indexOf(messageWithoutSpace) > -1) {
				let answer = [
					"<p>이 서비스는 유창현 김광현 정원경 안홍섭이 개발하였습니다. 문의 사항이 있다면 이용문의 페이지를 이용해주세요.</p><p>기획: 유창현 김광현 정원경 안홍섭<p>개발: 유창현 김광현 정원경 안홍섭</p><p>디자인: 유창현 김광현 정원경 안홍섭</p><p>고생: 유창현 김광현 정원경 안홍섭</p><p>잠못잠: 유창현 김광현 정원경 안홍섭</p><p>카페인중독: 유창현 김광현 정원경 안홍섭</p><p>두통: 유창현 김광현 정원경 안홍섭</p><p>복통: 유창현 김광현 정원경 안홍섭</p><p>거북목: 유창현 김광현 정원경 안홍섭</p><p>안구건조: 유창현 김광현 정원경 안홍섭</p><p>손목터널: 유창현 김광현 정원경 안홍섭</p><p>집에가고싶음: 유창현 김광현 정원경 안홍섭</p><p>엄마보고싶음: 유창현 김광현 정원경 안홍섭</p><p>아빠도보고싶음: 유창현 김광현 정원경 안홍섭</p><p>아버지: 날보고 있다면 정답을 알려줘</p>"
				]
				socket.emit('search', {keyword: data.message, type: 0, results: [{post_title: answer[getRandomInt(0, answer.length)]}]})
			} else {
				db.query('SELECT * FROM posts, categories WHERE post_title IS NOT NULL AND post_title like "%' + data.message + '%" AND post_cate = cate_idx ORDER BY post_date DESC LIMIT 5', (error, results, fields) => {
					if(error) throw error
					if(results.length == 0) {
						db.query('SELECT * FROM posts, categories WHERE post_title IS NOT NULL AND post_cate = 1 AND post_cate = cate_idx ORDER BY post_date DESC LIMIT 5', (error, results, fields) => {
							if(error) throw error
							socket.emit('search', {keyword: data.message, type: 0, results: [], recentlyResults: results})
						})
					} else {
						socket.emit('search', {keyword: data.message, type: 0, results: results})
					}
				})
			}
		}
	})
})

http.listen(3000, () => {
	console.log('listening on *:3000')
})
