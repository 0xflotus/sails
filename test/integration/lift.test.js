/**
 * Module dependencies
 */

var path = require('path');
var util = require('util');
var tmp = require('tmp');
var request = require('request');
var assert = require('assert');
var _ = require('@sailshq/lodash');
var MProcess = require('machinepack-process');
var Filesystem = require('machinepack-fs');
var testSpawningSailsLiftChildProcessInCwd = require('../helpers/test-spawning-sails-lift-child-process-in-cwd');
var appHelper = require('./helpers/appHelper');

tmp.setGracefulCleanup();



describe('Starting sails server with `sails lift`', function() {

  // Track the location of the Sails CLI, as well as the current working directory
  // before we stop hopping about all over the place.
  var originalCwd = process.cwd();
  var pathToSailsCLI = path.resolve(__dirname, '../../bin/sails.js');


  describe('in the directory of a newly-generated sails app', function() {

    var pathToTestApp;

    before(function(done) {
      // Create a temp directory.
      var tmpDir = tmp.dirSync({gracefulCleanup: true, unsafeCleanup: true});
      // Switch to the temp directory.
      process.chdir(tmpDir.name);
      pathToTestApp = path.resolve(tmpDir.name, 'testApp');
      // Create a new Sails app.
      MProcess.executeCommand({
        command: util.format('node %s new %s --fast --without=lodash,async', pathToSailsCLI, 'testApp'),
      }).exec(function(err) {
        if (err) {return done(err);}
        appHelper.linkDeps(pathToTestApp);
        return done();
      });
    });


    // And CD in.
    before(function (){
      process.chdir(pathToTestApp);
      Filesystem.writeSync({
        force: true,
        destination: 'api/controllers/getconf.js',
        string: 'module.exports = function (req, res) { return res.json(sails.config); }'
      }).execSync();

    });

    // Test `sails lift` in the CWD.
    describe('running `sails lift`', function (){
      testSpawningSailsLiftChildProcessInCwd({
        pathToSailsCLI: pathToSailsCLI,
        liftCliArgs: ['--hooks.pubsub=false'],
        envVars: _.extend({ 'sails_foo__bar': '{"abc": 123}'}, process.env),
        httpRequestInstructions: {
          method: 'GET',
          uri: 'http://localhost:1337',
        },
        fnWithAdditionalTests: function (){
          it('should humanize the config passed in via env vars', function (done){
            request({
              method: 'GET',
              uri: 'http://localhost:1337/getconf',
            }, function(err, response, body) {
              if (err) { return done(err); }
              body = JSON.parse(body);
              assert.equal(body.foo && body.foo.bar && body.foo.bar.abc, 123);
              return done();
            });
          });
        }
      });
    });

    // Test `sails lift` in the CWD with env vars for config.
    describe('running `node app.js`', function (){

      testSpawningSailsLiftChildProcessInCwd({
        pathToSailsCLI: pathToSailsCLI,
        cliArgs: ['app.js', '--hooks.pubsub=false'],
        envVars: _.extend({ 'sails_foo__bar': '{"abc": 123}'}, process.env),
        fnWithAdditionalTests: function (){
          it('should humanize the config passed in via env vars', function (done){
            request({
              method: 'GET',
              uri: 'http://localhost:1337/getconf',
            }, function(err, response, body) {
              if (err) { return done(err); }
              body = JSON.parse(body);
              assert.equal(body.foo && body.foo.bar && body.foo.bar.abc, 123);
              return done();
            });
          });
        }
      });

    });


    // Test `sails lift --port=1492` in the CWD.
    describe('running `sails lift --port=1492`', function (){
      testSpawningSailsLiftChildProcessInCwd({
        pathToSailsCLI: pathToSailsCLI,
        liftCliArgs: [
          '--port=1492',
          '--hooks.pubsub=false'
        ],
        httpRequestInstructions: {
          method: 'GET',
          uri: 'http://localhost:1492',
        },
        fnWithAdditionalTests: function (){
          it('should NOT be able to contact localhost:1337 anymore', function (done){
            request({
              method: 'GET',
              uri: 'http://localhost:1337',
            }, function(err, response, body) {
              if (err) { return done(); }
              return done(new Error('Should not be able to communicate with locahost:1337 anymore.... Here is the response we received:'+util.inspect(response,{depth:null})+'\n\n* * Troublehooting * *\n Perhaps the Sails app running in the child process was not properly cleaned up when it received SIGTERM?  Or could be a problem with the tests.  Find out all this and more after you fix it.'));
            });
          });
        }
      });
    });


    // And CD back to where we were before.
    after(function () {
      process.chdir(originalCwd);
    });

  });//</in the directory of a newly-generated sails app>






  describe('in an empty directory', function() {

    var pathToEmptyDirectory;

    before(function() {
      // Create a temp directory.
      var tmpDir = tmp.dirSync({gracefulCleanup: true, unsafeCleanup: true});
      // Switch to the temp directory.
      process.chdir(tmpDir.name);
      pathToEmptyDirectory = tmpDir.name;
    });

    // And CD in.
    before(function (){
      process.chdir(pathToEmptyDirectory);
    });

    // Now inject a describe block that tests lifing Sails in the CWD using
    // our wonderful little helper: "testSpawningSailsLiftChildProcessInCwd()".
    describe('running `sails lift`', function (){
      testSpawningSailsLiftChildProcessInCwd({
        pathToSailsCLI: pathToSailsCLI,
        liftCliArgs: ['--hooks.pubsub=false'],
        httpRequestInstructions: {
          method: 'GET',
          uri: 'http://localhost:1337',
          expectedStatusCode: 404
        }
      });
    });

    // And CD back to whererever we were before.
    after(function () {
      process.chdir(originalCwd);
    });

  });//</in an empty directory>


});
