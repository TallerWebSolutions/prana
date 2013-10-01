/*
 * Prana Application.
 *
 * The Prana application class.
 */

/*
 * Module dependencies.
 */
var util = require('util');
var fs = require('fs');
var path = require('path');
var async = require('async');
var EventEmitter = require('events').EventEmitter;
var utils = require('./lib/utils');

/**
 * Prana constructor.
 *
 * @constructor
 * @inherits EventEmitter
 * @param {Object} settings Application settings.
 */
var Prana = module.exports = function(settings) {
  EventEmitter.call(this);

  this.settings = {
    extensionFileSuffix: '.extension.json',
    commonDependencies: [],
    extensions: null
  };

  if (settings) {
    utils.extend(this.settings, settings);
  }

  // Types container.
  this.types = {};

  // Extensions container.
  this.extensions = {};

  var self = this;

  // Add 'type' core type.
  this.type('type', {
    title: 'Type',
    description: 'Types are the smallest things on the system.',
    storageSettings: {
      // Set data as reference to this.types.
      data: this.types
    },
    process: function(name, settings) {
      var controller = settings.controller || Prana.Type;
      var typeObject = new controller(self, name, settings);
      return Prana.Model.compile(self, typeObject);
    },
    key: 'name'
  });

  // Add 'extension' core type.
  this.type('extension', {
    title: 'Extension',
    description: 'Extensions can extend every type on the system, as well as react on events.',
    storageSettings: {
      // Set data as reference to this.extensions.
      data: this.extensions
    },
    process: function(name, settings) {
      var controller = settings.controller || Prana.Extension;
      return new controller(self, name, settings);
    },
    key: 'name'
  });
};

util.inherits(Prana, EventEmitter);

// Add components to Prana namespace.
Prana.utils = require('./lib/utils');
Prana.MemoryStorage = require('./lib/memory');
Prana.Type = require('./lib/type');
Prana.Model = require('./lib/model');
Prana.Extension = require('./lib/extension');

/**
 * Make sure all extensions and types are loaded.
 *
 * @param {Function} callback Callback to run after prana was initialized.
 */
Prana.prototype.init = function(callback) {
  var self = this;
  async.mapSeries(['extension', 'type'], function(typeName, next) {
    var TypeModel = self.type(typeName);
    // Just calling this will set this.extension and this.type vars since those
    // vars were passed to storage settings.
    TypeModel.list({}, next);
  },
  function(err, results) {
    if (err) {
      return callback(err);
    }

    // Run init hook on all modules.
    self.invoke('init', self, function() {
      callback.apply(self, results);
    })
  });
};

/**
 * Create new type specific objects.
 *
 * @param {String} type A type name string.
 * @param {Object} values Initial object values.
 * @return {Model} Actually an instance of a subclass of Model, the type
 *   specific model class instance.
 */
Prana.prototype.new = function(type, values) {
  var TypeModel = this.type(type);
  return new TypeModel(values);
};

/**
 * Set or get a type.
 *
 * @param {String} name A string to be used to identify the type.
 * @param {Object} settings The settings for for the type to be created.
 * @return {Model} A Model subclass created exclusivelly for this type.
 */
Prana.prototype.type = function(name, settings) {
  // If there's no settings we want to get a type.
  if (!settings) {
    // Return this as earlier as possible.
    return this.types[name];
  }
  else {
    if (name === 'type') {
      // We are creating the 'type' type, use process from settings.
      return this.types[name] = settings.process(name, settings);
    }
    else {
      // Run the process function from the 'type' type that's actually a model
      // class instead of a type specific model instance.
      return this.types[name] = this.types['type'].type.process(name, settings);
    }
  }
};

/**
 * Set or get an extension.
 *
 * @param {String} extension A string to be used to identify the extension.
 * @param {Object} settings Extension settings.
 * @return {Extension} Extension instance.
 */
