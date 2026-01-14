/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { DirectorFile } from './director/dirfile.js';
import { MemberType } from './director/chunk.js';
import { FOURCC } from './lingodec/enums.js';

// Import core functions from library
import {
    toUint8Array,
    PaletteType,
    getBuiltInPalette,
    parseCLUTChunk,
    parseBitmapPaletteId,
    getPaletteForBitmap,
    getPaletteName,
    parseBitmapMemberData,
    decompressBITD,
    decodeBITD,
    detectSoundFormat,
    convertSndToWav,
    MAC_ROMAN_MAP,
    macRomanToUtf8,
    LINGO_KEYWORDS,
    LINGO_OPERATORS,
    LINGO_BUILTINS,
    escapeHtmlForHighlight,
    highlightLingo
} from './projectorrays-lib.js';

// Global state
let currentFile = null;
let currentFileBuffer = null;
let currentDirFile = null;
let scripts = [];
let assets = [];
let selectedScript = null;
let selectedAsset = null;
let currentTab = 'scripts';

// DOM elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileInfo = document.getElementById('file-info');
const fileName = document.getElementById('file-name');
const downloadBtn = document.getElementById('download-btn');
const clearBtn = document.getElementById('clear-btn');
const loadingSection = document.getElementById('loading-section');
const errorSection = document.getElementById('error-section');
const errorMessage = document.getElementById('error-message');
const errorDismiss = document.getElementById('error-dismiss');
const contentSection = document.getElementById('content-section');
const scriptList = document.getElementById('script-list');
const assetList = document.getElementById('asset-list');
const codeDisplay = document.getElementById('code-display').querySelector('code');
const currentScriptName = document.getElementById('current-script-name');
const dotSyntaxCheckbox = document.getElementById('dot-syntax');
const copyBtn = document.getElementById('copy-btn');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const codePanel = document.getElementById('code-panel');
const assetPanel = document.getElementById('asset-panel');
const currentAssetName = document.getElementById('current-asset-name');
const downloadAssetBtn = document.getElementById('download-asset-btn');
const assetInfo = document.getElementById('asset-info');
const assetCanvas = document.getElementById('asset-canvas');
const assetText = document.getElementById('asset-text');
const assetBinary = document.getElementById('asset-binary');

// Member type names
const MemberTypeNames = {
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

// Initialize
function init() {
    // File input events
    fileInput.addEventListener('change', handleFileSelect);

    // Drag and drop events
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);

    // Button events
    downloadBtn.addEventListener('click', downloadFile);
    clearBtn.addEventListener('click', clearFile);
    errorDismiss.addEventListener('click', dismissError);
    copyBtn.addEventListener('click', copyCode);
    downloadAssetBtn.addEventListener('click', downloadAsset);

    // Dot syntax toggle
    dotSyntaxCheckbox.addEventListener('change', refreshCodeDisplay);

    // Tab switching
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Asset filter controls
    const assetSearch = document.getElementById('asset-search');
    if (assetSearch) {
        let searchTimeout;
        assetSearch.addEventListener('input', () => {
            // Debounce search input
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(populateAssetList, 150);
        });
    }

    // Type filter checkboxes
    const typeFilters = document.querySelectorAll('#type-filters input[type="checkbox"]');
    typeFilters.forEach(cb => {
        cb.addEventListener('change', populateAssetList);
    });

    // Select All/None buttons
    const selectAllBtn = document.getElementById('select-all-types');
    const selectNoneBtn = document.getElementById('select-none-types');

    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            typeFilters.forEach(cb => cb.checked = true);
            populateAssetList();
        });
    }

    if (selectNoneBtn) {
        selectNoneBtn.addEventListener('click', () => {
            typeFilters.forEach(cb => cb.checked = false);
            populateAssetList();
        });
    }
}

function switchTab(tab) {
    currentTab = tab;

    // Update tab buttons
    tabButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    // Update tab contents
    tabContents.forEach(content => {
        content.classList.toggle('active', content.id === `${tab}-tab`);
    });

    // Update right panel
    if (tab === 'scripts') {
        codePanel.classList.remove('hidden');
        assetPanel.classList.add('hidden');
    } else {
        codePanel.classList.add('hidden');
        assetPanel.classList.remove('hidden');
    }
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
}

