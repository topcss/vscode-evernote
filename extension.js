//TODO do sth with canceltoken
//TODO do sth with catch()
//TODO notebook list & note list need pagination
//TODO see more about activation Commands

'use strict'

const util = require('util');
const vscode = require('vscode');
const open = require('open');
const adapter = require('./evernote-adapter.js');
const converter = require('./converter.js');

const config = vscode.workspace.getConfiguration('evernote');
// const userSettingUri = vscode.Uri.parse('%APPDATA%\Code\User\settings.json'); URI malformed :(

const docToNoteMetas = {};
let showTips = config.showTips;

function showError(error) {
    if (!error) {
        return; //user dismiss
    }
    
    console.log(error);
    let errMsg;
    if (error.statusCode && error.statusMessage) {
        errMsg = util.format("Http Error: %s - %s (Wrong noteStoreUrl??)", error.statusCode, error.statusMessage);
    } else if (error.errorCode && error.parameter) {
        errMsg = util.format("Evernote Error: %s - %s", error.errorCode, error.parameter);
    } else {
        errMsg = "Unexpected Error: " + error.toString();
    }
    
    vscode.window.showErrorMessage(errMsg);
}

function openDocWithContent(selectedMeta, content) {
    console.log('note content:' + content);
    
    return vscode.workspace.openTextDocument({language: 'markdown'}).then(doc => {
        docToNoteMetas[doc] = selectedMeta;
        return vscode.window.showTextDocument(doc);
    }).then(editor => {
        let startPos = new vscode.Position(1,0);
        editor.edit(edit => {
            let mdContent = converter.toMd(content);
            edit.insert(startPos, mdContent);
        });
    });
}

function navToOneNote() {
    if (!config.noteStoreUrl || !config.token) {
        vscode.window.showInformationMessage('Check readme for details.')
        vscode.window.showWarningMessage("Please set the token & API url first");
        return;
    }    
    
    let notebooks, noteMetas, selectedMeta;
    
    adapter.listNoteBooks().then(allNotebooks => {
        notebooks = allNotebooks;
        let allNoteBookNames = allNotebooks.map(notebook => notebook.name);
        
        return vscode.window.showQuickPick(allNoteBookNames);
        
    }).then(selected => {
        if (!selected) {
            throw "";
        }
        
        let selectedGuid = notebooks.find(notebook => notebook.name === selected).guid;
        return adapter.listAllNoteMetas(selectedGuid);
        
    }).then(metaList => {
        noteMetas = metaList.notes;
        let allNoteTitles = noteMetas.map(noteMeta => noteMeta.title);
        
        return vscode.window.showQuickPick(allNoteTitles);
        
    }).then(selected => {
        if (!selected) {
            throw "";
        }
        
        selectedMeta = noteMetas.find(meta => meta.title === selected);
        return adapter.getNoteContent(selectedMeta.guid);
        
    }).then(noteContent => {
        return openDocWithContent(selectedMeta, noteContent);
    }).catch(showError);
    
    vscode.window.setStatusBarMessage("Requesting notebooks .....", 2);
}

function updateNote() {
    let activeDoc = vscode.window.activeTextEditor.document;
    let meta = docToNoteMetas[activeDoc];
    
    if (meta) {
        // console.log('out: ' + activeDoc.getText());
        let convertedContent = converter.toEnml(activeDoc.getText());
        console.log('converted out:' + convertedContent);
        
        adapter.updateNoteContent(meta.guid, meta.title, convertedContent).then(note => {
            // console.log('update timestamp: ' + note.updated);
            vscode.window.showInformationMessage('Note:' + note.title +' updated at: ' + new Date(note.updated));
        }).catch(showError);
    }
}

function insertNewNote() {
    throw "notimplemented";
}

function openDevPage() {
    vscode.window.showQuickPick(["China", "Other"]).then(choice => {
        if (!choice) {
            return; // user dismiss
        }
        
        if (choice === "China") {
            open("https://app.yinxiang.com/api/DeveloperToken.action");
        } else {
            open("https://www.evernote.com/api/DeveloperToken.action");
        }
    });
    
}

function alertToUpdate() {
    if (!showTips) {
        return;
    }
    
    let msg = "Saving to local won't sync the remote. Try Evernote: Update Note";
    let option = "Ignore";
    vscode.window.showWarningMessage(msg, option).then(result => {
        if (result === option) {
           showTips = false;
        }
    });
}

function activate(context) {
    let navToOneNoteCmd = vscode.commands.registerCommand('extension.navToOneNote', navToOneNote);
    let updateNoteCmd = vscode.commands.registerCommand('extension.updateNote', updateNote);
    let openDevPageCmd = vscode.commands.registerCommand('extension.openDevPage', openDevPage);
    
    context.subscriptions.push(navToOneNoteCmd);
    context.subscriptions.push(updateNoteCmd);
    context.subscriptions.push(openDevPageCmd);
    
    // vscode.workspace.onWillSaveTextDocument(alertToUpdate);
    vscode.workspace.onDidSaveTextDocument(alertToUpdate);
}

function deactivate() {
}


exports.activate = activate;
exports.deactivate = deactivate;