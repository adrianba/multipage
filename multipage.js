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

var sections = [
      "introduction"
  ,   "infrastructure"
  ,   "dom"
  ,   "semantics"
  ,   "document-metadata"
  ,   "sections"
  ,   "grouping-content"
  ,   "textlevel-semantics"
  ,   "edits"
  ,   "semantics-embedded-content"
  ,   "links"
  ,   "tabular-data"
  ,   "sec-forms"
  ,   "interactive-elements"
  ,   "semantics-scripting"
  ,   "common-idioms-without-dedicated-elements"
  ,   "disabled-elements"
  ,   "matching-html-elements-using-selectors"
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

// console.log("Creating ID->file mapping");

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
  if (section.length > 1) {
    // if we are in a subsection, just take the first
    section = section.first();
  }
  if (id === "semantics") {
    // we only take the first subsection for semantics
    // others will be handled by ids
    idMap['#' + id] = destfile;
    section = section.find("section").first();
  }
	section.find('*[id]').each(function(i,element) {
		idMap['#'+$(this).attr('id')] = destfile;
	});
}

// remapping links
// console.log("Remapping links");
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

// console.log('Saving index');
io.save(baseOutputPath + "index.html",doc.html());

console.log("Generating sections");

// remove unnecessary heading (Version links, editors, etc.)
var current = $("h2#abstract").first();
do {
  var nextElement = current.next();
  current.remove();
  current = nextElement;
} while(current && current.get(0).tagName !== "nav");
current = $("header").first().next();
do {
  nextElement = current.next();
  current.remove();
  current = nextElement;
} while($(current).get(0));

for(var i=0; i<sections.length; i++) {
	var id = sections[i];

	doc = cheerio.load($.html());

  var header = doc("#" + id);
  var section = header.parent();
  var stop = 10;
  while (section.get(0).tagName !== "section" && stop > 0) {
    section = section.parent();
    stop--;
    if (stop == 0) {
      console.log("Giving up on find the parent section for #"
                  + id + ". Please report a bug.");
    }
  }

  var inSubSection = (section.parents("section").length > 0);

  // remove everything under main
  var main = doc("main").first();
  main.empty();
  // reinsert the section
  main.append(section);

  // at the start of section 4, we eliminate all subsections after the first
  if (id === "semantics") {
    section.children("section").each(function(i,element) {
      if (i > 0) doc(element).remove();
    });
  }

  // Adjust the table of contents
	var toc = doc("nav#toc ol").first();
  var item = toc.find('a[href$="#' + id + '"]').first().parent();

  // find its previous and next
  var previous_item = undefined, next_item = undefined;
  if (i > 0) {
    previous_item = toc.find('a[href$="#' + sections[i-1] + '"]').first();
  }
  if ((i+1) < sections.length) {
    next_item = toc.find('a[href$="#' + sections[i+1] + '"]').first();
  }

	// only keep the appropriate nav toc
  toc.empty();
  toc.append(item);

  // again, for section 4, we eliminate alkl subtoc after the first
  if (id === "semantics") {
    item.children("ol").children("li").each(function(i,element) {
      if (i > 0) doc(element).remove();
    });
  }


  // make a nice title for the document
	var titleElement = doc("title").first();
	titleElement.text(titleElement.text() + ": " + header.text());

  // insert top and botton mini navbars
  var nav = "<a href='index.html#contents'>Table of contents</a>";
  if(previous_item!== undefined) {
  	nav = "← " + previous_item.toString() + " — " + nav;
  }
  if(next_item!==undefined) {
  	nav += " — " + next_item.toString() + " →";
  }
	nav = "<p class='prev_next'>" + nav + "</p>";
	var mainNav = doc("nav#toc");
	mainNav.prepend(nav);
	mainNav.parent().append(nav);

	var destfile = id;
	if (destfile === "index") {
		destfile = "fullindex";
	}
  // console.log('Saving ' + titleElement.text());
	io.save(baseOutputPath + destfile + ".html",doc.html());

}
