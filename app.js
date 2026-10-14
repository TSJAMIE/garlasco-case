let cyInstance = null;
let miniCyInstance = null;      // istanza del mini-grafo di navigazione
let databaseNodi = null;
let currentEpoch = null;
let charPositions = {};

document.addEventListener('DOMContentLoaded', () => {
    // Disclaimer
    const disclaimerBtn = document.getElementById('disclaimer-confirm-btn');
    if (disclaimerBtn) {
        disclaimerBtn.addEventListener('click', () => {
            const overlay = document.getElementById('disclaimer-overlay');
            overlay.style.opacity = '0';
            overlay.style.visibility = 'hidden';
            setTimeout(() => { overlay.style.display = 'none'; }, 700);
        });
    }

    // Caricamento dati (4 file JSON separati)
    Promise.all([
        fetch('data/characters.json').then(r => { if (!r.ok) throw new Error('Impossibile caricare characters.json'); return r.json(); }),
        fetch('data/positions.json').then(r =>  { if (!r.ok) throw new Error('Impossibile caricare positions.json');  return r.json(); }),
        fetch('data/events.json').then(r =>     { if (!r.ok) throw new Error('Impossibile caricare events.json');     return r.json(); }),
        fetch('data/links.json').then(r =>      { if (!r.ok) throw new Error('Impossibile caricare links.json');      return r.json(); })
    ])
        .then(([characters, positions, events, links]) => {
            databaseNodi = { characters, positions, events, links };
            loadPositions();

            const startCard = document.getElementById('start-investigation');
            if (startCard) {
                startCard.addEventListener('click', () => avviaTransizione('2007'));
            }

            document.querySelectorAll('.dial-item').forEach(item => {
                item.addEventListener('click', () => switchEpoch(item.dataset.year));
            });
        })
        .catch(err => console.error('Errore caricamento dati:', err));

    // Controlli UI
    document.getElementById('change-epoch-btn').addEventListener('click', resetApertura);
    document.getElementById('close-dossier-btn').addEventListener('click', chiudiDossier);
    document.getElementById('open-timeline-btn').addEventListener('click', apriTimeline);
    document.getElementById('close-timeline-btn').addEventListener('click', chiudiTimeline);
    document.getElementById('audio-toggle-btn').addEventListener('click', toggleAudio);

    const exportBtn = document.getElementById('export-positions-btn');
    if (exportBtn) exportBtn.addEventListener('click', esportaPosizioni);

    // Scorciatoie da tastiera
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            chiudiDossier();
            chiudiTimeline();
        }
    });

    // Rebuild mini-graph al resize (solo se aperto)
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (miniCyInstance && !miniCyInstance.destroyed()) {
                miniCyInstance.resize();
                miniCyInstance.fit(undefined, 24);
            }
        }, 150);
    });
});

// ===== POSIZIONI =====
// Le posizioni sono GLOBALI per personaggio (blocco in positions.json).
// La presenza di un personaggio in una data epoca è decisa dalla presenza
// della chiave timeline[anno] dentro characters.json.
function loadPositions() {
    if (databaseNodi && databaseNodi.positions) {
        charPositions = JSON.parse(JSON.stringify(databaseNodi.positions));
        console.log('📦 Posizioni globali caricate da positions.json');
        return;
    }
    const saved = localStorage.getItem('garlasco_positions');
    if (saved) {
        try {
            charPositions = JSON.parse(saved);
            console.log('💾 Posizioni caricate da localStorage');
            return;
        } catch (e) { console.warn('localStorage corrotto.'); }
    }
    charPositions = {};
    console.warn('⚠️ Nessuna posizione trovata. Uso default (0,0).');
}

function savePositions() {
    localStorage.setItem('garlasco_positions', JSON.stringify(charPositions));
}

function esportaPosizioni() {
    const json = JSON.stringify(charPositions, null, 2);
    console.log('===== COPIA QUESTO IN positions.json =====');
    console.log(json);
    if (navigator.clipboard) {
        navigator.clipboard.writeText(json)
            .then(() => console.log('✅ Copiato negli appunti!'))
            .catch(() => console.log('⚠️ Copia manuale dalla console.'));
    }
    alert('Posizioni esportate! Controlla la console (F12) — già copiate negli appunti.');
}

