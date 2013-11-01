Components.utils.import( 'resource://gre/modules/Services.jsm' );

var language_namespace = 'de';
var country_namespace = 'deu';
var default_keyword = 'g';
var usage_type = 'n';
var user_name = '';
var documentOptions;
const domain_path = 'http://www.serchilo.net/';

const {classes: Cc, interfaces: Ci} = Components;

// ====================================== core functions

function startup(data, reason) {

	Services.obs.addObserver(optionObserver, 'addon-options-displayed', false);
	addSearchEngine();	
}

function shutdown(data, reason) {

	// prevent saving usage_type 'u' with empty user name
	usage_type = Services.prefs.getCharPref('extensions.serchilo.usage_type');
	user_name = Services.prefs.getCharPref('extensions.serchilo.user_name');
	if (
		('u' == usage_type) &&
		('' == user_name) 
  ) {
		usage_type = Services.prefs.setCharPref('extensions.serchilo.usage_type', 'n');
	}
	removeSearchEngine();

}

function install(data, reason) {

	setLanguageAndCountryNamespaces();

	var prefs = Components.classes['@mozilla.org/preferences-service;1'].getService(Components.interfaces.nsIPrefBranch);

	// set default prefs if no prefs set yet
	if (!prefs.prefHasUserValue("extensions.serchilo.usage_type")) {
		prefs.setCharPref("extensions.serchilo.usage_type",					usage_type);
		prefs.setCharPref("extensions.serchilo.language_namespace",	language_namespace);
		prefs.setCharPref("extensions.serchilo.country_namespace",	country_namespace);
		prefs.setCharPref("extensions.serchilo.default_keyword",		default_keyword);
		prefs.setCharPref("extensions.serchilo.user_name",					user_name);
	}

}

function uninstall(data, reason) {}

// ====================================== custom functions

let optionObserver = {
    observe: function(subject, topic, data) {
     
	 		documentOptions = subject.QueryInterface(Ci.nsIDOMDocument);
			showAndHideOptions();
       
	  	var saveButton = documentOptions.getElementById('save');
      //saveButton.addEventListener('command', this.save);
      saveButton.addEventListener('command', updateSearchEngine);

      var typeSelect = documentOptions.getElementById('usage_type');
      typeSelect.addEventListener('command', showAndHideOptions);

    }
}

var showAndHideOptions = function showAndHideOptions() {

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

function removeSearchEngine() {
	var engine_name = Services.prefs.getCharPref('extensions.serchilo.engine_name');
  var engine = Services.search.getEngineByName(engine_name);
  if (engine != null) {
		Services.search.removeEngine(engine);
	}
}

function addSearchEngine() {

	usage_type = Services.prefs.getCharPref('extensions.serchilo.usage_type');

	switch (usage_type) {
	
	case 'n':
		language_namespace = Services.prefs.getCharPref('extensions.serchilo.language_namespace');
		country_namespace = Services.prefs.getCharPref('extensions.serchilo.country_namespace');
		default_keyword = Services.prefs.getCharPref('extensions.serchilo.default_keyword');
		var engine_url = domain_path + usage_type + '/' + language_namespace + '.' + country_namespace + '?';
		var engine_name = 'Serchilo: ' + language_namespace + '.' + country_namespace;
		if (default_keyword) {
			engine_url += 'default_keyword=' + default_keyword + '&';
			engine_name += ' | ' + default_keyword;	
		}
		break;

	case 'u':

		var user_name = Services.prefs.getCharPref('extensions.serchilo.user_name');
		var engine_url = domain_path + usage_type + '/' + user_name + '?';
		var engine_name = 'Serchilo: ' + user_name;
		break;

	}

    engine_url += 'query={searchTerms}';

  Services.search.addEngineWithDetails(
      engine_name,
      'http://www.serchilo.net/favicon.ico',
      '',
      '',
      'get',
      engine_url
  );

  Services.prefs.setCharPref('extensions.serchilo.engine_name', engine_name);

  let engine = Services.search.getEngineByName(engine_name);
  Services.search.currentEngine = engine;
}

function setLanguageAndCountryNamespaces() {

	var languageAndCountry = Services.locale.getLocaleComponentForUserAgent() || '';
	//var languageAndCountry = 'en';

	if (languageAndCountry != '') {
		languageAndCountry = languageAndCountry.split('-');

		// add language_namespace
		if (languageAndCountry[0].length == 2) {
			language_namespace = languageAndCountry[0];
			language_namespace = language_namespace.toLowerCase();
		}

		// add country_namespace
		if (languageAndCountry.length > 1) {
			var country_namespace_2letter = languageAndCountry[1];
			var country_namespace_3letter = serchilo_2letter_to_3letter_country_code(country_namespace_2letter); 
			if (country_namespace_3letter) {
				country_namespace = country_namespace_3letter.toLowerCase();
			}
		}
	}

	//dump(language_namespace);
	//dump(country_namespace);
}

var updateSearchEngine = function updateSearchEngine() {

	usage_type = Services.prefs.getCharPref('extensions.serchilo.usage_type');
	user_name = Services.prefs.getCharPref('extensions.serchilo.user_name');
	//dump('+' + usage_type + '+');
	//dump('-' + user_name + '-');

	if (
		('u' == usage_type) &&
		('' == user_name) 
  ) {
		documentOptions.getElementById('save').label = 'Save - Error: User name must not be empty.'
		return;
	}
	removeSearchEngine();
	addSearchEngine();
	documentOptions.getElementById('save').label = 'Save - Success.';
}

function serchilo_2letter_to_3letter_country_code( letter2 ) {

  country_codes = {
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