async function processFile(file) {
    showLoading();
    hideError();
    hideContent();

    try {
        currentFileBuffer = await file.arrayBuffer();
        currentFile = file;

        // Parse the Director file
        currentDirFile = new DirectorFile();
        currentDirFile.read(currentFileBuffer);

        // Parse all scripts (decompile bytecode to AST)
        currentDirFile.parseScripts();

        // Extract scripts and assets
        scripts = [];
        assets = [];
        extractScripts(currentDirFile);
        extractAssets(currentDirFile);

        // Show the UI
        showFileInfo(file.name);
        populateScriptList();
        populateAssetList();
        showContent();

        if (scripts.length > 0) {
            selectScript(0);
        }
    } catch (error) {
        console.error('Error processing file:', error);
        showError(error.message || 'Failed to process file');
    } finally {
        hideLoading();
    }
}

function extractScripts(dirFile) {
    // Get all script chunks from the file
    for (const scriptChunk of dirFile.scriptChunks) {
        if (scriptChunk.script) {
            scripts.push({
                name: getScriptName(scriptChunk),
                type: getScriptType(scriptChunk),
                script: scriptChunk.script,
                chunk: scriptChunk
            });
        }
    }

    // Sort by name
    scripts.sort((a, b) => a.name.localeCompare(b.name));
}

function extractAssets(dirFile) {
    // Debug: Log key table contents
    if (dirFile.keyTable) {
        console.log('Key table has', dirFile.keyTable.entries.length, 'entries');
        const bitdFourCC = FOURCC('B', 'I', 'T', 'D');
        console.log('Looking for BITD fourCC:', bitdFourCC.toString(16));
        const bitdEntries = dirFile.keyTable.entries.filter(e => e.fourCC === bitdFourCC);
        console.log('BITD entries found:', bitdEntries.length);
        if (bitdEntries.length === 0 && dirFile.keyTable.entries.length > 0) {
            // Show some fourCC values to debug
            const sampleFourCCs = dirFile.keyTable.entries.slice(0, 10).map(e => ({
                fourCC: e.fourCC.toString(16),
                castID: e.castID,
                sectionID: e.sectionID
            }));
            console.log('Sample key table entries (fourCC in hex):', sampleFourCCs);
        }
        if (bitdEntries.length > 0) {
            console.log('First 10 BITD entries:', bitdEntries.slice(0, 10).map(e => ({
                castID: e.castID,
                sectionID: e.sectionID
            })));
        }
    }

    // Get all cast members from all casts
    for (const cast of dirFile.casts) {
        console.log('Cast:', cast.name, 'members:', cast.members.size);
        for (const [memberId, member] of cast.members) {
            // Skip script members (they're shown in Scripts tab)
            if (member.type === MemberType.kScriptMember) continue;
            // Skip null members
            if (member.type === MemberType.kNullMember) continue;

            const asset = {
                id: memberId,
                name: member.getName() || `Member ${memberId}`,
                type: member.type,
                typeName: MemberTypeNames[member.type] || 'Unknown',
                member: member,
                cast: cast,
                castName: cast.name
            };

            // Try to find associated data chunk (BITD for bitmaps, snd for sounds, etc.)
            asset.dataChunkId = findAssetDataChunk(dirFile, cast, memberId, member.type, member);

            assets.push(asset);
        }
    }

    // Sort by ID
    assets.sort((a, b) => a.id - b.id);
}

function findAssetDataChunk(dirFile, cast, memberId, memberType, member) {
    // Look in key table for associated data chunks
    const keyTable = dirFile.keyTable;
    if (!keyTable) {
        console.log('findAssetDataChunk: no keyTable');
        return null;
    }

    // Map member types to their data chunk FOURCCs
    const dataChunkMap = {
        [MemberType.kBitmapMember]: FOURCC('B', 'I', 'T', 'D'),
        [MemberType.kSoundMember]: FOURCC('s', 'n', 'd', ' '),
        [MemberType.kTextMember]: FOURCC('S', 'T', 'X', 'T'),
        [MemberType.kPaletteMember]: FOURCC('C', 'L', 'U', 'T'),
        [MemberType.kShapeMember]: FOURCC('S', 'H', 'A', 'P'),
    };

    const targetFourCC = dataChunkMap[memberType];
    if (!targetFourCC) return null;

    // Get different IDs to try
    const slotID = memberId;  // Slot index in cast (member.id = i + minMember)
    const castSectionID = member?.castSectionID;  // CASt chunk's section ID
    const castLibID = member?.castLibID;  // Cast library ID (1024)

    // Try matching by slot ID first (most common for member data)
    for (const entry of keyTable.entries) {
        if (entry.castID === slotID && entry.fourCC === targetFourCC) {
            console.log('findAssetDataChunk: found by slotID', slotID, '-> sectionID', entry.sectionID);
            return entry.sectionID;
        }
    }

    // Try matching by CASt chunk section ID
    if (castSectionID) {
        for (const entry of keyTable.entries) {
            if (entry.castID === castSectionID && entry.fourCC === targetFourCC) {
                console.log('findAssetDataChunk: found by castSectionID', castSectionID, '-> sectionID', entry.sectionID);
                return entry.sectionID;
            }
        }
    }

    // Debug: show what we're looking for
    if (memberType === MemberType.kBitmapMember) {
        console.log('findAssetDataChunk: no BITD entry found for member', memberId);
        console.log('  slotID:', slotID, 'castSectionID:', castSectionID, 'castLibID:', castLibID);
        const bitdEntries = keyTable.entries.filter(e => e.fourCC === targetFourCC).slice(0, 5);
        console.log('  sample BITD entries:', bitdEntries.map(e => ({ castID: e.castID, sectionID: e.sectionID })));
    }

    return null;
}

