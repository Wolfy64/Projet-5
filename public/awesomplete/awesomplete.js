/**
 * Simple, lightweight, usable local autocomplete library for modern browsers
 * Because there weren’t enough autocomplete scripts in the world? Because I’m completely insane and have NIH syndrome? Probably both. :P
 * @author Lea Verou http://leaverou.github.io/awesomplete
 * MIT license
 */

(function () {

var _ = function (input, o) {
	var me = this;
    
    // Keep track of number of instances for unique IDs
    Awesomplete.count = (Awesomplete.count || 0) + 1;
    this.count = Awesomplete.count;

	// Setup

	this.isOpened = false;

	this.input = $(input);
	this.input.setAttribute("autocomplete", "off");
	this.input.setAttribute("aria-owns", "awesomplete_list_" + this.count);
	this.input.setAttribute("role", "combobox");

	o = o || {};

	configure(this, {
		minChars: 2,
		maxItems: 10,
		autoFirst: false,
		data: _.DATA,
		filter: _.FILTER_CONTAINS,
		sort: o.sort === false ? false : _.SORT_BYLENGTH,
		item: _.ITEM,
		replace: _.REPLACE
	}, o);

	this.index = -1;

	// Create necessary elements

	this.container = $.create("div", {
		className: "awesomplete",
		around: input
	});

	this.ul = $.create("ul", {
		hidden: "hidden",
        role: "listbox",
        id: "awesomplete_list_" + this.count,
		inside: this.container
	});

	this.status = $.create("span", {
		className: "visually-hidden",
		role: "status",
		"aria-live": "assertive",
        "aria-atomic": true,
        inside: this.container,
        textContent: this.minChars != 0 ? ("Type " + this.minChars + " or more characters for results.") : "Begin typing for results."
	});

	// Bind events

	this._events = {
		input: {
			"input": this.evaluate.bind(this),
			"blur": this.close.bind(this, { reason: "blur" }),
			"keydown": function(evt) {
				var c = evt.keyCode;

				// If the dropdown `ul` is in view, then act on keydown for the following keys:
				// Enter / Esc / Up / Down
				if(me.opened) {
					if (c === 13 && me.selected) { // Enter
						evt.preventDefault();
						me.select();
					}
					else if (c === 27) { // Esc
						me.close({ reason: "esc" });
					}
					else if (c === 38 || c === 40) { // Down/Up arrow
						evt.preventDefault();
						me[c === 38? "previous" : "next"]();
					}
				}
			}
		},
		form: {
			"submit": this.close.bind(this, { reason: "submit" })
		},
		ul: {
			"mousedown": function(evt) {
				var li = evt.target;

				if (li !== this) {

					while (li && !/li/i.test(li.nodeName)) {
						li = li.parentNode;
					}

					if (li && evt.button === 0) {  // Only select on left click
						evt.preventDefault();
						me.select(li, evt.target);
					}
				}
			}
		}
	};

	$.bind(this.input, this._events.input);
	$.bind(this.input.form, this._events.form);
	$.bind(this.ul, this._events.ul);

	if (this.input.hasAttribute("list")) {
		this.list = "#" + this.input.getAttribute("list");
		this.input.removeAttribute("list");
	}
	else {
		this.list = this.input.getAttribute("data-list") || o.list || [];
	}

	_.all.push(this);
};

_.prototype = {
	set list(list) {
		if (Array.isArray(list)) {
			this._list = list;
		}
		else if (typeof list === "string" && list.indexOf(",") > -1) {
				this._list = list.split(/\s*,\s*/);
		}
		else { // Element or CSS selector
			list = $(list);

			if (list && list.children) {
				var items = [];
				slice.apply(list.children).forEach(function (el) {
					if (!el.disabled) {
						var text = el.textContent.trim();
						var value = el.value || text;
						var label = el.label || text;
						if (value !== "") {
							items.push({ label: label, value: value });
						}
					}
				});
				this._list = items;
			}
		}

		if (document.activeElement === this.input) {
			this.evaluate();
		}
	},

	get selected() {
		return this.index > -1;
	},

	get opened() {
		return this.isOpened;
	},

	close: function (o) {
		if (!this.opened) {
			return;
		}

		this.ul.setAttribute("hidden", "");
		this.isOpened = false;
		this.index = -1;
    
		this.status.setAttribute("hidden", "");

		$.fire(this.input, "awesomplete-close", o || {});
	},

	open: function () {
		this.ul.removeAttribute("hidden");
		this.isOpened = true;
        
		this.status.removeAttribute("hidden");

		if (this.autoFirst && this.index === -1) {
			this.goto(0);
		}

		$.fire(this.input, "awesomplete-open");
	},

	destroy: function() {
		//remove events from the input and its form
		$.unbind(this.input, this._events.input);
		$.unbind(this.input.form, this._events.form);

		//move the input out of the awesomplete container and remove the container and its children
		var parentNode = this.container.parentNode;

		parentNode.insertBefore(this.input, this.container);
		parentNode.removeChild(this.container);

		//remove autocomplete and aria-autocomplete attributes
		this.input.removeAttribute("autocomplete");
		this.input.removeAttribute("aria-autocomplete");

		//remove this awesomeplete instance from the global array of instances
		var indexOfAwesomplete = _.all.indexOf(this);

		if (indexOfAwesomplete !== -1) {
			_.all.splice(indexOfAwesomplete, 1);
		}
	},

	next: function () {
		var count = this.ul.children.length;
		this.goto(this.index < count - 1 ? this.index + 1 : (count ? 0 : -1) );
	},

	previous: function () {
		var count = this.ul.children.length;
		var pos = this.index - 1;

		this.goto(this.selected && pos !== -1 ? pos : count - 1);
	},

	// Should not be used, highlights specific item without any checks!
	goto: function (i) {
		var lis = this.ul.children;

		if (this.selected) {
			lis[this.index].setAttribute("aria-selected", "false");
		}

		this.index = i;

		if (i > -1 && lis.length > 0) {
			lis[i].setAttribute("aria-selected", "true");
            
			this.status.textContent = lis[i].textContent + ", list item " + (i + 1) + " of " + lis.length;
            
            this.input.setAttribute("aria-activedescendant", this.ul.id + "_item_" + this.index);

			// scroll to highlighted element in case parent's height is fixed
			this.ul.scrollTop = lis[i].offsetTop - this.ul.clientHeight + lis[i].clientHeight;

			$.fire(this.input, "awesomplete-highlight", {
				text: this.suggestions[this.index]
			});
		}
	},

	select: function (selected, origin) {
		if (selected) {
			this.index = $.siblingIndex(selected);
		} else {
			selected = this.ul.children[this.index];
		}

		if (selected) {
			var suggestion = this.suggestions[this.index];

			var allowed = $.fire(this.input, "awesomplete-select", {
				text: suggestion,
				origin: origin || selected
			});

			if (allowed) {
				this.replace(suggestion);
				this.close({ reason: "select" });
				$.fire(this.input, "awesomplete-selectcomplete", {
					text: suggestion
				});
			}
		}
	},

	evaluate: function() {
		var me = this;
		var value = this.input.value;

		if (value.length >= this.minChars && this._list.length > 0) {
			this.index = -1;
			// Populate list with options that match
			this.ul.innerHTML = "";

			this.suggestions = this._list
				.map(function(item) {
					return new Suggestion(me.data(item, value));
				})
				.filter(function(item) {
					return me.filter(item, value);
				});

			if (this.sort !== false) {
				this.suggestions = this.suggestions.sort(this.sort);
			}

			this.suggestions = this.suggestions.slice(0, this.maxItems);

			this.suggestions.forEach(function(text, index) {
					me.ul.appendChild(me.item(text, value, index));
				});

			if (this.ul.children.length === 0) {
                
                this.status.textContent = "No results found";
                
				this.close({ reason: "nomatches" });
        
			} else {
				this.open();
        
                this.status.textContent = this.ul.children.length + " results found";
			}
		}
		else {
			this.close({ reason: "nomatches" });
            
                this.status.textContent = "No results found";
		}
	}
};

// Static methods/properties

_.all = [];

_.FILTER_CONTAINS = function (text, input) {
	return RegExp($.regExpEscape(input.trim()), "i").test(text);
};

_.FILTER_STARTSWITH = function (text, input) {
	return RegExp("^" + $.regExpEscape(input.trim()), "i").test(text);
};

_.SORT_BYLENGTH = function (a, b) {
	if (a.length !== b.length) {
		return a.length - b.length;
	}

	return a < b? -1 : 1;
};

_.ITEM = function (text, input, item_id) {
	var html = input.trim() === "" ? text : text.replace(RegExp($.regExpEscape(input.trim()), "gi"), "<mark>$&</mark>");
	return $.create("li", {
		innerHTML: html,
		"aria-selected": "false",
        "id": "awesomplete_list_" + this.count + "_item_" + item_id
	});
};

_.REPLACE = function (text) {
	this.input.value = text.value;
};

_.DATA = function (item/*, input*/) { return item; };

// Private functions

function Suggestion(data) {
	var o = Array.isArray(data)
	  ? { label: data[0], value: data[1] }
	  : typeof data === "object" && "label" in data && "value" in data ? data : { label: data, value: data };

	this.label = o.label || o.value;
	this.value = o.value;
}
Object.defineProperty(Suggestion.prototype = Object.create(String.prototype), "length", {
	get: function() { return this.label.length; }
});
Suggestion.prototype.toString = Suggestion.prototype.valueOf = function () {
	return "" + this.label;
};

function configure(instance, properties, o) {
	for (var i in properties) {
		var initial = properties[i],
		    attrValue = instance.input.getAttribute("data-" + i.toLowerCase());

		if (typeof initial === "number") {
			instance[i] = parseInt(attrValue);
		}
		else if (initial === false) { // Boolean options must be false by default anyway
			instance[i] = attrValue !== null;
		}
		else if (initial instanceof Function) {
			instance[i] = null;
		}
		else {
			instance[i] = attrValue;
		}

		if (!instance[i] && instance[i] !== 0) {
			instance[i] = (i in o)? o[i] : initial;
		}
	}
}

// Helpers

var slice = Array.prototype.slice;

function $(expr, con) {
	return typeof expr === "string"? (con || document).querySelector(expr) : expr || null;
}

function $$(expr, con) {
	return slice.call((con || document).querySelectorAll(expr));
}

$.create = function(tag, o) {
	var element = document.createElement(tag);

	for (var i in o) {
		var val = o[i];

		if (i === "inside") {
			$(val).appendChild(element);
		}
		else if (i === "around") {
			var ref = $(val);
			ref.parentNode.insertBefore(element, ref);
			element.appendChild(ref);
		}
		else if (i in element) {
			element[i] = val;
		}
		else {
			element.setAttribute(i, val);
		}
	}

	return element;
};

$.bind = function(element, o) {
	if (element) {
		for (var event in o) {
			var callback = o[event];

			event.split(/\s+/).forEach(function (event) {
				element.addEventListener(event, callback);
			});
		}
	}
};

$.unbind = function(element, o) {
	if (element) {
		for (var event in o) {
			var callback = o[event];

			event.split(/\s+/).forEach(function(event) {
				element.removeEventListener(event, callback);
			});
		}
	}
};

$.fire = function(target, type, properties) {
	var evt = document.createEvent("HTMLEvents");

	evt.initEvent(type, true, true );

	for (var j in properties) {
		evt[j] = properties[j];
	}

	return target.dispatchEvent(evt);
};

$.regExpEscape = function (s) {
	return s.replace(/[-\\^$*+?.()|[\]{}]/g, "\\$&");
};

$.siblingIndex = function (el) {
	/* eslint-disable no-cond-assign */
	for (var i = 0; el = el.previousElementSibling; i++);
	return i;
};

// Initialization

function init() {
	$$("input.awesomplete").forEach(function (input) {
		new _(input);
	});
}

// Are we in a browser? Check for Document constructor
if (typeof Document !== "undefined") {
	// DOM already loaded?
	if (document.readyState !== "loading") {
		init();
	}
	else {
		// Wait for it
		document.addEventListener("DOMContentLoaded", init);
	}
}

_.$ = $;
_.$$ = $$;

// Make sure to export Awesomplete on self when in a browser
if (typeof self !== "undefined") {
	self.Awesomplete = _;
}

// Expose Awesomplete as a CJS module
if (typeof module === "object" && module.exports) {
	module.exports = _;
}

return _;

}());