// ===== TRANSIZIONE =====
function avviaTransizione(anno) {
    const musica = document.getElementById('bg-music');
    if (musica) {
        musica.volume = 0.4;
        musica.play().catch(e => console.warn('Audio non riprodotto:', e));
    }
    const overlay = document.getElementById('portal-overlay');
    overlay.style.transform = 'scale(1.12)';
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';

    setTimeout(() => {
        overlay.style.display = 'none';
        const main = document.getElementById('main-interface');
        main.style.display = 'block';
        document.getElementById('open-timeline-btn').style.display = 'flex';
        document.getElementById('audio-toggle-btn').style.display = 'block';
        caricaEpoca(anno);
    }, 750);
}

// ===== COSTRUZIONE ELEMENTI =====
function buildElements(anno) {
    if (!databaseNodi || !databaseNodi.characters) return [];

    const nodiFiltrati = databaseNodi.characters
        .filter(char => char.timeline && char.timeline[anno])
        .map(char => {
            const dati = char.timeline[anno];
            const p = charPositions[char.id];
            const posizione = (p && typeof p.x === 'number' && typeof p.y === 'number')
                ? { x: p.x, y: p.y }
                : { x: 0, y: 0 };

            return {
                group: 'nodes',
                data: {
                    id: char.id,
                    label: char.label,
                    type: dati.type || 'N/A',
                    time: dati.time || 'N/A',
                    eta: dati.eta || 'N/A',
                    status: dati.status || 'N/A',
                    luogo: dati.luogo || 'N/A',
                    info: dati.info || '',
                    foto_mappa: dati.foto_mappa || '',
                    nodeType: dati.nodeType || 'standard'
                },
                position: posizione
            };
        });

    const archi = (databaseNodi.links && databaseNodi.links[anno]) ? databaseNodi.links[anno] : [];
    const archiConCurva = archi.map(e => ({
        group: 'edges',
        data: {
            ...e.data,
            id: `${anno}-${e.data.id}`,
            curvaDinamica: Math.floor(Math.random() * 40) + 20
        }
    }));

    return [...nodiFiltrati, ...archiConCurva];
}

