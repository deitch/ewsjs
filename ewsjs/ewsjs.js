/*
 * Embedded Web server. Receives requests for PUT/POST/GET/DELETE and figures out what to do.
 * Useful when there is no real server to use.
 */
/*global window */
var EWS = function() {
	// handlers
	var handlers = {path: {}, regex: []}, rewrites = [], auto = false, autoIndex = false;
	
	// hold data across calls
	var db = {};

	// for parsing paths
	// do a little intelligent parsing - thanks to Aaron Quint, of SammyJS, for this code: http://code.quirkey.com/sammy/
	var PATH_REPLACER = "([^\/]+)",PATH_NAME_MATCHER = /:([\w\d]+)/g,QUERY_STRING_MATCHER = /\?([^#]*)$/;
	
	// utility functions: fork, ajax, localGet
	var fork = function() {
		var fn, window = this;
		if (window && window.setTimeout && typeof(window.setTimeout) === "function") {
			fn = function(f) {window.setTimeout(f,1);};
		} else {
			// we have no fork option, so return null
			fn = null;
		}

		return(fn ? function(conf) {
			var f = conf.fn, scope = conf.scope, arg = [].concat(conf.arg);
			fn(function(){f.apply(scope,arg);});		
		} : fn);
	}();
	
	var sjax = function(url) {
		// get the file via Sjax, and respond with results
		var xmlHttp, method = "GET";
		// asynch most of the time
		try {
		    // Firefox, Opera 8.0+, Safari
		    xmlHttp=new window.XMLHttpRequest();
	    } catch (e0) {
		    // Internet Explorer
		    try {
		      xmlHttp=new window.ActiveXObject("Msxml2.XMLHTTP");
		    } catch (e1) {
		      try {
		        xmlHttp=new window.ActiveXObject("Microsoft.XMLHTTP");
		      } catch (e2) {
				return({success: false,message: "Your environment does not support AJAX!",response: null});
		      }
		    }
		 }

		 try {
			// open the request
			xmlHttp.open(method,url,false);
			xmlHttp.send(null);
			return({success: true, message: "200", response: xmlHttp.responseText});
		} catch (e3) {
			return({success:false,message: "404"});
		}
	};
	// determine if something is a directory listing
	var isDirListing = function(data,url) {
		var isDir = false;
		// first try the URL match, then multiline
		if (url.match(/\/$/) || data.match(/^\s*\d\d\d:.*$/mg)) {
			isDir = true;
		}
		// return our isDir
		return(isDir);
	};
	// to process a call - separate because it can get nested
	var processCall = function(param, url) {
		var h, res, i, j, match, key, fn, param_names, path, processed = false, p;
		url = url ? url : param.url;
		for (i=0;i<rewrites.length;i++) {
			match = rewrites[i].re.exec(url);
			if (match) {
				url = rewrites[i].path;
				// do any replacements necessary
				for (j=0;j<match.length;j++) {
					key = "$"+j;
					url = url.replace(key,match[j]);						
				}
				// exit out and redo the call for the new URL, but passing the old
				break;
			}
		}
		// if we matched a regex, we need to redo
		if (match) {
			processCall(param,url);
		} else {
			// always load it first from the filesystem
			if (!db[url]) {
				// look for the file
				res = sjax(url);
				// we use auto if we failed, or if we got a directory listing
				if ((!res.success || isDirListing(res.response,url)) && autoIndex) {
					res = sjax(url+"/"+autoIndex);
					if (res.success) {
						db[url] = res.response;
					}																
				} else if (res.success) {
					db[url] = res.response;
				}						
			}
			// OK, now loaded, move on to the handlers - preference is specific handler
			// important that we pass param.url, not url, since url=rewritten path, param.url=original request
			
			// first look for an exact match
			if (handlers.path[url]) {
				res = handlers.path[url](param.type,param.url,param.data,db);
				processed = true;
			} else {
				// no exact match, look for a regex match
				for(i=0;i<handlers.regex.length;i++) {
					h = handlers.regex[i];
					match = h.path.exec(url);
					if (match) {
						p = {};
						for (j=0;j<h.params.length;j++) {
							// regex matches start at 1, but the params array starts at 0
							p[h.params[j]] = match[j+1];
						}
						res = handlers.regex[i].fn(param.type,param.url,param.data,db,p);
						processed = true;
						break;
					}
				}
			}
			
			// did we process it?
			if (!processed) {
				if (auto) {
					res = auto(param.type,param.url,param.data,db);
				} else {
					res = {response: null, status: "404", success:false};					
				}
			}
			if (res.success) {
				param.success(res.response,res.status);														
			} else {
				
			}
		}
	};

	return {
		get: function(url,data,callback,type) {
			return this.ajax({
		        type: "GET",
		        url: url,
		        data: data,
		        success: callback,
		        dataType: type
		        });
		},
		put: function(url,data,callback,type) {
			return this.ajax({
		        type: "PUT",
		        url: url,
		        data: data,
		        success: callback,
		        dataType: type
		        });
		},
		post: function(url,data,callback,type) {
			return this.ajax({
		        type: "POST",
		        url: url,
		        data: data,
		        success: callback,
		        dataType: type
		        });
		},
		// note: delete is a reserved JavaScript keyword, use del instead
		del: function(url,data,callback,type) {
			return this.ajax({
		        type: "DELETE",
		        url: url,
		        data: data,
		        success: callback,
		        dataType: type
		        });
		},
		ajax: function(param) {
			// ajax as async, so fork it
			fork({scope: this, arg: [param], fn: processCall});
		},
		registerHandler: function(url,handler) {
	        // Needs to be explicitly set because IE will maintain the index unless NULL is returned,
	        // which means that with two consecutive routes that contain params, the second set of params will not be found and end up in splat instead of params
	        // https://developer.mozilla.org/en/Core_JavaScript_1.5_Reference/Global_Objects/RegExp/lastIndex        
	        PATH_NAME_MATCHER.lastIndex = 0;
			
	        // find the names
			var path_match, param_names = [], path = url;
	        while ((path_match = PATH_NAME_MATCHER.exec(path)) !== null) {
	          param_names.push(path_match[1]);
	        }
	        // replace with the path replacement
			if (param_names.length > 0) {
				path = new RegExp("^" + path.replace(PATH_NAME_MATCHER, PATH_REPLACER) + "$");
				// we have a regex
				handlers.regex.push({fn: handler, path: path, params: param_names});
			} else {
				// we have a straight path
				handlers.path[path] = handler;
			}
		},
		registerRewrite: function(re,path) {
			// do a simple rewrite
			rewrites.push({re:re,path:path});
		},
		// to handle for any path
		registerAuto: function(handler) {
			auto = handler;
		},
		registerDb: function(newdb) {
			db = newdb;
		},
		// sets to use /index if none is available
		setAutoIndex: function(newAutoIndex) {
			autoIndex = newAutoIndex;
		},
		load: function(path,cb) {
			var res = sjax(path);
			cb(res.response,res.status);
		}
	};
	
}();
