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

