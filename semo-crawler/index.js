const Promise = require('bluebird') // promise를 편리하게 사용하기 위해 bluebird 모듈 사용
const cheerio = require('cheerio') // jQuery의 selector를 node.js에서 사용하기 위해 cheerio 모듈 사용
const http = require('http')
const bodyParser = require('body-parser')
const mysql = require('mysql')
const schedule = require('node-schedule')

// 데이터베이스 정보
const db = mysql.createConnection({
	host: 'localhost',
	user: 'cs_semo',
	password: '',
	database: 'cs_semo',
	collate: "utf8_unicode_ci",
})

// 데이터베이스 연결
db.connect()

// 카테고리 테이블 로드
var getCategories = () => {
	return new Promise(function(resolve, reject) {
		db.query('SELECT * FROM categories', (error, results, fields) => {
			if(error) throw error
			resolve(results)
		})
	})
}

var getPosts = (category_idx) => {
	return new Promise(function(resolve, reject) {
		db.query('SELECT * FROM posts WHERE post_title IS NULL and post_cate = ? limit 0, 255', category_idx, (error, results, fields) => {
			if(error) throw error
			resolve(results)
		})
	})
}

var getAllNullPosts = () => {
	return new Promise(function(resolve, reject) {
		db.query('SELECT * FROM posts, categories WHERE post_title IS NULL and posts.post_cate = categories.cate_idx', (error, results, fields) => {
			if(error) throw error
			resolve(results)
		})
	})
}

// 원본 고유값으로 포스트 로드
var getPostBySourceIdx = (post_cate, post_source_idx) => {
	return new Promise(function(resolve, reject) {
		db.query('SELECT * FROM posts WHERE post_source_idx = ? and post_cate = ?', [post_source_idx, post_cate], (error, results, fields) => {
			if(error) throw error
			resolve(results)
		})
	})
}

// 포스트 데이터 업데이트
var updatePost = (post) => {
	return new Promise(function(resolve, reject) {
		db.query('UPDATE posts SET ? WHERE post_idx = ?', [post, post.post_idx], function(error, results, fields) {
			if(error) throw error
			resolve(results)
			return ({error: false, data: results, message: 'updated successfully'})
		})
		// console.log('post updated successfully.', post.post_idx, post.post_source_idx, post.post_title)
	})
}


// 포스트 존재 여부 확인
var isExist = (post_cate, post_source_idx) => {
	return new Promise(function(resolve, reject) {
		getPostBySourceIdx(post_cate, post_source_idx)
		.then(post => {
			if(post.length)
				resolve(true)
			else
				resolve(false)
		})
	})
}


// 포스트가 존재하지 않으면 포스트 저장
var insertPost = (post, cate_source_type, cate_source_idx) => {
	return new Promise(function(resolve, reject) {
		isExist(post.post_cate, post.post_source_idx)
		.then(isExist => {
			if(!isExist) {
				db.query('INSERT INTO posts SET ? ', post, function(error, results, fields) {
					if(error) throw error
					// getPost(cate_source_type, post, cate_source_idx)
					// 	.then(postData => updatePost(postData).then(() => { resolve(true) }))
					// 	.catch(err => console.error(err))
					getAllNullPostsData()
				})
				// console.log("post inserted successfully.")
				// getAllNullPostsData()
				// resolve(true)
			} else {
				reject()
			}
		})
	})
}


// 특정 url의 html 코드를 로드
// 한글이 깨지지 않도록 인코딩을 utf-8로 설정
var fetch = url => {
	return new Promise(function(resolve, reject) {
		http.get(url, res => {
			var body = ""
			res.setEncoding('utf-8')
			res.on('data', chunk => { body += chunk })
			res.on('end', () => { resolve(body) })
		})
	})
}

// 게시판 URL 형태로 변환
var getUrl = (cate_source_type, bbsId, currentPage) => {
	if(cate_source_type == 0)
		return "http://board.sejong.ac.kr/boardlist.do?searchField=ALL&searchValue=&currentPage=" + currentPage + "&searchLowItem=ALL&bbsConfigFK=" + bbsId + "&siteGubun=19&menuGubun=1"
	else if(cate_source_type == 1)
		return "http://library.sejong.ac.kr/bbs/Bbs.ax?bbsID=" + bbsId + "&currentPage=" + currentPage + "&pageSize=10"
}