// ===== CARICAMENTO INIZIALE =====
function caricaEpoca(anno) {
    if (!databaseNodi || !databaseNodi.characters) return;
    currentEpoch = anno;
    document.getElementById('active-year-label').innerText = anno;
    updateDialActive(anno);

    const elementi = buildElements(anno);

    cyInstance = cytoscape({
        container: document.getElementById('cy'),
        elements: elementi,
        zoomingEnabled: true,
        panningEnabled: true,
        boxSelectionEnabled: false,
        autounselectify: true,
        autoungrabify: false,
        minZoom: 0.3,
        maxZoom: 2.0,
        style: [
            {
                selector: 'node[nodeType="standard"]',
                style: {
                    'shape': 'round-rectangle',
                    'width': '95px',
                    'height': '118px',
                    'border-radius': '10px',
                    'background-color': '#14141a',
                    'background-opacity': 0.95,
                    'border-width': 1.5,
                    'border-color': 'rgba(255,255,255,0.12)',
                    'label': 'data(label)',
                    'text-valign': 'bottom',
                    'text-halign': 'center',
                    'text-margin-y': 10,
                    'color': '#e8d166',
                    'text-opacity': 0.95,
                    'font-family': 'Inter, sans-serif',
                    'font-size': '9px',
                    'font-weight': 600,
                    'text-transform': 'uppercase',
                    'text-wrap': 'wrap',
                    'text-max-width': '100px',
                    'overlay-opacity': 0,
                    'shadow-blur': 26,
                    'shadow-color': '#000',
                    'shadow-opacity': 0.7,
                    'shadow-offset-x': 0,
                    'shadow-offset-y': 6
                }
            },
            {
                selector: 'node[foto_mappa][foto_mappa != ""]',
                style: {
                    'background-image': 'data(foto_mappa)',
                    'background-fit': 'cover',
                    'background-position-x': '50%',
                    'background-position-y': '20%',
                    'background-opacity': 1,
                    'background-color': '#0a0a0a',
                    'border-width': 2,
                    'border-color': 'rgba(212,175,55,0.7)',
                    'border-radius': '10px'
                }
            },
            {
                selector: 'node[nodeType="point"]',
                style: {
                    'shape': 'ellipse',
                    'background-color': 'rgba(255,255,255,0.3)',
                    'width': '8px', 'height': '8px',
                    'label': 'data(label)',
                    'color': '#c5ac1f', 'text-opacity': 0.5,
                    'font-family': 'Inter, sans-serif',
                    'font-size': '8px',
                    'text-valign': 'top', 'text-margin-y': -8,
                    'shadow-blur': 12,
                    'shadow-color': '#d4af37',
                    'shadow-opacity': 0.4,
                    'shadow-offset-x': 0,
                    'shadow-offset-y': 0
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 1.6,
                    'curve-style': 'bezier',
                    'control-point-step-size': 'data(curvaDinamica)',
                    'target-arrow-shape': 'none',
                    'line-color': '#d3c82a',
                    'line-opacity': 0.55,
                    'line-style': 'dashed',
                    'line-cap': 'round',
                    'line-dash-pattern': [2, 12],
                    'line-dash-offset': 0,
                    'shadow-blur': 6,
                    'shadow-color': '#d4af37',
                    'shadow-opacity': 0.35
                }
            },
            {
                selector: 'edge[edgeType="connessione"]',
                style: { 'line-color': '#ffffff', 'line-opacity': 0.4 }
            },
            {
                selector: 'edge[edgeType="evidenza"]',
                style: {
                    'line-color': '#d4af37',
                    'line-opacity': 0.85,
                    'line-dash-pattern': [0]
                }
            }
        ],
        layout: { name: 'preset', padding: 60, animate: false }
    });

    cyInstance.ready(() => {
        cyInstance.fit();
        cyInstance.zoom(cyInstance.zoom() * 0.85);

        let offset = 0;
        let tempo = 0;
        function animateEdges() {
            if (!cyInstance || cyInstance.destroyed()) return;
            tempo += 0.02;
            offset += -0.3 + Math.sin(tempo) * 0.1;
            cyInstance.edges().style('line-dash-offset', offset);
            requestAnimationFrame(animateEdges);
        }
        animateEdges();
    });

    cyInstance.on('free', 'node', (evt) => {
        const node = evt.target;
        const id = node.id();
        const pos = node.position();
        charPositions[id] = { x: Math.round(pos.x), y: Math.round(pos.y) };
        savePositions();
        console.log(`📍 ${id} → { x: ${Math.round(pos.x)}, y: ${Math.round(pos.y)} }`);
    });

    cyInstance.on('tap', 'node', (evt) => {
        apriDossier(evt.target.data('id'));
    });

    cyInstance.on('tap', (evt) => {
        if (evt.target === cyInstance) chiudiDossier();
    });

    popolaTimeline(anno);
}

// ===== CAMBIO EPOCA =====
function switchEpoch(anno) {
    if (!cyInstance || cyInstance.destroyed()) return;
    if (anno === currentEpoch) return;
    if (!databaseNodi) return;

    const cy = cyInstance;
    const newElements = buildElements(anno);
    const newNodes = newElements.filter(el => el.group === 'nodes');
    const newEdges = newElements.filter(el => el.group === 'edges');

    const newNodeIds = new Set(newNodes.map(n => n.data.id));
    const newEdgeIds = new Set(newEdges.map(e => e.data.id));

    cy.edges().forEach(e => {
        if (!newEdgeIds.has(e.id())) {
            e.animate({ style: { opacity: 0 } },
                { duration: 300, complete: () => { if (e.cy()) e.remove(); } });
        }
    });

    cy.nodes().forEach(n => {
        if (!newNodeIds.has(n.id())) {
            n.animate({ style: { opacity: 0 } },
                { duration: 300, complete: () => { if (n.cy()) n.remove(); } });
        }
    });

    const currentNodeIds = new Set(cy.nodes().map(n => n.id()));
    const nodesToAdd = newNodes.filter(n => !currentNodeIds.has(n.data.id));

    if (nodesToAdd.length > 0) {
        const added = cy.add(nodesToAdd);
        added.style('opacity', 0);
        added.animate({ style: { opacity: 1 } }, { duration: 550 });
    }

    newNodes.forEach(n => {
        if (currentNodeIds.has(n.data.id)) {
            const node = cy.getElementById(n.data.id);
            if (node.length > 0) {
                node.data(n.data);
                if (n.position) {
                    node.position({ x: n.position.x, y: n.position.y });
                }
            }
        }
    });

    setTimeout(() => {
        if (!cyInstance || cyInstance.destroyed()) return;
        const currentEdgeIds = new Set(cyInstance.edges().map(e => e.id()));
        const edgesToAdd = newEdges.filter(e => !currentEdgeIds.has(e.data.id));
        if (edgesToAdd.length > 0) {
            const added = cyInstance.add(edgesToAdd);
            added.style('opacity', 0);
            added.animate({ style: { opacity: 1 } }, { duration: 550 });
        }
    }, 320);

    currentEpoch = anno;
    document.getElementById('active-year-label').innerText = anno;
    updateDialActive(anno);
    popolaTimeline(anno);
    chiudiDossier();
}

