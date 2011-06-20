/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.
    
    You should have received a copy of the GNU Affero General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/

/**
 * @class
 * Deprecated class for creating new Zotero.Translate instances<br/>
 * <br/>
 * New code should use Zotero.Translate.Web, Zotero.Translate.Import, Zotero.Translate.Export, or
 * Zotero.Translate.Search
 */
Zotero.Translate = function(type) {
	Zotero.debug("Translate: WARNING: new Zotero.Translate() is deprecated; please don't use this if you don't have to");
	// hack
	var translate = Zotero.Translate.newInstance(type);
	for(var i in translate) {
		this[i] = translate[i];
	}
	this.constructor = translate.constructor;
	this.__proto__ = translate.__proto__;
}

/**
 * Create a new translator by a string type
 */
Zotero.Translate.newInstance = function(type) {
	return new Zotero.Translate[type[0].toUpperCase()+type.substr(1).toLowerCase()];
}

/**
 * Namespace for Zotero sandboxes
 * @namespace
 */
Zotero.Translate.Sandbox = {
	/**
	 * Combines a sandbox with the base sandbox
	 */
	"_inheritFromBase":function(sandboxToMerge) {
		var newSandbox = {};
		
		for(var method in Zotero.Translate.Sandbox.Base) {
			newSandbox[method] = Zotero.Translate.Sandbox.Base[method];
		}
		
		for(var method in sandboxToMerge) {
			newSandbox[method] = sandboxToMerge[method];
		}
		
		return newSandbox;
	},
	
	/**
	 * Base sandbox. These methods are available to all translators.
	 * @namespace
	 */
	"Base": {
		/**
		 * Called as {@link Zotero.Item#complete} from translators to save items to the database.
		 * @param {Zotero.Translate} translate
		 * @param {SandboxItem} An item created using the Zotero.Item class from the sandbox
		 */
		"_itemDone":function(translate, item) {
			Zotero.debug("Translate: Saving item");
			
			// warn if itemDone called after translation completed
			if(translate._complete) {
				Zotero.debug("Translate: WARNING: Zotero.Item#complete() called after Zotero.done(); please fix your code", 2);
			}
			
			// if we're not supposed to save the item or we're in a child translator,
			// just return the item array
			if(translate._libraryID === false || translate._parentTranslator) {
				translate.newItems.push(item);
				translate._runHandler("itemDone", item, item);
				return;
			}
			
			var newItem = translate._itemSaver.saveItem(item);
			
			// Allow progress meter to update
			//
			// This can probably be re-enabled for web translators once badly asynced ones are fixed
			if(!translate.noWait && translate instanceof Zotero.Translate.Import) {
				Zotero.wait();
			}
			
			// pass both the saved item and the original JS array item
			translate._runHandler("itemDone", newItem, item);
		},
		
		/**
		 * Gets translator options that were defined in displayOptions in translator header
		 *
		 * @param {Zotero.Translate} translate
		 * @param {String} option Option to be retrieved
		 */
		"getOption":function(translate, option) {
			if(typeof option !== "string") {
				throw("Translate: getOption: option must be a string");
				return;
			}
			
			return translate._displayOptions[option];
		},
		
		/**
		 * For loading other translators and accessing their methods
		 * 
		 * @param {Zotero.Translate} translate
		 * @param {String} type Translator type ("web", "import", "export", or "search")
		 * @returns {Object} A safeTranslator object, which operates mostly like Zotero.Translate
		 */	 
		"loadTranslator":function(translate, type) {
			const setDefaultHandlers = function(translate, translation) {
				if(Zotero.Utilities.isEmpty(translation._handlers)) {
					if(type !== "export") {
						translation.setHandler("itemDone", function(obj, item) {
							translate.Sandbox._itemDone(translate, item);
						});
					}
					translation.setHandler("selectItems", translate._handlers["selectItems"]);
				}
			}
			
			if(typeof type !== "string") {
				throw("Translate: loadTranslator: type must be a string");
				return;
			}
			
			Zotero.debug("Translate: creating translate instance of type "+type+" in sandbox");
			var translation = Zotero.Translate.newInstance(type);
			translation._parentTranslator = translate;
			
			if(translation instanceof Zotero.Translate.Export && !(translation instanceof Zotero.Translate.Export)) {
				throw("Translate: only export translators may call other export translators");
			}
			
			/**
			 * @class Wrapper for {@link Zotero.Translate} for safely calling another translator 
			 * from inside an existing translator
			 * @inner
			 */
			var safeTranslator = {};
			safeTranslator.__exposedProps__ = {
				"setSearch":"r",
				"setDocument":"r",
				"setHandler":"r",
				"setString":"r",
				"setTranslator":"r",
				"getTranslators":"r",
				"translate":"r",
				"getTranslatorObject":"r"
			};
			safeTranslator.setSearch = function(arg) {
				if(Zotero.isFx4) arg = JSON.parse(JSON.stringify(arg));
				return translation.setSearch(arg);
			};
			safeTranslator.setDocument = function(arg) { return translation.setDocument(arg) };
			safeTranslator.setHandler = function(arg1, arg2) {
				translation.setHandler(arg1, 
					function(obj, item) {
						try {
							if(arg1 == "itemDone") {
								if(Zotero.isFx && (translate instanceof Zotero.Translate.Web
										|| translate instanceof Zotero.Translate.Search)) {
									// necessary to get around object wrappers in Firefox
									item = translate._sandboxManager.sandbox.Zotero._transferItem(JSON.stringify(item));
								} else {
									// otherwise, just use parent translator's complete function
									item.complete = translate._sandboxManager.sandbox.Zotero.Item.prototype.complete;
								}
							}
							arg2(obj, item);
						} catch(e) {
							translate.complete(false, e);
						}
					}
				);
			};
			safeTranslator.setString = function(arg) { translation.setString(arg) };
			safeTranslator.setTranslator = function(arg) {
				var success = translation.setTranslator(arg);
				if(!success) {
					throw "Translator "+translate.translator[0].translatorID+" attempted to call invalid translatorID "+arg;
				}
			};
			safeTranslator.getTranslators = function() { return translation.getTranslators() };
			var doneHandlerSet = false;
			safeTranslator.translate = function() {
				translate.incrementAsyncProcesses();
				setDefaultHandlers(translate, translation);
				if(!doneHandlerSet) {
					doneHandlerSet = true;
					translation.setHandler("done", function() { translate.decrementAsyncProcesses() });
				}
				return translation.translate(false);
			};
			// TODO
			safeTranslator.getTranslatorObject = function(callback) {
				if(callback) translate.incrementAsyncProcesses();
				var haveTranslatorFunction = function(translator) {
					translation.translator[0] = translator;
					if(!Zotero._loadTranslator(translator)) throw "Translator could not be loaded";
					
					if(Zotero.isFx) {
						// do same origin check
						var secMan = Components.classes["@mozilla.org/scriptsecuritymanager;1"]
							.getService(Components.interfaces.nsIScriptSecurityManager);
						var ioService = Components.classes["@mozilla.org/network/io-service;1"] 
							.getService(Components.interfaces.nsIIOService);
						
						var outerSandboxURI = ioService.newURI(typeof translate._sandboxLocation === "object" ?
							translate._sandboxLocation.location : translate._sandboxLocation, null, null);
						var innerSandboxURI = ioService.newURI(typeof translation._sandboxLocation === "object" ?
							translation._sandboxLocation.location : translation._sandboxLocation, null, null);
						
						try {
							secMan.checkSameOriginURI(outerSandboxURI, innerSandboxURI, false);
						} catch(e) {
							throw "Translate: getTranslatorObject() may not be called from web or search "+
								"translators to web or search translators from different origins.";
						}
					}
					
					translation._prepareTranslation();
					setDefaultHandlers(translate, translation);
					
					if(callback) {
						callback(translation._sandboxManager.sandbox);
						translate.decrementAsyncProcesses();
					}
				};
				
				if(typeof translation.translator[0] === "object") {
					haveTranslatorFunction(translation.translator[0]);
					return translation._sandboxManager.sandbox;
				} else {
					if(Zotero.isConnector && !callback) {
						throw "Translate: Translator must accept a callback to getTranslatorObject() to "+
							"operate in this translation environment.";
					}
					
					Zotero.Translators.get(translation.translator[0], haveTranslatorFunction);
					if(!Zotero.isConnector) return translation._sandboxManager.sandbox;
				}
			};
			
			// TODO security is not super-tight here, as someone could pass something into arg
			// that gets evaluated in the wrong scope in Fx < 4. We should wrap this.
			
			return safeTranslator;
		},
		
		/**
		 * Enables asynchronous detection or translation
		 * @param {Zotero.Translate} translate
		 * @deprecated
		 */
		"wait":function(translate) {},
		
		/**
		 * Completes asynchronous detection or translation
		 *
		 * @param {Zotero.Translate} translate
		 * @deprecated
		 */
		"done":function(translate, returnValue) {
			this._returnValue = returnValue;
		},
		
		/**
		 * Proxy for translator _debug function
		 * 
		 * @param {Zotero.Translate} translate
		 * @param {String} string String to write to console
		 * @param {String} [level] Level to log as (1 to 5)
		 */
		"debug":function(translate, string, level) {
			translate._debug(string, level);
		}
	},
	
	/**
	 * Web functions exposed to sandbox
	 * @namespace
	 */
	"Web":{
		/**
		 * Lets user pick which items s/he wants to put in his/her library
		 * @param {Zotero.Translate} translate
		 * @param {Object} items An set of id => name pairs in object format
		 */
		"selectItems":function(translate, items, callback) {
			if(Zotero.Utilities.isEmpty(items)) {
				throw "Translate: translator called select items with no items";
			}
			
			if(translate._selectedItems) {
				// if we have a set of selected items for this translation, use them
				return translate._selectedItems;
			} else if(translate._handlers.select) {
					// whether the translator supports asynchronous selectItems
					var haveAsyncCallback = !!callback;
					// whether the handler operates asynchronously
					var haveAsyncHandler = false;
					var returnedItems = null;
					
					var callbackExecuted = false;
					if(haveAsyncCallback) {
						// if this translator provides an async callback for selectItems, rig things
						// up to pop off the async process
						var newCallback = function(selectedItems) {
							callbackExecuted = true;
							callback(selectedItems);
							if(haveAsyncHandler) translate.decrementAsyncProcesses();
						};
					} else {
						// if this translator doesn't provide an async callback for selectItems, set things
						// up so that we can wait to see if the select handler returns synchronously. If it
						// doesn't, we will need to restart translation.
						var newCallback = function(selectedItems) {
							callbackExecuted = true;
							if(haveAsyncHandler) {
								translate.translate(this._libraryID, this._saveAttachments, selectedItems);
							} else {
								returnedItems = selectedItems;
							}
						};
					}
					
					translate._runHandler("select", items, newCallback);
					
					// if we don't have returnedItems set already, the handler is asynchronous
					haveAsyncHandler = !callbackExecuted;
					
					if(haveAsyncCallback) {
						// we are running asynchronously, so increment async processes
						if(haveAsyncHandler) translate.incrementAsyncProcesses();
						return false;
					} else {
						translate._debug("WARNING: No callback was provided for "+
							"Zotero.selectItems(). When executed outside of Firefox, a selectItems() call "+
							"will require that this translator to be called multiple times.", 1);
						
						if(haveAsyncHandler) {
							// The select handler is asynchronous, but this translator doesn't support
							// asynchronous select. We return false to abort translation in this
							// instance, and we will restart it later when the selectItems call is
							// complete.
							translate._aborted = true;
							return false;
						} else {
							return returnedItems;
						}
					}
			} else { // no handler defined; assume they want all of them
				if(callback) callback(items);
				return items;
			}
		},
		
		/**
		 * Overloads {@link Zotero.Translate.Sandbox.Base._itemDone} to ensure that no standalone
		 * items are saved, that an item type is specified, and to add a libraryCatalog and 
		 * shortTitle if relevant.
		 * @param {Zotero.Translate} translate
		 * @param {SandboxItem} An item created using the Zotero.Item class from the sandbox
		 */
		 "_itemDone":function(translate, item) {
			if(!item.itemType) {
				item.itemType = "webpage";
				Zotero.debug("Translate: WARNING: No item type specified");
			}
			
			if(item.type == "attachment" || item.type == "note") {
				Zotero.debug("Translate: Discarding standalone "+item.type+" in non-import translator", 2);
				return;
			}
		 	
			// store library catalog if this item was captured from a website, and
			// libraryCatalog is truly undefined (not false or "")
			if(item.repository !== undefined) {
				Zotero.debug("Translate: 'repository' field is now 'libraryCatalog'; please fix your code", 2);
				item.libraryCatalog = item.repository;
				delete item.repository;
			}
			
			// automatically set library catalog
			if(item.libraryCatalog === undefined) {
				item.libraryCatalog = translate.translator[0].label;
			}
						
			// automatically set access date if URL is set
			if(item.url && typeof item.accessDate == 'undefined') {
				item.accessDate = "CURRENT_TIMESTAMP";
			}
			
			if(!item.title) {
				throw "No title specified for item";
			}
			
			// create short title
			if(item.shortTitle === undefined && Zotero.Utilities.fieldIsValidForType("shortTitle", item.itemType)) {		
				// only set if changes have been made
				var setShortTitle = false;
				var title = item.title;
				
				// shorten to before first colon
				var index = title.indexOf(":");
				if(index !== -1) {
					title = title.substr(0, index);
					setShortTitle = true;
				}
				// shorten to after first question mark
				index = title.indexOf("?");
				if(index !== -1) {
					index++;
					if(index != title.length) {
						title = title.substr(0, index);
						setShortTitle = true;
					}
				}
				
				if(setShortTitle) item.shortTitle = title;
			}
			
			// call super
			Zotero.Translate.Sandbox.Base._itemDone(translate, item);
		}
	},

	/**
	 * Import functions exposed to sandbox
	 * @namespace
	 */
	"Import":{
		/**
		 * Saves a collection to the DB
		 * Called as {@link Zotero.Collection#complete} from the sandbox
		 * @param {Zotero.Translate} translate
		 * @param {SandboxCollection} collection
		 */
		"_collectionDone":function(translate, collection) {
			var newCollection = translate._itemSaver.saveCollection(collection);
			translate._runHandler("collectionDone", newCollection);
		},
		
		/**
		 * Sets the value of the progress indicator associated with export as a percentage
		 * @param {Zotero.Translate} translate
		 * @param {Number} value
		 */
		"setProgress":function(translate, value) {
			if(typeof value !== "number") {
				translate._progress = null;
			} else {
				translate._progress = value;
			}
		}
	},

	/**
	 * Export functions exposed to sandbox
	 * @namespace
	 */
	"Export":{
		/**
		 * Retrieves the next item to be exported
		 * @param {Zotero.Translate} translate
		 * @return {SandboxItem}
		 */
		"nextItem":function(translate) {
			var item = translate._itemGetter.nextItem();
			
			if(translate._displayOptions.hasOwnProperty("exportTags") && !translate._displayOptions["exportTags"]) {
				item.tags = [];
			}
			
			translate._runHandler("itemDone", item);
			
			// Update progress bar
			if(!translate.noWait) {
				Zotero.wait();
			}
			
			return item;
		},
		
		/**
		 * Retrieves the next collection to be exported
		 * @param {Zotero.Translate} translate
		 * @return {SandboxCollection}
		 */
		"nextCollection":function(translate) {
			if(!translate.translator[0].configOptions.getCollections) {
				throw("Translate: getCollections configure option not set; cannot retrieve collection");
			}
			
			return translate._itemGetter.nextCollection();
		},
		
		/**
		 * @borrows Zotero.Translate.Sandbox.Import.setProgress as this.setProgress
		 */
		"setProgress":function(translate, value) {
			Zotero.Translate.Sandbox.Import.setProgress(translate, value);
		}
	},
	
	/**
	 * Search functions exposed to sandbox
	 * @namespace
	 */
	"Search":{
		/**
		 * @borrows Zotero.Translate.Sandbox.Web._itemDone as this._itemDone
		 */
		"_itemDone":function(translate, item) {
			Zotero.Translate.Sandbox.Web._itemDone(translate, item);
		}
	}
}

