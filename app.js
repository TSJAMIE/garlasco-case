let cyInstance = null;
let databaseNodi = null;
let currentEpoch = null;
let charPositions = {};

document.addEventListener('DOMContentLoaded', () => {
    const disclaimerBtn = document.getElementById('disclaimer-confirm-btn');
    if (disclaimerBtn) {
        disclaimerBtn.addEventListener('click', () => {
            const overlay = document.getElementById('disclaimer-overlay');
            overlay.style.opacity = '0';
            overlay.style.visibility = 'hidden';
            setTimeout(() => { overlay.style.display = 'none'; }, 600);
        });
    }

    fetch('data.json')
        .then(r => {
            if (!r.ok) throw new Error('Impossibile caricare data.json');
            return r.json();
        })
        .then(data => {
            databaseNodi = data;
            loadPositions();

            const startCard = document.getElementById('start-investigation');
            if (startCard) {
                startCard.addEventListener('click', () => avviaTransizione('2007'));
            }

            document.querySelectorAll('.dial-item').forEach(item => {
                item.addEventListener('click', () => {
                    switchEpoch(item.dataset.year);
                });
            });
        })
        .catch(err => console.error('Errore caricamento dati:', err));

    document.getElementById('change-epoch-btn').addEventListener('click', resetApertura);
    document.getElementById('close-dossier-btn').addEventListener('click', chiudiDossier);
    document.getElementById('open-timeline-btn').addEventListener('click', apriTimeline);
    document.getElementById('close-timeline-btn').addEventListener('click', chiudiTimeline);
    document.getElementById('audio-toggle-btn').addEventListener('click', toggleAudio);

    const exportBtn = document.getElementById('export-positions-btn');
    if (exportBtn) exportBtn.addEventListener('click', esportaPosizioni);
});

// ===== POSIZIONI =====
// Nota: la priorità è data da `position` dentro la scheda del personaggio (timeline[anno].position).
// charPositions serve solo come FALLBACK per i personaggi che non hanno una position nella timeline.
function loadPositions() {
    // Fallback 1: blocco "positions" globale in data.json
    if (databaseNodi && databaseNodi.positions) {
        charPositions = JSON.parse(JSON.stringify(databaseNodi.positions));
        console.log('📦 Fallback posizioni da data.json (blocco positions)');
        return;
    }
    // Fallback 2: localStorage (drag salvati in passato)
    const saved = localStorage.getItem('garlasco_positions');
    if (saved) {
        try {
            charPositions = JSON.parse(saved);
            console.log('💾 Fallback posizioni da localStorage');
            return;
        } catch(e) { console.warn('localStorage corrotto.'); }
    }
    // Fallback 3: primo timeline con position disponibile
    if (databaseNodi && databaseNodi.characters) {
        databaseNodi.characters.forEach(c => {
            if (!c.timeline) return;
            for (const anno of Object.keys(c.timeline)) {
                const p = c.timeline[anno].position;
                if (p) { charPositions[c.id] = { x: p.x, y: p.y }; break; }
            }
        });
        console.log('📋 Fallback posizioni dai timeline.');
    }
}

function savePositions() {
    localStorage.setItem('garlasco_positions', JSON.stringify(charPositions));
}

function esportaPosizioni() {
    const json = JSON.stringify(charPositions, null, 2);
    console.log('===== COPIA QUESTO IN data.json SOTTO LA CHIAVE "positions" =====');
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
    overlay.style.transform = 'scale(1.15)';
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';

    setTimeout(() => {
        overlay.style.display = 'none';
        const main = document.getElementById('main-interface');
        main.style.display = 'block';
        document.getElementById('open-timeline-btn').style.display = 'flex';
        document.getElementById('audio-toggle-btn').style.display = 'block';
        caricaEpoca(anno);
    }, 700);
}

// ===== COSTRUZIONE ELEMENTI =====
function buildElements(anno) {
    if (!databaseNodi || !databaseNodi.characters) return [];

    const nodiFiltrati = databaseNodi.characters
        .filter(char => char.timeline && char.timeline[anno])
        .map(char => {
            const dati = char.timeline[anno];

            // PRIORITÀ: 1) position nella scheda del personaggio (per quell'anno)
            //           2) charPositions (fallback da data.json.positions o localStorage)
            //           3) 0,0
            let posizione;
            if (dati.position && typeof dati.position.x === 'number' && typeof dati.position.y === 'number') {
                posizione = { x: dati.position.x, y: dati.position.y };
            } else if (charPositions[char.id]) {
                posizione = { x: charPositions[char.id].x, y: charPositions[char.id].y };
            } else {
                posizione = { x: 0, y: 0 };
            }

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
                    'border-radius': '8px',
                    'background-color': '#1a1a1a',
                    'background-opacity': 0.9,
                    'border-width': 2,
                    'border-color': '#444',
                    'label': 'data(label)',
                    'text-valign': 'bottom',
                    'text-halign': 'center',
                    'text-margin-y': 10,
                    'color': '#f1ef75',
                    'text-opacity': 0.9,
                    'font-family': 'Inter, sans-serif',
                    'font-size': '9px',
                    'font-weight': 600,
                    'text-transform': 'uppercase',
                    'text-wrap': 'wrap',
                    'text-max-width': '100px',
                    'overlay-opacity': 0
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
                    'border-color': 'var(--glow-gold)',
                    'border-radius': '8px'
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
                    'text-valign': 'top', 'text-margin-y': -8
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 2,
                    'curve-style': 'bezier',
                    'control-point-step-size': 'data(curvaDinamica)',
                    'target-arrow-shape': 'none',
                    'line-color': '#d3c82a',
                    'line-opacity': 0.6,
                    'line-style': 'dashed',
                    'line-cap': 'round',
                    'line-dash-pattern': [2, 12],
                    'line-dash-offset': 0
                }
            },
            {
                selector: 'edge[edgeType="connessione"]',
                style: { 'line-color': '#ffffff', 'line-opacity': 0.5 }
            },
            {
                selector: 'edge[edgeType="evidenza"]',
                style: { 'line-color': '#d4af37', 'line-opacity': 0.8, 'line-dash-pattern': [0] }
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

    // Aggiorna anche la POSIZIONE dei nodi già presenti (non solo i data)
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
        container.innerHTML = '<div class="event-item" style="color:#666;font-size:12px;">Nessun evento registrato per questa epoca.</div>';
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

// ===== DOSSIER (senza foto) =====
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
}

// ===== UI =====
function toggleAudio() {
    const audio = document.getElementById('bg-music');
    const btn = document.getElementById('audio-toggle-btn');
    if (!audio) return;
    audio.muted = !audio.muted;
    btn.innerHTML = audio.muted ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-high"></i>';
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
    setTimeout(() => { panel.style.display = 'none'; }, 400);
}

function chiudiDossier() {
    const panel = document.getElementById('dossier-panel');
    panel.classList.remove('open');
    setTimeout(() => { panel.style.display = 'none'; }, 400);
}

function resetApertura() {
    chiudiDossier();
    chiudiTimeline();
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