Prana.prototype.extension = function(name, settings) {
  // If there's no settings we want to get a extension.
  if (!settings) {
    // Return this as earlier as possible.
    return this.extensions[name];
  }
  else {
    // Run the process function from the 'extension' type.
    return this.extensions[name] = this.types['extension'].type.process(name, settings);
  }
};

/**
 * Scan the file system for extensions.
 *
 * @param {String|Array} dir Path to extensions container directory this can be
 *   also an array of paths.
 * @param {Function} callback Function to run when data is returned.
 */
Prana.prototype.loadExtensions = function(dir, callback) {
  var self = this;
  var foundExtensions = {};

  // If dir is a string convert ir to an array.
  var dirs = (typeof dir === 'string') ? [dir] : dir;

  // We loop dirs in series since order is important.
  async.eachSeries(dirs, function(dir, next) {

    // Scan directory for JSON files matching settings.extensionFileSuffix.
    Prana.Extension.scan(dir, self.settings.extensionFileSuffix, function(file, data, next) {

      // Parse data and build extension settings.
      try {
        var settings = JSON.parse(data);
        settings.path = path.dirname(file);
        settings.name = settings.name || path.basename(file, self.settings.extensionFileSuffix);
      } catch (err) {
        return next(err);
      }

      // Set dependency chain merging dependencies and common dependencies if any.
      // Clone settings.commonDependencies array to avoid affecting other
      // applications.
      settings.dependencyChain = self.settings.commonDependencies.concat([]);
      if (settings.dependencies) {
        settings.dependencies.forEach(function(dependency) {
          if (settings.dependencyChain.indexOf(dependency) === -1) {
            settings.dependencyChain.push(dependency);
          }
        });
      }

      // In the case we are enabling a module that's in setting.commonDependencies
      // we need to remove the extension from it's own list of dependencies.
      var index = settings.dependencyChain.indexOf(settings.name);
      if (index !== -1) {
        settings.dependencyChain.splice(index, 1);
      }

      // Add to found extensions.
      foundExtensions[settings.name] = settings;
      next();
    }, next);
  }, function (err) {
    if (err) {
      return callback(err);
    }

    // If settings.extensions is not set, enabled all extensions found.
    var enabled = self.settings.extensions ? Object.keys(self.settings.extensions) : Object.keys(foundExtensions);
    var chains = {};
    var enabledExtensions = {};
    async.each(enabled, function(extensionName, next) {
      if (!foundExtensions[extensionName]) {
        return next(new Error('Extension not found ' + extensionName + '.'));
      }

      var settings = foundExtensions[extensionName];

      // Check if there are missing dependecies.
      var missingDependencies = settings.dependencyChain.filter(function(dependency) {
        return !foundExtensions[dependency];
      });

      // Fail if there are missing dependencies.
      if (missingDependencies.length > 0) {
        return next(new Error('Missing dependecies for ' + extensionName + ' extension: ' + missingDependencies.join(', ') + '.'));
      }

      // Build extension prototype.
      var prototypeFile = settings.path + '/' + settings.name + '.js';
      fs.exists(prototypeFile, function(exists) {
        // Allow extensions without a prototype. E.g. for feature extensions
        // that just have JSON files with some resources.
        settings.prototype = exists ? require(prototypeFile) : {};

        // Add extension dependencies and initialization function to the
        // dependency chains, without changing settings.dependencyChain.
        chains[settings.name] = settings.dependencyChain.concat([function(next) {
          // Get module settings from application settings and add module info
          // to that.
          var instanceSettings = self.settings.extensions ? self.settings.extensions[settings.name] : {};
          utils.extend(settings, instanceSettings);

          // Initialize and add the module instance to the application.
          enabledExtensions[settings.name] = self.extension(settings.name, settings);

          next();
        }]);
        next();
      });
    }, function (err) {
      if (err) {
        return callback(err);
      }

      // Execute all initialization functions declared above taking into
      // account module dependencies.
      async.auto(chains, function(err) {
        callback(err, enabledExtensions);
      });
    });
  });
};