/**
 * @class Base class for all translation types
 *
 * @property {String} type The type of translator. This is deprecated; use instanceof instead.
 * @property {Zotero.Translator[]} translator The translator currently in use. Usually, only the
 *     first entry of the Zotero.Translator array is populated; subsequent entries represent
 *     translators to be used if the first fails.
 * @property {String} path The path or URI string of the target
 * @property {String} newItems Items created when translate() was called
 * @property {String} newCollections Collections created when translate() was called
 * @property {Number} runningAsyncProcesses The number of async processes that are running. These
 *                                          need to terminate before Zotero.done() is called.
 */
Zotero.Translate.Base = function() {}
Zotero.Translate.Base.prototype = {
	/**
	 * Initializes a Zotero.Translate instance
	 */
	"init":function() {
		this._handlers = [];
		this._currentState = null;
		this.document = null;
		this.location = null;
	},
	
	/**
	 * Sets the location to operate upon
	 *
	 * @param {String|nsIFile} location The URL to which the sandbox should be bound or path to local file
	 */
	"setLocation":function(location) {
		this.location = location;
		if(typeof this.location == "object") {	// if a file
			this.path = location.path;
		} else {								// if a url
			this.path = location;
		}
	},
	
	/**
	 * Sets the translator to be used for import/export
	 *
	 * @param {Zotero.Translator|string} Translator object or ID
	 */
	"setTranslator":function(translator) {
		if(!translator) {
			throw("cannot set translator: invalid value");
		}
		
		this.translator = null;
		this._setDisplayOptions = null;
		
		if(typeof(translator) == "object") {	// passed an object and not an ID
			if(translator.translatorID) {
				this.translator = [translator];
			} else {
				throw("No translatorID specified");
			}
		} else {
			this.translator = [translator];
		}
		
		return !!this.translator;
	},
	
	/**
	 * Registers a handler function to be called when translation is complete
	 *
	 * @param {String} type Type of handler to register. Legal values are:
	 * select
	 *   valid: web
	 *   called: when the user needs to select from a list of available items
	 *   passed: an associative array in the form id => text
	 *   returns: a numerically indexed array of ids, as extracted from the passed
	 *            string
	 * itemDone
	 *   valid: import, web, search
	 *   called: when an item has been processed; may be called asynchronously
	 *   passed: an item object (see Zotero.Item)
	 *   returns: N/A
	 * collectionDone
	 *   valid: import
	 *   called: when a collection has been processed, after all items have been
	 *           added; may be called asynchronously
	 *   passed: a collection object (see Zotero.Collection)
	 *   returns: N/A
	 * done
	 *   valid: all
	 *   called: when all processing is finished
	 *   passed: true if successful, false if an error occurred
	 *   returns: N/A
	 * debug
	 *   valid: all
	 *   called: when Zotero.debug() is called
	 *   passed: string debug message
	 *   returns: true if message should be logged to the console, false if not
	 * error
	 *   valid: all
	 *   called: when a fatal error occurs
	 *   passed: error object (or string)
	 *   returns: N/A
	 * translators
	 *   valid: all
	 *   called: when a translator search initiated with Zotero.Translate.getTranslators() is
	 *           complete
	 *   passed: an array of appropriate translators
	 *   returns: N/A
	 * @param {Function} handler Callback function. All handlers will be passed the current
	 * translate instance as the first argument. The second argument is dependent on the handler.
	 */
	"setHandler":function(type, handler) {
		if(!this._handlers[type]) {
			this._handlers[type] = new Array();
		}
		this._handlers[type].push(handler);
	},

	/**
	 * Clears all handlers for a given function
	 * @param {String} type See {@link Zotero.Translate.Base#setHandler} for valid values
	 */
	"clearHandlers":function(type) {
		this._handlers[type] = new Array();
	},
	
	/**
	 * Indicates that a new async process is running
	 */
	"incrementAsyncProcesses":function() {
		this._runningAsyncProcesses++;
		Zotero.debug("Translate: Incremented asynchronous processes to "+this._runningAsyncProcesses, 4);
		if(this._parentTranslator) this._parentTranslator.incrementAsyncProcesses();
	},
	
	/**
	 * Indicates that a new async process is finished
	 */
	"decrementAsyncProcesses":function() {
		this._runningAsyncProcesses--;
		Zotero.debug("Translate: Decremented asynchronous processes to "+this._runningAsyncProcesses, 4);
		if(this._runningAsyncProcesses === 0) {
			this.complete();
		}
		if(this._parentTranslator) this._parentTranslator.decrementAsyncProcesses();
	},

	/**
	 * Clears all handlers for a given function
	 * @param {String} type See {@link Zotero.Translate.Base#setHandler} for valid values
	 * @param {Any} argument Argument to be passed to handler
	 */
	"_runHandler":function(type) {
		var returnValue = undefined;
		if(this._handlers[type]) {
			// compile list of arguments
			if(this._parentTranslator) {
				// if there is a parent translator, make sure we don't the Zotero.Translate
				// object, since it could open a security hole
				var args = [null];
			} else {
				var args = [this];
			}
			for(var i=1; i<arguments.length; i++) {
				args.push(arguments[i]);
			}
			
			for(var i in this._handlers[type]) {
				Zotero.debug("Translate: Running handler "+i+" for "+type, 5);
				try {
					returnValue = this._handlers[type][i].apply(null, args);
				} catch(e) {
					if(this._parentTranslator) {
						// throw handler errors if they occur when a translator is
						// called from another translator, so that the
						// "Could Not Translate" dialog will appear if necessary
						throw(e);
					} else {
						// otherwise, fail silently, so as not to interfere with
						// interface cleanup
						Zotero.debug("Translate: "+e+' in handler '+i+' for '+type, 5);
						Zotero.logError(e);
					}
				}
			}
		}
		return returnValue;
	},

	/**
	 * Gets all applicable translators of a given type
	 *
	 * For import, you should call this after setLocation; otherwise, you'll just get a list of all
	 * import filters, not filters equipped to handle a specific file
	 *
	 * @param {Boolean} [getAllTranslators] Whether all applicable translators should be returned,
	 *     rather than just the first available.
	 * @return {Zotero.Translator[]} An array of {@link Zotero.Translator} objects
	 */
	"getTranslators":function(getAllTranslators) {
		// do not allow simultaneous instances of getTranslators
		if(this._currentState == "detect") throw "Translate: getTranslators: detection is already running";
		this._currentState = "detect";
		this._getAllTranslators = getAllTranslators;
		this._getTranslatorsGetPotentialTranslators();
		
		// if detection returns immediately, return found translators
		if(!this._currentState) return this._foundTranslators;
	},
	
	/**
	 * Get all potential translators
	 * @return {Zotero.Translator[]}
	 */
	"_getTranslatorsGetPotentialTranslators":function() {
		var me = this;
		Zotero.Translators.getAllForType(this.type,
			function(translators) { me._getTranslatorsTranslatorsReceived(translators) });
	},
	
	/**
	 * Called on completion of {@link #_getTranslatorsGetPotentialTranslators} call
	 */
	"_getTranslatorsTranslatorsReceived":function(allPotentialTranslators, properToProxyFunctions) {
		this._potentialTranslators = [];
		this._foundTranslators = [];
		
		// this gets passed out by Zotero.Translators.getWebTranslatorsForLocation() because it is
		// specific for each translator, but we want to avoid making a copy of a translator whenever
		// possible.
		this._properToProxyFunctions = properToProxyFunctions ? properToProxyFunctions : null;
		this._waitingForRPC = false;
		
		for(var i in allPotentialTranslators) {
			var translator = allPotentialTranslators[i];
			if(translator.runMode === Zotero.Translator.RUN_MODE_IN_BROWSER) {
				this._potentialTranslators.push(translator);
			} else {
				this._waitingForRPC = true;
			}
		}
		
		if(this._waitingForRPC && this instanceof Zotero.Translate.Web) {
			var me = this;
			Zotero.Connector.callMethod("detect", {"uri":this.location.toString(),
				"cookie":this.document.cookie,
				"html":this.document.documentElement.innerHTML},
				function(returnValue) { me._getTranslatorsRPCComplete(returnValue) });
		}
		
		this._detect();
	},
	
	/**
	 * Called on completion of detect RPC for
	 * {@link Zotero.Translate.Base#_getTranslatorsTranslatorsReceived}
	 */
	 "_getTranslatorsRPCComplete":function(rpcTranslators) {
		this._waitingForRPC = false;
		
		// if there are translators, add them to the list of found translators
		if(rpcTranslators) {
			this._foundTranslators = this._foundTranslators.concat(rpcTranslators);
		}
		
		// call _detectTranslatorsCollected to return detected translators
		if(this._currentState === null) {
			this._detectTranslatorsCollected();
		}
	 },

	/**
	 * Begins the actual translation. At present, this returns immediately for import/export
	 * translators, but new code should use {@link Zotero.Translate.Base#setHandler} to register a 
	 * "done" handler to determine when execution of web/search translators is complete.
	 *
	 * @param 	{NULL|Integer|FALSE}	[libraryID=null]		Library in which to save items,
	 *																or NULL for default library;
	 *																if FALSE, don't save items
	 * @param 	{Boolean}				[saveAttachments=true]	Exclude attachments (e.g., snapshots) on import
	 */
	"translate":function(libraryID, saveAttachments) {		// initialize properties specific to each translation
		this._currentState = "translate";
		
		if(!this.translator || !this.translator.length) {
			throw("Translate: Failed: no translator specified");
		}
		
		this._libraryID = libraryID;
		this._saveAttachments = saveAttachments === undefined || saveAttachments;
		
		if(typeof this.translator[0] === "object") {
			// already have a translator object, so use it
			this._translateHaveTranslator();
		} else {
			// need to get translator first
			var me = this;
			Zotero.Translators.get(this.translator[0],
					function(translator) {
						me.translator[0] = translator;
						me._translateHaveTranslator();
					});
		}
	},
	
	/**
	 * Called when translator has been retrieved
	 */
	"_translateHaveTranslator":function() {
		// load translators
		if(!this._loadTranslator(this.translator[0])) return;
		
		// set display options to default if they don't exist
		if(!this._displayOptions) this._displayOptions = this.translator[0].displayOptions;
		
		// prepare translation
		this._prepareTranslation();
		
		Zotero.debug("Translate: Beginning translation with "+this.translator[0].label);
		
		this.incrementAsyncProcesses();
		
		// translate
		try {
			this._sandboxManager.sandbox["do"+this._entryFunctionSuffix].apply(null, this._getParameters());
		} catch(e) {
			if(this._parentTranslator) {
				throw(e);
			} else {
				this.complete(false, e);
				return false;
			}
		}
		
		this.decrementAsyncProcesses();
	},
	
	/**
	 * Executed on translator completion, either automatically from a synchronous scraper or as
	 * done() from an asynchronous scraper. Finishes things up and calls callback function(s).
	 * @param {Boolean|String} returnValue An item type or a boolean true or false
	 * @param {String|Exception} [error] An error that occurred during translation.
	 * @returm {String|NULL} The exception serialized to a string, or null if translation
	 *     completed successfully.
	 */
	"complete":function(returnValue, error) {
		// allow translation to be aborted for re-running after selecting items
		if(this._aborted) return;
		
		// Make sure this isn't called twice
		if(this._currentState === null) {
			Zotero.debug("Translate: WARNING: Zotero.done() called after translation completion; this should never happen");
			try {
				a
			} catch(e) {
				Zotero.debug(e);
			}
			return;
		}
		var oldState = this._currentState;
		this._runningAsyncProcesses = 0;
		if(!returnValue && this._returnValue) returnValue = this._returnValue;
		
		var errorString = null;
		if(!returnValue && error) errorString = this._generateErrorString(error);
		
		if(oldState === "detect") {
			if(this._potentialTranslators.length) {
				var lastTranslator = this._potentialTranslators.shift();
				var lastProperToProxyFunction = this._properToProxyFunctions ? this._properToProxyFunctions.shift() : null;
				
				if(returnValue) {
					var dupeTranslator = {"itemType":returnValue, "properToProxy":lastProperToProxyFunction};
					for(var i in lastTranslator) dupeTranslator[i] = lastTranslator[i];
					this._foundTranslators.push(dupeTranslator);
				} else if(error) {
					this._debug("Detect using "+lastTranslator.label+" failed: \n"+errorString, 2);
				}
			}
				
			if(this._potentialTranslators.length && (this._getAllTranslators || !returnValue)) {
				// more translators to try; proceed to next translator
				this._detect();
			} else {
				this._currentState = null;
				if(!this._waitingForRPC) this._detectTranslatorsCollected();
			}
		} else {
			this._currentState = null;
			
			// unset return value is equivalent to true
			if(returnValue === undefined) returnValue = true;
			
			if(returnValue) {
				this._debug("Translation successful");
			} else {
				// report error to console
				if(this.translator[0] && this.translator[0].logError) {
					this.translator[0].logError(error.toString(), "exception");
				} else {
					Zotero.logError(error);
				}
				
				// report error to debug log
				this._debug("Translation using "+(this.translator && this.translator[0] && this.translator[0].label ? this.translator[0].label : "no translator")+" failed: \n"+errorString, 2);
				
				this._runHandler("error", error);
			}
			
			// call handlers
			this._runHandler("done", returnValue);
		}
		
		return errorString;
	},
	
	/**
	 * Runs detect code for a translator
	 */
	"_detect":function() {
		// there won't be any translators if we need an RPC call
		if(!this._potentialTranslators.length) {
			this.complete(true);
			return;
		}
		
		if(!this._loadTranslator(this._potentialTranslators[0])) {
			this.complete(false, "Error loading translator into sandbox");
			return;
		}
		this._prepareDetection();
		
		this.incrementAsyncProcesses();
		
		try {
			var returnValue = this._sandboxManager.sandbox["detect"+this._entryFunctionSuffix].apply(null, this._getParameters());
		} catch(e) {
			this.complete(false, e);
			return;
		}
		
		if(returnValue !== undefined) this._returnValue = returnValue;
		this.decrementAsyncProcesses();
	},
	
	/**
	 * Called when all translators have been collected for detection
	 */
	"_detectTranslatorsCollected":function() {
		Zotero.debug("Translate: All translator detect calls and RPC calls complete");
		this._foundTranslators.sort(function(a, b) { return a.priority-b.priority });
		this._runHandler("translators", this._foundTranslators);
	},
	
	/**
	 * Loads the translator into its sandbox
	 * @param {Zotero.Translator} translator
	 * @return {Boolean} Whether the translator could be successfully loaded
	 */
	"_loadTranslator":function(translator) {
		var sandboxLocation = this._getSandboxLocation();
		if(!this._sandboxLocation || sandboxLocation != this._sandboxLocation) {
			this._sandboxLocation = sandboxLocation;
			this._generateSandbox();
		}
		
		this._runningAsyncProcesses = 0;
		this._returnValue = undefined;
		this._aborted = false;
		
		Zotero.debug("Translate: Parsing code for "+translator.label, 4);
		
		try {
			this._sandboxManager.eval("var translatorInfo = "+translator.code,
				["detect"+this._entryFunctionSuffix, "do"+this._entryFunctionSuffix]);
		} catch(e) {
			if(translator.logError) {
				translator.logError(e.toString());
			} else {
				Zotero.logError(e);
			}
			
			this.complete(false, "parse error");
			return false;
		}
		
		return true;
	},
	
	/**
	 * Generates a sandbox for scraping/scraper detection
	 */
	"_generateSandbox":function() {
		Zotero.debug("Translate: Binding sandbox to "+(typeof this._sandboxLocation == "object" ? this._sandboxLocation.document.location : this._sandboxLocation), 4);
		this._sandboxManager = new Zotero.Translate.SandboxManager(this._sandboxLocation);
		const createArrays = "['creators', 'notes', 'tags', 'seeAlso', 'attachments']";
		var src = "var Zotero = {};"+
		"Zotero.Item = function (itemType) {"+
				"const createArrays = "+createArrays+";"+
				"this.itemType = itemType;"+
				"for(var i in createArrays) {"+
					"this[createArrays[i]] = [];"+
				"}"+
		"};"+
		"Zotero.Collection = function () {};"+
		"Zotero.Collection.prototype.complete = function() { Zotero._collectionDone(this); };"+
		// https://bugzilla.mozilla.org/show_bug.cgi?id=609143 - can't pass E4X to sandbox in Fx4
		"Zotero.getXML = function() {"+
			"var xml = Zotero._getXML();"+
			"if(typeof xml == 'string') return new XML(xml);"+
		"};"+
		"Zotero._transferItem = function(itemString) {"+
			"var item = JSON.parse(itemString);"+
			"item.complete = Zotero.Item.prototype.complete;"+
			"return item;"+
		"};"+
		"Zotero.Item.prototype.complete = function() { ";
		if(Zotero.isFx) {
			// workaround for inadvertant attempts to pass E4X back from sandbox
			src += "for(var key in this) {"+
				"if("+createArrays+".indexOf(key) !== -1) {"+
					"for each(var item in this[key]) {"+
						"for(var key2 in item[key2]) {"+
							"if(typeof item[key2] === 'xml') {"+
								"item[key2] = item[key2].toString();"+
							"}"+
						"}"+
					"}"+
				"} else if(typeof this[key] === 'xml') {"+
					"this[key] = this[key].toString();"+
				"}"+
			"}";
		}
		src += "Zotero._itemDone(this);"+
		"}";
		
		this._sandboxManager.eval(src);
		this._sandboxManager.importObject(this.Sandbox, this);
		this._sandboxManager.importObject({"Utilities":new Zotero.Utilities.Translate(this)});
		this._sandboxManager.sandbox.Zotero.Utilities.HTTP = this._sandboxManager.sandbox.Zotero.Utilities;
	},
	
	/**
	 * Logs a debugging message
	 * @param {String} string Debug string to log
	 * @param {Integer} level Log level (1-5, higher numbers are higher priority)
	 */
	"_debug":function(string, level) {
		if(typeof string === "object" && Zotero.isFx36) {
			string = new XPCSafeJSObjectWrapper(string);
		}
		
		if(level !== undefined && typeof level !== "number") {
			Zotero.debug("debug: level must be an integer");
			return;
		}
		
		// if handler does not return anything explicitly false, show debug
		// message in console
		if(this._runHandler("debug", string) !== false) {
			if(typeof string == "string") string = "Translate: "+string;
			Zotero.debug(string, level);
		}
	},
	
	/**
	 * Generates a string from an exception
	 * @param {String|Exception} error
	 */
	"_generateErrorString":function(error) {
		var errorString = "";
		if(typeof(error) == "string") {
			errorString = "\nthrown exception => "+error;
		} else {
			for(var i in error) {
				if(typeof(error[i]) != "object") {
					errorString += "\n"+i+' => '+error[i];
				}
			}
		}
		
		errorString += "\nurl => "+this.path
			+ "\ndownloadAssociatedFiles => "+Zotero.Prefs.get("downloadAssociatedFiles")
			+ "\nautomaticSnapshots => "+Zotero.Prefs.get("automaticSnapshots");
		return errorString.substr(1);
	},
	
	/**
	 * Determines the location where the sandbox should be bound
	 * @return {String|document} The location to which to bind the sandbox
	 */
	"_getSandboxLocation":function() {
		return (this._parentTranslator ? this._parentTranslator._sandboxLocation : "http://www.example.com/");
	},
	
	/**
	 * Gets parameters to be passed to detect* and do* functions
	 * @return {Array} A list of parameters
	 */
	"_getParameters":function() { return []; },
	
	/**
	 * No-op for preparing detection
	 */
	"_prepareDetection":function() {},
	
	/**
	 * No-op for preparing translation
	 */
	"_prepareTranslation":function() {},
}

