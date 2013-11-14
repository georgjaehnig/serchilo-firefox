const { classes: Cc, interfaces: Ci, utils: Cu, results: Cr } = Components;

// Import the Services module.
Cu.import("resource://gre/modules/Services.jsm");

// These must be the same details as in your search.xml file.
let engine_details = {
    name: "Serchilo: de.deu",
    url: "http://www.serchilo.net/n/de.deu?query=_searchTerms_"
};

let engine_uri = 'data:text/xml;charset=utf-8,' + escape('<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/" xmlns:moz="http://www.mozilla.org/2006/browser/search/"> <ShortName>Serchilo: de.deu</ShortName> <Url xmlns:s="http://serchilo.net/opensearchextensions/1.0/" type="text/html" method="get" template="http://www.serchilo.net/n/de.deu?query={searchTerms}"/> <Url type="application/x-suggestions+json" template="http://www.serchilo.net/opensearch-suggestions/n/de.deu?source=firefox-addon&amp;query={searchTerms}"/> <Url type="application/opensearchdescription+xml" rel="self" template="http://www.serchilo.net/opensearch/n/de.deu"/> <Image width="16" height="16"> http://www.serchilo.net/sites/all/themes/custom/temo/favicon.ico </Image> <Contact>opensearch@serchilo.net</Contact> <moz:UpdateUrl>http://www.serchilo.net/opensearch/n/de.deu</moz:UpdateUrl> <moz:SearchForm>http://www.serchilo.net/n/de.deu</moz:SearchForm> <moz:IconUpdateUrl> http://www.serchilo.net/sites/all/themes/custom/temo/favicon.ico </moz:IconUpdateUrl> <moz:UpdateInterval>7</moz:UpdateInterval> <Query role="example" searchTerms="g berlin"/> <InputEncoding>utf-8</InputEncoding> <Tags/> </OpenSearchDescription>');

//const engine_uri = "http://serchilo.net/opensearch/u/jorges";

// Keep track of whether this is the first run.
var firstRun = false;
// Decide whether to select the search engine.
var selectSearch = false;

function removeObserver() {
    try {
        Services.obs.removeObserver(searchObserver, ENGINE_ADDED);
    }
    // If we've already removed this observer, ignore the error.
    catch (e) {}
}

// Observer called after our engine has been successfully added
function searchObserver(engine, topic, data) {
    if (data != "engine-added")
        return;

    engine.QueryInterface(Ci.nsISearchEngine);
    if (engine.name == engine_details.name) {
        // Remove our observer now that we're done with it.
        removeObserver();

        // If the engine is not hidden and this is the first run, move
        // it to the first position in the engine list and select it
        if (selectSearch && !engine.hidden) {
            Services.search.moveEngine(engine, 0);
            Services.search.currentEngine = engine;
        }
    }
}
// Observer topic
const ENGINE_ADDED = "browser-search-engine-modified";

function startup(data, reason) {

	dump(unescape(engine_uri));
	//dump(unescape(engine_uri2));

    firstRun = reason == ADDON_INSTALL;
    // Re-select the search engine if this is the first run
    // or we're being re-enabled.
    selectSearch = firstRun || reason == ADDON_ENABLE;

    // Only add the engine if it doesn't already exist.
    let engine = Services.search.getEngineByName(engine_details.name);
    if (engine)
        searchObserver(engine, engine_details);
    else {
        // Register an observer to detect when the engine has been added, if
        // necessary.
        if (selectSearch)
            Services.obs.addObserver(searchObserver, ENGINE_ADDED, false);

        Services.search.addEngine(engine_uri, Ci.nsISearchEngine.DATA_XML, null, false);
				Services.search.currentEngine = engine;
    }
}

function shutdown(data, reason) {
    // Remove our observer, if necessary
    if (reason != APP_SHUTDOWN)
        removeObserver();

    // Clean up the search engine on uninstall or disabled.
    if (reason == ADDON_UNINSTALL || reason == ADDON_DISABLE) {
        let engine = Services.search.getEngineByName(engine_details.name);
        // Only remove the engine if it appears to be the same one we
        // added.
				dump('begin');
				dump( engine.getSubmission("_searchTerms_").uri.spec);
				dump('end');
        if (engine && engine.getSubmission("_searchTerms_").uri.spec == engine_details.url)
        //if (engine)
            Services.search.removeEngine(engine);
    }
}

function install() {}
function uninstall() {}
