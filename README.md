ewsjs
=====
Overview
--------
ewsjs is an embedded Web server inside your browser. When developing Ajax-based and single-page-applications, it is often very difficult to test these applications until a Web server is in place.

The most common use for ewsjs is for mocking server requests.

EWS provides an embedded Web server that looks to your Ajax application as if it is coming from the server. You can put in any logic and fully test out your Ajax application within the browser, without running a server.

EWS supports several key features:

* Registering handlers for any path
* Registering handlers for parametrized paths, like Sinatra routes
* Registering a handler for automatic, when no other handler matches
* Rewriting of one path to another, like in Apache or nginx
* Asynchronous, exactly mimicking true ajax calls

Installation
------------
Simply download ewsjs.js from this site and include it in your Web page:

````html5
<script src="/path/to/ewsjs.js"></script>
````

Usage
-----
EWS creates a single global variable, named, very originally, EWS. 

EWS intercepts all xmlHttp requests by your browser and sends them to handlers that you create. You can then choose how to respond to the request by sending it stub information, ignoring the request (usually a bad idea), or going back to the server and getting the information, including processing and manipulating it prior to sending it back to the requestor.

## Enable/Disable

You enable interception by:

````JavaScript
EWS.enable(true);
````

Conversely, you can disable it by:

````JavaScript
EWS.enable(false);
EWS.disable(); // convenience function, same thing as EWS.enable(false);
````

## Registering interception paths

You can register a handler for a specific HTTP method and path using

````JavaScript
EWS.registerHandler(url,handler);
````

The 'url' listed above is one of:

* an actual absolute path, e.g. '/users/foo'
* a parametrized path like expressjs or Sinatra, e.g. '/users/:id'

The 'handler' is a function that will be invoked each time the given path (or matching parametrized path) is requested by the browser via ajax.

## Handlers
The handler is a function that will be called whenever the given path (or matching parametrized path) is requested by the browser via ajax. The handler has the following signature:

````JavaScript
function(config);
````

Where config is an object containing parameters passed to the handler. The following parameters are passed:

* method: the method which was called, one of 'GET','POST','PUT','DELETE','HEAD'
* url: the *original* url that was requested, not one that was rewritten (see URL rewriting)
* headers: an object with the request headers
* data: data passed to the request, both via POST and via query. All data is passed as a JS object.
* params: if this was a parameterized path, then the params property of config is an object containing the matched parameters
* db: an in-memory key-value store used as a database; see 'database' later in this document.

## Parametrized Paths
As mentioned above, you can register a handler using a parametrized path. For example, if you do:

````JavaScript
EWS.registerHandler('/users/:id/:prop',handler);
````

And a GET request comes for '/users/123/name', your handler will be invoked, with the following config:

````JavaScript
{method: 'GET', url:'users/123/name', headers: {}, data: {}, params: {id:'123',prop:'name'}}
````

## Catch-All Handler
All requests must be handled by a handler, or it will return a 404. However, sometimes you want a 'catch-all' or default handler, to handle all requests when no other handler does. 

EWS provides this capability as well! 

````JavaScript
EWS.registerAuto(handler);
````

The handler signature is identical to other handlers, and will be called only if no other handler - precise or parametrized - matches.

## Rewrites
EWS supports rewriting of paths, in a similar manner to Apache or nginx. EWS rewrites are quite simple to use:

````JavaScript
EWS.registerRewrite(re,path);
````

Where:

* re: a JavaScript regular expression object
* path: the path to which to rewrite it

You can register as many rewrite handlers as you want.

Every request received by EWS will be matched against all rewrite regular expressions. As soon as a match is found, processing stops, the url is changed to the path from the registration, and a new request is processed. No matter how many rewrites are performed, even 10 chained one after the other, the original request URL will always be passed to the final handler as config.url.

## DB Cache
EWS has the concept of a "database", more correctly a file cache. It automatically loads this file cache when requests come in, and passes the data to the handlers as the 'db' property of the config parameter.

Let us assume that a request is made for '/foo/bar.html'. Before passing the request to the registered handler, EWS will try to load '/foo/bar.html' from the original source (file:// or http://). Once it is either loaded or has failed to load, the request will then be passed to the appropriate handler.

If the load was successful, the retrieved data will be stored in an internal in-memory cache (we got really wild and called it 'db'), keyed to the URL. Thus, in our case, if the file retrieved contained '<html></html>' (really complex file!):

````JavaScript
db['/foo/bar.html'] = '<html></html>';
````

This entire db is accessible to every handler function via config.db, as listed above.

### Auto Index
When loading the db with data from the server/filesystem, you can set an auto-index path to be used. For example, if you request '/foo', and if foo is a directory and you want it to automatically look for '/foo/index.html', you can tell it to do so:

````JavaScript
EWS.setAutoIndex('index.html');
````

## Overriding
Sometimes, you actually want to go to the server, not via EWS, even if EWS.enable is true. The most common case is if one of your handlers needs to retrieve data from the server!

Fortunately, EWS provides a tool to call the 'real' ajax function.

````JavaScript
EWS.load(path,callback,async);
````

Where:

* path: path to request. 
* callback: callback to call when complete. Signature will match the normal xmlHttpRequest signature.
* async: whether to make the request async or sync. 


## Order of Processing
With each request, EWS follows the following order, assuming it has been enabled:

1. Check for rewrite matches:
	* Yes: rewrite and go back to beginning
	* No: next step
2. Check for data cache in db
	* Yes: next step
	* No: try to load into db and then go to next step
3. Look for exact path match
	* Yes: pass to handler and done
	* No: next step
4. Look for parametrized path handler
	* Yes: pass to handler and done
	* No: next step
5. Look for catch-all handler
	* Yes: pass to handler and done
	* No: return 404
