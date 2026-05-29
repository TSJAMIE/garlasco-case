let cyInstance = null;
let databaseNodi = null;

// Inizializzazione dell'applicazione al caricamento del DOM
document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================
    // GESTIONE DISCLAIMER INIZIALE
    // ==========================================
    const disclaimerBtn = document.getElementById('disclaimer-confirm-btn');
    if (disclaimerBtn) {
        disclaimerBtn.addEventListener('click', () => {
            const disclaimer = document.getElementById('disclaimer-overlay');
            if (disclaimer) {
                disclaimer.style.opacity = '0';
                disclaimer.style.visibility = 'hidden';
                
                // Rimozoine dall'albero di rendering al termine della transizione CSS
                setTimeout(() => {
                    disclaimer.style.display = 'none';
                }, 600);
            }
        });
    }

    // ==========================================
    // CARICAMENTO COSTRUTTI E DATI
    // ==========================================
    fetch('data.json')
        .then(response => {
            if (!response.ok) {
                throw new Error("Impossibile leggere il file data.json");
            }
            return response.json();
        })
        .then(data => {
            databaseNodi = data;
            document.getElementById('node-2007').addEventListener('click', () => avviaTransizione('2007'));
            document.getElementById('node-2017').addEventListener('click', () => avviaTransizione('2017'));
            document.getElementById('node-2025').addEventListener('click', () => avviaTransizione('2025'));
        })
        .catch(error => console.error("Errore critico di caricamento dati:", error));

    // Eventi dell'interfaccia utente
    document.getElementById('change-epoch-btn').addEventListener('click', resetApertura);
    document.getElementById('close-dossier-btn').addEventListener('click', chiudiDossier);
    document.getElementById('open-timeline-btn').addEventListener('click', apriTimeline);
    document.getElementById('close-timeline-btn').addEventListener('click', chiudiTimeline);
    document.getElementById('audio-toggle-btn').addEventListener('click', toggleAudio);
});

// ==========================================
// SFONDO ANIMATO (PARTICELLE)
// ==========================================
const canvas = document.getElementById('particle-canvas');
if (canvas) {
    const ctx = canvas.getContext('2d');
    let particles = [];

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    class Particle {
        // Logica della classe Particle rimasta invariata
    }

    function initParticles() {
        for (let i = 0; i < 40; i++) { particles.push(new Particle()); }
    }
    function animateParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => { p.update(); p.draw(); });
        requestAnimationFrame(animateParticles);
    }
    initParticles();
    animateParticles();
}

// ==========================================
// LOGICA DEI DIALOGHI E DEL GRAFO
// ==========================================

function avviaTransizione(anno) {
    const musica = document.getElementById('bg-music');
    if (musica) {
        musica.volume = 0.4; 
        musica.play().catch(error => {
            console.log("Riproduzione automatica limitata o file audio mancante:", error);
        });
    }

    const overlay = document.getElementById('portal-overlay');
    overlay.style.transform = 'scale(1.2)';
    overlay.style.opacity = '0';
    
    setTimeout(() => {
        overlay.style.display = 'none';
        document.getElementById('open-timeline-btn').style.display = 'flex';
        document.getElementById('audio-toggle-btn').style.display = 'block';
        
        caricaEpoca(anno);
    }, 800);
}