function getScriptName(scriptChunk) {
    const script = scriptChunk.script;
    if (script.factoryName) {
        return script.factoryName;
    }
    if (script.handlers.length > 0 && script.handlers[0].name) {
        return script.handlers[0].name;
    }
    return 'Script ' + script.scriptNumber;
}

function getScriptType(scriptChunk) {
    const script = scriptChunk.script;
    if (script.isFactory()) {
        return 'Factory';
    }
    const flags = script.scriptFlags;
    if (flags & 0x200) { // kScriptFlagEventScript
        return 'Event';
    }
    return 'Script';
}

function populateScriptList() {
    scriptList.innerHTML = '';

    for (let i = 0; i < scripts.length; i++) {
        const scriptInfo = scripts[i];
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="script-name">${escapeHtml(scriptInfo.name)}</span>
            <span class="script-type">${escapeHtml(scriptInfo.type)}</span>
        `;
        li.addEventListener('click', () => selectScript(i));
        scriptList.appendChild(li);
    }
}

// Get selected asset types from checkboxes
function getSelectedAssetTypes() {
    const checkboxes = document.querySelectorAll('#type-filters input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

// Get filtered assets based on search and type filters
function getFilteredAssets() {
    const searchInput = document.getElementById('asset-search');
    const searchText = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const selectedTypes = getSelectedAssetTypes();

    return assets.filter(asset => {
        // Check type filter
        const matchesType = selectedTypes.length === 0 || selectedTypes.includes(asset.typeName);
        if (!matchesType) return false;

        // Check search filter
        if (!searchText) return true;
        const matchesName = asset.name.toLowerCase().includes(searchText);
        const matchesId = asset.id.toString().includes(searchText);
        return matchesName || matchesId;
    });
}

// Store filtered assets with their original indices for selection
let filteredAssetIndices = [];

function populateAssetList() {
    assetList.innerHTML = '';

    const filtered = getFilteredAssets();
    filteredAssetIndices = [];

    // Map filtered assets to their original indices
    filtered.forEach(asset => {
        const originalIndex = assets.indexOf(asset);
        filteredAssetIndices.push(originalIndex);
    });

    for (let i = 0; i < filtered.length; i++) {
        const asset = filtered[i];
        const originalIndex = filteredAssetIndices[i];
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="asset-name">${escapeHtml(asset.name)}</span>
            <span class="asset-type">${escapeHtml(asset.typeName)}</span>
            <span class="asset-id">#${asset.id}</span>
        `;
        li.addEventListener('click', () => selectAsset(originalIndex));
        assetList.appendChild(li);
    }

    // Update asset count display
    const assetCount = document.getElementById('asset-count');
    if (assetCount) {
        assetCount.textContent = `Showing ${filtered.length} of ${assets.length} assets`;
    }
}

function selectScript(index) {
    if (index < 0 || index >= scripts.length) return;

    // Update selection in list
    const items = scriptList.querySelectorAll('li');
    items.forEach((item, i) => {
        item.classList.toggle('selected', i === index);
    });

    selectedScript = scripts[index];
    currentScriptName.textContent = selectedScript.name;
    copyBtn.classList.remove('hidden');

    refreshCodeDisplay();
}

function selectAsset(index) {
    if (index < 0 || index >= assets.length) return;

    // Update selection in list
    const items = assetList.querySelectorAll('li');
    items.forEach((item, i) => {
        item.classList.toggle('selected', i === index);
    });

    selectedAsset = assets[index];
    currentAssetName.textContent = selectedAsset.name;
    downloadAssetBtn.classList.remove('hidden');

    refreshAssetDisplay();
}