/**
 * @class Web translation
 *
 * @property {Document} document The document object to be used for web scraping (set with setDocument)
 * @property {Zotero.Connector.CookieManager} cookieManager A CookieManager to manage cookies for
 *     this Translate instance.
 */
Zotero.Translate.Web = function() {
	this.init();
}
Zotero.Translate.Web.prototype = new Zotero.Translate.Base();
Zotero.Translate.Web.prototype.type = "web";
Zotero.Translate.Web.prototype._entryFunctionSuffix = "Web";
Zotero.Translate.Web.prototype.Sandbox = Zotero.Translate.Sandbox._inheritFromBase(Zotero.Translate.Sandbox.Web);

/**
 * Sets the browser to be used for web translation
 * @param {Document} doc An HTML document
 */
Zotero.Translate.Web.prototype.setDocument = function(doc) {
	this.document = doc;
	this.setLocation(doc.location.href);
}

/**
 * Sets a Zotero.Connector.CookieManager to handle cookie management for XHRs initiated from this
 * translate instance
 *
 * @param {Zotero.Connector.CookieManager} cookieManager
 */
Zotero.Translate.Web.prototype.setCookieManager = function(cookieManager) {
	this.cookieManager = cookieManager;
}

/**
 * Sets the location to operate upon
 *
 * @param {String} location The URL of the page to translate
 */
