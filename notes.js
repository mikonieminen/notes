
function Note(notesProvider, initData) {
    var dirty = false;
    var saving = false;
    var inputFormat = "html";
    var outputFormat = "html";

    var memento = {
        id: null,
        title: "Note " + new Date(),
        text: "New note.",
        created: new Date(),
        modified: new Date(),
        format: "text"
    };

    if (initData) {
        if (!initData.id) {
            memento.id = UUID();
        }
        for (key in initData) {
            memento[key] = initData[key];
        }
    } else {
        memento.id = UUID();
    }

    this.subscribers = {};

    // Use Object.defineProperty to hide actual data.
    // When values are changed, notify NotesProvider so that
    // note will be updated in the database.

    Object.defineProperty(this, '_memento', {
        configurable: false,
        enumerable: false,
        get: function() {
            return memento;
        }
    });

    Object.defineProperty(this, 'id', {
        configurable: false,
        enumerable: true,
        get: function() {
            return memento.id;
        }
    });

    Object.defineProperty(this, 'created', {
        configurable: false,
        enumerable: true,
        get: function() {
            return memento.created;
        }
    });

    Object.defineProperty(this, 'modified', {
        configurable: false,
        enumerable: true,
        get: function() {
            return memento.modified;
        }
    });

    Object.defineProperty(this, 'title', {
        configurable: false,
        enumerable: true,
        get: function() {
            return memento.title;
        },
        set: function(val) {
            if ( memento.title != val) {
                memento.title = val;
                memento.modified = new Date();
                notesProvider.updated(this);
            }
        }
    });

    Object.defineProperty(this, 'text', {
        configurable: false,
        enumerable: true,
        get: function() {
            return memento.text;
        },
        set: function(val) {
            if ( memento.text != val) {
                memento.text = val;
                memento.modified = new Date();
                notesProvider.updated(this);
            }
        }
    });

    Object.defineProperty(this, '_dirty', {
        configurable: false,
        enumerable: false,
        get: function() {
            return dirty;
        },
        set: function(val) {
            dirty = val;
        }
    });

    Object.defineProperty(this, '_saving', {
        configurable: false,
        enumerable: false,
        get: function() {
            return saving;
        },
        set: function(val) {
            saving = val;
        }
    });
}

Note.prototype.format = function(inputFormat, outputFormat, data) {
    if (inputFormat == outputFormat) {
        return data;
    }
};

Note.prototype.subscribe = function(event, callback) {
    if (! this.subscribers[event]) {
        this.subscribers[event] = [];
    }
    this.subscribers[event].push(callback);
};

function NotesProvider(app) {
    console.log("NotesProvider");
    this.app = app;
}

NotesProvider.prototype.initStorage = function(transaction) {
    console.log("NotesProvider.initStorage");
    var self = this;
    var store;
    if (!self.app.db.objectStoreNames.contains("notes")) {
        store = self.app.db.createObjectStore("notes", { keyPath: "id" });
    } else {
        store = transaction.objectStore("notes");
    }
    if (!store.indexNames.contains("modified")) {
        store.createIndex("modified", "modified", { unique: false });
    }
    if (!store.indexNames.contains("created")) {
        store.createIndex("created", "created", { unique: false });
    }
}

NotesProvider.prototype.init = function(callback) {
    console.log("NotesProvider.init");
    var self = this;
    var store;
    var index;
    var cursorRequest;

    store = self.app.db.transaction(["notes"]).objectStore("notes");
    index = store.index("modified");

    cursorRequest = index.openCursor();

    cursorRequest.addEventListener("success", function(e) {
        console.log("NotesProvider.init, cursorRequest success");
        var result = e.target.result;
        if(!!result == false) {
            callback();
        } else {
            console.log(JSON.stringify(result.value, null, '\t'));
            self.app.viewModel.addNote(new Note(self, result.value));
            result.continue();
        }
    }, false);

    cursorRequest.addEventListener("error", function(err) {
        console.log("NotesProvider.init, cursorRequest error");
        callback(err);
    }, false);

    cursorRequest.addEventListener("abort", function(reason) {
        console.log("NotesProvider.init, cursorRequest abort");
        callback(reason);
    }, false);
};

NotesProvider.prototype.addNote = function(note) {
    var self = this;
    var store;
    var request;
    var IDBTransaction = window.IDBTransaction;
    var transaction = this.app.db.transaction(["notes"], "readwrite");

    transaction.addEventLister("complete", function(event) {
        console.log("NotesProvider.addNote, transaction complete.");
    }, false);

    transaction.addEventListener("error", function(event) {
        console.log("NotesProvider.addNote, transaction error");
        console.log(event);
        alert("Creating new note failed.");
    }, false);

    store = transaction.objectStore("notes");

    request = store.add(note._memento);

    request.addEventListener("success", function(event) {
        console.log("NotesProvider.addNote, succeed.");
        console.log("Add new note to top of the list and make it current.");
        self.app.viewModel.notes.splice(0, 0, note);
        self.app.viewModel.currentNote(note);
    }, false);
};

NotesProvider.prototype.saveNote = function(note) {
    var self = this;
    var store;
    var request;
    var IDBTransaction = window.IDBTransaction;
    var transaction;

    note._saving = true;

    transaction = this.app.db.transaction(["notes"], "readwrite");
    transaction.addEventListener("complete", function(event) {
        console.log("NotesProvider.saveNote, transaction completed.");
        note._saving = false;
        if (note._dirty) {
            console.log("NotesProvider.saveNote, re-save since note was updated during the operation.");
            self.saveNote(note);
        }
    }, false);
    transaction.addEventListener("error", function(event) {
        console.log("NotesProvider.saveNote, error: ", event);
        alert("Failed to save note.");
    }, false);

    store = transaction.objectStore("notes");

    note._dirty = false;

    request = store.put(note._memento);

    request.addEventListener("success", function(event) {
        console.log("NotesProvider.saveNote, saved.");
    }, false);
};

NotesProvider.prototype.updated = function(note) {
    var i = 0;
    if (note.subscribers['changed'] instanceof Array) {
        for (i = 0; i < note.subscribers['changed'].length; ++i) {
            note.subscribers['changed'][i](note);
        }
    }
    if (!note._dirty && !note._saving) {
        console.log("Note updated, save current state.");
        note._dirty = true;
        this.saveNote(note);
    } else if (!note._dirty && note._saving) {
        note._dirty = true;
    }
};