// ===== ROTELLA =====
function updateDialActive(anno) {
    document.querySelectorAll('.dial-item').forEach(item => {
        item.classList.toggle('active', item.dataset.year === anno);
    });
}

// ===== TIMELINE =====
function popolaTimeline(anno) {
    const container = document.getElementById('timeline-events-container');
    container.innerHTML = '';
    if (!databaseNodi || !databaseNodi.events || !databaseNodi.events[anno]) {
        container.innerHTML = '<div class="event-item" style="color:#666;font-size:12px;border-left-color:#333;">Nessun evento registrato per questa epoca.</div>';
        return;
    }
    databaseNodi.events[anno].forEach(ev => {
        const div = document.createElement('div');
        div.className = 'event-item';
        div.innerHTML = `
            <div class="event-date">${ev.data}</div>
            <div class="event-title">${ev.titolo}</div>
            <div class="event-desc">${ev.descrizione}</div>
        `;
        container.appendChild(div);
    });
}

// ===== DOSSIER =====
function apriDossier(nodeId) {
    const panel = document.getElementById('dossier-panel');
    panel.classList.add('open');
    panel.style.display = 'block';

    const charRecord = databaseNodi.characters.find(c => c.id === nodeId);
    if (!charRecord) return;

    const anno = currentEpoch;
    const dati = charRecord.timeline && charRecord.timeline[anno] ? charRecord.timeline[anno] : {};

    document.getElementById('dossier-name').innerText = charRecord.label || 'Sconosciuto';

    document.getElementById('meta-type').innerText = dati.type || 'N/A';
    document.getElementById('meta-time').innerText = dati.time || 'N/A';
    document.getElementById('meta-eta').innerText = dati.eta || 'N/A';
    document.getElementById('meta-status').innerText = dati.status || 'N/A';
    document.getElementById('meta-luogo').innerText = dati.luogo || 'N/A';
    document.getElementById('dossier-desc').innerText = dati.info || 'Nessuna informazione disponibile.';

    const container = document.getElementById('dossier-events-container');
    container.innerHTML = '';
    if (dati.events && dati.events.length > 0) {
        dati.events.forEach(ev => {
            const div = document.createElement('div');
            div.className = 'event-item';
            div.innerHTML = `
                <div class="event-date">${ev.data}</div>
                <div class="event-title">${ev.titolo}</div>
                <div class="event-desc">${ev.descrizione}</div>
            `;
            container.appendChild(div);
        });
    } else {
        container.innerHTML = '<div style="font-size:12px;color:#555;">Nessun evento specifico per questo soggetto.</div>';
    }

    // Mini-grafo di navigazione
    buildMiniGraph(nodeId);
    openMiniGraphPanel();
}