Zotero.Translate.Web.prototype.setLocation = function(location) {
	this.location = location;
	this.path = this.location;
}

/**
 * Get potential web translators
 */
Zotero.Translate.Web.prototype._getTranslatorsGetPotentialTranslators = function() {
	var me = this;
	Zotero.Translators.getWebTranslatorsForLocation(this.location,
			function(data) {
				// data[0] = list of translators
				// data[1] = list of functions to convert proper URIs to proxied URIs
				me._getTranslatorsTranslatorsReceived(data[0], data[1]);
			});
}

/**
 * Bind sandbox to document being translated
 */
Zotero.Translate.Web.prototype._getSandboxLocation = function() {
	return this.document.defaultView;
}

/**
 * Pass document and location to detect* and do* functions
 */
Zotero.Translate.Web.prototype._getParameters = function() { return [this.document, this.location]; }

/**
 * Prepare translation
 */
Zotero.Translate.Web.prototype._prepareTranslation = function() {
	this._itemSaver = new Zotero.Translate.ItemSaver(this._libraryID,
		Zotero.Translate.ItemSaver[(this._saveAttachments ? "ATTACHMENT_MODE_DOWNLOAD" : "ATTACHMENT_MODE_IGNORE")], 1);
	this.newItems = this._itemSaver.newItems;
}

