var assert = require("assert");
var Prana = require('../prana');

describe('Model', function() {

  var prana = new Prana();

  var SomeType = prana.type('someType', {
    title: 'Some Type',
    description: 'Some type for testing purposes.',
    keyProperty: 'id'
  });

  it('should save and load an item', function(done) {
    var item = new SomeType({
      id: 1,
      value: 'Some value'
    });

    item.save(function(error) {
      if (error) {
        throw error;
      }

      assert.ok(item);

      SomeType.load(1, function(error, item) {
        if (error) {
          throw error;
        }
        assert.ok(item);
        assert.ok(item instanceof SomeType);
        assert.ok(item instanceof Prana.Model);
        done();
      });
    });
  });

  it('should save and list items', function(done) {
    var item = new SomeType({
      id: 2,
      value: 'Some value'
    });

    item.save(function(error) {
      if (error) {
        throw error;
      }

      assert.ok(item);

      SomeType.list({}, function(error, items) {
        if (error) {
          throw error;
        }
        assert.ok(items);
        assert.ok(Object.keys(items).length > 0);
        done();
      });
    });
  });

  it('should save, load and delete an item', function(done) {
    var item = new SomeType({
      id: 3,
      value: 'Some value'
    });

    item.save(function(error) {
      if (error) {
        throw error;
      }

      assert.ok(item);

      SomeType.load(3, function(error, item) {
        if (error) {
          throw error;
        }
        assert.ok(item);
        assert.ok(item instanceof SomeType);
        assert.ok(item instanceof Prana.Model);

        item.delete(function(error, deletedItem) {
          if (error) {
            throw error;
          }
          assert.ok(deletedItem);

          SomeType.load(3, function(error, absentItem) {
            if (error) {
              throw error;
            }
            assert.ok(!absentItem);
            done();
          });
        });
      });
    });
  });

  it('should save, load and delete an item using shortcuts', function(done) {
    prana.save('someType', {
      id: 4,
      value: 'Some value'
    }, function(error, item) {
      if (error) {
        throw error;
      }
      assert.ok(item);
      assert.ok(item instanceof SomeType);
      assert.ok(item instanceof Prana.Model);

      prana.load('someType', 4, function(error, loadedItem) {
        if (error) {
          throw error;
        }
        assert.ok(loadedItem);
        assert.ok(loadedItem instanceof SomeType);
        assert.ok(loadedItem instanceof Prana.Model);

        prana.delete('someType', 4, function(error, deletedItem) {
          if (error) {
            throw error;
          }
          assert.ok(deletedItem);

          prana.load('someType', 4, function(error, absentItem) {
            if (error) {
              throw error;
            }
            assert.ok(!absentItem);
            done();
          });
        });
      });
    });
  });

});