// { 제목, 링크, 작성자명, 작성일, 조회수 }로 구성
// cheerio는 jQuery의 코어를 사용하기 때문에 jQuery selector를 이용하여 원하는 데이터 추출 가능
// 목록에서 가장 정확한 데이터는 카테고리와 링크이기 때문에 카테고리와 링크 데이터만 데이터베이스에 저장
var getPostsInCurrentPage = (cate_source_type, cateIdx, boardId, currentPage) => {
	return new Promise(function(resolve, reject) {
	fetch(getUrl(cate_source_type, boardId, currentPage))
		.then(body => {
			$ = cheerio.load(body)
			if(cate_source_type == 0) {
				let maxCount = $('.text-board tbody tr').length
				$('.text-board tbody tr').each((index, elem) => {
					(async function loop() {
						await (function() {
							return new Promise(function(innerResolve, innerReject) {
								let post = {}
								let $elem = cheerio.load(elem)
								post.post_cate = cateIdx
								post.post_source_idx = $elem('td.subject').children('a').attr('href').match(/pkid=([0-9]+)/)[1]
								if(!$elem('td.index').children('img').length) {
									insertPost(post, cate_source_type, boardId)
									.then(() => {})
									.catch(() => {})
									.done(() => {
										if(index == maxCount - 1) { 
											resolve()
										} else {
											innerResolve()
										}
									})
								}
							})
						})()

					})()
				})
			} else if(cate_source_type == 1) {
				let maxCount = $('#frmBbs table.tb01 tbody tr')
				$('#frmBbs table.tb01 tbody tr').each((index, elem) => {
					(async function loop() {
						await (function() {
							return new Promise(function(innerResolve, reject) {
								let post = {}
								let $elem = cheerio.load(elem)
								post.post_cate = cateIdx
								post.post_source_idx = $elem('td.subject').children('a').attr('href').match(/(articleID=)+([0-9]+)/g, '')[0].split("=")[1]
								insertPost(post, cate_source_type, boardId)
								.then(() => {})
								.catch(() => {})
								.done(() => {
									// console.log(post.post_source_idx)
									if(index == maxCount - 1) { 
										resolve()
									} else {
										innerResolve()
									}
								})
							})
						})()

					})()
				})
			}
		})
		.catch(err => { throw err })
	})
}