// ===== MINI-GRAFO DI NAVIGAZIONE =====
function buildMiniGraph(centerId) {
    // Su schermi piccoli il pannello è nascosto via CSS: skip build
    if (window.innerWidth <= 1024) return;

    const container = document.getElementById('mini-cy');
    const emptyEl = document.getElementById('mini-graph-empty');
    const countEl = document.getElementById('mini-graph-count');
    if (!container) return;

    // Reset
    if (miniCyInstance && !miniCyInstance.destroyed()) {
        miniCyInstance.destroy();
        miniCyInstance = null;
    }
    emptyEl.style.display = 'none';
    countEl.innerText = '0';

    if (!databaseNodi || !databaseNodi.links || !databaseNodi.links[currentEpoch]) {
        emptyEl.style.display = 'flex';
        return;
    }

    // Trova i collegamenti diretti del personaggio nell'epoca corrente
    const links = databaseNodi.links[currentEpoch];
    const connectedIds = new Set();
    links.forEach(link => {
        const { source, target } = link.data;
        if (source === centerId) connectedIds.add(target);
        else if (target === centerId) connectedIds.add(source);
    });

    // Filtra solo i personaggi realmente presenti nell'epoca corrente
    const epochChars = databaseNodi.characters.filter(
        c => c.timeline && c.timeline[currentEpoch]
    );
    const epochCharMap = new Map(epochChars.map(c => [c.id, c]));

    const validConnections = [...connectedIds].filter(id => epochCharMap.has(id));

    if (validConnections.length === 0) {
        emptyEl.style.display = 'flex';
        return;
    }

    // Costruzione elementi mini-grafo
    const centerChar = epochCharMap.get(centerId);
    const nodes = [{
        data: {
            id: centerId,
            label: (centerChar && centerChar.label) || centerId,
            isCenter: true,
            foto_mappa: (centerChar && centerChar.timeline[currentEpoch].foto_mappa) || ''
        }
    }];

    validConnections.forEach(otherId => {
        const char = epochCharMap.get(otherId);
        if (!char) return;
        const dati = char.timeline[currentEpoch];
        nodes.push({
            data: {
                id: otherId,
                label: char.label || otherId,
                foto_mappa: dati.foto_mappa || ''
            }
        });
    });

    const edges = validConnections.map(otherId => ({
        data: {
            id: `mini-${centerId}-${otherId}`,
            source: centerId,
            target: otherId
        }
    }));

    countEl.innerText = String(validConnections.length);

    miniCyInstance = cytoscape({
        container: container,
        elements: [...nodes, ...edges],
        autounselectify: true,
        userZoomingEnabled: false,
        userPanningEnabled: false,
        boxSelectionEnabled: false,
        wheelSensitivity: 0,
        style: [
            {
                selector: 'node',
                style: {
                    'width': 46,
                    'height': 46,
                    'shape': 'ellipse',
                    'background-color': '#16161d',
                    'background-opacity': 0.95,
                    'border-width': 1.5,
                    'border-color': 'rgba(255,255,255,0.18)',
                    'label': 'data(label)',
                    'font-size': '7px',
                    'font-weight': 600,
                    'font-family': 'Inter, sans-serif',
                    'color': '#d9c964',
                    'text-valign': 'bottom',
                    'text-halign': 'center',
                    'text-margin-y': 5,
                    'text-wrap': 'wrap',
                    'text-max-width': '62px',
                    'text-transform': 'uppercase',
                    'overlay-opacity': 0,
                    'transition-property': 'border-color, border-width',
                    'transition-duration': '200ms',
                    'shadow-blur': 14,
                    'shadow-color': '#000',
                    'shadow-opacity': 0.6,
                    'shadow-offset-x': 0,
                    'shadow-offset-y': 3
                }
            },
            {
                selector: 'node[foto_mappa][foto_mappa != ""]',
                style: {
                    'background-image': 'data(foto_mappa)',
                    'background-fit': 'cover',
                    'background-position-x': '50%',
                    'background-position-y': '20%',
                    'background-opacity': 1,
                    'background-color': '#0a0a0a'
                }
            },
            {
                selector: 'node[isCenter]',
                style: {
                    'width': 62,
                    'height': 62,
                    'border-width': 2.5,
                    'border-color': '#d4af37',
                    'font-size': '8px',
                    'color': '#f0c94a',
                    'text-max-width': '80px',
                    'shadow-blur': 24,
                    'shadow-color': '#d4af37',
                    'shadow-opacity': 0.55,
                    'shadow-offset-y': 0
                }
            },
            {
                selector: 'node:active',
                style: {
                    'border-color': '#f0c94a',
                    'border-width': 2
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 1.2,
                    'curve-style': 'straight',
                    'line-color': '#d3c82a',
                    'line-opacity': 0.5,
                    'line-style': 'dashed',
                    'line-dash-pattern': [3, 5],
                    'shadow-blur': 4,
                    'shadow-color': '#d4af37',
                    'shadow-opacity': 0.25
                }
            }
        ],
        layout: {
            name: 'concentric',
            concentric: (node) => node.data('isCenter') ? 2 : 1,
            levelWidth: () => 1,
            minNodeSpacing: 28,
            padding: 30,
            animate: false
        }
    });

    // Click su un nodo del mini-grafo → apri il suo dossier
    miniCyInstance.on('tap', 'node', (evt) => {
        const id = evt.target.data('id');
        if (id && id !== centerId) {
            apriDossier(id);
        }
    });

    // Cursore pointer sui nodi
    miniCyInstance.on('mouseover', 'node', () => {
        container.style.cursor = 'pointer';
    });
    miniCyInstance.on('mouseout', 'node', () => {
        container.style.cursor = 'default';
    });

    miniCyInstance.ready(() => {
        miniCyInstance.fit(undefined, 24);
    });
}