function refreshCodeDisplay() {
    if (!selectedScript) {
        codeDisplay.innerHTML = '';
        return;
    }

    const dotSyntax = dotSyntaxCheckbox.checked;

    try {
        const code = selectedScript.script.scriptText('\n', dotSyntax);
        codeDisplay.innerHTML = highlightLingo(code);
    } catch (error) {
        console.error('Error generating script text:', error);
        codeDisplay.innerHTML = '<span class="hl-comment">-- Error generating script text: ' + escapeHtmlForHighlight(error.message) + '</span>';
    }
}

function refreshAssetDisplay() {
    if (!selectedAsset) {
        assetInfo.innerHTML = '';
        return;
    }

    // Hide all preview elements
    assetCanvas.classList.add('hidden');
    assetText.classList.add('hidden');
    assetBinary.classList.add('hidden');
    const audioPlayer = document.getElementById('audio-player');
    if (audioPlayer) audioPlayer.classList.add('hidden');

    // Show asset info
    let infoHtml = `
        <p><strong>Name:</strong> ${escapeHtml(selectedAsset.name)}</p>
        <p><strong>Type:</strong> ${escapeHtml(selectedAsset.typeName)}</p>
        <p><strong>Member ID:</strong> ${selectedAsset.id}</p>
        <p><strong>Cast:</strong> ${escapeHtml(selectedAsset.castName)}</p>
    `;

    // Add specific data based on member type
    const member = selectedAsset.member;
    if (member.specificData && member.specificData.length > 0) {
        infoHtml += `<p><strong>Data Size:</strong> ${member.specificData.length} bytes</p>`;
    }

    assetInfo.innerHTML = infoHtml;

    // Try to display the asset based on type
    switch (selectedAsset.type) {
        case MemberType.kBitmapMember:
            displayBitmap(selectedAsset);
            break;
        case MemberType.kTextMember:
        case MemberType.kRTEMember:
            displayText(selectedAsset);
            break;
        case MemberType.kShapeMember:
            displayShape(selectedAsset);
            break;
        case MemberType.kButtonMember:
            displayButton(selectedAsset);
            break;
        case MemberType.kPaletteMember:
            displayPalette(selectedAsset);
            break;
        case MemberType.kSoundMember:
            displaySound(selectedAsset);
            break;
        case MemberType.kFilmLoopMember:
            displayFilmLoop(selectedAsset);
            break;
        default:
            displayBinaryData(selectedAsset);
            break;
    }
}

function displayBitmap(asset) {
    const member = asset.member;
    const version = currentDirFile?.version || 500;

    console.log('displayBitmap called for:', asset.name, 'id:', asset.id, 'version:', version);

    // Try to get the BITD chunk data
    let bitdData = null;
    if (asset.dataChunkId && currentDirFile.chunkExists(FOURCC('B', 'I', 'T', 'D'), asset.dataChunkId)) {
        try {
            bitdData = currentDirFile.getChunkData(FOURCC('B', 'I', 'T', 'D'), asset.dataChunkId);
            console.log('  BITD data size:', bitdData?.length || bitdData?.byteLength);
        } catch (e) {
            console.error('Error loading BITD chunk:', e);
        }
    }

    // Parse bitmap member data
    const bitmapInfo = parseBitmapMemberData(member.specificData, version);
    if (!bitmapInfo) {
        assetBinary.innerHTML = '<p>No bitmap data available or invalid format</p>';
        assetBinary.classList.remove('hidden');
        return;
    }

    const { width, height, bitsPerPixel, pitch, paletteId } = bitmapInfo;

    // Get the appropriate palette
    let paletteInfo;
    if (paletteId < 0) {
        paletteInfo = {
            palette: getBuiltInPalette(paletteId),
            name: getPaletteName(paletteId),
            id: paletteId
        };
    } else if (paletteId > 0) {
        // Try to load custom palette from CLUT
        paletteInfo = getPaletteForBitmap(member, currentDirFile, version);
    } else {
        paletteInfo = {
            palette: getBuiltInPalette(PaletteType.kClutSystemMac),
            name: 'System - Mac',
            id: PaletteType.kClutSystemMac
        };
    }

    // Update info display
    assetInfo.innerHTML += `
        <p><strong>Dimensions:</strong> ${width} x ${height}</p>
        <p><strong>Bit Depth:</strong> ${bitsPerPixel}-bit</p>
        <p><strong>Pitch:</strong> ${pitch} bytes/row</p>
        <p><strong>Palette:</strong> ${paletteInfo.name} (ID: ${paletteInfo.id})</p>
    `;

    if (!bitdData) {
        console.log('  No BITD chunk found');
        assetInfo.innerHTML += `<p><strong>Note:</strong> Bitmap data chunk not found</p>`;
        displayBinaryData(asset);
        return;
    }

    try {
        const bitdBytes = toUint8Array(bitdData);
        // Use library's decodeBITD to get pixel data, then render to canvas
        const result = decodeBITD(bitdBytes, width, height, bitsPerPixel, pitch, paletteInfo.palette, version);

        // Show compression info
        assetInfo.innerHTML += `<p><strong>Compression:</strong> ${result.isCompressed ? 'RLE' : 'None'}</p>`;

        // Render to canvas
        const canvas = assetCanvas;
        const ctx = canvas.getContext('2d');
        canvas.width = result.width;
        canvas.height = result.height;
        const imageData = ctx.createImageData(result.width, result.height);
        imageData.data.set(result.pixels);
        ctx.putImageData(imageData, 0, 0);
        canvas.classList.remove('hidden');
    } catch (e) {
        console.error('Error decoding bitmap:', e);
        assetInfo.innerHTML += `<p><strong>Error:</strong> ${e.message}</p>`;
        displayBinaryData(asset);
    }
}

