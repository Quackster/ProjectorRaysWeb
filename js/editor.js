/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * ProjectorRays Cast Editor - Edit and create .cst files
 */

import { DirectorFile } from './director/dirfile.js';
import { MemberType, CastMemberChunk } from './director/chunk.js';
import { WriteStream, BufferView } from './stream.js';
import { Endianness, FOURCC, fourCCToString } from './lingodec/enums.js';
import { MemoryMapEntry } from './director/subchunk.js';

/**
 * CastEditor - Edit and create Director cast files
 */
export class CastEditor {
    constructor(dirFile) {
        this.dirFile = dirFile;
        this.modifiedNames = new Map();    // memberId -> new name
        this.modifiedScripts = new Map();  // memberId -> new script text
        this.dirty = false;
    }

    /**
     * Get the Director file version
     */
    get version() {
        return this.dirFile?.version || 500;
    }

    /**
     * Get all cast members
     */
    getMembers() {
        const members = [];
        if (this.dirFile && this.dirFile.casts) {
            for (const cast of this.dirFile.casts.values()) {
                for (const member of cast.members.values()) {
                    members.push({
                        id: member.id,
                        name: this.getMemberName(member.id) || member.getName() || `Member ${member.id}`,
                        type: member.type,
                        typeName: this.getMemberTypeName(member.type),
                        castName: cast.name,
                        member: member
                    });
                }
            }
        }
        return members.sort((a, b) => a.id - b.id);
    }

    /**
     * Get human-readable member type name
     */
    getMemberTypeName(type) {
        const typeNames = {
            [MemberType.kNullMember]: 'Null',
            [MemberType.kBitmapMember]: 'Bitmap',
            [MemberType.kFilmLoopMember]: 'Film Loop',
            [MemberType.kTextMember]: 'Text',
            [MemberType.kPaletteMember]: 'Palette',
            [MemberType.kPictureMember]: 'Picture',
            [MemberType.kSoundMember]: 'Sound',
            [MemberType.kButtonMember]: 'Button',
            [MemberType.kShapeMember]: 'Shape',
            [MemberType.kMovieMember]: 'Movie',
            [MemberType.kDigitalVideoMember]: 'Digital Video',
            [MemberType.kScriptMember]: 'Script',
            [MemberType.kRTEMember]: 'Rich Text'
        };
        return typeNames[type] || `Unknown (${type})`;
    }

    /**
     * Get member name (with modifications)
     */
    getMemberName(memberId) {
        if (this.modifiedNames.has(memberId)) {
            return this.modifiedNames.get(memberId);
        }
        // Find the member and get original name
        const member = this.findMember(memberId);
        return member ? member.getName() : null;
    }

    /**
     * Set member name
     */
    setMemberName(memberId, newName) {
        this.modifiedNames.set(memberId, newName);
        this.dirty = true;
    }

    /**
     * Get script text for a script member
     */
    getScriptText(memberId) {
        if (this.modifiedScripts.has(memberId)) {
            return this.modifiedScripts.get(memberId);
        }
        const member = this.findMember(memberId);
        return member ? member.getScriptText() : null;
    }

    /**
     * Set script text for a script member
     */
    setScriptText(memberId, newText) {
        this.modifiedScripts.set(memberId, newText);
        this.dirty = true;
    }

    /**
     * Find a member by ID
     */
    findMember(memberId) {
        if (this.dirFile && this.dirFile.casts) {
            for (const cast of this.dirFile.casts.values()) {
                if (cast.members.has(memberId)) {
                    return cast.members.get(memberId);
                }
            }
        }
        return null;
    }

    /**
     * Check if there are unsaved changes
     */
    hasChanges() {
        return this.dirty;
    }

    /**
     * Apply all modifications to the cast member objects
     */
    applyModifications() {
        // Apply name modifications
        for (const [memberId, newName] of this.modifiedNames) {
            const member = this.findMember(memberId);
            if (member) {
                member.setName(newName);
            }
        }

        // Apply script text modifications
        for (const [memberId, newText] of this.modifiedScripts) {
            const member = this.findMember(memberId);
            if (member) {
                member.setScriptText(newText);
            }
        }
    }

