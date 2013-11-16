const { classes: Cc, interfaces: Ci, utils: Cu, results: Cr } = Components;

// Import the Services module.
Cu.import("resource://gre/modules/Services.jsm");

var preferences = {
  language_namespace: 'de',
  country_namespace: 'deu',
  custom_namespaces: '',
  default_keyword: 'g',
  user_name: ''
}

var documentOptions;

var engine_details = {
  description:      'Serchilo.net, added by Firefox addon'
};

const ENGINE_XML_TEMPLATE = '<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/" xmlns:moz="http://www.mozilla.org/2006/browser/search/"> <ShortName>{name}</ShortName> <Description>{description}</Description> <Url xmlns:s="http://serchilo.net/opensearchextensions/1.0/" type="text/html" method="get" template="http://www.serchilo.net/{usage_type}/{namespace_path}?source=firefox-addon&amp;query={searchTerms}&amp;default_keyword={default_keyword}"/> <Url type="application/x-suggestions+json" template="http://www.serchilo.net/opensearch-suggestions/{usage_type}/{namespace_path}?source=firefox-addon&amp;query={searchTerms}"/> <Image width="16" height="16"> http://www.serchilo.net/sites/all/themes/custom/temo/favicon.ico </Image> <Contact>opensearch@serchilo.net</Contact> <moz:SearchForm>http://www.serchilo.net/{usage_type}/{namespace_path}</moz:SearchForm> <moz:IconUpdateUrl> http://www.serchilo.net/sites/all/themes/custom/temo/favicon.ico </moz:IconUpdateUrl> <moz:UpdateInterval>7</moz:UpdateInterval> <Query role="example" searchTerms="g berlin"/> <InputEncoding>utf-8</InputEncoding> <Tags/> </OpenSearchDescription>';

// Observer topic
const ENGINE_ADDED = "browser-search-engine-modified";

// Keep track of whether this is the first run.
var firstRun = false;
// Decide whether to select the search engine.
var selectSearch = false;


// CORE FUNCTIONS ===============================================

function startup(data, reason) {

  Services.obs.addObserver(optionObserver, 'addon-options-displayed', false);

  firstRun = reason == ADDON_INSTALL;
  // Re-select the search engine if this is the first run
  // or we're being re-enabled.
  selectSearch = firstRun || reason == ADDON_ENABLE;

  addSearchEngine();
}

function shutdown(data, reason) {

  removeOptionObserver();

  if (reason != APP_SHUTDOWN) {
    removeSearchObserver();
  }

  // Clean up the search engine on uninstall or disabled.
  if (reason == ADDON_UNINSTALL || reason == ADDON_DISABLE) {
    removeSearchEngine();
  }
}


function install() {
  setSystemLanguageAndCountryToPreferences();
  setPreferencesInBrowser();
}

function uninstall() {}

// HELPER FUNCTIONS ===============================================

function setPreferencesInBrowser() {

  var prefs = Components.classes['@mozilla.org/preferences-service;1'].getService(Components.interfaces.nsIPrefBranch);

  for (var key in preferences) {
    if (!prefs.prefHasUserValue("extensions.serchilo." + key)) {
      prefs.setCharPref("extensions.serchilo." + key, preferences[key]);
    }
  }
}

function updatePreferencesFromBrowser() {
  var prefs = Components.classes['@mozilla.org/preferences-service;1'].getService(Components.interfaces.nsIPrefBranch);
  for (var key in preferences) {
    if (prefs.prefHasUserValue("extensions.serchilo." + key)) {
      preferences[key] = prefs.getCharPref("extensions.serchilo." + key);
    }
  }
}

// Observers

// Observer called after our engine has been successfully added
function searchObserver(engine, topic, data) {
  if (data != "engine-added")
    return;

  engine.QueryInterface(Ci.nsISearchEngine);
  if (engine.name == engine_details.name) {
    // Remove our observer now that we're done with it.
    removeSearchObserver();

    // If the engine is not hidden and this is the first run, move
    // it to the first position in the engine list and select it
    if (selectSearch && !engine.hidden) {
      Services.search.moveEngine(engine, 0);
      Services.search.currentEngine = engine;
    }
  }
}

