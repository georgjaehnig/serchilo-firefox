const { classes: Cc, interfaces: Ci, utils: Cu, results: Cr } = Components;

// Import the Services module.
Cu.import("resource://gre/modules/Services.jsm");

var language_namespace = 'de';
var country_namespace = 'deu';
var default_keyword = 'g';
var usage_type = 'n';
var user_name = '';
var documentOptions;

const domain_path = 'http://www.serchilo.net/';
let engine_details = {
  name:             'Serchilo: de.deu',
  url:              'http://www.serchilo.net/n/de.deu?query=_searchTerms_',
  usage_type:       'n',
  namespace_path:   'de.deu',
  default_keyword:  '',
  description:      'Serchilo.net, added by Firefox addon'
};


const ENGINE_XML_TEMPLATE = '<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/" xmlns:moz="http://www.mozilla.org/2006/browser/search/"> <ShortName>{name}</ShortName> <Description>{description}</Description> <Url xmlns:s="http://serchilo.net/opensearchextensions/1.0/" type="text/html" method="get" template="http://www.serchilo.net/{usage_type}/{namespace_path}?source=firefox-addon&amp;query={searchTerms}&amp;{default_keyword_parameter}"/> <Url type="application/x-suggestions+json" template="http://www.serchilo.net/opensearch-suggestions/{usage_type}/{namespace_path}?source=firefox-addon&amp;query={searchTerms}"/> <Image width="16" height="16"> http://www.serchilo.net/sites/all/themes/custom/temo/favicon.ico </Image> <Contact>opensearch@serchilo.net</Contact> <moz:SearchForm>http://www.serchilo.net/{usage_type}/{namespace_path}</moz:SearchForm> <moz:IconUpdateUrl> http://www.serchilo.net/sites/all/themes/custom/temo/favicon.ico </moz:IconUpdateUrl> <moz:UpdateInterval>7</moz:UpdateInterval> <Query role="example" searchTerms="g berlin"/> <InputEncoding>utf-8</InputEncoding> <Tags/> </OpenSearchDescription>';

// Observer topic
const ENGINE_ADDED = "browser-search-engine-modified";

// Keep track of whether this is the first run.
var firstRun = false;
// Decide whether to select the search engine.
var selectSearch = false;

// HELPER FUNCTIONS ===============================================

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

function wrap_xml_into_data_uri(xml) {
  let uri = 'data:text/xml;charset=utf-8,' + encodeURI(xml);
  return uri;
}

// CORE FUNCTIONS ===============================================

function optionObserver(subject, topic, data) {

  if (topic != "addon-options-displayed") {
    return;
  }

  documentOptions = subject.QueryInterface(Ci.nsIDOMDocument);
  showAndHideOptions();

  var saveButton = documentOptions.getElementById('save');
  //saveButton.addEventListener('command', this.save);
  //saveButton.addEventListener('command', updateSearchEngine);

  var typeSelect = documentOptions.getElementById('usage_type');
  typeSelect.addEventListener('command', showAndHideOptions);

}

function showAndHideOptions() {

  usage_type = Services.prefs.getCharPref('extensions.serchilo.usage_type');

  switch (usage_type) {
  case 'n':
    documentOptions.getElementById('user_name').collapsed = true;
    documentOptions.getElementById('language_namespace').collapsed = false;
    documentOptions.getElementById('country_namespace').collapsed = false;
    documentOptions.getElementById('custom_namespaces').collapsed = false;
    documentOptions.getElementById('default_keyword').collapsed = false;
    break;
  case 'u':
    documentOptions.getElementById('user_name').collapsed = false;
    documentOptions.getElementById('language_namespace').collapsed = true;
    documentOptions.getElementById('country_namespace').collapsed = true;
    documentOptions.getElementById('custom_namespaces').collapsed = true;
    documentOptions.getElementById('default_keyword').collapsed = true;
    break;
  }
}

function startup(data, reason) {

  Services.obs.addObserver(optionObserver, 'addon-options-displayed', false);

  firstRun = reason == ADDON_INSTALL;
  // Re-select the search engine if this is the first run
  // or we're being re-enabled.
  selectSearch = firstRun || reason == ADDON_ENABLE;

  // Only add the engine if it doesn't already exist.
  let engine = Services.search.getEngineByName(engine_details.name);
  if (engine) {
    searchObserver(engine, engine_details);
  }
  else {
    // Register an observer to detect when the engine has been added, if
    // necessary.
    if (selectSearch) {
      Services.obs.addObserver(searchObserver, ENGINE_ADDED, false);
    }

    let engine_xml = ENGINE_XML_TEMPLATE;
    engine_xml = engine_xml.replace('{name}', engine_details.name);
    engine_xml = engine_xml.replace('{usage_type}', engine_details.usage_type);
    engine_xml = engine_xml.replace('{namespace_path}', engine_details.namespace_path);
    engine_xml = engine_xml.replace('{default_keyword}', engine_details.default_keyword);
    engine_xml = engine_xml.replace('{description}', engine_details.description);

    let engine_uri = wrap_xml_into_data_uri(engine_xml);

    Services.search.addEngine(engine_uri, Ci.nsISearchEngine.DATA_XML, null, false);
  }
}

function shutdown(data, reason) {
  try {
    Services.obs.removeObserver(optionObserver, 'addon-options-displayed');
  }
  catch (e) {}

  // Remove our observer, if necessary
  if (reason != APP_SHUTDOWN)
    removeObserver();

  // Clean up the search engine on uninstall or disabled.
  if (reason == ADDON_UNINSTALL || reason == ADDON_DISABLE) {
    let engine = Services.search.getEngineByName(engine_details.name);
    // Only remove the engine if it appears to be the same one we
    // added.
    if (engine && engine.description == engine_details.description) {
      Services.search.removeEngine(engine);
    }
  }
}

function install() {}
function uninstall() {}