/**
 * Invoke a hook in all extensions that implement it.
 *
 * @param {String} hook Name of the hook to run.
 * @param {...Mixed} arg Variable number of arguments to pass the hook
 *   implementation.
 * @param {Function} callback Callback to run after all implementations have
 *   been invoked.
 */
Prana.prototype.invoke = function() {
  var args = Array.prototype.slice.call(arguments);
  var hook = args.shift();
  var callback = args.pop();
  var self = this;
  var chains = {};

  async.each(Object.keys(this.extensions), function(extensionName, next) {
    var extension = self.extensions[extensionName];
    var settings = extension.settings;
    var extensionInvoke = function(next) {
      // Make a copy of arguments to avoid appending all next callbacks to the
      // main args object.
      var argsCopy = args.slice();

      // Invoke extension hook implementation.
      if (extension[hook] && typeof extension[hook] === 'function') {
        argsCopy.push(next);
        // Invoke hook implemetation and return.
        return extension[hook].apply(extension, argsCopy);
      }

      next();
    };

    if (settings.dependencyChain) {
      // Clone extension dependency chain and add invocation function to the
      // dependency chains, without changing settings.dependencyChain.
      chains[extensionName] = settings.dependencyChain.concat([extensionInvoke]);
    }
    else {
      // Module doesn't have any dependencies.
      chains[extensionName] = extensionInvoke;
    }

    next();
  }, function (err) {
    if (err) {
      return callback(err);
    }

    // Execute all hooks taking into account module dependencies.
    async.auto(chains, callback);
  });
};

/**
 * Collect data from JSON files and type specific hooks and add them to the data
 * container object.
 *
 * @param {Type} type Type object to collect data for.
 * @param {Object} data Data container object.
 * @param {Function} callback Callback to run after all data have been
 *   collected.
 */
Prana.prototype.collect = function(type, data, callback) {
  // The extension type don't allow collecting.
  if (type.name == 'extension') {
    return callback();
  }

  var result = {};
  var self = this;

  // Loop over all extensions to collect their items.
  async.each(Object.keys(this.extensions), function(extensionName, next) {
    var extension = self.extensions[extensionName];

    if (extension.settings.path) {
      // Scan for JSON files for this type.
      Prana.Extension.scanItems(extension.settings.path, type.name, function(err, foundItems) {
        if (err) {
          return next(err);
        }

        if (foundItems) {
          // If items was found add them to the result.
          utils.extend(result, foundItems);
        }

        next();
      });
    }
    else {
      next();
    }
  }, function(err) {
    // Process all items from JSON files.
    Prana.Type.processAll(type, result, data);

    // Invoke type hooks on all modules. We don't use invoke() here since we
    // want data from previous hook invocation to be passed to the next hook
    // implementation. This way the resources created by previous hook
    // implementations can be modifyed by the dependent modules.
    // Create a chain to call hooks in the order of dependency.
    var chains = {};
    async.each(Object.keys(self.extensions), function(extensionName, next) {
      var extension = self.extensions[extensionName];

      // The callback that will receive and process.
      var extensionInvoke = function(next) {
        if (!extension[type.name] || typeof extension[type.name] !== 'function') {
          return next();
        }

        // Invoke type hook implemetation.
        extension[type.name](data, function(err, newItems) {
          if (err) {
            return next(err);
          }
          if (newItems) {
            // Process and include new items.
            Prana.Type.processAll(type, newItems, data);
          }
          next();
        });
      };

      if (extension.settings.dependencyChain) {
        // Clone extension dependency chain and add invocation function to the
        // dependency chains, without changing settings.dependencyChain.
        chains[extensionName] = extension.settings.dependencyChain.concat([extensionInvoke]);
      }
      else {
        // Module doesn't have any dependencies.
        chains[extensionName] = extensionInvoke;
      }

      next();
    }, function (err) {
      if (err) {
        return callback(err);
      }

      // Execute all hooks taking into account module dependencies.
      async.auto(chains, callback);
    });
  });
};
