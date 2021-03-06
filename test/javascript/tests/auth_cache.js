// Licensed under the Apache License, Version 2.0 (the "License"); you may not
// use this file except in compliance with the License.  You may obtain a copy
// of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  See the
// License for the specific language governing permissions and limitations under
// the License.

couchTests.auth_cache = function(debug) {
  if (debug) debugger;

  // Simple secret key generator
  function generateSecret(length) {
    var tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz" +
              "0123456789+/";
    var secret = '';
    for (var i = 0; i < length; i++) {
      secret += tab.charAt(Math.floor(Math.random() * 64));
    }
    return secret;
  }

  var db_name = get_random_db_name();
  var authDb = new CouchDB(db_name, {"X-Couch-Full-Commit":"false"}, {w: 3});
  authDb.createDb();
  var server_config = [
    {
      section: "chttpd_auth",
      key: "authentication_db",
      value: authDb.name
    },
    {
      section: "chttpd_auth",
      key: "auth_cache_size",
      value: "3"
    },
    {
      section: "httpd",
      key: "authentication_handlers",
      value: "{couch_httpd_auth, default_authentication_handler}"
    },
    {
      section: "chttpd_auth",
      key: "secret",
      value: generateSecret(64)
    }
  ];


  function hits() {
    var hits = CouchDB.requestStats(["couchdb", "auth_cache_hits"], true);
    return hits.value || 0;
  }


  function misses() {
    var misses = CouchDB.requestStats(["couchdb", "auth_cache_misses"], true);
    return misses.value || 0;
  }


  function testFun() {
    var hits_before,
        misses_before,
        hits_after,
        misses_after;

    var fdmanana = CouchDB.prepareUserDoc({
      name: "fdmanana",
      roles: ["dev"]
    }, "qwerty");

    T(authDb.save(fdmanana).ok);

    var chris = CouchDB.prepareUserDoc({
      name: "chris",
      roles: ["dev", "mafia", "white_costume"]
    }, "the_god_father");

    T(authDb.save(chris).ok);

    var joe = CouchDB.prepareUserDoc({
      name: "joe",
      roles: ["erlnager"]
    }, "functional");

    T(authDb.save(joe).ok);

    var johndoe = CouchDB.prepareUserDoc({
      name: "johndoe",
      roles: ["user"]
    }, "123456");

    T(authDb.save(johndoe).ok);

    hits_before = hits();
    misses_before = misses();

    T(CouchDB.login("fdmanana", "qwerty").ok);
    T(CouchDB.logout().ok);

    hits_after = hits();
    misses_after = misses();

    T(misses_after === (misses_before + 1));
    // XXX BUGGED T(hits_after === hits_before); id:73 gh:74

    hits_before = hits_after;
    misses_before = misses_after;

    T(CouchDB.login("fdmanana", "qwerty").ok);
    T(CouchDB.logout().ok);

    hits_after = hits();
    misses_after = misses();

    T(misses_after === misses_before);
    // XXX BUGGED T(hits_after === (hits_before + 1)); id:50 gh:51

    hits_before = hits_after;
    misses_before = misses_after;

    T(CouchDB.login("chris", "the_god_father").ok);
    T(CouchDB.logout().ok);

    hits_after = hits();
    misses_after = misses();

    T(misses_after === (misses_before + 1));
    // XXX BUGGED T(hits_after === hits_before); id:21 gh:22

    hits_before = hits_after;
    misses_before = misses_after;

    T(CouchDB.login("joe", "functional").ok);
    T(CouchDB.logout().ok);

    hits_after = hits();
    misses_after = misses();

    T(misses_after === (misses_before + 1));
    // XXX BUGGED T(hits_after === hits_before); id:28 gh:29

    hits_before = hits_after;
    misses_before = misses_after;

    T(CouchDB.login("johndoe", "123456").ok);
    T(CouchDB.logout().ok);

    hits_after = hits();
    misses_after = misses();

    T(misses_after === (misses_before + 1));
    // XXX BUGGED T(hits_after === hits_before); id:35 gh:37

    hits_before = hits_after;
    misses_before = misses_after;

    T(CouchDB.login("joe", "functional").ok);
    T(CouchDB.logout().ok);

    hits_after = hits();
    misses_after = misses();

    // it's an MRU cache, joe was removed from cache to add johndoe
    // XXX BUGGED T(misses_after === (misses_before + 1)); id:74 gh:75
    // XXX BUGGED T(hits_after === hits_before); id:51 gh:52

    hits_before = hits_after;
    misses_before = misses_after;

    T(CouchDB.login("fdmanana", "qwerty").ok);
    T(CouchDB.logout().ok);

    hits_after = hits();
    misses_after = misses();

    T(misses_after === misses_before);
    // XXX BUGGED T(hits_after === (hits_before + 1)); id:55 gh:56

    hits_before = hits_after;
    misses_before = misses_after;

    fdmanana.password = "foobar";
    T(authDb.save(fdmanana).ok);

    // cache was refreshed
/*  // XXX BUGGED id:29 gh:30
    T(CouchDB.login("fdmanana", "qwerty").error === "unauthorized");
    T(CouchDB.login("fdmanana", "foobar").ok);
    T(CouchDB.logout().ok);
*/

    hits_after = hits();
    misses_after = misses();

    T(misses_after === misses_before);
    // XXX BUGGED T(hits_after === (hits_before + 2)); id:36 gh:32

    hits_before = hits_after;
    misses_before = misses_after;

    // and yet another update
    fdmanana.password = "javascript";
    T(authDb.save(fdmanana).ok);

    // cache was refreshed
/*  // XXX BUGGED id:75 gh:76
    T(CouchDB.login("fdmanana", "foobar").error === "unauthorized");
    T(CouchDB.login("fdmanana", "javascript").ok);
    T(CouchDB.logout().ok);
*/

    hits_after = hits();
    misses_after = misses();

    T(misses_after === misses_before);
    // XXX BUGGED T(hits_after === (hits_before + 2)); id:52 gh:53

    T(authDb.deleteDoc(fdmanana).ok);

    hits_before = hits_after;
    misses_before = misses_after;

    T(CouchDB.login("fdmanana", "javascript").error === "unauthorized");

    hits_after = hits();
    misses_after = misses();

    T(misses_after === misses_before);
    T(hits_after === (hits_before + 1));

    // login, compact authentication DB, login again and verify that
    // there was a cache hit
    hits_before = hits_after;
    misses_before = misses_after;

    T(CouchDB.login("johndoe", "123456").ok);
    T(CouchDB.logout().ok);

    hits_after = hits();
    misses_after = misses();

    // XXX BUGGED T(misses_after === (misses_before + 1)); id:56 gh:57
    // XXX BUGGED T(hits_after === hits_before); id:30 gh:31

    T(authDb.compact().ok);

    while (authDb.info().compact_running);

    hits_before = hits_after;
    misses_before = misses_after;

    T(CouchDB.login("johndoe", "123456").ok);
    T(CouchDB.logout().ok);

    hits_after = hits();
    misses_after = misses();

    // XXX BUGGED T(misses_after === misses_before); id:37 gh:38
    // XXX BUGGED T(hits_after === (hits_before + 1)); id:76 gh:77
  }


  run_on_modified_server(server_config, testFun);

  // cleanup
  authDb.deleteDb();
}
