'use strict';

var sc = angular.module('stellarClient');

sc.service('session', function($cacheFactory, KeyGen, Network, DataBlob, PERSISTENT_SESSION, BLOB_LOCATION){
  var cache = $cacheFactory('sessionCache');

  var Session = function() {};

  Session.prototype.get = function(name){ return cache.get(name); };
  Session.prototype.put = function(name, value){ return cache.put(name, value); };

  Session.prototype.storeCredentials = function(username, password){
    // Expand the user's credentials into the key used to encrypt the blob.
    var blobKey = KeyGen.expandCredentials(password, username);

    // Expand the user's credentials into the ID used to encrypt the blob.
    // The blobID must not allow an attacker to compute the blobKey.
    var blobID = sjcl.codec.hex.fromBits(sjcl.codec.bytes.toBits(KeyGen.expandCredentials(password, blobKey)));

    // Store the username, key, and ID in the session cache.
    // Don't store the password since we no longer need it.
    this.put('username', username);
    this.put('blobKey', blobKey);
    this.put('blobID', blobID);
  };

  // TODO: Think about moving this.
  Session.prototype.storeBlob = function() {
    // Get the blob from the session cache.
    var blob = this.get('blob');

    if(PERSISTENT_SESSION) localStorage.blob = JSON.stringify(blob);

    // Encrypt the blob and upload it to the server.
    $.ajax({
      url: BLOB_LOCATION + '/' + this.get('blobID'),
      method: 'POST',
      data: {blob: blob.encrypt(this.get('blobKey'))},
      dataType: 'json'
    });
  };

  Session.prototype.start = function(){
    var blob = this.get('blob');
    var packedKeys = blob.get('packedKeys');

    // Initialize the session with the blob's data.
    this.put('username', blob.get('username'));
    this.put('keys', KeyGen.unpack(packedKeys));
    this.put('address', packedKeys.address);

    // Set loggedIn to be true to signify that it is safe to use the session variables.
    this.put('loggedIn', true);
  };

  Session.prototype.connect = function() {
    var server = this.get('blob').get('server');
    var address = this.get('address');
    var network = new Network(server, address);
    network.connect();

    // Store the network connection in the session.
    this.put('network', network);
  };

  Session.prototype.loginFromStorage = function(){
    var blobData = localStorage.blob;

    if(blobData) {
      this.put('blob', new DataBlob(JSON.parse(blobData)));
      this.start();
    }
  };

  Session.prototype.logOut = function(){
    cache.removeAll();
    if(PERSISTENT_SESSION) delete localStorage.blob;
    this.put('loggedIn', false);
  };

  return new Session();
});