// ##### My Autocomplete #####
new Awesomplete(input, {
	list: [
		"Accenteur alpin",
		"Accenteur mouchet",
		"Agami trompette, Agami, Aganmi",
		"Agrobate roux",
		"Aigle botté",
		"Aigle criard",
		"Aigle de Bonelli",
		"Aigle des steppes",
		"Aigle ibérique",
		"Aigle impérial",
		"Aigle noir et blanc",
		"Aigle orné",
		"Aigle pêcheur à poitrine blanche",
		"Aigle pomarin",
		"Aigle royal",
		"Aigle tyran",
		"Aigrette à face blanche, Héron à face blanche, Long cou",
		"Aigrette bleue",
		"Aigrette d'Australasie",
		"Aigrette des récifs",
		"Aigrette garzette",
		"Aigrette neigeuse",
		"Aigrette roussâtre",
		"Aigrette sacrée, Aigrette des récifs",
		"Aigrette tricolore",
		"Alapi à cravate noire",
		"Alapi à menton noir",
		"Alapi à sourcils blancs",
		"Alapi à tête noire",
		"Alapi carillonneur",
		"Alapi de Buffon",
		"Alapi paludicole",
		"Albatros à bec jaune, Albatros à bec jaune de l'Océan Indien",
		"Albatros à cape blanche, Albatros timide",
		"Albatros à nez jaune, Albatros à bec jaune",
		"Albatros à sourcils noirs",
		"Albatros à tête grise",
		"Albatros d'Amsterdam",
		"Albatros fuligineux à dos clair",
		"Albatros fuligineux à dos sombre",
		"Albatros hurleur, Grand albatros",
		"Alouette calandre",
		"Alouette calandrelle",
		"Alouette des champs",
		"Alouette haussecol",
		"Alouette lulu",
		"Alouette monticole",
		"Alouette pispolette",
		"Amadine cou - coupé",
		"Amazone à tête jaune",
		"Amazone aourou",
		"Amazone de Dufresne",
		"Amazone de la Martinique",
		"Amazone poudrée",
		"Anabate à couronne rousse",
		"Anabate à croupion roux",
		"Anabate à gorge fauve",
		"Anabate des palmiers",
		"Anabate flamboyant",
		"Anabate olivâtre",
		"Anabate rubigineux",
		"Anhinga d'Amérique, Canard plongeur",
		"Ani à bec lisse, Bilbitin, Gros merle de Sainte - Lucie",
		"Ani des palétuviers",
		"Antriade olivâtre",
		"Antriade turdoïde",
		"Ara bleue",
		"Ara chloroptère",
		"Ara de Guadeloupe",
		"Ara macavouanne",
		"Ara noble",
		"Ara rouge, Ara macao",
		"Ara vert",
		"Araçari grigri",
		"Araçari vert",
		"Araguira gris",
		"Araponga blanc",
		"Ariane à poitrine blanche",
		"Ariane à poitrine blanche(orienticola)",
		"Ariane à queue cuivrée",
		"Ariane à ventre vert",
		"Ariane de Linné",
		"Ariane vert - doré",
		"Arlequin plongeur, Garrot arlequin",
		"Astrild à joues orange",
		"Astrild bec de corail, Astrild ondulé",
		"Astrild cendré, Astrild troglodyte",
		"Attila à croupion jaune",
		"Attila cannelle",
		"Aulia à ventre pâle, Tyran à ventre pâle",
		"Aulia cendré",
		"Aulia grisâtre, Tyran grisâtre ",
		"Autour à ventre blanc, Émouchet bleu, Épervier à ventre blanc, Buse blanche, Buse",
		"Autour à ventre gris",
		"Autour australien, Émouchet gris",
		"Autour des palombes",
		"Autour des palombes(ssp.de Corse)",
		"Avocette élégante",
		"Balbuzard d'Australie, Buse de mer, Aigle pêcheur",
		"Balbuzard pêcheur",
		"Barbacou à croupion blanc",
		"Barbacou noir",
		"Barbacou rufalbin",
		"Barge à queue noire",
		"Barge hudsonienne",
		"Barge marbrée",
		"Barge rousse",
		"Bargette du Térek, Chevalier bargette",
		"Bartramie des champs, Bartramie à longue queue, Maubèche des champs",
		"Batara à gorge noire",
		"Batara ardoisé",
		"Batara cendré",
		"Batara d'Amazonie",
		"Batara de Cayenne",
		"Batara demi - deuil",
		"Batara étoilé",
		"Batara fascié",
		"Batara huppé",
		"Batara rayé",
		"Batara souris",
		"Batara tacheté",
		"Bec - croisé bifascié",
		"Bec - croisé des sapins",
		"Bec - croisé perroquet",
		"Bec - en - ciseaux noir",
		"Bécarde à ailes blanches",
		"Bécarde à calotte noire",
		"Bécarde cendrée",
		"Bécarde de Lesson",
		"Bécarde du Surinam",
		"Bécasse d'Amérique",
		"Bécasse des bois",
		"Bécasseau à cou roux",
		"Bécasseau à échasses, Bécasseau échasse",
		"Bécasseau à queue pointue",
		"Bécasseau cocorli",
		"Bécasseau d'Alaska",
		"Bécasseau de Baird",
		"Bécasseau de Bonaparte, Bécasseau à croupion blanc",
		"Bécasseau de l'Anadyr",
		"Bécasseau de Temminck",
		"Bécasseau falcinelle",
		"Bécasseau maubèche",
		"Bécasseau minuscule",
		"Bécasseau minute",
		"Bécasseau rousset, Bécasseau roussâtre",
		"Bécasseau sanderling",
		"Bécasseau semipalmé",
		"Bécasseau tacheté, Bécasseau à poitrine cendrée",
		"Bécasseau variable",
		"Bécasseau violet",
		"Bécassine de Wilson",
		"Bécassine des marais",
		"Bécassine double",
		"Bécassine géante",
		"Bécassine sourde",
		"Bécassine sud - américaine, Bécassine de Magellan ",
		"Bengali des Indes, Bengali rouge",
		"Bergeronnette citrine",
		"Bergeronnette de Yarrell",
		"Bergeronnette des ruisseaux",
		"Bergeronnette grise",
		"Bergeronnette printanière",
		"Bernache à cou roux",
		"Bernache à ventre pâle",
		"Bernache cravant",
		"Bernache du Canada",
		"Bernache du Pacifique",
		"Bernache nonnette",
		"Bihoreau cannelle",
		"Bihoreau violacé",
		"Blongios nain, Blongios d'Australie",
		"Bondrée apivore",
		"Bouscarle de Cetti",
		"Bouvreuil pivoine",
		"Bruant à calotte blanche",
		"Bruant à col roux",
		"Bruant à couronne blanche",
		"Bruant à gorge blanche",
		"Bruant à joues marron",
		"Bruant à sourcils jaunes",
		"Bruant à tête rousse",
		"Bruant auréole",
		"Bruant cendrillard",
		"Bruant chanteur",
		"Bruant chingolo",
		"Bruant des champs",
		"Bruant des neiges",
		"Bruant des prés",
		"Bruant des roseaux",
		"Bruant des savanes",
		"Bruant fauve",
		"Bruant fou",
		"Bruant jaune",
		"Bruant lapon",
		"Bruant masqué",
		"Bruant mélanocéphale",
		"Bruant nain",
		"Bruant ortolan",
		"Bruant proyer",
		"Bruant roux",
		"Bruant rustique",
		"Bruant zizi",
		"Bulbul à ventre rouge",
		"Bulbul de la Réunion, Merle",
		"Bulbul de Madagascar",
		"Bulbul orphée",
		"Busard cendré",
		"Busard de Buffon",
		"Busard de Gould",
		"Busard de Madagascar",
		"Busard de Maillard",
		"Busard des marais",
		"Busard des roseaux",
		"Busard pâle",
		"Busard Saint - Martin",
		"Buse à face noire",
		"Buse à gros bec",
		"Buse à queue barrée",
		"Buse à queue blanche",
		"Buse à queue courte",
		"Buse à queue rousse",
		"Buse à tête blanche",
		"Buse ardoisée",
		"Buse blanche",
		"Buse buson",
		"Buse cendrée",
		"Buse échasse",
		"Buse féroce",
		"Buse pattue",
		"Buse roussâtre",
		"Buse urubu",
		"Buse variable",
		"Butor blongios, Blongios nain",
		"Butor d'Amérique",
		"Butor d'Australie",
		"Butor étoilé",
		"Butor mirasol",
		"Butor zigzag, Onoré zigzag",
		"Cabézon tacheté",
		"Caille des blés",
		"Caille peinte",
		"Caïque à queue courte",
		"Caïque à tête noire",
		"Caïque maïpouri, Caïque maïpourri, Maïpouri à tête noire",
		"Calliste diable - enrhumé",
		"Calliste passevert",
		"Calliste rouverdin",
		"Calliste septicolore",
		"Calliste syacou",
		"Calliste tacheté",
		"Calliste tiqueté",
		"Calliste varié",
		"Calopsitte élégante",
		"Campyloptère à ventre gris",
		"Canard à bosse, Sarcidiorne à bosse",
		"Canard à collier noir",
		"Canard à front blanc, Canard d'Amérique",
		"Canard à sourcils, Canard sauvage",
		"Canard bridé, Souchet australien",
		"Canard carolin, Canard branchu",
		"Canard chipeau",
		"Canard colvert",
		"Canard d'Eaton",
		"Canard de Crozet, Canard d'Eaton (Crozet)",
		"Canard de Meller",
		"Canard des Bahamas, Pilet des Bahamas",
		"Canard des Kerguélen, Canard d'Eaton (Kerguélen)",
		"Canard mandarin",
		"Canard musqué",
		"Canard noir",
		"Canard pilet",
		"Canard siffleur",
		"Canard souchet",
		"Capucin à dos marron",
		"Capucin à tête blanche",
		"Capucin bec - de - plomb",
		"Capucin damier",
		"Capucin nonnette",
		"Caracara à gorge rouge",
		"Caracara à tête jaune",
		"Caracara du Nord",
		"Caracara noir",
		"Cardinal à poitrine rose, Grosbec à poitrine rose",
		"Cardinal érythromèle",
		"Cardinal flavert",
		"Carnifex à collier",
		"Carnifex à gorge cendrée",
		"Carnifex ardoisé",
		"Carnifex barré",
		"Carouge à calotte rousse",
		"Carouge à capuchon",
		"Carouge à épaulettes",
		"Carouge à tête jaune",
		"Carouge unicolore",
		"Carpophage géant, Notou",
		"Carpophage pacifique",
		"Cassenoix moucheté, Casse - noix",
		"Cassique cul - jaune",
		"Cassique cul - rouge",
		"Cassique huppé",
		"Cassique vert",
		"Caurale soleil",
		"Chardonneret élégant",
		"Chardonneret jaune",
		"Chevalier aboyeur",
		"Chevalier arlequin",
		"Chevalier combattant, Combattant varié",
		"Chevalier culblanc",
		"Chevalier de Sibérie",
		"Chevalier gambette",
		"Chevalier grivelé",
		"Chevalier guignette",
		"Chevalier semipalmé",
		"Chevalier solitaire",
		"Chevalier stagnatile",
		"Chevalier sylvain",
		"Chevêche des terriers, Chouette des terriers ",
		"Chevêchette d'Amazonie",
		"Chocard à bec jaune",
		"Choucas de Daourie",
		"Choucas des tours",
		"Choucas des tours oriental",
		"Chouette à lunettes",
		"Chouette chevêche, Chevêche d'Athéna",
		"Chouette chevêchette, Chevêchette d'Europe",
		"Chouette effraie, Effraie des clochers",
		"Chouette épervière",
		"Chouette huhul",
		"Chouette hulotte",
		"Chouette Limard, Petite nyctale",
		"Chouette mouchetée",
		"Cigogne blanche",
		"Cigogne maguari",
		"Cigogne noire",
		"Cincle plongeur",
		"Circaète Jean - le - Blanc",
		"Cisticole des joncs",
		"Cochevis de Thékla",
		"Cochevis huppé",
		"Colibri à gorge rubis",
		"Colibri à menton bleu, Émeraude à menton bleu",
		"Colibri à tête bleue",
		"Colibri améthyste",
		"Colibri avocette, Mango avocette",
		"Colibri corinne",
		"Colibri de Delphine",
		"Colibri falle - vert, Falle - vert",
		"Colibri guaïnumbi",
		"Colibri huppé",
		"Colibri jacobin",
		"Colibri oreillard",
		"Colibri rubis - topaze",
		"Colibri topaze",
		"Colibri tout - vert",
		"Colin de Californie",
		"Colin de Virginie",
		"Colin huppé",
		"Colombe à croissant, Perdrix croissant",
		"Colombe à front gris",
		"Colombe à queue noire, Ortolan",
		"Colombe bleutée",
		"Colombe de Verreaux",
		"Colombe pygmée",
		"Colombe rousse",
		"Colombe roux violet, Colombe rouviolette, Perdrix rouge",
		"Colombine du Pacifique, Tourterelle verte",
		"Conirostre bicolore",
		"Conirostre cul - roux",
		"Conophage à oreilles blanches, Conopophage à oreilles blanches ",
		"Conure couronnée",
		"Conure cuivrée",
		"Conure de Pinto",
		"Conure maîtresse",
		"Conure nanday",
		"Conure pavouane",
		"Conure soleil",
		"Conure versicolore",
		"Conure veuve",
		"Coq bankiva, Coq, Poule",
		"Coq - de - roche orange, Coq de roche",
		"Coquette à raquettes",
		"Coquette huppe - col",
		"Coracine à col nu",
		"Coracine chauve",
		"Coracine noire",
		"Coracine rouge",
		"Corbeau calédonien",
		"Corbeau familier, Corneille de l'Inde",
		"Corbeau freux",
		"Corbeau pie",
		"Cordon bleu violacé",
		"Cordonbleu à joues rouges",
		"Cormoran à aigrettes",
		"Cormoran africain",
		"Cormoran d'Australasie",
		"Cormoran de Crozet",
		"Cormoran de Kerguelen",
		"Cormoran huppé",
		"Cormoran huppé de Méditerranée, Cormoran de Desmarest",
		"Cormoran impérial",
		"Cormoran noir",
		"Cormoran olivâtre, Cormoran vigua",
		"Cormoran pie",
		"Cormoran pygmée",
		"Corneille mantelée",
		"Corneille mantelée(de Corse)",
		"Corneille noire",
		"Corythopis à collier",
		"Cotinga brun",
		"Cotinga de Cayenne",
		"Cotinga de Daubenton",
		"Cotinga ouette",
		"Cotinga pompadour",
		"Coucou à éventail, Monteur de gamme",
		"Coucou de Madagascar",
		"Coucou de Nouvelle - Zélande",
		"Coucou éclatant, Coucou cuivré",
		"Coucou geai",
		"Coucou gris",
		"Coucou présageur",
		"Coulicou à bec jaune, Coucou à bec jaune",
		"Coulicou à bec noir, Coucou à bec noir",
		"Coulicou d'Euler",
		"Coulicou de Vieillot",
		"Coulicou manioc, Coulicou masqué, Coulicou manioc, Coccyzus des palétuviers, Coulicou des palétuviers",
		"Courlan brun",
		"Courlis à bec grêle",
		"Courlis à long bec",
		"Courlis cendré",
		"Courlis corlieu",
		"Courlis corlieu d'Europe",
		"Courlis de Sibérie",
		"Courlis esquimau",
		"Courlis hudsonien",
		"Courlis nain",
		"Courol vouroudriou",
		"Courvite isabelle",
		"Crabier blanc, Crabier de Madagascar, Crabier malgache",
		"Crave à bec rouge",
		"Crécerelle d ? Australie",
		"Crécerelle d'Amérique",
		"Crécerelle d'Amérique (Caraïbes)",
		"Cygne chanteur",
		"Cygne de Bewick",
		"Cygne noir",
		"Cygne tuberculé",
		"Dacnis à coiffe bleue",
		"Dacnis bleu",
		"Damier du Cap",
		"Dendrocygne à ventre noir",
		"Dendrocygne des Antilles",
		"Dendrocygne fauve",
		"Dendrocygne veuf",
		"Diamant de kittlitz, Bengali des Nouvelles - Hébrides",
		"Diamant psittaculaire, Cardinal de Nouméa, Pape de Nouméa",
		"Dickcissel d'Amérique",
		"Dindon sauvage",
		"Donacobe à miroir, Troglodyte à miroir",
		"Doradite de Sclater",
		"Drome ardéole",
		"Drongo de Mayotte",
		"Dryade à queue fourchue",
		"Duc à aigrettes",
		"Durbec des sapins",
		"Echasse blanche",
		"Échasse d'Amérique",
		"Échenilleur à masque noir",
		"Échenilleur calédonien, Siffleur calédonien",
		"Échenilleur de la Réunion, Tuit - tuit de la Réunion",
		"Échenilleur de montagne, Siffleur de montagne",
		"Echenilleur pie",
		"Éffraie de prairie, Chouette",
		"Effraie des clochers, Chouette effraie",
		"Effraie des clochers, Chouette, Hibou",
		"Egothèle calédonien",
		"Eider à duvet",
		"Eider à tête grise",
		"Eider de Steller",
		"Élaène siffleuse, Siffleur blanc, Élénie siffleuse",
		"Elanion à queue blanche",
		"Élanion blanc",
		"Elanion perle",
		"Élénie à bec court",
		"Élénie à couronne d'or",
		"Élénie à ventre jaune",
		"Élénie de Gaimard",
		"Elénie grise",
		"Élénie huppée",
		"Élénie menue",
		"Élénie tête - de - feu",
		"Émeraude orvert",
		"Engoulevent à collier roux",
		"Engoulevent à queue courte",
		"Engoulevent à queue étoilée",
		"Engoulevent bois - pourri",
		"Engoulevent coré",
		"Engoulevent d'Amérique",
		"Engoulevent d'Europe",
		"Engoulevent de Caroline",
		"Engoulevent de Nouvelle - Calédonie",
		"Engoulevent leucopyge",
		"Engoulevent minime",
		"Engoulevent nacunda",
		"Engoulevent noirâtre",
		"Engoulevent pauraqué",
		"Engoulevent piramidig",
		"Engoulevent trifide",
		"Epervier bicolore",
		"Épervier brun",
		"Épervier d'Europe",
		"Épervier de Cooper",
		"Épervier de Frances",
		"Épervier de Mayotte",
		"Epervier nain",
		"Érismature à tête blanche",
		"Érismature rousse",
		"Erismature routoutou, Canard masqué",
		"Ermite à brins blancs",
		"Ermite à long bec",
		"Ermite d'Antonia",
		"Ermite d'Auguste",
		"Ermite de Bourcier",
		"Ermite hirsute",
		"Ermite nain",
		"Ermite roussâtre",
		"Étourneau caronculé",
		"Étourneau sansonnet",
		"Étourneau unicolore",
		"Euplecte franciscain",
		"Euplecte ignicolore",
		"Evêque bleu - noir",
		"Faisan de Colchide",
		"Faisan doré",
		"Faisan vénéré, Faisans de Chasse",
		"Faucon aplomado",
		"Faucon concolore",
		"Faucon crécerelle",
		"Faucon crécerellette",
		"Faucon d'Éléonore",
		"Faucon de Barbarie",
		"Faucon de l'Amour",
		"Faucon des chauves - souris",
		"Faucon des prairies",
		"Faucon émerillon",
		"Faucon gerfaut",
		"Faucon hobereau",
		"Faucon kobez",
		"Faucon lanier",
		"Faucon orangé",
		"Faucon pèlerin",
		"Faucon sacre",
		"Fauvette à lunettes",
		"Fauvette à tête noire",
		"Fauvette babillarde",
		"Fauvette de l'Atlas",
		"Fauvette de Lifou",
		"Fauvette de Moltoni",
		"Fauvette des jardins",
		"Fauvette du désert",
		"Fauvette épervière",
		"Fauvette grisette",
		"Fauvette masqué",
		"Fauvette mélanocéphale",
		"Fauvette naine",
		"Fauvette orphée",
		"Fauvette passerinette",
		"Fauvette pitchou",
		"Fauvette pitchou(aremorica)",
		"Fauvette pitchou(corse)",
		"Fauvette sarde",
		"Flamant des Caraïbes",
		"Flamant du Chili",
		"Flamant nain, Petit flamant",
		"Flamant rose",
		"Fou à pieds rouges",
		"Fou austral",
		"Fou brun",
		"Fou d'Abbott",
		"Fou de Bassan",
		"Fou de Grant",
		"Fou du Cap",
		"Fou masqué",
		"Foudi de La Réunion",
		"Foudi des Comores",
		"Foudi rouge, Foudi de Madagascar",
		"Foudy, Cardinal",
		"Foulque à crête, Foulque caronculée",
		"Foulque d'Amérique",
		"Foulque macroule",
		"Founingo des Comores",
		"Fourmilier à gorge rousse",
		"Fourmilier manikup",
		"Fourmilier tacheté",
		"Fourmilier zébré",
		"Francolin gris",
		"Francolin noir",
		"Frégate ariel",
		"Frégate ariel, Petite Frégate",
		"Frégate du Pacifique",
		"Frégate superbe",
		"Fuligule à bec cerclé, Fuligule à collier",
		"Fuligule à dos blanc",
		"Fuligule à tête noire, Petit Fuligule",
		"Fuligule à tête rouge",
		"Fuligule austral",
		"Fuligule milouin",
		"Fuligule milouinan",
		"Fuligule morillon",
		"Fuligule nyroca",
		"Fulmar argenté, Fulmar antarctique",
		"Fulmar de Hall, Pétrel de Hall",
		"Fulmar géant, Pétrel géant",
		"Gallicolombe de Stair",
		"Gallinule africaine",
		"Gallinule d'Amérique, Poule d'eau, Gallinule poule d ? eau",
		"Gallinule poule - d ? eau",
		"Gallinule sombre, Poule d'eau",
		"Ganga cata",
		"Gardeb ? uf d'Asie",
		"Garrot à oeil d'or",
		"Garrot albéole",
		"Garrot d'Islande",
		"Geai bleu",
		"Geai de Cayenne",
		"Geai des chênes",
		"Gélinotte des bois",
		"Gélinotte huppée",
		"Géocoucou pavonin",
		"Géocoucou tacheté",
		"Géopélie zébrée",
		"Gérygone mélanésienne",
		"Glaréole à ailes noires",
		"Glaréole à collier",
		"Glaréole isabelle",
		"Glaréole malgache, Glaréole de Madagascar",
		"Glaréole orientale, Glaréole des Maldives",
		"Gobe - mouche de Lifou",
		"Gobe - mouche de Maré",
		"Gobe - mouches de Paradis, Tersiphone de Bourbon, Oiseau la vierge, Chakouat",
		"Gobemouche à collier",
		"Gobemouche à semi collier, Gobe - mouche à demi - collier",
		"Gobemouche gris",
		"Gobemouche méditerranéen",
		"Gobemouche nain, Gobemouche rougeâtre",
		"Gobemouche noir",
		"Gobemoucheron guyanais",
		"Gobemoucheron tropical",
		"Goéland à ailes blanches, Goéland arctique",
		"Goéland à bec cerclé",
		"Goéland argenté",
		"Goéland bourgmestre",
		"Goéland brun",
		"Goéland cendré",
		"Goéland d'Audouin",
		"Goéland de la Baltique",
		"Goéland dominicain",
		"Goéland dominicain, Goéland de Kerguelen",
		"Goéland hudsonien, Goéland d'Amérique",
		"Goéland ichthyaète",
		"Goéland leucophée",
		"Goéland marin",
		"Goéland pontique",
		"Goéland railleur",
		"Goglu des prés, Bobolink",
		"Gorfou de Filhol",
		"Gorfou de Schlegel",
		"Gorfou huppé",
		"Gorfou maraconi",
		"Gorfou sauteur",
		"Gorfou sauteur du Nord, Gorfou de Moseley",
		"Gorgebleue à miroir",
		"Grallaire grand - beffroi",
		"Grallaire roi",
		"Grallaire tachetée",
		"Granatelle de Pelzeln, Paruline de Pelzeln",
		"Grand Batara",
		"Grand Chevalier à pattes jaunes, Chevalier criard",
		"Grand corbeau",
		"Grand Cormoran",
		"Grand Gravelot",
		"Grand Héron",
		"Grand Ibijau",
		"Grand Jacamar",
		"Grand Labbe",
		"Grand Labbe, Labbe subantarctique",
		"Grand Pingouin",
		"Grand Tardivole",
		"Grand Tétras",
		"Grand Tinamou",
		"Grand Urubu",
		"Grand - duc d'Europe",
		"Grand - duc de Virginie, Grand Duc d ? Amérique",
		"Grande Aigrette",
		"Grande Aigrette(Amérique)",
		"Grande Outarde, Outarde barbue",
		"Gravelot à collier interrompu, Gravelot de Kent",
		"Gravelot asiatique, Pluvier asiatique",
		"Gravelot de Leschenault, Pluvier de Leschenault",
		"Gravelot kildir, Pluvier kildir",
		"Gravelot mongol, Pluvier mongol, Pluvier de Mongolie",
		"Gravelot pâtre",
		"Gravelot siffleur, Pluvier siffleur",
		"Grèbe à bec bigarré",
		"Grèbe à cou noir",
		"Grèbe australasien",
		"Grèbe castagneux",
		"Grèbe castagneux, Petit Grèbe",
		"Grèbe esclavon",
		"Grèbe huppé",
		"Grèbe jougris",
		"Grèbe minime",
		"Grébifoulque d'Amérique",
		"Grimpar à bec courbe",
		"Grimpar à collier",
		"Grimpar à gorge tachetée",
		"Grimpar à longue queue",
		"Grimpar à menton blanc",
		"Grimpar barré",
		"Grimpar bec - en - coin",
		"Grimpar de Perrot",
		"Grimpar des cabosses",
		"Grimpar enfumé",
		"Grimpar flambé",
		"Grimpar lancéolé",
		"Grimpar nasican",
		"Grimpar strié",
		"Grimpar talapiot",
		"Grimpar varié",
		"Grimpereau brun",
		"Grimpereau des bois",
		"Grimpereau des jardins",
		"Grisin à croupion roux",
		"Grisin ardoisé",
		"Grisin de Cayenne",
		"Grisin de Todd",
		"Grisin étoilé",
		"Grisin givré",
		"Grisin noirâtre",
		"Grisin sombre",
		"Grisin spodioptile",
		"Grive à ailes rousses",
		"Grive à gorge noire",
		"Grive à gorge rousse, Grive à gorge noire",
		"Grive à joues grises",
		"Grive à pieds jaunes",
		"Grive de Bicknell",
		"Grive de Sibérie",
		"Grive des bois",
		"Grive dorée",
		"Grive draine",
		"Grive fauve",
		"Grive litorne",
		"Grive mauvis",
		"Grive musicienne",
		"Grive obscure",
		"Grive solitaire",
		"Grivette à dos olive, Grive à dos olive",
		"Grosbec casse - noyaux",
		"Grosbec errant",
		"Grue cendrée",
		"Grue demoiselle",
		"Grue du Canada",
		"Guacharo des cavernes",
		"Guêpier d'Europe",
		"Guêpier de Perse",
		"Guêpier malgache",
		"Guifette leucoptère",
		"Guifette moustac",
		"Guifette noire",
		"Guillemot à miroir",
		"Guillemot de Brünnich",
		"Guillemot de Troïl",
		"Guiraca bleu",
		"Guit - guit céruléen",
		"Guit - guit émeraude",
		"Guit - guit saï",
		"Gygis blanche",
		"Gygis blanche, Sterne blanche",
		"Gypaète barbu",
		"Harelde de Miquelon, Harelde boréale",
		"Harfang des neiges",
		"Harle bièvre",
		"Harle couronné",
		"Harle huppé",
		"Harle piette",
		"Harpage bidenté, Milan bidenté",
		"Harpie féroce",
		"Harpie huppée",
		"Hémipode de Madagascar, Turnix de Madagascar",
		"Héron agami, Onoré agami ",
		"Héron bihoreau, Bihoreau gris",
		"Héron cendré",
		"Héron cocoi, Héron cocoï",
		"Héron coiffé",
		"Héron crabier, Crabier chevelu",
		"Héron de Humblot",
		"Héron garde - b ? ufs",
		"Héron garde - boeufs",
		"Héron mélanocéphale",
		"Héron pourpré",
		"Héron strié",
		"Héron strié, Blongios vert, Héron vert",
		"Héron vert",
		"Hibou des marais",
		"Hibou maître - bois",
		"Hibou moyen - duc",
		"Hibou petit - duc, Petit - duc scops",
		"Hibou strié",
		"Hirondelle à ailes blanches",
		"Hirondelle à ailes hérissées",
		"Hirondelle à ceinture blanche",
		"Hirondelle à cuisses blanches",
		"Hirondelle à front blanc",
		"Hirondelle à front brun",
		"Hirondelle à gorge rousse",
		"Hirondelle bicolore",
		"Hirondelle bleu et blanc",
		"Hirondelle chalybée",
		"Hirondelle de Bourbon",
		"Hirondelle de fenêtre",
		"Hirondelle de rivage",
		"Hirondelle de rochers",
		"Hirondelle des arbres",
		"Hirondelle des églises, Hirondelle à ventre blanc",
		"Hirondelle des Mascareignes",
		"Hirondelle des torrents",
		"Hirondelle du Pacifique",
		"Hirondelle gracieuse",
		"Hirondelle messagère",
		"Hirondelle noire, Martin pourpre, Hirondelle pourprée",
		"Hirondelle rousseline",
		"Hirondelle rustique, Hirondelle de cheminée",
		"Hirondelle striée, Hirondelle à gorge striée",
		"Hirondelle tapère",
		"Hoazin huppé, Hoazin, Sassa",
		"Hocco alector, Hocco noir",
		"Huîtrier d'Amérique",
		"Huitrier de Finsch",
		"Huîtrier pie",
		"Huppe fasciée",
		"Hypolaïs bottée, Hypolaïs russe, Hypolaïs de Russie",
		"Hypolaïs ictérine, Grand contrefaisant",
		"Hypolaïs obscure",
		"Hypolaïs pâle",
		"Hypolaïs polyglotte, Petit contrefaisant",
		"Hypolaïs rama",
		"Ibijau à ailes blanches",
		"Ibijau à longue queue",
		"Ibijau gris",
		"Ibijau roux",
		"Ibis blanc",
		"Ibis falcinelle",
		"Ibis malgache",
		"Ibis rouge",
		"Ibis sacré",
		"Ibis vert, Flamant bois",
		"Inséparable à tête grise",
		"Inséparable à tête rouge",
		"Inséparable de Fischer",
		"Inséparable masqué",
		"Jabiru d'Amérique",
		"Jacamar à bec jaune",
		"Jacamar à longue queue",
		"Jacamar à ventre blanc",
		"Jacamar brun",
		"Jacamar vert",
		"Jacana noir",
		"Jacarini noir",
		"Jaseur boréal, Jaseur de Bohème",
		"Jaseur d'Amérique",
		"Junco ardoisé",
		"Kagou huppé, Cagou",
		"Kamichi cornu",
		"Labbe à longue queue",
		"Labbe antarctique",
		"Labbe de McCormick",
		"Labbe parasite",
		"Labbe pomarin",
		"Lagopède alpin",
		"Lagopède des Alpes",
		"Lagopède des Pyrénées",
		"Lagopède des saules",
		"Langrayen à ventre blanc, Hirondelle busière",
		"Léiothrix jaune, Rossignol du Japon",
		"Limnodrome à bec court, Bécassin roux",
		"Limnodrome à long bec, Bécassin à long bec",
		"Linotte à bec jaune",
		"Linotte mélodieuse",
		"Locustelle de Pallas",
		"Locustelle fasciée",
		"Locustelle fluviatile",
		"Locustelle lancéolée",
		"Locustelle luscinioïde",
		"Locustelle tachetée",
		"Loriot d'Europe, Loriot jaune",
		"Loriquet à diadème, Lori à diadème",
		"Loriquet à tête bleue",
		"Lusciniole à moustaches",
		"Macagua rieur, Faucon rieur, Macagua",
		"Macareux moine",
		"Macreuse à ailes blanches",
		"Macreuse à bec jaune",
		"Macreuse à front blanc",
		"Macreuse brune",
		"Macreuse noire",
		"Madère, Colibri madère",
		"Mainate religieux",
		"Manakin à front blanc",
		"Manakin à gorge blanche",
		"Manakin à panache doré",
		"Manakin à tête blanche",
		"Manakin auréole",
		"Manakin cannelle, Moucherolle manakin ",
		"Manakin casse - noisette",
		"Manakin minuscule",
		"Manakin noir",
		"Manakin tijé",
		"Manchot à jugulaire",
		"Manchot Adelie",
		"Manchot empereur",
		"Manchot papou",
		"Manchot royal",
		"Mango à cravate noire",
		"Mango à cravate verte",
		"Marouette à sourcils blancs",
		"Marouette de Baillon",
		"Marouette de Caroline",
		"Marouette fuligineuse",
		"Marouette grise",
		"Marouette jaune, Râle jaune",
		"Marouette plombée",
		"Marouette ponctuée",
		"Marouette poussin",
		"Martin pêcheur vintsi",
		"Martin roselin, Étourneau roselin",
		"Martin - chasseur sacré",
		"Martin - pêcheur à ventre roux",
		"Martin - pêcheur bicolore",
		"Martin - pêcheur d'Amazonie",
		"Martin - pêcheur d'Amérique",
		"Martin - pêcheur d'Europe",
		"Martin - pêcheur nain",
		"Martin - pêcheur vert",
		"Martin - pêcheur vintsi",
		"Martinet",
		"Martinet à collier blanc",
		"Martinet à menton blanc",
		"Martinet à ventre blanc, Martinet alpin",
		"Martinet chiquesol, Petit martinet noir, Hirondelle",
		"Martinet claudia",
		"Martinet d'André",
		"Martinet de Cayenne",
		"Martinet de Chapman",
		"Martinet de Grandidier",
		"Martinet de Sick",
		"Martinet des maisons",
		"Martinet des palmes",
		"Martinet du Cap",
		"Martinet épineux",
		"Martinet montagnard",
		"Martinet noir",
		"Martinet pâle",
		"Martinet polioure",
		"Martinet ramoneur",
		"Martinet sombre",
		"Martinet spinicaude",
		"Mégalure calédonienne, Fauvette calédonienne",
		"Méliphage à oreillons gris",
		"Méliphage barré, Grive perlée",
		"Méliphage foulehaio",
		"Méliphage toulou, Méliphage noir",
		"Mergule nain",
		"Merle à col blanc",
		"Merle à flancs gris",
		"Merle à lunettes, Grive à lunettes, Grive chatte",
		"Merle à plastron",
		"Merle cacao",
		"Merle d'Amérique",
		"Merle de Lifou",
		"Merle de Maré",
		"Merle des Îles",
		"Merle des Moluques, Martin triste",
		"Merle leucomèle",
		"Merle noir",
		"Merle vantard",
		"Mésange à longue queue, Orite à longue queue",
		"Mésange à tête brune",
		"Mésange alpestre",
		"Mésange azurée",
		"Mésange bleue",
		"Mésange boréale",
		"Mésange boréale, Mésange à tête noire",
		"Mésange charbonnière",
		"Mésange huppée",
		"Mésange noire",
		"Mésange nonnette",
		"Mésangeai du Canada",
		"Microbate à collier",
		"Microbate à long bec",
		"Microtyran à queue courte",
		"Microtyran bifascié, Todirostre bifascié ",
		"Microtyran casqué, Todirostre casqué ",
		"Milan à long bec",
		"Milan à queue fourchue, Naucler à queue fourchue",
		"Milan bec - en - croc, Bec - en - croc de Temminck",
		"Milan bleuâtre",
		"Milan de Cayenne, Bec - en - croc de Cayenne",
		"Milan des marais",
		"Milan noir",
		"Milan noir(à bec jaune)",
		"Milan royal",
		"Milan siffleur, Aigle siffleur",
		"Miro à ventre jaune, Rossignol à ventre jaune",
		"Moineau cisalpin",
		"Moineau domestique",
		"Moineau domestique(indicus)",
		"Moineau espagnol",
		"Moineau friquet",
		"Moineau soulcie",
		"Monarque brun",
		"Monarque mélanésien, Gobe - mouches à large bec",
		"Monticole bleu, Merle bleu",
		"Monticole de roche, Merle de roche",
		"Moqueur chat",
		"Moqueur corossol",
		"Moqueur des savanes, Grive des savanes, Moquia",
		"Moqueur gorge blanche",
		"Moqueur grivotte",
		"Moqueur polyglotte",
		"Moqueur roux",
		"Moqueur trembleur, Trembleur brun, Cocobino",
		"Motmot houtouc",
		"Moucherolle",
		"Moucherolle à bavette blanche",
		"Moucherolle à côtés olive",
		"Moucherolle à longs brins",
		"Moucherolle à tête blanche",
		"Moucherolle à ventre jaune",
		"Moucherolle barbichon",
		"Moucherolle cendré",
		"Moucherolle d'Euler",
		"Moucherolle des aulnes",
		"Moucherolle fascié",
		"Moucherolle fuligineux",
		"Moucherolle gobe - mouches, Gobe - mouches, Loulou fou, Tombé lévé",
		"Moucherolle hirondelle",
		"Moucherolle phébi",
		"Moucherolle pie",
		"Moucherolle rougequeue",
		"Mouette à tête grise",
		"Mouette argentée, Mouette australienne",
		"Mouette atricille",
		"Mouette de Bonaparte",
		"Mouette de Franklin",
		"Mouette de Ross",
		"Mouette de Sabine",
		"Mouette ivoire, Goéland sénateur, Mouette blanche",
		"Mouette mélanocéphale",
		"Mouette pygmée",
		"Mouette rieuse",
		"Mouette tridactyle",
		"Myrmidon à flancs blancs",
		"Myrmidon à ventre brun",
		"Myrmidon du Surinam",
		"Myrmidon gris",
		"Myrmidon longipenne",
		"Myrmidon moucheté",
		"Myrmidon pygmée",
		"Myzomèle calédonien",
		"Myzomèle cardinal, Sucrier cardinal, Colibri",
		"Nette demi - deuil",
		"Nette rousse",
		"Niverolle alpine, Niverolle des Alpes",
		"Noddi brun",
		"Noddi brun, Noddi niais",
		"Noddi gris",
		"Noddi marianne, Noddi à bec grêle",
		"Noddi noir",
		"Nyctale de Tengmalm, Chouette de Tengmalm",
		"Océanite à croupion gris",
		"Océanite à gorge blanche",
		"Océanite à ventre blanc",
		"Océanite à ventre noir",
		"océanite de Matsudaira",
		"Océanite frégate, Pétrel frégate",
		"Oedicnème criard",
		"Oedicnème des récifs",
		"Oie à bec court",
		"Oie à tête barrée",
		"Oie cendrée",
		"Oie des moissons",
		"Oie des neiges",
		"Oie naine",
		"Oie rieuse",
		"Oiseau lunettes gris, Oiseau blanc, Zosterops de Bourbon, Oiseau - lunettes de Bourbon",
		"Oiseau lunettes vert, Oiseau vert",
		"Onoré fascié",
		"Onoré rayé",
		"Organiste cul - blanc",
		"Organiste de Finsch",
		"Organiste doré",
		"Organiste fardé",
		"Organiste louis d'or, Perruche, Avant Noël, Roi-bois",
		"Organiste nègre",
		"Organiste plombé",
		"Organiste téïté",
		"Oriole à épaulettes",
		"Oriole de Baltimore",
		"Oriole de Martinique, Carouge",
		"Oriole des vergers",
		"Oriole jaune",
		"Ortalide motmot",
		"Ouette d'Égypte, Oie d'Égypte",
		"Outarde canepetière",
		"Outarde de Macqueen",
		"Oxyrhynque huppé",
		"Padda de Java",
		"Palicour de Cayenne",
		"Panure à moustaches, Mésange à moustaches",
		"Paon",
		"Papegeai maillé",
		"Paroare rougecap",
		"Paruline à ailes bleues",
		"Paruline à calotte noire",
		"Paruline à capuchon",
		"Paruline à collier, Sylvette parula",
		"Paruline à couronne rousse",
		"Paruline à croupion jaune",
		"Paruline à flancs marron",
		"Paruline à gorge grise",
		"Paruline à gorge noire",
		"Paruline à gorge orangée",
		"Paruline à joues grises",
		"Paruline à joues noires",
		"Paruline à poitrine baie",
		"Paruline à tête cendrée",
		"Paruline azurée",
		"Paruline bleue",
		"Paruline couronnée, Sylvette couronnée",
		"Paruline d ? Adélaïde",
		"Paruline des mangroves(bartholemica)",
		"Paruline des pins",
		"Paruline des rives",
		"Paruline des ruisseaux, Sylvette des ruisseaux",
		"Paruline du Canada",
		"Paruline du Kentucky",
		"Paruline équatoriale",
		"Paruline flamboyante, Sylvette flamboyante",
		"Paruline hochequeue",
		"Paruline jaune",
		"Paruline masquée",
		"Paruline noire et blanche, Sylvette noire et blanche",
		"Paruline obscure, Sylvette obscure",
		"Paruline rayée, Sylvette rayée",
		"Paruline tigrée",
		"Paruline triste",
		"Paruline vermivore",
		"Passerin indigo",
		"Pélican à lunettes",
		"Pélican blanc",
		"Pélican blanc, Pélican d'Amérique",
		"Pélican brun(Caraïbes)",
		"Pélican brun, Pélican, Grand gosier",
		"Pélican frisé",
		"Pélican gris",
		"Pénélope à gorge bleue, Pénélope siffleuse",
		"Pénélope marail, Maraïl, Maray",
		"Perdicule rousse - gorge",
		"Perdrix bartavelle",
		"Perdrix chukar, Perdrix choucar",
		"Perdrix de Madagascar",
		"Perdrix gambra",
		"Perdrix grise",
		"Perdrix rouge",
		"Perrique de Guadeloupe, Conure de Guadeloupe",
		"Perroquet de benson",
		"Perroquet de Guadeloupe",
		"Perroquet jaco",
		"Perruche à collier",
		"Perruche à collier de Maurice",
		"Perruche calédonienne, Perruche à front rouge",
		"Perruche cornue, Perruche de la chaîne",
		"Perruche d'Ouvéa",
		"Perruche ondulée",
		"Petit bec - en - fourreau de Crozet",
		"Petit bec - en - fourreau, Petit chionis",
		"Petit Blongios",
		"Petit Chevalier à pattes jaunes, Chevalier à pattes jaunes",
		"Petit duc",
		"Petit Gravelot",
		"Petit Piaye",
		"Petit pingouin, Pingouin torda",
		"Petit prion, Prion colombe",
		"Petit puffin, Puffin semblable",
		"Petit - duc choliba",
		"Petit - duc de Watson",
		"Petit - duc du Roraima",
		"Petit - duc guatémaltèque",
		"Petit - duc malgache",
		"Petite Buse",
		"Petite Sterne",
		"Pétrel à ailes noires",
		"Pétrel à collier",
		"Pétrel à menton blanc",
		"Pétrel antarctique",
		"Pétrel calédonien",
		"Pétrel cul - blanc, Océanite cul - blanc",
		"Pétrel de Barau",
		"Pétrel de Bulwer",
		"Pétrel de Castro, Océanite de Castro",
		"Pétrel de Gould",
		"Pétrel de Jouanin",
		"Pétrel de Kerguelen",
		"Pétrel de la Trinité",
		"Pétrel de Solander",
		"Pétrel de Swinhoe, Océanite de Swinhoe",
		"Pétrel de Tahiti",
		"Pétrel de Wilson, Océanite de Wilson",
		"Pétrel des Desertas",
		"Pétrel des neiges",
		"Pétrel diablotin",
		"Pétrel du Herald, Pétrel héraut",
		"Pétrel fulmar, Fulmar boréal",
		"Pétrel gongon",
		"Pétrel maculé",
		"Pétrel noir de Bourbon",
		"Pétrel plongeur commun, Puffinure plongeur",
		"Pétrel plongeur de Géorgie du Sud, Puffinure de Géorgie du Sud",
		"Pétrel soyeux",
		"Pétrel tempête, Océanite tempête",
		"Phaéton à bec jaune",
		"Phaéton à bec jaune(Europa)",
		"Phaéton à bec jaune(Pacifique)",
		"Phaéton à bec rouge",
		"Phaéton à bec rouge(mesonauta)",
		"Phaéton à brins rouges, Paille en queue à brins rouges",
		"Phalarope à bec étroit",
		"Phalarope à bec large",
		"Phalarope de Wilson",
		"Phragmite aquatique",
		"Phragmite des joncs",
		"Piauhau hurleur",
		"Piaye à ventre noir",
		"Piaye écureuil",
		"Pic à chevron d'or",
		"Pic à cou rouge",
		"Pic à cravate noire",
		"Pic à dos blanc",
		"Pic à dos noir",
		"Pic à gorge jaune",
		"Pic cendré",
		"Pic chevelu",
		"Pic de Cassin",
		"Pic de Cayenne",
		"Pic de la Guadeloupe, Tapeur",
		"Pic de Malherbe",
		"Pic dominicain",
		"Pic épeiche",
		"Pic épeichette",
		"Pic flamboyant",
		"Pic jaune",
		"Pic maculé",
		"Pic mar",
		"Pic mineur",
		"Pic mordoré",
		"Pic noir",
		"Pic ondé",
		"Pic or - olive",
		"Pic ouentou",
		"Pic passerin",
		"Pic tridactyle",
		"Pic vert - doré",
		"Pic vert, Pivert",
		"Picumne de Buffon",
		"Picumne frangé",
		"Pie bavarde",
		"Pie bleue",
		"Pie - grièche à poitrine rose",
		"Pie - grièche à tête rousse",
		"Pie - grièche brune",
		"Pie - grièche du Turkestan",
		"Pie - grièche écorcheur",
		"Pie - grièche grise",
		"Pie - grièche masquée",
		"Pie - grièche méridionale",
		"Pigeon à cou rouge",
		"Pigeon à couronne blanche",
		"Pigeon à gorge blanche, Collier blanc",
		"Pigeon biset",
		"Pigeon colombin",
		"Pigeon de Madagascar",
		"Pigeon des Comores",
		"Pigeon plombé",
		"Pigeon ramier",
		"Pigeon ramiret",
		"Pigeon rousset",
		"Pigeon vineux",
		"Pinson de Lincoln",
		"Pinson des arbres",
		"Pinson des marais",
		"Pinson du nord, Pinson des Ardennes",
		"Pinson familier",
		"Pinson hudsonien, Bruant hudsonien",
		"Pintade de Numidie, Pintade commune",
		"Pione à tête bleue",
		"Pione violette",
		"Pioui de l'Ouest",
		"Pipit à dos olive",
		"Pipit à gorge rousse",
		"Pipit de Godlewski",
		"Pipit de la Petchora",
		"Pipit de Richard",
		"Pipit des arbres",
		"Pipit farlousane",
		"Pipit farlouse",
		"Pipit jaunâtre",
		"Pipit maritime",
		"Pipit rousseline",
		"Pipit spioncelle",
		"Piprite verdin",
		"Pipromorphe à tête brune",
		"Pipromorphe de McConnell",
		"Pipromorphe roussâtre",
		"Piranga orangé, Tangara orangé",
		"Piranga rouge - sang",
		"Platyrhynque à cimier blanc",
		"Platyrhynque à cimier orange",
		"Platyrhynque à miroir",
		"Platyrhynque à poitrine jaune",
		"Platyrhynque à tête d'or",
		"Platyrhynque jaune - olive",
		"Platyrhynque olivâtre",
		"Platyrhynque poliocéphale",
		"Plongeon à bec blanc",
		"Plongeon arctique",
		"Plongeon catmarin",
		"Plongeon imbrin",
		"Pluvian fluviatile",
		"Pluvier à double collier",
		"Pluvier à front blanc",
		"Pluvier à triple collier",
		"Pluvier argenté",
		"Pluvier bronzé",
		"Pluvier d'Azara, Gravelot d?Azara",
		"Pluvier de Wilson, Gravelot de Wilson, Collier",
		"Pluvier doré",
		"Pluvier fauve",
		"Pluvier guignard",
		"Pluvier neigeux",
		"Pluvier oriental",
		"Pluvier semipalmé, Gravelot semipalmé",
		"Polochion moine, Polochon moine, Grive moine",
		"Porte - éventail roi, Moucherolle royal",
		"Pouillot à grands sourcils",
		"Pouillot à pattes sombres, Pouillot à deux barres, Pouillot ardoisé",
		"Pouillot boréal",
		"Pouillot brun",
		"Pouillot de Bonelli",
		"Pouillot de Hume",
		"Pouillot de Pallas, Pouillot roitelet",
		"Pouillot de Schwarz",
		"Pouillot de Sibérie",
		"Pouillot du Caucase, Pouillot des genévriers",
		"Pouillot fitis",
		"Pouillot ibérique, Pouillot véloce ibérique",
		"Pouillot oriental",
		"Pouillot siffleur",
		"Pouillot véloce",
		"Pouillot verdâtre",
		"Poule sultane, Talève sultane, Porphyrion bleu",
		"Poule - d'eau, Gallinule poule-d'eau",
		"Prion de Belcher",
		"Prion de Forster",
		"Prion de la désolation",
		"Prion de Macgillivray, Prion de Saint - Paul",
		"Prion de Salvin",
		"Ptilope de Clémentine",
		"Ptilope de Grey, Pigeon vert des îles",
		"Ptilope vlouvlou, Pigeon vert",
		"Puffin à bec grêle",
		"Puffin à pieds pâles",
		"Puffin cendré",
		"Puffin d'Audubon",
		"Puffin de Macaronésie, Puffin obscur",
		"Puffin de Scopoli",
		"Puffin des Anglais",
		"Puffin des Baléares",
		"Puffin élégant",
		"Puffin fouquet",
		"Puffin fouquet, Puffin du Pacifique",
		"Puffin fuligineux",
		"Puffin leucomèle",
		"Puffin majeur",
		"Puffin tropical, Puffin de Baillon",
		"Puffin volage",
		"Puffin yelkouan",
		"Puffinure des Kerguelen",
		"Pygargue à queue blanche",
		"Pygargue à tête blanche",
		"Quiscale bronzé, Mainate bronzé",
		"Quiscale merle",
		"Quiscale merle(guadeloupensis)",
		"Quiscale merle, Merle François, Crédit, Cancangnan",
		"Quiscale rouilleux, Mainate rouilleux",
		"Râle à bec peint",
		"Râle à long bec, Râle gris, Pintade",
		"Râle brunoir",
		"Râle concolore",
		"Râle d'eau",
		"Râle de Lafresnaye",
		"Râle des genêts",
		"Râle des palétuviers",
		"Râle grêle",
		"Râle kiolo",
		"Râle ocellé",
		"Râle tacheté",
		"Râle tapageur",
		"Râle tiklin",
		"Râle tiklin, Râle à bandes",
		"Rémiz penduline, Mésange rémiz",
		"Rhipidure à collier, Petit lève - queue",
		"Rhipidure tacheté, Grand lève - queue",
		"Robin à flancs roux, Rossignol à flancs roux",
		"Roitelet à couronne dorée",
		"Roitelet à couronne rubis",
		"Roitelet à triple bandeau",
		"Roitelet huppé",
		"Rolle violet",
		"Rollier d'Europe",
		"Roselin cramoisi",
		"Roselin githagine, Bouvreuil githagine",
		"Roselin pourpré",
		"Rossignol philomèle",
		"Rossignol progné",
		"Rougegorge familier",
		"Rougequeue à front blanc",
		"Rougequeue de Moussier",
		"Rougequeue noir",
		"Rousserolle des buissons",
		"Rousserolle des Gambier, Rousserolle de Mangareva",
		"Rousserolle des îles sous le Vent, Rousserolle de Raiatea",
		"Rousserolle effarvatte",
		"Rousserolle isabelle",
		"Rousserolle turdoïde",
		"Rousserolle verderolle",
		"Salangane à croupion blanc",
		"Salangane de Vanikoro",
		"Salangane des Mascareignes",
		"Salangane soyeuse, Hirondelle des grottes",
		"Saltator ardoisé",
		"Saltator des grands - bois",
		"Saltator gris",
		"Saltator groc bec, Saltator strié, Grive gros bec",
		"Saphir à gorge rousse, Ariane à gorge rousse",
		"Saphir azuré",
		"Sarcelle à ailes bleues",
		"Sarcelle à ailes vertes, Sarcelle de la Caroline",
		"Sarcelle australasienne, Sarcelle grise",
		"Sarcelle cannelle",
		"Sarcelle d'été",
		"Sarcelle d'hiver",
		"Sarcelle de Nouvelle - Zélande",
		"Sarcelle élégante",
		"Sarcelle marbrée",
		"Sarcoramphe roi",
		"Savacou huppé",
		"Sclérure à bec court",
		"Sclérure à gorge rousse",
		"Sclérure des ombres",
		"Serin cini",
		"Serin du Cap",
		"Serin du Mozambique",
		"Sicale des savanes",
		"Siffleur calédonien",
		"Siffleur doré",
		"Siffleur itchong",
		"Sirli de Dupont",
		"Sittelle à poitrine rousse",
		"Sittelle corse",
		"Sittelle torchepot",
		"Sittine à queue rousse",
		"Sittine brune",
		"Sittine des rameaux",
		"Sizerin blanchâtre",
		"Sizerin boréal",
		"Sizerin cabaret",
		"Sizerin flammé",
		"Smaragdan oreillard",
		"Solitaire à gorge rousse, Siffleur des montagnes",
		"Souimanga de Mayotte",
		"Sourciroux mélodieux",
		"Spatule blanche",
		"Spatule rose, Spatule rosée",
		"Spatule royale",
		"Sporophile - Rouge gorge, Père noir(mâle), Moisson(femelle), Gros bec(femelle)",
		"Sporophile à ailes blanches",
		"Sporophile à face noire, Cici, Cici - z ? èb",
		"Sporophile à ventre châtain",
		"Sporophile à ventre jaune",
		"Sporophile ardoisé",
		"Sporophile bouveron",
		"Sporophile crassirostre",
		"Sporophile curio",
		"Sporophile faux - bouvron",
		"Sporophile gris - de - plomb",
		"Sporophile petit - louis",
		"Sterne à gros bec",
		"Sterne à joues blanches",
		"Sterne arctique",
		"Sterne argentée",
		"Sterne bridée",
		"Sterne caspienne",
		"Sterne caugek",
		"Sterne de Cabot",
		"Sterne de Cayenne",
		"Sterne de Dougall",
		"Sterne de Forster",
		"Sterne de Kerguelen",
		"Sterne de Saunders",
		"Sterne diamant",
		"Sterne élégante",
		"Sterne fuligineuse",
		"Sterne hansel",
		"Sterne huppée",
		"Sterne naine",
		"Sterne néréis",
		"Sterne pierregarin",
		"Sterne royale",
		"Sterne subantarctique",
		"Sterne voyageuse",
		"Stourne calédonien, Merle noir",
		"Sturnelle des prés",
		"Sturnelle militaire",
		"Sucrier à poitrine jaune, Sucrier à ventre jaune, Sucrier falle jaune, Sucrier cage",
		"Sucrier à ventre jaune(bartholemica)",
		"Sylvette à gorge jaune, Paruline à gorge jaune",
		"Sylvette à moustache, Paruline des prés",
		"Sylvette de Guadeloupe, Paruline caféiette",
		"Sylvette orangée, Paruline orangée",
		"Sylvette verdâtre, Fauvette verdâtre",
		"Synallaxe à gorge jaune",
		"Synallaxe à ventre blanc",
		"Synallaxe albane",
		"Synallaxe de Cayenne",
		"Synallaxe de McConnell",
		"Synallaxe ponctué",
		"Syrrhapte paradoxal",
		"Tadorne casarca, Casarca roux",
		"Tadorne de Belon",
		"Talève d'Allen, Poule sultane d'Allen",
		"Talève favorite",
		"Talève sultane, Poule sultane",
		"Talève violacée",
		"Tamatia à collier",
		"Tamatia à gros bec",
		"Tamatia brun",
		"Tamatia pie",
		"Tamatia tacheté",
		"Tangara à bec d'argent",
		"Tangara à camail",
		"Tangara à crête fauve",
		"Tangara à dos jaune",
		"Tangara à épaulettes blanches",
		"Tangara à galons blancs",
		"Tangara à galons rouges",
		"Tangara à huppe rouge, Tangara à huppe ignée ",
		"Tangara à miroir blanc",
		"Tangara coiffe - noire",
		"Tangara cyanictère",
		"Tangara des palmiers",
		"Tangara écarlate",
		"Tangara évêque",
		"Tangara guira",
		"Tangara mordoré",
		"Tangara noir et blanc",
		"Tangara vermillon",
		"Tantale d'Amérique",
		"Tarier oriental",
		"Tarier pâtre",
		"Tarin des aulnes",
		"Tarin des Pins, Chardonneret des pins",
		"Tchitrec malgache",
		"Tersine hirondelle",
		"Tétéma colma",
		"Tétéma coq - de - bois",
		"Tétras lyre",
		"Tichodrome échelette",
		"Tinamou cendré",
		"Tinamou rubigineux",
		"Tinamou soui",
		"Tinamou varié",
		"Tisserin gendarme",
		"Tityre à tête noire",
		"Tityre gris",
		"Tocro de Guyane, Tocro",
		"Todirostre à front gris",
		"Todirostre de Joséphine",
		"Todirostre familier",
		"Todirostre peint",
		"Todirostre tacheté",
		"Todirostre zostérops",
		"Tohi à flancs roux",
		"Tohi silencieux",
		"Torcol fourmilier",
		"Toucan à bec rouge, Toucan de Cuvier",
		"Toucan toco",
		"Toucan vitellin, Toucan ariel",
		"Toucanet de Derby",
		"Toucanet de Whitely",
		"Toucanet koulik",
		"Toui à queue pourprée",
		"Toui à sept couleurs",
		"Toui de Sclater",
		"Toui de Sclater(sclateri)",
		"Toui été",
		"Toui para",
		"Tournepierre à collier",
		"Tournepierre du Canada",
		"Tourterelle à ailes blanches",
		"Tourterelle à queue carrée",
		"Tourterelle des bois",
		"Tourterelle du Cap",
		"Tourterelle maillée",
		"Tourterelle oreillarde",
		"Tourterelle orientale",
		"Tourterelle peinte, Tourterelle malgache, Ramier",
		"Tourterelle rieuse",
		"Tourterelle tambourette",
		"Tourterelle triste",
		"Tourterelle turque",
		"Traquet à tête blanche",
		"Traquet de la Réunion, Tarier de la Réunion",
		"Traquet du désert",
		"Traquet isabelle",
		"Traquet kurde, Traquet à queue rousse, Traquet de Perse",
		"Traquet motteux",
		"Traquet oreillard",
		"Traquet pie",
		"Traquet rieur",
		"Traquet tarier, Tarier des prés",
		"Travailleur à bec rouge",
		"Trembleur gris",
		"Troglodyte à face pâle",
		"Troglodyte à poitrine blanche",
		"Troglodyte arada",
		"Troglodyte bambla",
		"Troglodyte coraya",
		"Troglodyte familier, Rossignol",
		"Troglodyte mignon",
		"Trogon à queue blanche",
		"Trogon à queue noire",
		"Trogon aurore",
		"Trogon rosalba",
		"Trogon violacé",
		"Turnix bariolé",
		"Tyran à gorge rayée",
		"Tyran à queue fauve, Tyran rougequeue ",
		"Tyran audacieux",
		"Tyran de Cayenne",
		"Tyran de Pelzeln",
		"Tyran de Wied",
		"Tyran des palmiers",
		"Tyran des savanes",
		"Tyran féroce",
		"Tyran gris",
		"Tyran gris, Pipiri, Pipirite",
		"Tyran grosse - tête",
		"Tyran janeau",
		"Tyran licteur",
		"Tyran mélancolique",
		"Tyran mélodieux",
		"Tyran olivâtre",
		"Tyran oriflamme",
		"Tyran pirate",
		"Tyran pitangua",
		"Tyran quiquivi",
		"Tyran siffleur",
		"Tyran sociable",
		"Tyran tacheté",
		"Tyran tritri",
		"Tyranneau à petits pieds",
		"Tyranneau barbu",
		"Tyranneau des palétuviers",
		"Tyranneau flavéole",
		"Tyranneau frangé",
		"Tyranneau minute",
		"Tyranneau nain",
		"Tyranneau ombré",
		"Tyranneau passegris",
		"Tyranneau roitelet",
		"Tyranneau souris",
		"Tyranneau verdâtre",
		"Tyranneau vif, Tyranneau guyanais",
		"Urubu à tête jaune",
		"Urubu à tête rouge, Vautour aura, Vautour à tête rouge",
		"Urubu noir",
		"Vacher à tête brune",
		"Vacher géant",
		"Vacher luisant",
		"Vanneau à queue blanche",
		"Vanneau armé",
		"Vanneau de Cayenne",
		"Vanneau huppé",
		"Vanneau sociable",
		"Vanneau soldat",
		"Vanneau terne",
		"Vanneau téro",
		"Vautour de Rüppell",
		"Vautour fauve",
		"Vautour moine",
		"Vautour oricou",
		"Vautour percnoptère",
		"Venturon corse",
		"Venturon montagnard",
		"Verdier d'Europe",
		"Veuve dominicaine",
		"Viréo à gorge jaune, Viréo à poitrine jaune",
		"Viréo à moustaches, Cuek, Tchouek, Piade, Piopio, Tchuenck",
		"Viréo à oeil blanc",
		"Viréo aux yeux rouges, Viréo à oeil rouge",
		"Viréo de Philadelphie",
		"Viréo solitaire, Viréo à tête bleue",
		"Viréon à calotte rousse",
		"Viréon à gorge grise",
		"Viréon à plastron",
		"Viréon à tête cendrée",
		"Viréon fardé",
		"Zostérops à dos gris, Lunette",
		"Zostérops à dos vert, Lunette",
		"Zostérops de Lifou",
		"Zostérops de Mayotte, Zostérops malgache",
		"Zostérops malgache",
		"Zostérops malgache(Europa)",
		"Zostérops minute"
	]
});