    /**
     * Build the complete file as an ArrayBuffer
     */
    buildFile() {
        // Apply modifications to chunks
        this.applyModifications();

        // Clone the original file structure
        const originalBuffer = this.dirFile.buffer;
        const result = new Uint8Array(originalBuffer.slice(0));

        // For now, we do a simple approach: rebuild the CASt chunks that were modified
        // This is a basic implementation - full implementation would recalculate all offsets

        // Get the memory map
        const mmap = this.dirFile.mmap;
        if (!mmap) {
            console.error('No memory map found');
            return result.buffer;
        }

        // Find modified CASt chunks and rewrite them in-place if they fit
        for (const [memberId, newName] of this.modifiedNames) {
            const member = this.findMember(memberId);
            if (member && member.castSectionID !== undefined) {
                this.rewriteCastChunk(result, member, mmap);
            }
        }

        this.dirty = false;
        return result.buffer;
    }

    /**
     * Rewrite a CASt chunk in place (if it fits)
     */
    rewriteCastChunk(buffer, member, mmap) {
        const sectionID = member.castSectionID;
        if (sectionID === undefined || sectionID >= mmap.mapArray.length) {
            console.warn('Invalid section ID for member:', member.id);
            return false;
        }

        const entry = mmap.mapArray[sectionID];
        const originalLen = entry.len;
        const offset = entry.offset;

        // Check if fourCC matches CASt
        const castFourCC = FOURCC('C', 'A', 'S', 't');
        if (entry.fourCC !== castFourCC) {
            console.warn('Section', sectionID, 'is not a CASt chunk');
            return false;
        }

        // Calculate new chunk size
        const newSize = member.size();

        // For now, only allow rewriting if new size <= original size
        if (newSize > originalLen) {
            console.warn('New CASt chunk size', newSize, 'exceeds original', originalLen);
            console.warn('Full rebuild required - not yet implemented');
            return false;
        }

        // Write the chunk
        const chunkBuffer = new Uint8Array(originalLen);
        const stream = new WriteStream(chunkBuffer, Endianness.kBigEndian);
        member.write(stream);

        // Copy to output buffer (skip 8-byte chunk header: fourCC + len)
        const dataOffset = offset + 8;
        buffer.set(chunkBuffer.slice(0, newSize), dataOffset);

        // Pad with zeros if smaller
        if (newSize < originalLen) {
            buffer.fill(0, dataOffset + newSize, dataOffset + originalLen);
        }

        console.log('Rewrote CASt chunk for member', member.id, 'at offset', offset);
        return true;
    }

    /**
     * Download the modified file
     */
    download(filename) {
        const buffer = this.buildFile();
        const blob = new Blob([buffer], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'modified.cst';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Clear all modifications
     */
    clearModifications() {
        this.modifiedNames.clear();
        this.modifiedScripts.clear();
        this.dirty = false;
    }
}

// ============================================================================
// Editor UI Module
// ============================================================================

let currentEditor = null;
let currentFile = null;
let selectedMember = null;

// DOM elements
let dropZone, fileInput, fileInfo, fileName, clearBtn;
let loadingSection, errorSection, errorMessage, errorDismiss;
let editorSection, memberList, editPanel;
let memberNameInput, memberTypeDisplay, memberIdDisplay;
let saveBtn, exportBtn;

/**
 * Initialize the editor UI
 */
export function initEditorUI() {
    // Get DOM elements
    dropZone = document.getElementById('drop-zone');
    fileInput = document.getElementById('file-input');
    fileInfo = document.getElementById('file-info');
    fileName = document.getElementById('file-name');
    clearBtn = document.getElementById('clear-btn');

    loadingSection = document.getElementById('loading-section');
    errorSection = document.getElementById('error-section');
    errorMessage = document.getElementById('error-message');
    errorDismiss = document.getElementById('error-dismiss');

    editorSection = document.getElementById('editor-section');
    memberList = document.getElementById('member-list');
    editPanel = document.getElementById('edit-panel');

    memberNameInput = document.getElementById('member-name');
    memberTypeDisplay = document.getElementById('member-type');
    memberIdDisplay = document.getElementById('member-id');

    saveBtn = document.getElementById('save-btn');
    exportBtn = document.getElementById('export-btn');

    // Setup event listeners
    setupEventListeners();
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // File drop zone
    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) {
                handleFile(e.dataTransfer.files[0]);
            }
        });
    }

    // File input
    if (fileInput) {
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                handleFile(fileInput.files[0]);
            }
        });
    }

    // Clear button
    if (clearBtn) {
        clearBtn.addEventListener('click', clearFile);
    }

    // Error dismiss
    if (errorDismiss) {
        errorDismiss.addEventListener('click', () => {
            errorSection.classList.add('hidden');
        });
    }

    // Member name input
    if (memberNameInput) {
        memberNameInput.addEventListener('input', () => {
            if (selectedMember && currentEditor) {
                currentEditor.setMemberName(selectedMember.id, memberNameInput.value);
                updateSaveButtonState();
                refreshMemberList();
            }
        });
    }

    // Save button
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            if (currentEditor) {
                currentEditor.applyModifications();
                updateSaveButtonState();
            }
        });
    }

    // Export button
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            if (currentEditor && currentFile) {
                const exportName = currentFile.name.replace(/\.[^.]+$/, '_modified.cst');
                currentEditor.download(exportName);
            }
        });
    }
}

