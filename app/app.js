var App = {
	apiUrl: "https://api.github.com",	// API URL
	templates: {
		users: "#users-template",		// Users view template
		followers: "#followers-template"		// Followers view template
	},
	container: "#app-container",		// Placeholder to show the app into
	sayToConsole: true,
	
	data: {
		users: [],						// Data cache object
		links: []
	},

	init: function () {
		///<summary> Start the app </summary>
		var app = this;

		//$.support.cors = true;	// tell jQuery our environment supports Cross-Domain requests

		// load the first set of users		
		app.loadPage();
		
		// attach event actions
		app.attachEvents();
	},
	
	loadPage: function (page) {
		///<summary> Load a specific page of users </summary>
		var app = this;
		
		app.loadingStart();

		app.getUsers(page, function(){
			app.populateUsers(app.data);
			app.loadingEnd();
		});
	},
	
	getUsers: function (page, callback){
		///<summary> Fetch users </summary>
		var app = this,
			requestUrl = app.apiUrl + '/users',	// api url + resource
			type = 'GET';
		
		// if page has been specified: find url from cache (except for 1st page)
		if ( page && page != "first" && app.data.links[page] ){
			requestUrl = app.data.links[page].href;
		}
		
		app.say("getUsers: start");
		
		// go fetch!
		app.apiRequest(requestUrl, type, function(response, links){
			app.data.users = response;	// save data to app
			
			// if request has returned pagination links
			if ( links )
				app.data.links = links;	// save links to app
			
			// run callback if any
			if ( typeof callback == "function" )
				callback(response);
		});
	},
	
	getFollowers: function (user, callback){
		///<summary> Fetch followers for a given user </summary>
		if (!user)
			return false;
			
		var app = this,
			resource = '/users/'+user+'/followers',
			type = 'GET';

		app.say("getFollowers: start");
		
		// go fetch!
		app.apiRequest(app.apiUrl + resource, type, function(response){
			// run callback if any
			if ( typeof callback == "function" )
				callback(response);
		});
	},
	
	apiRequest: function ( url, type, callback ){
		///<summary> Make an API request </summary>
		var app = this;
		
		$.ajax({
			url: url,
			type: type
		})
		.fail(function ( jqXHR, textStatus, errorThrown ){
				app.say("apiRequest: error", textStatus, errorThrown)
		})
		.done(function( response, textStatus, jqXHR ) {
			// success callback
			app.say("apiRequest: received data", response.slice(0,10));
			
			// check for pagination links
			if ( jqXHR.getResponseHeader('Link') ){
				var link = app.parseLinkHeader(jqXHR.getResponseHeader('Link'));
			}

			// run callback if any
			if ( typeof callback == "function" )
				callback(response, link);
				
		});
	},
	
	populateUsers: function (newData) {
		///<summary> Populate our template and send it to the page </summary>
		var app = this,
			data = [];

		// check for parameters
		if(!newData)
			return false;
			
		data = newData;

		// populate template
		var source   = $(app.templates.users).html();
		var template = Handlebars.compile(source);

		// add to DOM
		$(app.container).empty().append(template(data));

		app.say("populateUsers: populated");
	},
	
	populateFollowers: function (userId, newData) {
		///<summary> Populate our template and send it to the page for given user</summary>
		var app = this,
			data = [];
		
		// check for parameters
		if(!userId || !newData)
			return false;

		data.followers = newData;

		// populate template
		var source   = $(app.templates.followers).html();
		var template = Handlebars.compile(source);

		// add to DOM
		$(template(data))
			.hide()
			.appendTo($(app.container).find('#user-'+userId))
			.fadeIn();

		app.say("populateFollowers: populated");
	},
	
	attachEvents: function () {
		///<summary> Attach events </summary>
		var app = this;
		
		// click on Followers link
		$(app.container).on("click", ".action-followers", function(event){
			event.preventDefault();
			app.clickFollowers($(event.currentTarget));
		});

		// click on Paging links
		$(app.container).on("click", ".action-first, .action-prev, .action-next, .action-last", function(event){
			event.preventDefault();
			var linkName = $(this).attr('rel');
			app.loadPage(linkName);
		});
	},
	
	clickFollowers: function($element){
		///<summary> Show followers with loading effect</summary>
		var app = this;
		
		var userId = $element.attr('rel');	// find related user
			
		app.loadingStart($element);
		
		// check if user id was found
		if (!userId)
			return false;
			
		// get data and populate when ready
		app.getFollowers(userId, function(data){
			app.populateFollowers(userId, data);
			app.loadingEnd($element);
			$element.hide();
		});
	},
 
	parseLinkHeader: function (header) {
		///<summary> Parse a Link header </summary>
		// https://gist.github.com/deiu/9335803		
		
		// Link:<https://example.org/.meta>; rel=meta
		// var r = parseLinkHeader(xhr.getResponseHeader('Link');
		// r['meta']['href'] outputs https://example.org/.meta
		
		var unquote = function (value) {
			///<summary> Unquote string (utility) </summary>
		    if (value.charAt(0) == '"' && value.charAt(value.length - 1) == '"') {
		        return value.substring(1, value.length - 1);
		    }
		    return value;
		}
		
		var linkexp = /<[^>]*>\s*(\s*;\s*[^\(\)<>@,;:"\/\[\]\?={} \t]+=(([^\(\)<>@,;:"\/\[\]\?={} \t]+)|("[^"]*")))*(,|$)/g;
		var paramexp = /[^\(\)<>@,;:"\/\[\]\?={} \t]+=(([^\(\)<>@,;:"\/\[\]\?={} \t]+)|("[^"]*"))/g;

		var matches = header.match(linkexp);
		var rels = {};
		for (var i = 0; i < matches.length; i++) {
			var split = matches[i].split('>');
			var href = split[0].substring(1);
			var ps = split[1];
			var link = {};
			link.href = href;
			var s = ps.match(paramexp);
			for (var j = 0; j < s.length; j++) {
				var p = s[j];
				var paramsplit = p.split('=');
				var name = paramsplit[0];
				link[name] = unquote(paramsplit[1]);
			}

			if (link.rel !== undefined) {
				rels[link.rel] = link;
			}
		}

		return rels;
	},
	
	loadingStart: function($element){
		///<summary> Stuff to do when loading starts for element </summary>
		var app = this,
			$element = $element || $(app.container);
			
		$element.addClass('loading');
	},
	
	loadingEnd: function($element){
		///<summary> Stuff to do when loading ends for element </summary>
		var app = this,
			$element = $element || $(app.container);
			
		$element.removeClass('loading');
	},
	
	say: function (message){
		///<summary> Central logging method </summary>
		var app = this;
		if ( app.sayToConsole && console && console.log ) 
			console.log( arguments.length > 1 ? arguments : message );
	}
}