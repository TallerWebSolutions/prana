var Prana = require('../prana');

// Very simple usage of Prana: just make a basic CRUD interface with memory
// based storage.
var application = new Prana();

// Create a very simple 'in memory' cache storage type.
// This will auto generate a 'basic controller class' for us, we can also set
// the 'controller' property when creating the type to override the standard
// controller.
var Cache = application.type('cache', {
  title: 'Cache',
  description: 'A very simple key/value cache storage mechanism.',

  // Those settings are the same as the defaults.
  path: 'cache',
  storage: 'memory',
  keyProperty: 'key'
});

// List all types to see the type we created, the 'type' type is a core type.
var Type = application.type('type');

Type.list({}, function(error, items) {
  console.log('A list of types');
  console.log(Object.keys(items));
});

// Create a cache item.
var cache = new Cache({
  name: 'some-cache',
  value: 'some-cache-value'
});

// Save item to memory.
cache.save();

// Create another cache item using the application.new() shorthand.
var otherCache = application.new('cache', {
  name: 'some-other-cache',
  value: 'some-other-cache-value'
});

// Save item to memory.
otherCache.save();

// Retrieve a list of cached data.
// You can also pass a conditions object as first argument to list(). The
// Memory Storage engine only allows key as condition, e.g. {key: 'some-key'}.
// Other storage engines allows complex queries to be performed.
Cache.list({}, function(error, items) {
  console.log('A list of items');
  console.log(items);
});

// Retrieve cached data.
Cache.load('some-cache', function(error, item) {
  console.log('A single item');
  console.log(item);
});

// Delete cached data.
Cache.delete('some-cache', function(error, item) {
  console.log('Delete this single item');
  console.log(item);
});

// Retrieve a list of cached data again to check if the item was really removed.
Cache.list({}, function(error, items) {
  console.log('A list of items');
  console.log(items);
});

// You can also delete loaded items.
// cache.delete();