/**
 * Overload translate to set selectedItems
 */
Zotero.Translate.Web.prototype.translate = function(libraryID, saveAttachments, selectedItems) {
	this._selectedItems = selectedItems;
	Zotero.Translate.Base.prototype.translate.apply(this, [libraryID, saveAttachments]);
}

/**
 * Overload _translateHaveTranslator to send an RPC call if necessary
 */
Zotero.Translate.Web.prototype._translateHaveTranslator = function() {
	if(this.translator[0].runMode === Zotero.Translator.RUN_MODE_IN_BROWSER) {
		// begin process to run translator in browser
		Zotero.Translate.Base.prototype._translateHaveTranslator.apply(this);
	} else {
		// otherwise, ferry translator load to RPC
		var me = this;
		Zotero.Connector.callMethod("savePage", {
				"uri":this.location.toString(),
				"translatorID":(typeof this.translator[0] === "object"
				                ? this.translator[0].translatorID : this.translator[0]),
				"cookie":this.document.cookie,
				"html":this.document.documentElement.innerHTML
			}, function(obj) { me._translateRPCComplete(obj) });
	}
}
	
/**
 * Called when an RPC call for remote translation completes
 */
Zotero.Translate.Web.prototype._translateRPCComplete = function(obj, failureCode) {
	if(!obj) this.complete(false, failureCode);
	
	if(obj.selectItems) {
		// if we have to select items, call the selectItems handler and do it
		var me = this;
		var items = this._runHandler("select", obj.selectItems,
			function(selectedItems) {
				Zotero.Connector.callMethod("selectItems",
					{"instanceID":obj.instanceID, "selectedItems":selectedItems},
					function(obj) { me._translateRPCComplete(obj) })
			}
		);
	} else {
		// if we don't have to select items, continue
		for(var i in obj.items) {
			this._runHandler("itemDone", null, obj.items[i]);
		}
		this.complete(true);
	}
}

/**
 * Overload complete to report translation failure
 */
Zotero.Translate.Web.prototype.complete = function(returnValue, error) {
	// call super
	var oldState = this._currentState;
	var errorString = Zotero.Translate.Base.prototype.complete.apply(this, [returnValue, error]);
	
	// Report translation failure if we failed
	if(oldState == "translate" && errorString && this.translator[0].inRepository && Zotero.Prefs.get("reportTranslationFailure")) {
		// Don't report failure if in private browsing mode
		if(Zotero.isFx && !Zotero.isStandalone) {
			var pbs = Components.classes["@mozilla.org/privatebrowsing;1"]
						.getService(Components.interfaces.nsIPrivateBrowsingService);
			if (pbs.privateBrowsingEnabled) {
				return;
			}
		}
		
		var postBody = "id=" + encodeURIComponent(this.translator[0].translatorID) +
					   "&lastUpdated=" + encodeURIComponent(this.translator[0].lastUpdated) +
					   "&diagnostic=" + encodeURIComponent(Zotero.getSystemInfo()) +
					   "&errorData=" + encodeURIComponent(errorString);
		Zotero.HTTP.doPost("http://www.zotero.org/repo/report", postBody);
	}
}

/**
 * @class Import translation
 */
Zotero.Translate.Import = function() {
	this.init();
}
Zotero.Translate.Import.prototype = new Zotero.Translate.Base();
Zotero.Translate.Import.prototype.type = "import";
Zotero.Translate.Import.prototype._entryFunctionSuffix = "Import";
Zotero.Translate.Import.prototype._io = false;

Zotero.Translate.Import.prototype.Sandbox = Zotero.Translate.Sandbox._inheritFromBase(Zotero.Translate.Sandbox.Import);

/**
 * Sets string for translation and initializes string IO
 */
Zotero.Translate.Import.prototype.setString = function(string) {
	this._string = string;
	this._io = false;
}

/**
 * Overload {@link Zotero.Translate.Base#complete} to close file
 */
Zotero.Translate.Import.prototype.complete = function(returnValue, error) {
	if(this._io) {
		this._progress = null;
		this._io.close();
	}
	
	// call super
	Zotero.Translate.Base.prototype.complete.apply(this, [returnValue, error]);
}