function displayText(asset) {
    const member = asset.member;

    // Try to get text from STXT chunk
    if (asset.dataChunkId && currentDirFile.chunkExists(FOURCC('S', 'T', 'X', 'T'), asset.dataChunkId)) {
        try {
            const stxtData = currentDirFile.getChunkData(FOURCC('S', 'T', 'X', 'T'), asset.dataChunkId);
            const bytes = toUint8Array(stxtData);
            const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

            // STXT chunk format:
            // Offset 0: headerLength (uint32, big-endian)
            // Offset 4: textLength (uint32, big-endian)
            // Offset 8: textOffset (relative to start of data after header)
            // After header: text data, then formatting data

            if (bytes.length >= 12) {
                const headerLength = view.getUint32(0, false);
                const textLength = view.getUint32(4, false);

                // Text starts after the header
                const textStart = headerLength;
                const textEnd = Math.min(textStart + textLength, bytes.length);

                // Decode text using Mac Roman encoding
                let text = macRomanToUtf8(bytes, textStart, textEnd - textStart);

                // Convert Mac line endings (CR) to Unix (LF)
                text = text.replace(/\r/g, '\n');

                assetInfo.innerHTML += `<p><strong>Text Length:</strong> ${textLength} characters</p>`;

                assetText.textContent = text || '(Empty text)';
                assetText.classList.remove('hidden');
                return;
            }
        } catch (e) {
            console.error('Error loading text:', e);
        }
    }

    // Fall back to displaying raw data
    displayBinaryData(asset);
}

function displayShape(asset) {
    const member = asset.member;

    if (!member.specificData || member.specificData.length < 4) {
        displayBinaryData(asset);
        return;
    }

    const bytes = toUint8Array(member.specificData);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    try {
        // Shape member specific data format:
        // Offset 0: shapeType (uint16)
        // Offset 2: boundingRect (8 bytes)
        // etc.

        const shapeType = view.getUint16(0, false);
        const shapeNames = {
            1: 'Rectangle',
            2: 'Round Rectangle',
            3: 'Oval',
            4: 'Line'
        };

        const shapeName = shapeNames[shapeType] || `Unknown (${shapeType})`;

        let infoHtml = `<p><strong>Shape Type:</strong> ${shapeName}</p>`;

        if (bytes.length >= 10) {
            const top = view.getInt16(2, false);
            const left = view.getInt16(4, false);
            const bottom = view.getInt16(6, false);
            const right = view.getInt16(8, false);
            infoHtml += `<p><strong>Bounds:</strong> ${right - left} x ${bottom - top}</p>`;
        }

        if (bytes.length >= 12) {
            const lineSize = view.getUint16(10, false);
            infoHtml += `<p><strong>Line Size:</strong> ${lineSize}</p>`;
        }

        assetInfo.innerHTML += infoHtml;

        // Draw the shape on canvas
        if (bytes.length >= 10) {
            const top = view.getInt16(2, false);
            const left = view.getInt16(4, false);
            const bottom = view.getInt16(6, false);
            const right = view.getInt16(8, false);
            const width = right - left;
            const height = bottom - top;

            if (width > 0 && height > 0 && width < 1000 && height < 1000) {
                const canvas = assetCanvas;
                const ctx = canvas.getContext('2d');
                canvas.width = width + 20;
                canvas.height = height + 20;

                ctx.fillStyle = '#16213e';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                ctx.strokeStyle = '#e94560';
                ctx.lineWidth = 2;
                ctx.fillStyle = '#0f3460';

                const x = 10, y = 10;

                switch (shapeType) {
                    case 1: // Rectangle
                        ctx.fillRect(x, y, width, height);
                        ctx.strokeRect(x, y, width, height);
                        break;
                    case 2: // Round Rectangle
                        const radius = Math.min(10, width / 4, height / 4);
                        ctx.beginPath();
                        ctx.roundRect(x, y, width, height, radius);
                        ctx.fill();
                        ctx.stroke();
                        break;
                    case 3: // Oval
                        ctx.beginPath();
                        ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.stroke();
                        break;
                    case 4: // Line
                        ctx.beginPath();
                        ctx.moveTo(x, y);
                        ctx.lineTo(x + width, y + height);
                        ctx.stroke();
                        break;
                    default:
                        ctx.strokeRect(x, y, width, height);
                }

                canvas.classList.remove('hidden');
                return;
            }
        }
    } catch (e) {
        console.error('Error parsing shape:', e);
    }

    displayBinaryData(asset);
}

