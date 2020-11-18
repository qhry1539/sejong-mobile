var app = {
  init: function() {
    this.header.init();
    this.chat.init();
    this.share.init();
  },
  intro: {
    init: function() {

      // intro slider
      $slider = $('.introSlider');
      $slider.slick({
        arrows: false,
        dots: true,
        infinite: false
      });
      // /intro slider

      $('.introSliderButton.next').on('click', function(e) {
        $slider.slick('slickNext');
      });

      $slider.on('afterChange', function(slick, currentSlide) {
        if(currentSlide.currentSlide == $slider.find('.slick-slide').length - 1) {
          $('.introSliderButton.next').hide();
          $('.introSliderButton.done').show();
        } else {
          $('.introSliderButton.next').show();
          $('.introSliderButton.done').hide();
        }
      })

      $('.introSliderButton.done').on('click', function(e) {
        e.preventDefault();
        localStorage.setItem('semoIntroChecked', true)
        location.href = '/';
      })

      $('.introSliderButton.skip').on('click', function(e) {
        e.preventDefault();
        localStorage.setItem('semoIntroChecked', true)
        location.href = '/';
      })
    }
  },
  header: {
    init: function() {
      $('.goBack').on('click', function() {
        window.history.back();
      });

      $('.goHome').on('click', function() {
        location.href = '/';
      })

      $('.search').on('click', function() {
        $('.chat.container').addClass('active');
        $('.chat.container input[name="messageInput"]').focus();
        $('body').addClass('chat-open');
      });
    }
  },
  main: {
    init: function() {
      if(!localStorage.getItem('semoIntroChecked')) {
        location.href = '/intro';
      }
    }
  },
  chat: {
    socket: io(),
    init: function() {
      $('.floatingChatButton').on('click', function() {
        $('.chat.container').toggleClass('active');
        $('body').toggleClass('chat-open');
      });

      $('.closeChat').on('click', function() {
        $('.chat.container').removeClass('active');
        $('body').removeClass('chat-open');
      });

      $('.chat.container input[name="messageInput"]').on('focus', function() {
        app.chat.interaction.scroll.bottom($('.chat .contentContainer'))
      });

      $('.chat.container input[name="messageInput"]').keydown(function(e){
        if(e.keyCode == 13) { app.chat.send(); }
      });

      $(document).on('click', '.chatInputContainer .send', function() {
        app.chat.send();
      });

      app.chat.socket.on('search', function(data) {
        $('.chatContentContainer').append(app.chat.message.answer(data))
        app.chat.interaction.scroll.bottom($('.chat .contentContainer'))
      });

      var eggCounter = 0;
      $(document).on('click', '.chatContentContainer .profileImageContainer', function() {
        eggCounter++;
        if(eggCounter == 5) {
          var message = "유창현";
          var data = {
            userid: app.chat.socket.io.engine.id,
            message: message
          }
          $('.chatContentContainer').append(app.chat.message.user(data))
          app.chat.interaction.scroll.bottom($('.chat .contentContainer'))
          app.chat.socket.emit('search', data);
        }
      })
    },
    send: function() {
        var message = $('.chat.container input[name="messageInput"]').val().trim();
        if(message.length >= 2) {
          $('.chat.container input[name="messageInput"]').val('');
          var data = {
            userid: app.chat.socket.io.engine.id,
            message: message
          }
          $('.chatContentContainer').append(app.chat.message.user(data))
          app.chat.interaction.scroll.bottom($('.chat .contentContainer'))
          app.chat.socket.emit('search', data);
        } else {
          alert("두 글자 이상 적어주세요 :)")
          if(message.length == 0) { $('.chat.container input[name="messageInput"]').val('').focus() }
          else { $('.chat.container input[name="messageInput"]').focus() }
          return false;
        }
    },
    message: {
      answer: function(data) {
        var responseList = ""
        if(data.type == 0) {
          if(data.results.length) {
            var answerMessage = '원하는 "' + data.keyword + '" 정보를 선택하세요 :)'
            $.each(data.results, function(index, value) {
              responseList += '<li><span class="writer">' + value.post_writer + '[' + value.cate_title + ']' + '</span><a href="/postContent/' + value.post_idx + '">' + value.post_title + '</a></li>'
            })
          } else {
            var answerMessage = '"' + data.keyword + '" 관련 정보가 존재하지 않습니다.<br>대신에 이런 정보는 어떠세요?'
            $.each(data.recentlyResults, function(index, value) {
              responseList += '<li><span class="writer">' + value.post_writer + '[' + value.cate_title + ']' + '</span><a href="/postContent/' + value.post_idx + '">' + value.post_title + '</a></li>'
            })
          }
          if(data.results.length >= 5) {
            var loadMoreButton = '<a href="/postSearch/' + data.keyword + '/1" class="btn loadMore">"' + data.keyword + '" 검색결과 더보기</a>'
          } else {
            var loadMoreButton = ""
          }
          elem = ''
                + '<div class="messageContainer responder">'
                  + '<div class="profileImageContainer"><i class="material-icons">tag_faces</i></div>'
                  + '<div class="messageBox">'
                    + '<div class="userTitle">'
                      + '<span>세모</span>'
                    + '</div>'
                    + '<div class="messageText">'
                      + '<p>'
                        + answerMessage
                      + '</p>'
                    + '</div>'
                    + '<div class="responseResultContainer">'
                      + '<ul class="responseList">'
                        + responseList
                      + '</ul>'
                      + loadMoreButton
                    + '</div>'
                  + '</div>'
                + '</div>';
          return elem;
        } else if(data.type == 1) {
          if(data.results.length) {
            var answerMessage = data.results[0].start_year + "년 " + data.results[0].start_month + "월에 " + data.results.length + '개의 일정이 있어요 :)'
            $.each(data.results, function(index, value) {
              if(value.start_month == value.end_month && value.start_day == value.end_day) {
                responseList += '<li><span class="eventDate"><i class="material-icons">calendar_today</i>' + value.start_month + '월 ' + value.start_day + '일</span><span class="eventTitle">' + value.event_title + '</span></li>'  
              } else {
                responseList += '<li><span class="eventDate"><i class="material-icons">calendar_today</i>' + value.start_month + '월 ' + value.start_day + '일 - ' + value.end_month + '월 ' + value.end_day + '일</span><span class="eventTitle">' + value.event_title + '</span></li>'  
              }
            })
            var loadMoreButton = '<a href="/events/" class="btn loadMore">전체 학사일정 보기</a>'
          } else {
            var answerMessage = data.results[0].start_year + "년 " + data.results[0].start_month + "월엔 학사일정이 없어요 :)<br>전체일정을 확인해볼까요?"
            var loadMoreButton = '<a href="/events/" class="btn loadMore">전체 학사일정 보기</a>'
          }
          elem = ''
                + '<div class="messageContainer responder">'
                  + '<div class="profileImageContainer"><i class="material-icons">tag_faces</i></div>'
                  + '<div class="messageBox">'
                    + '<div class="userTitle">'
                      + '<span>세모</span>'
                    + '</div>'
                    + '<div class="messageText">'
                      + '<p>'
                        + answerMessage
                      + '</p>'
                    + '</div>'
                    + '<div class="responseResultContainer">'
                      + '<ul class="responseList">'
                        + responseList
                      + '</ul>'
                      + loadMoreButton
                    + '</div>'
                  + '</div>'
                + '</div>';
          return elem;
        }
      },
      user: function(data) {
        elem = ''
              + '<div class="messageContainer user">'
                  + '<div class="profileImageContainer"><i class="material-icons">tag_faces</i></div>'
                  + '<div class="messageBox">'
                    + '<div class="userTitle">'
                      + '<span>나</span>'
                    + '</div>'
                    + '<div class="messageText">'
                      + '<p>'
                        + data.message
                      + '</p>'
                    + '</div>'
                  + '</div>'
                + '</div>';
        return elem;
      }
    },
    interaction: {
      scroll: {
        bottom: function(elem) {
          elem.animate({scrollTop: $('.chat .chatContentContainer').height()}, 600, $.bez([0.65, 0.05, 0.36, 1]));
        }
      }
    },
    example: function(elem) {
      var keyword = $(elem).data('keyword');
      $('.chat.container input[name="messageInput"]').val(keyword);
      $('.chatInputContainer .send').trigger('click');
      $('.chat.container input[name="messageInput"]').val();
    }
  },
  events: {
    init: function() {
      var cal = $( '#calendar' ).calendario({
        displayWeekAbbr: true,
      });

      var date = new Date()
      var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      $('.custom-month').text(months[date.getMonth()])
      $('.custom-year').text(date.getFullYear())

      $( '#custom-next' ).on( 'click', function() {
        cal.gotoNextMonth( updateMonthYear );
      } );
      $( '#custom-prev' ).on( 'click', function() {
        cal.gotoPreviousMonth( updateMonthYear );
      } );

      function updateMonthYear() {        
        $('.custom-month').html( cal.getMonthName() );
        $('.custom-year').html( cal.getYear() );
      }
    }
  },
  help: {
    init: function() {

      // help slider
      $slider = $('.helpSlider');
      $slider.slick({
        arrows: false,
        dots: true,
        infinite: false,
        // centerMode: true,
        slidesToShow: 4,
        slidesToScroll: 1,
        responsive: [
          {
            breakpoint: 1024,
            settings: {
              slidesToShow: 3,
            }
          },
          {
            breakpoint: 600,
            settings: {
              slidesToShow: 2,
            }
          },
          {
            breakpoint: 480,
            settings: {
              slidesToShow: 1,
            }
          },
        ]
      });
      // /help slider
    }
  },
  share: {
    init: function() {
      $('.shareThisPage').on('click', function(e) {
        e.preventDefault();
        $('.shareContainer').toggleClass('active');
      });

      $('.copyURL').on('click', function(e) {
        e.preventDefault();
        $('input.url').select();
        document.execCommand("copy");
        alert("링크를 복사했어요.\n공유하고 싶은 곳에 붙여 넣기 하세요:)");
      });

      $('.closeShare').on('click', function(e) {
        e.preventDefault();
        $('.shareContainer').toggleClass('active');
      });
    }
  }
};

$(document).ready(function() {
  app.init();
});