/**
 * Get all potential import translators, ordering translators with the right file extension first
 */
Zotero.Translate.Import.prototype._getTranslatorsGetPotentialTranslators = function() {
	var me = this;
	Zotero.Translators.getImportTranslatorsForLocation(this.location,
		function(translators) { me._getTranslatorsTranslatorsReceived(translators) });
}

/**
 * Overload {@link Zotero.Translate.Base#getTranslators} to return all translators immediately only
 * if no string or location is set
 */
Zotero.Translate.Import.prototype.getTranslators = function() {
	if(!this._string && !this.location) {
		this._foundTranslators = Zotero.Translators.getAllForType(this.type);
		this._potentialTranslators = [];
		this.complete(true);
		return this._foundTranslators;
	} else {
		Zotero.Translate.Base.prototype.getTranslators.call(this);
	}
}
	
/**
 * Overload {@link Zotero.Translate.Base#_loadTranslator} to prepare translator IO
 */
Zotero.Translate.Import.prototype._loadTranslator = function(translator) {
	// call super
	var returnVal = Zotero.Translate.Base.prototype._loadTranslator.call(this, translator);
	if(!returnVal) return returnVal;
	
	var dataMode = (translator ? translator : this._potentialTranslators[0]).configOptions["dataMode"];
	
	var err = false;
	if(this._io) {
		try {
			this._io.reset(dataMode);
		} catch(e) {
			err = e;
		}
	} else {
		if(Zotero.Translate.IO.Read && this.location && this.location instanceof Components.interfaces.nsIFile) {
			try {
				this._io = new Zotero.Translate.IO.Read(this.location, dataMode);
			} catch(e) {
				err = e;
			}
		} else {
			try {
				this._io = new Zotero.Translate.IO.String(this._string, this.path ? this.path : "", dataMode);
			} catch(e) {
				err = e;
			}
		}
	}
	
	if(err) {
		Zotero.debug("Translate: Preparing IO for "+translator.label+" failed: ");
		Zotero.debug(err);
		return false;
	}
	
	this._sandboxManager.importObject(this._io);
	
	return true;
}

/**
 * Prepare translation
 */
Zotero.Translate.Import.prototype._prepareTranslation = function() {
	this._progress = undefined;
	this._itemSaver = new Zotero.Translate.ItemSaver(this._libraryID,
		Zotero.Translate.ItemSaver[(this._saveAttachments ? "ATTACHMENT_MODE_FILE" : "ATTACHMENT_MODE_IGNORE")]);
	this.newItems = this._itemSaver.newItems;
	this.newCollections = this._itemSaver.newCollections;
}

Zotero.Translate.Import.prototype.__defineGetter__("progress",
/**
 * Return the progress of the import operation, or null if progress cannot be determined
 */
function() {
	if(this._progress !== undefined) return this._progress;
	if(Zotero.Translate.IO.rdfDataModes.indexOf(this._mode) !== -1 || this._mode === "xml/e4x" || this._mode == "xml/dom" || !this._io) {
		return null;
	}
	return this._io.bytesRead/this._io.contentLength*100;
});
	

/**
 * @class Export translation
 */
Zotero.Translate.Export = function() {
	this.init();
}
Zotero.Translate.Export.prototype = new Zotero.Translate.Base();
Zotero.Translate.Export.prototype.type = "export";
Zotero.Translate.Export.prototype._entryFunctionSuffix = "Export";
Zotero.Translate.Export.prototype.Sandbox = Zotero.Translate.Sandbox._inheritFromBase(Zotero.Translate.Sandbox.Export);

/**
 * Sets the items to be exported
 * @param {Zotero.Item[]} items
 */
Zotero.Translate.Export.prototype.setItems = function(items) {
	this._items = items;
	delete this._collection;
}

/**
 * Sets the collection to be exported (overrides setItems)
 * @param {Zotero.Collection[]} collection
 */
Zotero.Translate.Export.prototype.setCollection = function(collection) {
	this._collection = collection;
	delete this._items;
}

/**
 * Sets the translator to be used for export
 *
 * @param {Zotero.Translator|string} Translator object or ID. If this contains a displayOptions
 *    attribute, setDisplayOptions is automatically called with the specified value.
 */
Zotero.Translate.Export.prototype.setTranslator = function(translator) {
	if(typeof translator == "object" && translator.displayOptions) {
		this._displayOptions = translator.displayOptions;
	}
	return Zotero.Translate.Base.prototype.setTranslator.apply(this, [translator]);
}

/**
 * Sets translator display options. you can also pass a translator (not ID) to
 * setTranslator that includes a displayOptions argument
 */
Zotero.Translate.Export.prototype.setDisplayOptions = function(displayOptions) {
	this._displayOptions = displayOptions;
}

/**
 * @borrows Zotero.Translate.Import#complete
 */
Zotero.Translate.Export.prototype.complete = Zotero.Translate.Import.prototype.complete;

/**
 * Overload {@link Zotero.Translate.Base#getTranslators} to return all translators immediately
 */
Zotero.Translate.Export.prototype.getTranslators = function() {
	this._foundTranslators = Zotero.Translators.getAllForType(this.type);
	this._potentialTranslators = [];
	this.complete(true);
	return this._foundTranslators;
}

/**
 * Does the actual export, after code has been loaded and parsed
 */
Zotero.Translate.Export.prototype._prepareTranslation = function() {
	this._progress = undefined;
	
	// initialize ItemGetter
	this._itemGetter = new Zotero.Translate.ItemGetter();
	var getCollections = this.translator[0].configOptions.getCollections ? this.translator[0].configOptions.getCollections : false;
	if(this._collection) {
		this._itemGetter.setCollection(this._collection, getCollections);
		delete this._collection;
	} else if(this._items) {
		this._itemGetter.setItems(this._items);
		delete this._items;
	} else {
		this._itemGetter.setAll(getCollections);
	}
	
	// export file data, if requested
	if(this._displayOptions["exportFileData"]) {
		this.location = this._itemGetter.exportFiles(this.location, this.translator[0].target);
	}
	
	// initialize IO
	if(!this.location) {
		var io = this._io = new Zotero.Translate.IO.String(null, this.path ? this.path : "", this.translator[0].configOptions["dataMode"]);
		this.__defineGetter__("string", function() { return io.string; });
	} else if(!Zotero.Translate.IO.Write) {
		throw "Translate: Writing to files is not supported in this build of Zotero.";
	} else {
		this._io = new Zotero.Translate.IO.Write(this.location,
			this.translator[0].configOptions["dataMode"],
			this._displayOptions["exportCharset"] ? this._displayOptions["exportCharset"] : null);
	}
	
	this._sandboxManager.importObject(this._io);
}

Zotero.Translate.Export.prototype.__defineGetter__("progress",
/**
 * Return the progress of the import operation, or null if progress cannot be determined
 */
function() {
	if(this._progress !== undefined) return this._progress;
	if(!this._itemGetter) {
		return null;
	}
	return (1-this._itemGetter.numItemsRemaining/this._itemGetter.numItems)*100;
});

/**
 * @class Search translation
 * @property {Array[]} search Item (in {@link Zotero.Item#serialize} format) to extrapolate data
 *    (set with setSearch)
 */
Zotero.Translate.Search = function() {
	this.init();
};
Zotero.Translate.Search.prototype = new Zotero.Translate.Base();
Zotero.Translate.Search.prototype.type = "search";
Zotero.Translate.Search.prototype._entryFunctionSuffix = "Search";
Zotero.Translate.Search.prototype.Sandbox = Zotero.Translate.Sandbox._inheritFromBase(Zotero.Translate.Sandbox.Search);

/**
 * @borrows Zotero.Translate.Web#setCookieManager
 */
Zotero.Translate.Search.prototype.setCookieManager = Zotero.Translate.Web.prototype.setCookieManager;

/**
 * Sets the item to be used for searching
 * @param {Object} item An item, with as many fields as desired, in the format returned by
 *     {@link Zotero.Item#serialize}
 */
Zotero.Translate.Search.prototype.setSearch = function(search) {
	this.search = search;
}

/**
 * Overloads {@link Zotero.Translate.Base#getTranslators} to always return all potential translators
 */
Zotero.Translate.Search.prototype.getTranslators = function() {
	return Zotero.Translate.Base.prototype.getTranslators.call(this, true);
}

/**
 * Sets the translator or translators to be used for search
 *
 * @param {Zotero.Translator|string} Translator object or ID
 */