function optionObserver(subject, topic, data) {

  if (topic != "addon-options-displayed") {
    return;
  }

  documentOptions = subject.QueryInterface(Ci.nsIDOMDocument);
  showAndHideOptions();

  documentOptions.getElementById('user_name').addEventListener('keyup', showAndHideOptions);

  documentOptions.getElementById('user_name').addEventListener('change', updateSearchEngine);
  documentOptions.getElementById('custom_namespaces').addEventListener('change', updateSearchEngine);
  documentOptions.getElementById('default_keyword').addEventListener('change', updateSearchEngine);

  documentOptions.getElementById('language_namespace').addEventListener('command', updateSearchEngine);
  documentOptions.getElementById('country_namespace').addEventListener('command', updateSearchEngine);

}

// Observer removers

function removeSearchObserver() {
  try {
    Services.obs.removeObserver(searchObserver, ENGINE_ADDED);
  }
  // If we've already removed this observer, ignore the error.
  catch (e) {}
}

function removeOptionObserver() {
  try {
    Services.obs.removeObserver(optionObserver, 'addon-options-displayed');
  }
  catch (e) {}
}

// General helpers

function wrap_xml_into_data_uri(xml) {
  let uri = 'data:text/xml;charset=utf-8,' + encodeURI(xml);
  return uri;
}


function showAndHideOptions() {

  let user_name = Services.prefs.getCharPref('extensions.serchilo.user_name');

  if (user_name == '') {
    documentOptions.getElementById('language_namespace').collapsed = false;
    documentOptions.getElementById('country_namespace').collapsed = false;
    documentOptions.getElementById('custom_namespaces').collapsed = false;
    documentOptions.getElementById('default_keyword').collapsed = false;
  }
  else {
    documentOptions.getElementById('language_namespace').collapsed = true;
    documentOptions.getElementById('country_namespace').collapsed = true;
    documentOptions.getElementById('custom_namespaces').collapsed = true;
    documentOptions.getElementById('default_keyword').collapsed = true;
  }
}

// search engine add & removal
function addSearchEngine() {

  updatePreferencesFromBrowser();
  updateEngineDetailsFromPreferences();

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
    engine_xml = engine_xml.replace('{description}', engine_details.description);
    engine_xml = engine_xml.replace('{usage_type}', engine_details.usage_type);
    engine_xml = engine_xml.replace('{namespace_path}', engine_details.namespace_path);

    engine_xml = engine_xml.replace('{default_keyword}', preferences.default_keyword);

    let engine_uri = wrap_xml_into_data_uri(engine_xml);

    Services.search.addEngine(engine_uri, Ci.nsISearchEngine.DATA_XML, null, false);
  }
}

function updateEngineDetailsFromPreferences() {

  engine_details.usage_type = (preferences.user_name == '' ? 'n' : 'u');
	switch (engine_details.usage_type) {
  case 'n':
    engine_details.namespace_path = preferences.language_namespace + '.' + preferences.country_namespace;
    if (preferences.custom_namespaces != '') {
      engine_details.namespace_path += '.' + preferences.custom_namespaces;
    }
    engine_details.name = 'Serchilo: ' + engine_details.namespace_path;
    if (preferences.default_keyword != '') {
      engine_details.name += ' | ' + preferences.default_keyword;
    }
    break; 
  case 'u':
    engine_details.namespace_path = preferences.user_name;
    engine_details.name = 'Serchilo: ' + preferences.user_name;
    break; 
  }
}

function removeSearchEngine() {
  let engine = Services.search.getEngineByName(engine_details.name);
  // Only remove the engine if it appears to be the same one we
  // added.
  if (engine && engine.description == engine_details.description) {
    Services.search.removeEngine(engine);
  }
}

function updateSearchEngine() {
  // When updating, (re-)select the engine
  selectSearch = true;
  removeSearchEngine();
  addSearchEngine();
}

