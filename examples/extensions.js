var Prana = require('../prana');

var application = new Prana();

// The prototype of our programmatically created extension.
var myProgrammaticExtensionPrototype = {

  // The type() hook.
  type: function(types, callback) {
    var newTypes = {};

    // Add a type to this object and pass it as argument to the callback to have
    // medata processed and a type created properly.
    newTypes['myProgrammaticExtensionType'] = {
      title: 'My Programmatic Extension Type',
      description: 'A type created by a programmatically added extension.'
    };

    callback(null, newTypes);
  }

};

// Add an extension programmatically.
application.extension('my-programmatic-extension', {
  title: 'My Programmatic Extension',
  description: 'This is just an example extension.',
  prototype: myProgrammaticExtensionPrototype
});

// Scan a folder for extensions.
application.loadExtensions(__dirname + '/extensions', function(error, extensions) {
  if (error) {
    throw error;
  }

  console.log('Loaded %d extensions.', Object.keys(extensions).length);
  console.log('Found extensions');
  console.log(extensions);

  // When using extensions it's better to call init() to make sure all
  // extensions and types are loaded.
  application.init(function(extensions, types) {
    // List all extensions to see the extension we created programatically
    // above and the one created we have scanned. The 'extension' type is a
    // core type.
    var Extension = application.type('extension');
    Extension.list({}, function(error, items) {
      if (error) {
        throw error;
      }

      console.log('A list of extensions');
      console.log(items);

      // List all types to see the type created by our programmatic added and
      // by the scanned extensions. Just like the 'extension' type, the 'type'
      // type is a core type.
      var Type = application.type('type');
      Type.list({}, function(error, items) {
        console.log('A list of types');
        console.log(items);
      });

      // Get 'example' type model created by the example.type.json file.
      var Example = application.type('example');
      var ExampleItem = new Example({
        name: 'test',
        title: 'Test'
      });
      ExampleItem.save(function(error, item) {
        // List Example items.
        Example.list({}, function(error, items) {
          console.log('A list of Example items');
          console.log(items);
        });
      });

      // Get 'myProgrammaticExtensionType' type created by the extension.
      var MyProgrammaticExtensionType = application.type('myProgrammaticExtensionType');
      var myProgrammaticExtensionTypeItem = new MyProgrammaticExtensionType({
        name: 'test',
        title: 'Test'
      });
      myProgrammaticExtensionTypeItem.save(function(error, item) {
        // list MyProgrammaticExtensionType items.
        MyProgrammaticExtensionType.list({}, function(error, items) {
          console.log('A list of MyProgrammaticExtensionType items');
          console.log(items);
        });
      });

      // Get 'anotherExampleType' type created by the Example scanned extension.
      var AnotherExampleType = application.type('anotherExampleType');
      var anotherExampleTypeItem = new AnotherExampleType({
        name: 'test',
        title: 'Test'
      });
      anotherExampleTypeItem.save(function(error, item) {
        console.log('Formatted item title, from a method added from type settings: ' + item.formattedTitle());
        // list MyProgrammaticExtensionType items.
        AnotherExampleType.customList(function(error, items) {
          console.log('A custom list of AnotherExampleType items made from a static method added from type settings');
          console.log(items);
        });
      });

    });
  });
});