function displayButton(asset) {
    const member = asset.member;

    // Button members have text associated with them
    // Try to get the button text from STXT chunk
    if (asset.dataChunkId && currentDirFile.chunkExists(FOURCC('S', 'T', 'X', 'T'), asset.dataChunkId)) {
        displayText(asset);
        return;
    }

    if (!member.specificData || member.specificData.length < 2) {
        displayBinaryData(asset);
        return;
    }

    const bytes = toUint8Array(member.specificData);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    try {
        const buttonType = view.getUint16(0, false);
        const buttonTypes = {
            1: 'Push Button',
            2: 'Check Box',
            3: 'Radio Button'
        };

        assetInfo.innerHTML += `<p><strong>Button Type:</strong> ${buttonTypes[buttonType] || `Unknown (${buttonType})`}</p>`;
    } catch (e) {
        console.error('Error parsing button:', e);
    }

    displayBinaryData(asset);
}

function displayPalette(asset) {
    // Try to get palette data from CLUT chunk
    if (asset.dataChunkId && currentDirFile.chunkExists(FOURCC('C', 'L', 'U', 'T'), asset.dataChunkId)) {
        try {
            const clutData = currentDirFile.getChunkData(FOURCC('C', 'L', 'U', 'T'), asset.dataChunkId);
            const bytes = toUint8Array(clutData);

            // CLUT chunks contain 256 RGB entries (768 bytes) or similar
            const numColors = Math.min(256, Math.floor(bytes.length / 6));  // 6 bytes per color (RGB with high bytes)

            assetInfo.innerHTML += `<p><strong>Colors:</strong> ${numColors}</p>`;

            // Draw palette swatches
            const canvas = assetCanvas;
            const ctx = canvas.getContext('2d');
            const swatchSize = 16;
            const cols = 16;
            const rows = Math.ceil(numColors / cols);

            canvas.width = cols * swatchSize;
            canvas.height = rows * swatchSize;

            for (let i = 0; i < numColors; i++) {
                const offset = i * 6;
                // Director palettes store colors as 16-bit values per channel
                const r = bytes[offset] || 0;
                const g = bytes[offset + 2] || 0;
                const b = bytes[offset + 4] || 0;

                const x = (i % cols) * swatchSize;
                const y = Math.floor(i / cols) * swatchSize;

                ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                ctx.fillRect(x, y, swatchSize, swatchSize);
            }

            canvas.classList.remove('hidden');
            return;
        } catch (e) {
            console.error('Error loading palette:', e);
        }
    }

    displayBinaryData(asset);
}

