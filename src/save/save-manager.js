import localforage from 'localforage';
import { alertDialog } from '../ui/dialog-service.js';

localforage.config({
  name: 'reactor-knockoff',
  storeName: 'saves',
});

const SAVE_KEY = 'rks';

let pendingSave = null;
let latestData = null;

async function flushSave(callback) {
  while (latestData !== null) {
    const data = latestData;
    latestData = null;
    await localforage.setItem(SAVE_KEY, data);
  }
  pendingSave = null;
  if (callback) {
    callback();
  }
}

function queueSave(data, callback) {
  latestData = data;
  if (pendingSave) {
    return pendingSave;
  }
  pendingSave = flushSave(callback);
  return pendingSave;
}

export async function migrateFromLocalStorage() {
  const legacy = localStorage.getItem(SAVE_KEY);
  if (legacy === null) {
    return;
  }

  try {
    await localforage.setItem(SAVE_KEY, legacy);
    localStorage.removeItem(SAVE_KEY);
  } catch (err) {
    console.warn('Failed to migrate save to IndexedDB:', err);
  }
}

class SAVE_MANAGER {
  constructor() {
    this.game;
    this.active_saver;
  }

  init(game) {
    this.game = game;
  }
}

export const save_manager = new SAVE_MANAGER();

export class LocalSaver {
  save(data, callback) {
    save_manager.game.save_debug && console.log('LocalSaver.save');
    queueSave(data, callback);
  }

  enable() {
    save_manager.game.save_debug && console.log('LocalSaver.enable');
    localStorage.removeItem('google_drive_save');
    save_manager.active_saver = this;
  }

  load(callback) {
    save_manager.game.save_debug && console.log('LocalSaver.load');
    localforage.getItem(SAVE_KEY).then((rks) => {
      if (rks === null) {
        rks = localStorage.getItem(SAVE_KEY);
      }
      callback(rks);
    });
  }
}

save_manager.LocalSaver = LocalSaver;

let google_loaded = false;
let google_auth_called = false;

let google_saver_instance = null;

window.set_google_loaded = function() {
  save_manager.game.save_debug && console.log('set_google_loaded');
  google_loaded = true;

  if (google_auth_called && google_saver_instance) {
    google_saver_instance.checkAuth(null, true);
  }
};

