"use strict";

var fs = require('fs');
var cheerio = require('cheerio');
var io = require('./io-promise');

var baseOutputPath = "./out/";
var specFile = 'single-page.html';

if(process.argv[2] !== undefined) {
	if(process.argv[3] !== undefined) {
		baseOutputPath = process.argv[3];
	}
	specFile = process.argv[2];
}

console.log('Loading single-page.html');
var $ = cheerio.load(fs.readFileSync(specFile));
console.log('Loaded.');

var sections = [
      "introduction"
  ,   "infrastructure"
  ,   "dom"
  ,   "semantics"
  ,   "editing"
  ,   "browsers"
  ,   "webappapis"
  ,   "syntax"
  ,   "xhtml"
  ,   "rendering"
  ,   "obsolete"
  ,   "iana"
  ,   "index"
  ,   "property-index"
  ,   "idl-index"
  ,   "references"
  ,   "acknowledgements"
];

// first, create a mapping between the ids and their files
var idMap = [];
for(var i=0; i<sections.length; i++) {
	var id = sections[i];

	var destfile = id;
	if(destfile==="index") {
		destfile = "fullindex";
	}

	var section = $('#'+id).parents('section');
	if(!section) throw 'section not found';
	console.log('Found section for ' + id);
	section.find('*[id]').each(function(i,element) {
		idMap['#'+$(this).attr('id')] = destfile;
	});
}

// remapping links
console.log("Remapping links");
var notFound = [];
$("a[href^='#']").each(function(i,element) {
	var href = $(this).attr('href');
	if(idMap[href] !== undefined) {
		$(this).attr('href',idMap[href] + ".html" + href);
	} else {
		if(notFound[href]===undefined) {
			notFound[href] = href;
			console.error('Link not found: ' + href);
		}
	}
});

console.log("Generating index");
var doc = cheerio.load($.html());
var main = doc("main").first();
main.remove();
io.save(baseOutputPath + "index.html",doc.html());

console.log("Generating sections");
for(var i=0; i<sections.length; i++) {
	var id = sections[i];

	doc = cheerio.load($.html());

    // remove unnecessary heading (Version links, editors, etc.)
	var current = doc("h2#abstract").first();
	do {
		var nextElement = current.next();
		current.remove();
		current = nextElement;
	} while(current && current.get(0).tagName !== "nav");
	current = doc("header").first().next();
	do {
		nextElement = current.next();
		current.remove();
		current = nextElement;
	} while(doc(current).get(0));

    // only keep the appropriate section
	main = doc("main").first();
	var section_position,section_title;
	main.children().each(function(i,element) {
		var e = doc(this);
		var h2 = e.find("h2").first();
		if(e.get(0).tagName!=='section' || !h2 || h2.attr('id')!==id) {
			doc(this).remove();
		} else {
			section_position = i;
			section_title = e.find("span.content").first().text();
		}
	});

    // only keep the appropriate nav toc
	var previous_toc=null,next_toc=null;
	var toc = doc("nav#toc ol").first();
	toc.children().each(function(i,element) {
		if(i!==section_position) {
			if(i===(section_position-1)) {
				previous_toc = element;
			} else if(i===(section_position+1)) {
				next_toc = element;
			}
			doc(element).remove();
		}
	});

    // make a nice title for the document
	var titleElement = doc("title").first();
	titleElement.text(titleElement.text() + ": " + section_title);

    // insert top and botton mini navbars
    var nav = "<a href='index.html#contents'>Table of contents</a>";
    if(previous_toc!==null) {
    	nav = "← " + doc(previous_toc).find("a").first().toString() + " — " + nav;
    }
    if(next_toc!==null) {
    	nav += " — " + doc(next_toc).find("a").first().toString() + " →";
    }
	nav = "<nav class='prev_next'>" + nav + "</nav>";
	var mainNav = doc("nav#toc");
	mainNav.prepend(nav);
	mainNav.parent().append(nav);

	var destfile = id;
	if (destfile === "index") {
		destfile = "fullindex";
	}
	io.save(baseOutputPath + destfile + ".html",doc.html());

	console.log('Created ' + titleElement.text());
}