function caricaEpoca(anno) {
    if (!databaseNodi || !databaseNodi.characters) return;
    
    document.getElementById('active-year-label').innerText = anno;

    const nodiFiltrati = databaseNodi.characters
        .filter(char => char.timeline && char.timeline[anno])
        .map(char => {
            const datiAnno = char.timeline[anno];
            
            return {
                group: 'nodes',
                data: {
                    id: char.id,
                    label: char.label,
                    type: datiAnno.type,
                    time: datiAnno.time,
                    eta: datiAnno.eta || 'N/A',       
                    status: datiAnno.status || 'N/A', 
                    luogo: datiAnno.luogo || 'N/A',   
                    info: datiAnno.info,
                    foto_mappa: datiAnno.foto_mappa || '', 
                    nodeType: datiAnno.nodeType || 'standard'
                },
                position: datiAnno.position ? { x: datiAnno.position.x, y: datiAnno.position.y } : { x: 100, y: 100 }
            };
        });

    const archiAnno = (databaseNodi.links && databaseNodi.links[anno]) ? databaseNodi.links[anno] : [];
    
    const archiConCurva = archiAnno.map(edge => {
        if (!edge.data) edge.data = {};
        edge.data.curvaDinamica = Math.floor(Math.random() * 40) + 20;
        return edge;
    });

    const elementiGrafo = [...nodiFiltrati, ...archiConCurva];

    cyInstance = cytoscape({
        container: document.getElementById('cy'),
        elements: elementiGrafo,
        zoomingEnabled: true,
        panningEnabled: true,
        boxSelectionEnabled: false,
        autounselectify: true,
        autoungrabify: true, 
        minZoom: 0.3,
        maxZoom: 2.0,

        style: [
            {
                selector: 'node[nodeType="standard"]',
                style: {
                    'shape': 'rectangle',
                    'width': '90px',
                    'height': '120px',
                    'background-color': '#222',
                    'background-opacity': 0.5,
                    'border-width': 1,
                    'border-color': '#444',
                    'label': 'data(label)',
                    'text-valign': 'bottom',
                    'text-halign': 'center',
                    'text-margin-y': 8,
                    'color': '#f1ef75',
                    'text-opacity': 0.7,
                    'font-family': 'Courier New, monospace',
                    'font-size': '9px',
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
                    'background-opacity': 1,
                    'border-width': 0
                }
            },
            {
                selector: 'node[nodeType="point"]',
                style: {
                    'shape': 'ellipse',
                    'background-color': 'rgba(255, 255, 255, 0.4)',
                    'width': '6px',
                    'height': '6px',
                    'label': 'data(label)',
                    'color': '#c5ac1f',
                    'text-opacity': 0.4,
                    'font-family': 'Courier New, monospace',
                    'font-size': '8px',
                    'text-valign': 'top',
                    'text-margin-y': -6
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 2.5,
                    'curve-style': 'bezier',
                    'control-point-step-size': 'data(curvaDinamica)',
                    'target-arrow-shape': 'none', 
                    'line-color': '#d3c82a',
                    'line-opacity': 0.8,
                    'line-style': 'dashed',
                    'line-cap': 'round',
                    'line-dash-pattern': [1, 15],
                    'line-dash-offset': 0
                }
            },
            { selector: 'edge[edgeType="connessione"]', style: { 'line-color': '#ffffff', 'line-opacity': 0.7 } },
            { selector: 'edge[edgeType="evidenza"]', style: { 'line-color': '#d4af37', 'line-opacity': 0.9 } },
            { selector: 'edge[edgeType="cronologia"]', style: { 'line-color': '#888888', 'line-opacity': 0.5 } }
        ],

        layout: {
            name: 'preset', 
            padding: 40,
            animate: true,
            animationDuration: 500
        }
    });

    cyInstance.ready(() => {
        cyInstance.fit();
        cyInstance.zoom(cyInstance.zoom() * 0.85);

        let offset = 0;
        let tempo = 0;

        function animateEdges() {
            if (!cyInstance || cyInstance.destroyed()) return;
            
            tempo += 0.03; 
            const passoDinamico = -0.5 + (Math.sin(tempo) * 0.2);
            offset += passoDinamico; 

            cyInstance.edges().style('line-dash-offset', offset);
            requestAnimationFrame(animateEdges);
        }
        animateEdges();
    });

    cyInstance.on('tap', 'node', (evt) => {
        const nodeData = evt.target.data();
        const panel = document.getElementById('dossier-panel');
        
        panel.style.display = 'block';
        document.getElementById('dossier-name').innerText = nodeData.label;
        document.getElementById('meta-type').innerText = nodeData.type || 'N/A';
        document.getElementById('meta-type').style.color = '#ffffff';
        document.getElementById('meta-time').innerText = nodeData.time || 'N/A';
        document.getElementById('meta-eta').innerText = nodeData.eta || 'N/A';
        document.getElementById('meta-status').innerText = nodeData.status || 'N/A';
        document.getElementById('meta-luogo').innerText = nodeData.luogo || 'N/A';
        document.getElementById('dossier-desc').innerText = nodeData.info || '';

        const charRecord = databaseNodi.characters.find(char => char.id === nodeData.id);
        const annoAttivo = document.getElementById('active-year-label').innerText;
        
        let sfondoDossier = null;
        if (charRecord && charRecord.timeline && charRecord.timeline[annoAttivo]) {
            sfondoDossier = charRecord.timeline[annoAttivo].sfondo_dossier;
        }
        
        if (sfondoDossier) {
            panel.style.setProperty('--bg-immagine', `url('${sfondoDossier}')`);
        } else {
            panel.style.removeProperty('--bg-immagine');
        }

        const dossierEventsContainer = document.getElementById('dossier-events-container');
        dossierEventsContainer.innerHTML = '';
        
        if (charRecord && charRecord.timeline && charRecord.timeline[annoAttivo]) {
            const datiAnnoSelezionato = charRecord.timeline[annoAttivo];
            
            if (datiAnnoSelezionato.events && datiAnnoSelezionato.events.length > 0) {
                datiAnnoSelezionato.events.forEach(ev => {
                    const evDiv = document.createElement('div');
                    evDiv.style.marginBottom = '15px';
                    evDiv.style.borderLeft = '2px solid #d4af37';
                    evDiv.style.paddingLeft = '10px';
                    evDiv.innerHTML = `
                        <div style="font-size:10px; color:#d4af37;">${ev.data}</div>
                        <div style="font-size:12px; color:#fff; margin:2px 0;">${ev.titolo}</div>
                        <div style="font-size:11px; color:#aaa;">${ev.descrizione}</div>
                    `;
                    dossierEventsContainer.appendChild(evDiv);
                });
            } else {
                dossierEventsContainer.innerHTML = '<div style="font-size:11px; color:#555;">Nessun evento specifico collegato a questo crono-record.</div>';
            }
        }
    });

    cyInstance.on('tap', (evt) => {
        if(evt.target === cyInstance){ chiudiDossier(); }
    });

    popolaTimeline(anno);
}