function setSystemLanguageAndCountryToPreferences() {

  var languageAndCountry = Services.locale.getLocaleComponentForUserAgent() || '';
  //var languageAndCountry = 'en';

  if (languageAndCountry != '') {
    languageAndCountry = languageAndCountry.split('-');

    // add language_namespace
    if (languageAndCountry[0].length == 2) {
      preferences.language_namespace = languageAndCountry[0].toLowerCase();
    }

    // add country_namespace
    if (languageAndCountry.length > 1) {
      var country_namespace_2letter = languageAndCountry[1];
      var country_namespace_3letter = serchilo_2letter_to_3letter_country_code(country_namespace_2letter); 
      if (country_namespace_3letter) {
        preferences.country_namespace = country_namespace_3letter.toLowerCase();
      }
    }
  }

  return preferences;
}

function serchilo_2letter_to_3letter_country_code( letter2 ) {

  let country_codes = {
    'AF' : 'AFG',
    'AL' : 'ALB',
    'DZ' : 'DZA',
    'AS' : 'ASM',
    'AD' : 'AND',
    'AO' : 'AGO',
    'AI' : 'AIA',
    'AQ' : 'ATA',
    'AG' : 'ATG',
    'AR' : 'ARG',
    'AM' : 'ARM',
    'AW' : 'ABW',
    'AU' : 'AUS',
    'AT' : 'AUT',
    'AZ' : 'AZE',
    'BS' : 'BHS',
    'BH' : 'BHR',
    'BD' : 'BGD',
    'BB' : 'BRB',
    'BY' : 'BLR',
    'BE' : 'BEL',
    'BZ' : 'BLZ',
    'BJ' : 'BEN',
    'BM' : 'BMU',
    'BT' : 'BTN',
    'BO' : 'BOL',
    'BA' : 'BIH',
    'BW' : 'BWA',
    'BV' : 'BVT',
    'BR' : 'BRA',
    'IO' : 'IOT',
    'BN' : 'BRN',
    'BG' : 'BGR',
    'BF' : 'BFA',
    'BI' : 'BDI',
    'KH' : 'KHM',
    'CM' : 'CMR',
    'CA' : 'CAN',
    'CV' : 'CPV',
    'KY' : 'CYM',
    'CF' : 'CAF',
    'TD' : 'TCD',
    'CL' : 'CHL',
    'CN' : 'CHN',
    'CX' : 'CXR',
    'CC' : 'CCK',
    'CO' : 'COL',
    'KM' : 'COM',
    'CG' : 'COG',
    'CD' : 'COD',
    'CK' : 'COK',
    'CR' : 'CRI',
    'CI' : 'CIV',
    'HR' : 'HRV',
    'CU' : 'CUB',
    'CY' : 'CYP',
    'CZ' : 'CZE',
    'DK' : 'DNK',
    'DJ' : 'DJI',
    'DM' : 'DMA',
    'DO' : 'DOM',
    'TP' : 'TMP',
    'EC' : 'ECU',
    'EG' : 'EGY',
    'SV' : 'SLV',
    'GQ' : 'GNQ',
    'ER' : 'ERI',
    'EE' : 'EST',
    'ET' : 'ETH',
    'FK' : 'FLK',
    'FO' : 'FRO',
    'FJ' : 'FJI',
    'FI' : 'FIN',
    'FR' : 'FRA',
    'FX' : 'FXX',
    'GF' : 'GUF',
    'PF' : 'PYF',
    'TF' : 'ATF',
    'GA' : 'GAB',
    'GM' : 'GMB',
    'GE' : 'GEO',
    'DE' : 'DEU',
    'GH' : 'GHA',
    'GI' : 'GIB',
    'GR' : 'GRC',
    'GL' : 'GRL',
    'GD' : 'GRD',
    'GP' : 'GLP',
    'GU' : 'GUM',
    'GT' : 'GTM',
    'GN' : 'GIN',
    'GW' : 'GNB',
    'GY' : 'GUY',
    'HT' : 'HTI',
    'HM' : 'HMD',
    'VA' : 'VAT',
    'HN' : 'HND',
    'HK' : 'HKG',
    'HU' : 'HUN',
    'IS' : 'ISL',
    'IN' : 'IND',
    'ID' : 'IDN',
    'IR' : 'IRN',
    'IQ' : 'IRQ',
    'IE' : 'IRL',
    'IL' : 'ISR',
    'IT' : 'ITA',
    'JM' : 'JAM',
    'JP' : 'JPN',
    'JO' : 'JOR',
    'KZ' : 'KAZ',
    'KE' : 'KEN',
    'KI' : 'KIR',
    'KP' : 'PRK',
    'KR' : 'KOR',
    'KW' : 'KWT',
    'KG' : 'KGZ',
    'LA' : 'LAO',
    'LV' : 'LVA',
    'LB' : 'LBN',
    'LS' : 'LSO',
    'LR' : 'LBR',
    'LY' : 'LBY',
    'LI' : 'LIE',
    'LT' : 'LTU',
    'LU' : 'LUX',
    'MO' : 'MAC',
    'MK' : 'MKD',
    'MG' : 'MDG',
    'MW' : 'MWI',
    'MY' : 'MYS',
    'MV' : 'MDV',
    'ML' : 'MLI',
    'MT' : 'MLT',
    'MH' : 'MHL',
    'MQ' : 'MTQ',
    'MR' : 'MRT',
    'MU' : 'MUS',
    'YT' : 'MYT',
    'MX' : 'MEX',
    'FM' : 'FSM',
    'MD' : 'MDA',
    'MC' : 'MCO',
    'MN' : 'MNG',
    'MS' : 'MSR',
    'MA' : 'MAR',
    'MZ' : 'MOZ',
    'MM' : 'MMR',
    'NA' : 'NAM',
    'NR' : 'NRU',
    'NP' : 'NPL',
    'NL' : 'NLD',
    'AN' : 'ANT',
    'NC' : 'NCL',
    'NZ' : 'NZL',
    'NI' : 'NIC',
    'NE' : 'NER',
    'NG' : 'NGA',
    'NU' : 'NIU',
    'NF' : 'NFK',
    'MP' : 'MNP',
    'NO' : 'NOR',
    'OM' : 'OMN',
    'PK' : 'PAK',
    'PW' : 'PLW',
    'PA' : 'PAN',
    'PG' : 'PNG',
    'PY' : 'PRY',
    'PE' : 'PER',
    'PH' : 'PHL',
    'PN' : 'PCN',
    'PL' : 'POL',
    'PT' : 'PRT',
    'PR' : 'PRI',
    'QA' : 'QAT',
    'RE' : 'REU',
    'RO' : 'ROM',
    'RU' : 'RUS',
    'RW' : 'RWA',
    'KN' : 'KNA',
    'LC' : 'LCA',
    'VC' : 'VCT',
    'WS' : 'WSM',
    'SM' : 'SMR',
    'ST' : 'STP',
    'SA' : 'SAU',
    'SN' : 'SEN',
    'SC' : 'SYC',
    'SL' : 'SLE',
    'SG' : 'SGP',
    'SK' : 'SVK',
    'SI' : 'SVN',
    'SB' : 'SLB',
    'SO' : 'SOM',
    'ZA' : 'ZAF',
    'GS' : 'SGS',
    'ES' : 'ESP',
    'LK' : 'LKA',
    'SH' : 'SHN',
    'PM' : 'SPM',
    'SD' : 'SDN',
    'SR' : 'SUR',
    'SJ' : 'SJM',
    'SZ' : 'SWZ',
    'SE' : 'SWE',
    'CH' : 'CHE',
    'SY' : 'SYR',
    'TW' : 'TWN',
    'TJ' : 'TJK',
    'TZ' : 'TZA',
    'TH' : 'THA',
    'TG' : 'TGO',
    'TK' : 'TKL',
    'TO' : 'TON',
    'TT' : 'TTO',
    'TN' : 'TUN',
    'TR' : 'TUR',
    'TM' : 'TKM',
    'TC' : 'TCA',
    'TV' : 'TUV',
    'UG' : 'UGA',
    'UA' : 'UKR',
    'AE' : 'ARE',
    'GB' : 'GBR',
    'US' : 'USA',
    'UM' : 'UMI',
    'UY' : 'URY',
    'UZ' : 'UZB',
    'VU' : 'VUT',
    'VE' : 'VEN',
    'VN' : 'VNM',
    'VG' : 'VGB',
    'VI' : 'VIR',
    'WF' : 'WLF',
    'EH' : 'ESH',
    'YE' : 'YEM',
    'ZM' : 'ZMB',
    'ZW' : 'ZWE'
	};
	if (letter2 in country_codes) {
		var letter3 = country_codes[letter2];	
		return letter3;
	}

}