function openMiniGraphPanel() {
    if (window.innerWidth <= 1024) return;
    const panel = document.getElementById('mini-graph-panel');
    if (!panel) return;
    panel.setAttribute('aria-hidden', 'false');
    // rAF per garantire che il layout sia pronto prima della transizione
    requestAnimationFrame(() => {
        panel.classList.add('open');
        // resize per sicurezza dopo l'apertura
        if (miniCyInstance && !miniCyInstance.destroyed()) {
            setTimeout(() => {
                if (miniCyInstance && !miniCyInstance.destroyed()) {
                    miniCyInstance.resize();
                    miniCyInstance.fit(undefined, 24);
                }
            }, 520);
        }
    });
}

function closeMiniGraphPanel() {
    const panel = document.getElementById('mini-graph-panel');
    if (!panel) return;
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    // Distruggi dopo la transizione
    setTimeout(() => {
        if (miniCyInstance && !miniCyInstance.destroyed()) {
            miniCyInstance.destroy();
            miniCyInstance = null;
        }
    }, 500);
}

// ===== UI =====
function toggleAudio() {
    const audio = document.getElementById('bg-music');
    const btn = document.getElementById('audio-toggle-btn');
    if (!audio) return;
    audio.muted = !audio.muted;
    btn.innerHTML = audio.muted
        ? '<i class="fa-solid fa-volume-xmark"></i>'
        : '<i class="fa-solid fa-volume-high"></i>';
    btn.title = audio.muted ? 'Attiva Audio' : 'Disattiva Audio';
}

function apriTimeline() {
    const panel = document.getElementById('timeline-panel');
    panel.style.display = 'block';
    setTimeout(() => panel.classList.add('open'), 10);
}

function chiudiTimeline() {
    const panel = document.getElementById('timeline-panel');
    panel.classList.remove('open');
    setTimeout(() => { panel.style.display = 'none'; }, 500);
}

function chiudiDossier() {
    const panel = document.getElementById('dossier-panel');
    panel.classList.remove('open');
    setTimeout(() => { panel.style.display = 'none'; }, 500);

    // Chiudi anche il mini-grafo
    closeMiniGraphPanel();
}

function resetApertura() {
    chiudiDossier();
    chiudiTimeline();

    if (miniCyInstance && !miniCyInstance.destroyed()) {
        miniCyInstance.destroy();
        miniCyInstance = null;
    }
    if (cyInstance) { cyInstance.destroy(); cyInstance = null; }
    currentEpoch = null;

    const audio = document.getElementById('bg-music');
    if (audio) { audio.pause(); audio.currentTime = 0; audio.muted = false; }
    const btn = document.getElementById('audio-toggle-btn');
    btn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
    btn.title = 'Disattiva Audio';
    btn.style.display = 'none';
    document.getElementById('open-timeline-btn').style.display = 'none';
    document.getElementById('main-interface').style.display = 'none';

    const overlay = document.getElementById('portal-overlay');
    overlay.style.display = 'flex';
    overlay.style.opacity = '1';
    overlay.style.transform = 'scale(1)';
    overlay.style.pointerEvents = 'auto';

    document.querySelectorAll('.dial-item').forEach(el => el.classList.remove('active'));
}