"strict";

function NoteListItem(note, viewModel) {
    var self = this;
    this.note = note;

    this.title = ko.observable(note.title);
    this.modified = ko.observable(note.modified);

    note.subscribe('changed', function() {
        self.title(note.title);
        self.modified(note.modified);
        viewModel.notes.sort(NoteListItem.prototype.compare);
    });
}

NoteListItem.prototype.compare = function(a, b) {
    if (a.note.modified < b.note.modified) {
        return 1;
    } else if (a.note.modified > b.note.modified) {
        return -1;
    } else {
        return 0;
    }
};

function ViewModel() {
    var self = this;

    this.notes = ko.observableArray([]);

    this.currentNote = ko.observable(null);

    this.currentView = ko.observable("list");

    this.updateTitle = function(note, event) {
        console.log("Update title");
        note.title = event.target.innerHTML;
    };

    this.updateText = function(note, event) {
        console.log("Update text");
        note.text = event.target.innerHTML;
    };

    this.addNote = function(note) {
        self.notes.push(new NoteListItem(note, this));
        self.notes.sort(NoteListItem.prototype.compare);
    };

    this.openNote = function(item) {
        self.currentNote(item.note);
        self.currentView("note");
    };

    this.closeNote = function(event) {
        self.currentView("list");
        self.currentNote(null);
    };
}

function App() {
    this.version = 2;
    this.idb;
    this.db;
    this.notesProvider;
    this.viewModel;

    this.idb = window.indexedDB || window.webkitIndexedDB;
    this.notesProvider = new NotesProvider(this);
    this.viewModel = new ViewModel(this.notesProvider);
}

App.prototype.init = function() {
    var self = this;
    var request;

    request = this.idb.open("Notes", this.version);

    request.addEventListener("error", function(event) {
        alert("Got error.");
    });

    request.addEventListener("upgradeneeded", function(event) {
        console.log("IDB onupgradeneeded");
        self.db = request.result;
        self.notesProvider.initStorage(event.currentTarget.transaction);
    });

    request.onsuccess = function(event) {
        console.log("IDB onsuccess");

        self.db = request.result;

        ko.applyBindings(self.viewModel);
        self.notesProvider.init(function(err) {
            if (!err) {
                self.ready();
            } else {
                alert("Error while initialization.");
            }
        });
    };
};

App.prototype.ready = function() {
    var self = this;
    document.querySelector('#note_list > input.add-new-btn').addEventListener('click', function(event) {
        var note = new Note(self.notesProvider);
        self.viewModel.addNote(note);
        self.viewModel.currentNote(note);
        self.viewModel.currentView("note");
        self.notesProvider.saveNote(note);
    });
    document.querySelector('#note_list > input').disabled = false;
};

document.addEventListener("DOMContentLoaded", function(event) {
    console.log("Document loaded.");

    window.applicationCache.addEventListener('updateready', function(e) {
        console.log("Appcache update ready.");
        if (window.applicationCache.status == window.applicationCache.UPDATEREADY) {
            // Browser downloaded a new app cache.
            // Swap it in and reload the page to get the new hotness.
            window.applicationCache.swapCache();
            if (confirm('A new version of this site is available. Load it?')) {
                window.location.reload();
            }
        } else {
            // Manifest didn't changed. Nothing new to server.
        }
    }, false);

    var app = new App();
    app.init();
}, true);