Zotero.Translate.Search.prototype.setTranslator = function(translator) {
	if(typeof translator == "object" && !translator.translatorID) {
		// we have an array of translators
		
		// accept a list of objects
		this.translator = [];
		for(var i in translator) {
			this.translator.push(translator[i]);
		}
		return true;
	} else {
		return Zotero.Translate.Base.prototype.setTranslator.apply(this, [translator]);
	}
}

/**
 * Overload Zotero.Translate.Base#complete to move onto the next translator if
 * translation fails
 */
Zotero.Translate.Search.prototype.complete = function(returnValue, error) {
	if(this._currentState == "translate") {
		if(!this.newItems.length) returnValue = false;
		if(!returnValue) {
			Zotero.debug("Translate: Could not find a result using "+this.translator[0].label+": \n"
						  +this._generateErrorString(error), 3);
			if(this.translator.length > 1) {
				this.translator.shift();
				this.translate(this._libraryID, this._saveAttachments);
				return;
			}
		}
	}
	
	// call super
	Zotero.Translate.Base.prototype.complete.apply(this, [returnValue, error]);
}

/**
 * Pass search item to detect* and do* functions
 */
Zotero.Translate.Search.prototype._getParameters = function() { return [this.search]; };

/**
 * Extract sandbox location from translator target
 */
Zotero.Translate.Search.prototype._getSandboxLocation = function() {
	// generate sandbox for search by extracting domain from translator target
	if(this.translator && this.translator[0] && this.translator[0].target) {
		// so that web translators work too
		const searchSandboxRe = /^http:\/\/[\w.]+\//;
		var tempURL = this.translator[0].target.replace(/\\/g, "").replace(/\^/g, "");
		var m = searchSandboxRe.exec(tempURL);
		if(m) return m[0];
	}
	return Zotero.Translate.Base.prototype._getSandboxLocation.call(this);
}

Zotero.Translate.Search.prototype._prepareTranslation = Zotero.Translate.Web.prototype._prepareTranslation;

/**
 * IO-related functions
 * @namespace
 */
Zotero.Translate.IO = {
	/**
	 * Parses XML using DOMParser
	 */
	"parseDOMXML":function(input, charset, size) {
		try {
			var dp = new DOMParser();
		} catch(e) {
			try {
				var dp = Components.classes["@mozilla.org/xmlextras/domparser;1"]
				   .createInstance(Components.interfaces.nsIDOMParser);
			} catch(e) {
				throw "DOMParser not supported";
			}
		}
		
		if(typeof input == "string") {
			var nodes = dp.parseFromString(input, "text/xml");
		} else {
			var nodes = dp.parseFromStream(input, charset, size, "text/xml");
		}
		
		if(nodes.getElementsByTagName("parsererror").length) {
			throw("DOMParser error: loading data into data store failed");
		}
		
		return nodes;
	},
	
	/**
	 * Names of RDF data modes
	 */
	"rdfDataModes":["rdf", "rdf/xml", "rdf/n3"]
};

/******* String support *******/

/**
 * @class Translate backend for translating from a string
 */
Zotero.Translate.IO.String = function(string, uri, mode) {
	if(string && typeof string === "string") {
		this._string = string;
	} else {
		this._string = "";
	}
	this._stringPointer = 0;
	this._uri = uri;
	
	if(mode) {
		this.reset(mode);
	}
}

Zotero.Translate.IO.String.prototype = {
	"__exposedProps__":{
		"RDF":"r",
		"read":"r",
		"write":"r",
		"setCharacterSet":"r",
		"_getXML":"r"
	},
	
	"_initRDF":function() {
		Zotero.debug("Translate: Initializing RDF data store");
		this._dataStore = new Zotero.RDF.AJAW.RDFIndexedFormula();
		
		if(this._string.length) {
			var parser = new Zotero.RDF.AJAW.RDFParser(this._dataStore);
			parser.parse(Zotero.Translate.IO.parseDOMXML(this._string), this._uri);
		}
		
		this.RDF = new Zotero.Translate.IO._RDFSandbox(this._dataStore);
	},
	
	"setCharacterSet":function(charset) {},
	
	"read":function(bytes) {
		// if we are reading in RDF data mode and no string is set, serialize current RDF to the
		// string
		if(Zotero.Translate.IO.rdfDataModes.indexOf(this._mode) !== -1 && this._string === "") {
			this._string = this.RDF.serialize();
		}
		
		// return false if string has been read
		if(this._stringPointer >= this._string.length) {
			return false;
		}
		
		if(bytes !== undefined) {
			if(this._stringPointer >= this._string.length) return false;
			var oldPointer = this._stringPointer;
			this._stringPointer += bytes;
			return this._string.substr(oldPointer, bytes);
		} else {
			// bytes not specified; read a line
			var oldPointer = this._stringPointer;
			var lfIndex = this._string.indexOf("\n", this._stringPointer);
			
			if(lfIndex != -1) {
				// in case we have a CRLF
				this._stringPointer = lfIndex+1;
				if(this._string.length > lfIndex && this._string[lfIndex-1] == "\r") {
					lfIndex--;
				}
				return this._string.substr(oldPointer, lfIndex-oldPointer);					
			}
			
			var crIndex = this._string.indexOf("\r", this._stringPointer);
			if(crIndex != -1) {
				this._stringPointer = crIndex+1;
				return this._string.substr(oldPointer, crIndex-oldPointer-1);
			}
			
			this._stringPointer = this._string.length;
			return this._string.substr(oldPointer);
		}
	},
	
	"write":function(data) {
		this._string += data;
	},
	
	"_getXML":function() {
		if(this._mode == "xml/dom") {
			return Zotero.Translate.IO.parseDOMXML(this._string);
		} else {
			return this._string.replace(/<\?xml[^>]+\?>/, "");
		}
	},
	
	"reset":function(newMode) {
		this._stringPointer = 0;
		
		this._mode = newMode;
		if(Zotero.Translate.IO.rdfDataModes.indexOf(this._mode) !== -1) {
			this._initRDF();
		}
	},
	
	"close":function() {}
}
Zotero.Translate.IO.String.prototype.__defineGetter__("string",
function() {
	if(Zotero.Translate.IO.rdfDataModes.indexOf(this._mode) !== -1) {
		return this.RDF.serialize();
	} else {
		return this._string;
	}
});
Zotero.Translate.IO.String.prototype.__defineSetter__("string",
function(string) {
	this._string = string;
});
Zotero.Translate.IO.String.prototype.__defineGetter__("bytesRead",
function() {
	return this._stringPointer;
});
Zotero.Translate.IO.String.prototype.__defineGetter__("contentLength",
function() {
	return this._string.length;
});

/****** RDF DATA MODE ******/

/**
 * @class An API for handling RDF from the sandbox. This is exposed to translators as Zotero.RDF.
 *
 * @property {Zotero.RDF.AJAW.RDFIndexedFormula} _dataStore
 * @property {Integer[]} _containerCounts
 * @param {Zotero.RDF.AJAW.RDFIndexedFormula} dataStore
 */
Zotero.Translate.IO._RDFSandbox = function(dataStore) {
	this._dataStore = dataStore;
}