// 특정 포스트 데이터 크롤링
var getPost = (cate_source_type, post, board_idx) => {
	return new Promise((resolve, reject) => {
		if(cate_source_type == 0) {
			fetch('http://board.sejong.ac.kr/boardview.do?pkid=' + post.post_source_idx + '&siteGubun=19&bbsConfigFK=' + board_idx)
				.then(body => {
					$ = cheerio.load(body)
					let postData = {}
					postData.post_idx = post.post_idx
					postData.post_source_idx = post.post_source_idx
					postData.post_title = $('td.subject-value').text().trim().replace("\\xF1\\x9F\\xAD\\x92", "")
					postData.post_writer = $('td.writer').text().trim()
					postData.post_date = $('td.date').text().trim()
					postData.post_source_view_count = $('td.count').text().trim()
					postData.post_attach = []
					$('td.attach').eq(0).find('ul.item-list li a').each((index, elem) => {
						let $attach = cheerio.load(elem)
						let attach = {
							title: $attach.text().trim(),
							url: elem.attribs.href
						}
						postData.post_attach.push(attach)
					})
					postData.post_attach = JSON.stringify(postData.post_attach)
					postData.post_content = JSON.stringify($('td.content').html().trim())
					resolve(postData)
				})
				.catch(err => { throw err })
		} else if(cate_source_type == 1) {
			fetch('http://library.sejong.ac.kr/bbs/Detail.ax?bbsID=' + board_idx + '&articleID=' + post.post_source_idx)
				.then(body => {
					$ = cheerio.load(body)
					let postData = {}
					postData.post_idx = post.post_idx
					postData.post_source_idx = post.post_source_idx
					postData.post_title = $('.contents span.boardTd').eq(0).text().trim()
					postData.post_writer = $('.contents span.boardTd').eq(1).text().trim()
					postData.post_date = $('.contents span.boardTd').eq(2).text().trim().replace(/\//g, "-")
					postData.post_source_view_count = $('.contents span.boardTd').eq(3).text().trim()
					postData.post_attach = []
					// console.log($('fieldset.flash').html())
					$('fieldset.flash .attachBox a').each((index, elem) => {
						// console.log(index)
						let $attach = cheerio.load(elem)
						let attach = {
							title: $attach.text().trim(),
							url: elem.attribs.href
						}
						postData.post_attach.push(attach)
					})
					postData.post_attach = JSON.stringify(postData.post_attach)
					if($('.xed').html().length) postData.post_content = JSON.stringify($('.xed').html().trim())
					resolve(postData)
				})
				.catch(err => { throw err })
		}
	})
}



// 특정 게시판의 마지막 페이지 번호
var getLastPageNumber = (cate_source_type, boardId) => { 
	return new Promise((resolve, reject) => {
		fetch(getUrl(cate_source_type, boardId, 1)).then(body => {
			if(cate_source_type == 0) {
				$ = cheerio.load(body)
				let $elem = cheerio.load($('.pagination').html())
				resolve($elem('a')[$elem('a').length - 1].attribs.onclick.replace(/[^0-9\.]+/g, ''))	
			} else if(cate_source_type == 1) {
				$ = cheerio.load(body)
				let $elem = cheerio.load($('.pager').html())
				resolve($elem('a')[$elem('a').length - 1].attribs.href.replace(/[^0-9]+/g, ''))
			}
		})
	})
}

// 특정 게시판의 모든 글을 로드
var getPostsInTheBoard = (cate_source_type, cateIdx, boardId, maxPage) => {
	(async function loop() {
		for(var i = 1 ; i <= maxPage ; i++) {
			await getPostsInCurrentPage(cate_source_type, cateIdx, boardId, i)
		}
	})()
}


// 모든 게시판의 글을 로드
var getPostsInTheEntireBoard = () => {
	getCategories().then(categories => {
		(async function loop() {
			for(var i = 0 ; i < categories.length ; i++) {
				await getLastPageNumber(categories[i].cate_source_type, categories[i].cate_source_idx)
					.then( lastPageNumber => getPostsInTheBoard(categories[i].cate_source_type, categories[i].cate_idx, categories[i].cate_source_idx, lastPageNumber) )
					.catch( err => console.error(err) )
			}
		})()
	})
}

// 모든 게시판의 1페이지 글을 로드
var getPostsIn1stPage = () => {
	return new Promise((resolve, reject) => {
		getCategories()
		.then(categories => {
			(async function loop() {
				for(var i = 0 ; i < categories.length ; i++) {
					await getPostsInCurrentPage(categories[i].cate_source_type, categories[i].cate_idx, categories[i].cate_source_idx, 1)
				}
			})()
		})
	})
}

// 상세 데이터가 없는 글을 업데이트
var getAllNullPostsData = () => {
	getAllNullPosts()
	.then(nullPosts => {
		(async function loop() {
			// console.log(nullPosts.length + '개의 포스트 데이터')
			if(nullPosts.length == 0) process.exit()
			for(var i = 0 ; i < nullPosts.length ; i++) {
				await getPost(nullPosts[i].cate_source_type, nullPosts[i], nullPosts[i].cate_source_idx)
					.then(postData => updatePost(postData).then(() => { /*if(i == nullPosts.length - 1) process.exit()*/ }))
					.catch(err => console.error(err))
			}
		})()
	})
}

// getPostsIn1stPage()
// getPostsInTheEntireBoard()
// getAllNullPostsData()


// var rule = new schedule.RecurrenceRule()
// rule.minute = 1

// var j = schedule.scheduleJob('*/4 * * * *', function() {
// 	console.log("RECURRENCE CRAWLING")
// 	getPostsIn1stPage()
// })

// getAllNullPostsData();
setInterval(function() {
	console.log("RECURRENCE CRAWLING")
	getPostsIn1stPage()
}, 300000)