function displaySound(asset) {
    const member = asset.member;

    // Try to load sound data
    let soundData = null;
    if (asset.dataChunkId && currentDirFile.chunkExists(FOURCC('s', 'n', 'd', ' '), asset.dataChunkId)) {
        try {
            soundData = currentDirFile.getChunkData(FOURCC('s', 'n', 'd', ' '), asset.dataChunkId);
        } catch (e) {
            console.error('Error loading sound chunk:', e);
        }
    }

    if (!soundData) {
        assetInfo.innerHTML += `<p><strong>Status:</strong> No sound data found</p>`;
        assetBinary.innerHTML = '<p>Sound data not available</p>';
        assetBinary.classList.remove('hidden');
        return;
    }

    const soundBytes = toUint8Array(soundData);
    const formatInfo = detectSoundFormat(soundBytes);

    assetInfo.innerHTML += `
        <p><strong>Format:</strong> ${formatInfo.format.toUpperCase()}</p>
        <p><strong>Size:</strong> ${soundBytes.length.toLocaleString()} bytes</p>
    `;

    // Store format info for download
    asset.soundFormat = formatInfo;

    // Try to play the audio
    const audioPlayer = document.getElementById('audio-player');
    const soundPreview = document.getElementById('sound-preview');

    if (audioPlayer && soundPreview) {
        let audioBlob = null;
        let mimeType = formatInfo.mimeType;

        if (formatInfo.format === 'aiff' || formatInfo.format === 'wav' || formatInfo.format === 'mp3') {
            // These formats may be playable directly by the browser
            audioBlob = new Blob([soundBytes], { type: mimeType });
        } else if (formatInfo.format === 'snd') {
            // Try to convert Mac SND to WAV
            const wavResult = convertSndToWav(soundBytes);
            if (wavResult) {
                audioBlob = new Blob([wavResult.data], { type: 'audio/wav' });
                mimeType = 'audio/wav';
                assetInfo.innerHTML += `
                    <p><strong>Sample Rate:</strong> ${wavResult.sampleRate} Hz</p>
                    <p><strong>Channels:</strong> ${wavResult.numChannels}</p>
                    <p><strong>Bits:</strong> ${wavResult.bitsPerSample}-bit</p>
                `;
            }
        }

        if (audioBlob) {
            // Revoke previous URL if any
            if (soundPreview.src && soundPreview.src.startsWith('blob:')) {
                URL.revokeObjectURL(soundPreview.src);
            }

            const audioUrl = URL.createObjectURL(audioBlob);
            soundPreview.src = audioUrl;
            audioPlayer.classList.remove('hidden');

            // Handle playback errors
            soundPreview.onerror = () => {
                console.warn('Audio playback not supported for this format');
                audioPlayer.classList.add('hidden');
                assetBinary.innerHTML = `
                    <div style="text-align: center; padding: 1rem;">
                        <p style="color: #888;">Audio preview not available for this format.</p>
                        <p style="color: #666;">Use the Download button to save the sound file.</p>
                    </div>
                `;
                assetBinary.classList.remove('hidden');
            };
        } else {
            // Can't convert or play
            assetBinary.innerHTML = `
                <div style="text-align: center; padding: 1rem;">
                    <p style="color: #888;">Audio preview not available for this format.</p>
                    <p style="color: #666;">Use the Download button to save the sound file.</p>
                </div>
            `;
            assetBinary.classList.remove('hidden');
        }
    }
}

function displayFilmLoop(asset) {
    const member = asset.member;

    assetInfo.innerHTML += `<p><strong>Type:</strong> Film Loop (animated sequence)</p>`;

    if (member.specificData && member.specificData.length >= 4) {
        const bytes = toUint8Array(member.specificData);
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

        try {
            // Film loop specific data
            if (bytes.length >= 2) {
                const frameCount = view.getUint16(0, false);
                assetInfo.innerHTML += `<p><strong>Frames:</strong> ${frameCount}</p>`;
            }
        } catch (e) {
            console.error('Error parsing film loop:', e);
        }
    }

    displayBinaryData(asset);
}

function displayBinaryData(asset) {
    const member = asset.member;

    if (!member.specificData || member.specificData.length === 0) {
        assetBinary.innerHTML = '<p>No specific data available</p>';
        assetBinary.classList.remove('hidden');
        return;
    }

    const bytes = toUint8Array(member.specificData);
    displayHexDump(bytes, 512);
}

function displayHexDump(bytes, maxBytes) {
    const limit = Math.min(bytes.length, maxBytes);
    let html = '';

    for (let i = 0; i < limit; i += 16) {
        const offset = i.toString(16).padStart(6, '0');
        let hexPart = '';
        let asciiPart = '';

        for (let j = 0; j < 16; j++) {
            if (i + j < limit) {
                const byte = bytes[i + j];
                hexPart += byte.toString(16).padStart(2, '0') + ' ';
                asciiPart += (byte >= 32 && byte < 127) ? String.fromCharCode(byte) : '.';
            } else {
                hexPart += '   ';
            }
        }

        html += `<div class="hex-row">
            <span class="hex-offset">${offset}</span>
            <span class="hex-bytes">${hexPart}</span>
            <span class="hex-ascii">${asciiPart}</span>
        </div>`;
    }

    if (bytes.length > maxBytes) {
        html += `<div class="hex-row"><span class="hex-offset">...</span><span class="hex-bytes">${bytes.length - maxBytes} more bytes</span></div>`;
    }

    assetBinary.innerHTML = html;
    assetBinary.classList.remove('hidden');
}