function popolaTimeline(anno) {
    const container = document.getElementById('timeline-events-container');
    container.innerHTML = '';
    
    if (!databaseNodi || !databaseNodi.events || !databaseNodi.events[anno]) {
        container.innerHTML = '<div class="metadata-line">Nessun evento registrato per questa epoca.</div>';
        return;
    }

    databaseNodi.events[anno].forEach(ev => {
        const evDiv = document.createElement('div');
        evDiv.style.marginBottom = '15px';
        evDiv.style.borderLeft = '2px solid #d4af37';
        evDiv.style.paddingLeft = '10px';
        evDiv.innerHTML = `
            <div style="font-size:10px; color:#d4af37;">${ev.data}</div>
            <div style="font-size:12px; color:#fff; margin:2px 0;">${ev.titolo}</div>
            <div style="font-size:11px; color:#aaa;">${ev.descrizione}</div>
        `;
        container.appendChild(evDiv);
    });
}

function toggleAudio() {
    const musica = document.getElementById('bg-music');
    const btn = document.getElementById('audio-toggle-btn');
    if (!musica) return;

    if (musica.muted) {
        musica.muted = false;
        btn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
        btn.title = "Disattiva Audio";
    } else {
        musica.muted = true;
        btn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
        btn.title = "Attiva Audio";
    }
}

function apriTimeline() {
    document.getElementById('timeline-panel').style.display = 'block';
}

function chiudiTimeline() {
    document.getElementById('timeline-panel').style.display = 'none';
}

function chiudiDossier() {
    document.getElementById('dossier-panel').style.display = 'none';
}

function resetApertura() {
    chiudiDossier();
    chiudiTimeline();
    if(cyInstance) { cyInstance.destroy(); }
    
    const musica = document.getElementById('bg-music');
    if (musica) {
        musica.pause();
        musica.currentTime = 0;
        musica.muted = false;
    }

    const audioBtn = document.getElementById('audio-toggle-btn');
    audioBtn.style.display = 'none';
    audioBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';

    document.getElementById('open-timeline-btn').style.display = 'none';
    const overlay = document.getElementById('portal-overlay');
    overlay.style.display = 'flex';
    setTimeout(() => { 
        overlay.style.transform = 'scale(1)';
        overlay.style.opacity = '1'; 
    }, 50);
}