/**
 * Handle file selection
 */
async function handleFile(file) {
    currentFile = file;

    // Show file info
    if (fileName) fileName.textContent = file.name;
    if (fileInfo) fileInfo.classList.remove('hidden');
    if (loadingSection) loadingSection.classList.remove('hidden');
    if (editorSection) editorSection.classList.add('hidden');
    if (errorSection) errorSection.classList.add('hidden');

    try {
        const buffer = await file.arrayBuffer();
        const dirFile = new DirectorFile();
        await dirFile.read(buffer);

        currentEditor = new CastEditor(dirFile);

        // Show editor section
        if (loadingSection) loadingSection.classList.add('hidden');
        if (editorSection) editorSection.classList.remove('hidden');

        // Populate member list
        refreshMemberList();
        clearEditPanel();

    } catch (e) {
        console.error('Error loading file:', e);
        showError(e.message || 'Failed to load file');
        if (loadingSection) loadingSection.classList.add('hidden');
    }
}

/**
 * Clear the current file
 */
function clearFile() {
    currentFile = null;
    currentEditor = null;
    selectedMember = null;

    if (fileInput) fileInput.value = '';
    if (fileInfo) fileInfo.classList.add('hidden');
    if (editorSection) editorSection.classList.add('hidden');
    if (errorSection) errorSection.classList.add('hidden');
    if (memberList) memberList.innerHTML = '';
    clearEditPanel();
}

/**
 * Show an error message
 */
function showError(message) {
    if (errorMessage) errorMessage.textContent = message;
    if (errorSection) errorSection.classList.remove('hidden');
}

/**
 * Refresh the member list
 */
function refreshMemberList() {
    if (!memberList || !currentEditor) return;

    const members = currentEditor.getMembers();
    memberList.innerHTML = '';

    for (const member of members) {
        const li = document.createElement('li');
        li.dataset.id = member.id;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'member-name';
        nameSpan.textContent = currentEditor.getMemberName(member.id) || member.name;

        const typeSpan = document.createElement('span');
        typeSpan.className = 'member-type';
        typeSpan.textContent = `${member.typeName} (#${member.id})`;

        li.appendChild(nameSpan);
        li.appendChild(typeSpan);

        if (selectedMember && selectedMember.id === member.id) {
            li.classList.add('selected');
        }

        li.addEventListener('click', () => {
            selectMember(member);
        });

        memberList.appendChild(li);
    }
}

/**
 * Select a member for editing
 */
function selectMember(member) {
    selectedMember = member;

    // Update list selection
    const items = memberList.querySelectorAll('li');
    items.forEach(li => {
        li.classList.toggle('selected', li.dataset.id == member.id);
    });

    // Update edit panel
    if (memberNameInput) {
        memberNameInput.value = currentEditor.getMemberName(member.id) || member.name || '';
    }
    if (memberTypeDisplay) {
        memberTypeDisplay.textContent = member.typeName;
    }
    if (memberIdDisplay) {
        memberIdDisplay.textContent = `#${member.id}`;
    }
    if (editPanel) {
        editPanel.classList.remove('hidden');
    }
}

/**
 * Clear the edit panel
 */
function clearEditPanel() {
    selectedMember = null;
    if (memberNameInput) memberNameInput.value = '';
    if (memberTypeDisplay) memberTypeDisplay.textContent = '';
    if (memberIdDisplay) memberIdDisplay.textContent = '';
    if (editPanel) editPanel.classList.add('hidden');
}

/**
 * Update save button state based on changes
 */
function updateSaveButtonState() {
    if (saveBtn) {
        saveBtn.disabled = !currentEditor || !currentEditor.hasChanges();
    }
    if (exportBtn) {
        exportBtn.disabled = !currentEditor;
    }
}

// Auto-initialize when DOM is ready
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initEditorUI);
    } else {
        initEditorUI();
    }
}