export class GoogleSaver {
  constructor(local_saver) {
    this.local_saver = local_saver;
    var CLIENT_ID = '572695445092-svr182bgaass7vt97r5mnnk4phmmjh5u.apps.googleusercontent.com';
    var SCOPES = ['https://www.googleapis.com/auth/drive.appfolder'];
    var src = 'https://apis.google.com/js/client.js?onload=set_google_loaded';
    var filename = 'save.txt';
    var file_id = null;
    var file_meta = null;
    var tried_load = false;
    var load_callback = null;
    var self = this;
    var enable_callback;
    var access_token;

    this.loadfailed = false;
    this.authChecked = false;

    this.enable = function(callback, event) {
      save_manager.game.save_debug && console.log('GoogleSaver.enable');
      enable_callback = callback;

      if (google_loaded && this.authChecked === true && file_id !== null) {
        if (callback) {
          callback();
        }

        return;
      } else if (google_loaded) {
        self.checkAuth(null, event ? false : true);
      } else {
        google_auth_called = true;
      }

      save_manager.active_saver = this;
    };

    this.save = function(data, callback) {
      save_manager.game.save_debug && console.log('GoogleSaver.save');
      local_saver.save(data);

      if (google_loaded === true && this.authChecked === true && file_id !== null) {
        update_file(data, callback);
      } else if (callback) {
        callback();
      }
    };

    this.load = function(callback) {
      save_manager.game.save_debug && console.log('GoogleSaver.load');

      if (file_meta !== null) {
        download_file(file_meta, callback);
      } else {
        tried_load = true;
        load_callback = callback;
      }
    };

    var load_script = function() {
      var el = document.createElement('script');
      el.setAttribute('type', 'text/javascript');
      el.setAttribute('src', src);
      el.onerror = function() { self.loadfailed = true; document.getElementById('enable_google_drive_save').classList.add('button_disabled'); };

      document.getElementsByTagName('head')[0].appendChild(el);
    };

    this.checkAuth = function(callback, immediate = false) {
      save_manager.game.save_debug && console.log('GoogleSaver.checkAuth');

      gapi.auth.authorize(
        {
          client_id: CLIENT_ID,
          scope: SCOPES,
          immediate: immediate,
        },
        function(authResult) {
          save_manager.game.save_debug && console.log('gapi.auth.authorize CB', authResult);

          if (authResult && !authResult.error) {
            google_loaded = true;
            self.authChecked = true;
            access_token = authResult.access_token;
            localStorage.setItem('google_drive_save', 1);

            if (callback) {
              callback();
            } else {
              gapi.client.load('drive', 'v2', function(data) {
                save_manager.game.save_debug && console.log('gapi.client.load CB', data);
                get_file();
              });
            }
          } else if (!immediate) {
            local_saver.enable();
            save_manager.active_saver = local_saver;
            localStorage.removeItem('google_drive_save');
            alertDialog('Could not authorize. Switching to local save.', { title: 'Google Drive' });
          } else {
            self.checkAuth(callback, false);
          }
        }
      );
    };

    var update_file = function(data = '{}', callback) {
      save_manager.game.save_debug && console.log('GoogleSaver update_file', data);
      var boundary = '-------314159265358979323846';
      var delimiter = '\r\n--' + boundary + '\r\n';
      var close_delim = '\r\n--' + boundary + '--';

      var contentType = 'text/plain';
      var base64Data = btoa(data);
      var multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(file_meta) +
        delimiter +
        'Content-Type: ' + contentType + '\r\n' +
        'Content-Transfer-Encoding: base64\r\n' +
        '\r\n' +
        base64Data +
        close_delim;

      var request = gapi.client.request({
        path: '/upload/drive/v2/files/' + file_id,
        method: 'PUT',
        params: {
          uploadType: 'multipart',
          alt: 'json',
        },
        headers: {
          'Content-Type': 'multipart/mixed; boundary="' + boundary + '"',
        },
        body: multipartRequestBody,
      });

      request.execute(function(data) {
        save_manager.game.save_debug && console.log('gapi.client.request CB', data);

        if (!data || data.error) {
          if (data.error.code === 404) {
            alertDialog('It looks like the game was taken over in a new window - to take the game back, please refresh', { title: 'Google Drive' });
          } else {
            self.authChecked = false;
            self.checkAuth(function() {
              update_file(data, callback);
            }, true);
          }
        } else if (callback) {
          callback();
        }
      });
    };

    var deleteFile = function(fileId, callback) {
      save_manager.game.save_debug && console.log('GoogleSaver deleteFile');
      var request = gapi.client.drive.files.delete({
        fileId: fileId,
      });

      request.execute(function() {
        if (callback) callback();
      });
    };

    var get_file = function() {
      save_manager.game.save_debug && console.log('GoogleSaver get_file');

      function listFilesInApplicationDataFolder(callback) {
        function retrievePageOfFiles(request, result) {
          request.execute(function(resp) {
            result = result.concat(resp.items);
            var nextPageToken = resp.nextPageToken;

            if (nextPageToken) {
              request = gapi.client.drive.files.list({
                pageToken: nextPageToken,
              });
              retrievePageOfFiles(request, result);
            } else {
              save_manager.game.save_debug && console.log('GoogleSaver retrievePageOfFiles CB', result);
              callback(result);
            }
          });
        }
        var initialRequest = gapi.client.drive.files.list({
          q: '\'appfolder\' in parents',
        });
        retrievePageOfFiles(initialRequest, []);
      }

      listFilesInApplicationDataFolder(function(result) {
        save_manager.game.save_debug && console.log('GoogleSaver listFilesInApplicationDataFolder CB', result);

        for (var i = 0, l = result.length; i < l; i++) {
          var file = result[i];

          if (file.title === filename) {
            file_id = file.id;
            file_meta = file;

            if (tried_load) {
              self.load(load_callback);
            } else if (enable_callback) {
              enable_callback();
              enable_callback = null;
            }

            return;
          }
        }

        new_save_file();
      });
    };

    var new_save_file = function(callback) {
      save_manager.game.save_debug && console.log('GoogleSaver new_save_file');
      var boundary = '-------314159265358979323846264';
      var delimiter = '\r\n--' + boundary + '\r\n';
      var close_delim = '\r\n--' + boundary + '--';

      var contentType = 'text/plain';
      var metadata = {
        title: filename,
        mimeType: contentType,
        parents: [{ id: 'appfolder' }],
      };
      var base64Data = btoa(btoa(JSON.stringify({})));
      var multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: ' + contentType + '\r\n' +
        'Content-Transfer-Encoding: base64\r\n' +
        '\r\n' +
        base64Data +
        close_delim;
      var request = gapi.client.request({
        path: '/upload/drive/v2/files',
        method: 'POST',
        params: {
          uploadType: 'multipart',
        },
        headers: {
          'Content-Type': 'multipart/mixed; boundary="' + boundary + '"',
        },
        body: multipartRequestBody,
      });

      request.execute(function(arg) {
        save_manager.game.save_debug && console.log('gapi.client.request CB', arg);
        file_id = arg.id;
        file_meta = arg;
        if (callback) callback();
      });
    };

    var download_file = function(file, callback) {
      save_manager.game.save_debug && console.log('GoogleSaver download_file');
      if (file.downloadUrl) {
        var accessToken = gapi.auth.getToken().access_token;
        var xhr = new XMLHttpRequest();
        xhr.open('GET', file.downloadUrl);
        xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);
        xhr.onload = function() {
          file_meta = null;
          deleteFile(file_id, function() {
            file_id = null;

            new_save_file(function() {
              callback(xhr.responseText);
            });
          });
        };
        xhr.onerror = function() {
          callback(null);
        };
        xhr.send();
      } else {
        callback(null);
      }
    };

    load_script();
  }
}

save_manager.GoogleSaver = GoogleSaver;

export function createSavers() {
  const local_saver = new LocalSaver();
  google_saver_instance = new GoogleSaver(local_saver);
  return { local_saver, google_saver: google_saver_instance };
}