Zotero.Translate.IO._RDFSandbox.prototype = {
	"_containerCounts":[],
	"__exposedProps__":{
		"addStatement":"r",
		"newResource":"r",
		"newContainer":"r",
		"addContainerElement":"r",
		"getContainerElements":"r",
		"addNamespace":"r",
		"getAllResources":"r",
		"getResourceURI":"r",
		"getArcsIn":"r",
		"getArcsOut":"r",
		"getSources":"r",
		"getTargets":"r",
		"getStatementsMatching":"r"
	},
	
	/**
	 * Gets a resource as a Zotero.RDF.AJAW.RDFSymbol, rather than a string
	 * @param {String|Zotero.RDF.AJAW.RDFSymbol} about
	 * @return {Zotero.RDF.AJAW.RDFSymbol}
	 */
	"_getResource":function(about) {
		return (typeof about == "object" ? about : new Zotero.RDF.AJAW.RDFSymbol(about));
	},
	
	/**
	 * Runs a callback to initialize this RDF store
	 */
	"_init":function() {
		if(this._prepFunction) {
			this._dataStore = this._prepFunction();
			delete this._prepFunction;
		}
	},
	
	/**
	 * Serializes the current RDF to a string
	 */
	"serialize":function(dataMode) {
		var serializer = Serializer();
		
		for(var prefix in this._dataStore.namespaces) {
			serializer.suggestPrefix(prefix, this._dataStore.namespaces[prefix]);
		}
		
		// serialize in appropriate format
		if(dataMode == "rdf/n3") {
			return serializer.statementsToN3(this._dataStore.statements);
		}
		
		return serializer.statementsToXML(this._dataStore.statements);
	},
	
	/**
	 * Adds an RDF triple
	 * @param {String|Zotero.RDF.AJAW.RDFSymbol} about
	 * @param {String|Zotero.RDF.AJAW.RDFSymbol} relation
	 * @param {String|Zotero.RDF.AJAW.RDFSymbol} value
	 * @param {Boolean} literal Whether value should be treated as a literal (true) or a resource
	 *     (false)
	 */
	"addStatement":function(about, relation, value, literal) {
		if(literal) {
			// zap chars that Mozilla will mangle
			value = value.toString().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
		} else {
			value = this._getResource(value);
		}
		
		this._dataStore.add(this._getResource(about), this._getResource(relation), value);
	},
	
	/**
	 * Creates a new anonymous resource
	 * @return {Zotero.RDF.AJAW.RDFSymbol}
	 */
	"newResource":function() {
		return new Zotero.RDF.AJAW.RDFBlankNode();
	},
	
	/**
	 * Creates a new container resource
	 * @param {String} type The type of the container ("bag", "seq", or "alt")
	 * @param {String|Zotero.RDF.AJAW.RDFSymbol} about The URI of the resource
	 * @return {Zotero.Translate.RDF.prototype.newContainer
	 */
	"newContainer":function(type, about) {
		const rdf = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
		const containerTypes = {"bag":"Bag", "seq":"Seq", "alt":"Alt"};
		
		type = type.toLowerCase();
		if(!containerTypes[type]) {
			throw "Invalid container type in Zotero.RDF.newContainer";
		}
		
		var about = this._getResource(about);
		this.addStatement(about, rdf+"type", rdf+containerTypes[type], false);
		this._containerCounts[about.toNT()] = 1;
		
		return about;
	},
	
	/**
	 * Adds a new element to a container
	 * @param {String|Zotero.RDF.AJAW.RDFSymbol} about The container
	 * @param {String|Zotero.RDF.AJAW.RDFSymbol} element The element to add to the container
	 * @param {Boolean} literal Whether element should be treated as a literal (true) or a resource
	 *     (false)
	 */
	"addContainerElement":function(about, element, literal) {
		const rdf = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
	
		var about = this._getResource(about);
		this._dataStore.add(about, new Zotero.RDF.AJAW.RDFSymbol(rdf+"_"+(this._containerCounts[about.toNT()]++)), element, literal);
	},
	
	/**
	 * Gets all elements within a container
	 * @param {String|Zotero.RDF.AJAW.RDFSymbol} about The container
	 * @return {Zotero.RDF.AJAW.RDFSymbol[]}
	 */
	"getContainerElements":function(about) {
		const liPrefix = "http://www.w3.org/1999/02/22-rdf-syntax-ns#_";
		
		var about = this._getResource(about);
		var statements = this._dataStore.statementsMatching(about);
		var containerElements = [];
		
		// loop over arcs out looking for list items
		for(var i=0; i<statements.length; i++) {
			var statement = statements[i];
			if(statement.predicate.uri.substr(0, liPrefix.length) == liPrefix) {
				var number = statement.predicate.uri.substr(liPrefix.length);
				
				// make sure these are actually numeric list items
				var intNumber = parseInt(number);
				if(number == intNumber.toString()) {
					// add to element array
					containerElements[intNumber-1] = (statement.object.termType == "literal" ? statement.object.toString() : statement.object);
				}
			}
		}
		
		return containerElements;
	},
	
	/**
	 * Adds a namespace for a specific URI
	 * @param {String} prefix Namespace prefix
	 * @param {String} uri Namespace URI
	 */
	"addNamespace":function(prefix, uri) {
		this._dataStore.setPrefixForURI(prefix, uri);
	},
	
	/**
	 * Gets the URI a specific resource
	 * @param {String|Zotero.RDF.AJAW.RDFSymbol} resource
	 * @return {String}
	 */
	"getResourceURI":function(resource) {
		if(typeof(resource) == "string") return resource;
		if(resource.uri) return resource.uri;
		if(resource.toNT == undefined) throw "Zotero.RDF: getResourceURI called on invalid resource";
		return resource.toNT();
	},
	
	/**
	 * Gets all resources in the RDF data store
	 * @return {Zotero.RDF.AJAW.RDFSymbol[]}
	 */
	"getAllResources":function() {
		var returnArray = [];
		for(var i in this._dataStore.subjectIndex) {
			returnArray.push(this._dataStore.subjectIndex[i][0].subject);
		}
		return returnArray;
	},
	
	/**
	 * Gets all arcs (predicates) into a resource
	 * @return {Zotero.RDF.AJAW.RDFSymbol[]}
	 * @deprecated Since 2.1. Use {@link Zotero.Translate.IO["rdf"]._RDFBase#getStatementsMatching}
	 */
	"getArcsIn":function(resource) {
		var statements = this._dataStore.objectIndex[this._dataStore.canon(this._getResource(resource))];
		if(!statements) return false;
		
		var returnArray = [];
		for(var i=0; i<statements.length; i++) {
			returnArray.push(statements[i].predicate.uri);
		}
		return returnArray;
	},
	
	/**
	 * Gets all arcs (predicates) out of a resource
	 * @return {Zotero.RDF.AJAW.RDFSymbol[]}
	 * @deprecated Since 2.1. Use {@link Zotero.Translate.IO["rdf"]._RDFBase#getStatementsMatching}
	 */
	"getArcsOut":function(resource) {
		var statements = this._dataStore.subjectIndex[this._dataStore.canon(this._getResource(resource))];
		if(!statements) return false;
		
		var returnArray = [];
		for(var i=0; i<statements.length; i++) {
			returnArray.push(statements[i].predicate.uri);
		}
		return returnArray;
	},
	
	/**
	 * Gets all subjects whose predicates point to a resource
	 * @param {String|Zotero.RDF.AJAW.RDFSymbol} resource Subject that predicates should point to
	 * @param {String|Zotero.RDF.AJAW.RDFSymbol} property Predicate
	 * @return {Zotero.RDF.AJAW.RDFSymbol[]}
	 * @deprecated Since 2.1. Use {@link Zotero.Translate.IO["rdf"]._RDFBase#getStatementsMatching}
	 */
	"getSources":function(resource, property) {
		var statements = this._dataStore.statementsMatching(undefined, this._getResource(property), this._getResource(resource));
		if(!statements.length) return false;
		
		var returnArray = [];
		for(var i=0; i<statements.length; i++) {
			returnArray.push(statements[i].subject);
		}
		return returnArray;
	},
	
	/**
	 * Gets all objects of a given subject with a given predicate
	 * @param {String|Zotero.RDF.AJAW.RDFSymbol} resource Subject
	 * @param {String|Zotero.RDF.AJAW.RDFSymbol} property Predicate
	 * @return {Zotero.RDF.AJAW.RDFSymbol[]}
	 * @deprecated Since 2.1. Use {@link Zotero.Translate.IO["rdf"]._RDFBase#getStatementsMatching}
	 */
	"getTargets":function(resource, property) {
		var statements = this._dataStore.statementsMatching(this._getResource(resource), this._getResource(property));
		if(!statements.length) return false;
		
		var returnArray = [];
		for(var i=0; i<statements.length; i++) {
			returnArray.push(statements[i].object.termType == "literal" ? statements[i].object.toString() : statements[i].object);
		}
		return returnArray;
	},
	
	/**
	 * Gets statements matching a certain pattern
	 *
	 * @param	{String|Zotero.RDF.AJAW.RDFSymbol}	subj 		Subject
	 * @param	{String|Zotero.RDF.AJAW.RDFSymbol}	predicate	Predicate
	 * @param	{String|Zotero.RDF.AJAW.RDFSymbol}	obj			Object
	 * @param	{Boolean}							objLiteral	Whether the object is a literal (as
	 *															opposed to a URI)
	 * @param	{Boolean}							justOne		Whether to stop when a single result is
	 *															retrieved
	 */
	"getStatementsMatching":function(subj, pred, obj, objLiteral, justOne) {
		var statements = this._dataStore.statementsMatching(
			(subj ? this._getResource(subj) : undefined),
			(pred ? this._getResource(pred) : undefined),
			(obj ? (objLiteral ? objLiteral : this._getResource(obj)) : undefined),
			undefined, justOne);
		if(!statements.length) return false;
		
		
		var returnArray = [];
		for(var i=0; i<statements.length; i++) {
			returnArray.push([statements[i].subject, statements[i].predicate, (statements[i].object.termType == "literal" ? statements[i].object.toString() : statements[i].object)]);
		}
		return returnArray;
	}
};