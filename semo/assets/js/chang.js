var ch = {
	f: {
		scrollTo: function(target, speed, top) {
			var s = 400;
			var t = 100;
			if(speed != undefined && speed.length != 0) s = speed;
			if(top != undefined && top.length != 0) t = top;
			var body = jQuery('html, body');
			body.stop().animate({scrollTop:jQuery(target).offset().top - t}, s, 'swing', function() { 
				
			});
		}	
	},
	ls: { // localStorage
		allStorage: function allStorage() {

		    var archive = {}, // Notice change here
		        keys = Object.keys(localStorage),
		        i = keys.length;

		    while ( i-- ) {
		        archive[ keys[i] ] = localStorage.getItem( keys[i] );
		    }

		    return archive;
		}
	},
	url: {
		getUrlParameter: function(sParam) {
	        var sPageURL = decodeURIComponent(window.location.search.substring(1)),
	        sURLVariables = sPageURL.split('&'),
	        sParameterName,
	        i;

	        for (i = 0; i < sURLVariables.length; i++) {
	            sParameterName = sURLVariables[i].split('=');

	            if (sParameterName[0] === sParam) {
	                return sParameterName[1] === undefined ? true : sParameterName[1];
	            }
	        }
	    }
	}
}