function copyCode() {
    const code = codeDisplay.textContent;
    if (code) {
        navigator.clipboard.writeText(code).then(() => {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyBtn.textContent = originalText;
            }, 1500);
        }).catch(err => {
            console.error('Failed to copy:', err);
        });
    }
}

function downloadAsset() {
    if (!selectedAsset) return;

    const member = selectedAsset.member;
    let data = null;
    let filename = selectedAsset.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    let mimeType = 'application/octet-stream';

    // Try to get the actual asset data
    if (selectedAsset.dataChunkId) {
        const chunkFourCCs = {
            [MemberType.kBitmapMember]: FOURCC('B', 'I', 'T', 'D'),
            [MemberType.kSoundMember]: FOURCC('s', 'n', 'd', ' '),
            [MemberType.kTextMember]: FOURCC('S', 'T', 'X', 'T'),
        };

        const fourCC = chunkFourCCs[selectedAsset.type];
        if (fourCC && currentDirFile.chunkExists(fourCC, selectedAsset.dataChunkId)) {
            try {
                const chunkData = currentDirFile.getChunkData(fourCC, selectedAsset.dataChunkId);
                data = toUint8Array(chunkData);

                // Set appropriate extension
                switch (selectedAsset.type) {
                    case MemberType.kBitmapMember:
                        filename += '.bitd';
                        break;
                    case MemberType.kSoundMember:
                        // Use detected format if available
                        if (selectedAsset.soundFormat) {
                            filename += selectedAsset.soundFormat.ext;
                            mimeType = selectedAsset.soundFormat.mimeType;
                        } else {
                            // Detect format from data
                            const formatInfo = detectSoundFormat(data);
                            filename += formatInfo.ext;
                            mimeType = formatInfo.mimeType;
                        }
                        break;
                    case MemberType.kTextMember:
                        filename += '.txt';
                        mimeType = 'text/plain';
                        break;
                }
            } catch (e) {
                console.error('Error getting asset data:', e);
            }
        }
    }

    // Fall back to specific data if no chunk data
    if (!data && member.specificData) {
        data = toUint8Array(member.specificData);
        filename += '.dat';
    }

    if (!data) {
        alert('No data available for download');
        return;
    }

    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function downloadFile() {
    if (!currentFile || !currentFileBuffer) return;

    const blob = new Blob([currentFileBuffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function clearFile() {
    currentFile = null;
    currentFileBuffer = null;
    currentDirFile = null;
    scripts = [];
    assets = [];
    selectedScript = null;
    selectedAsset = null;

    fileInput.value = '';
    scriptList.innerHTML = '';
    assetList.innerHTML = '';
    codeDisplay.textContent = '';
    currentScriptName.textContent = 'Select a script';
    currentAssetName.textContent = 'Select an asset';
    copyBtn.classList.add('hidden');
    downloadAssetBtn.classList.add('hidden');
    assetInfo.innerHTML = '';
    assetCanvas.classList.add('hidden');
    assetText.classList.add('hidden');
    assetBinary.classList.add('hidden');

    hideFileInfo();
    hideContent();
    hideError();

    // Reset to scripts tab
    switchTab('scripts');
}

// UI visibility helpers
function showLoading() {
    loadingSection.classList.remove('hidden');
}

function hideLoading() {
    loadingSection.classList.add('hidden');
}

function showError(message) {
    errorMessage.textContent = message;
    errorSection.classList.remove('hidden');
}

function hideError() {
    errorSection.classList.add('hidden');
}

function dismissError() {
    hideError();
}

function showContent() {
    contentSection.classList.remove('hidden');
}

function hideContent() {
    contentSection.classList.add('hidden');
}

function showFileInfo(name) {
    fileName.textContent = name;
    downloadBtn.classList.remove('hidden');
    fileInfo.classList.remove('hidden');
    dropZone.classList.add('hidden');
}

function hideFileInfo() {
    fileInfo.classList.add('hidden');
    dropZone.classList.remove('hidden');
}

// Utility
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Start the application
init();
