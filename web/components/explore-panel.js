export class ExplorePanel extends HTMLElement {
    constructor() {
        super();
        this._sessionID = null;
    }

    connectedCallback() {
        this.render();
        this.setupListeners();
    }

    render() {
        this.innerHTML = `
            <div class="ep-container">
                <div class="ep-header">
                    <span class="ep-title">Variable Explorer</span>
                    <button class="ep-close" id="close-explorer">&times;</button>
                </div>
                <div class="ep-content" id="explorer-content">
                    <div class="ep-empty">Run code with variables to explore</div>
                </div>
            </div>
        `;

        if (!document.getElementById('explore-panel-styles')) {
            const style = document.createElement('style');
            style.id = 'explore-panel-styles';
            style.textContent = `
                explore-panel {
                    display: none;
                    position: absolute;
                    inset: 0;
                    z-index: 10;
                    background: var(--bg-base);
                }

                explore-panel.visible {
                    display: grid;
                    grid-template-rows: 1fr;
                }

                .ep-container {
                    display: grid;
                    grid-template-rows: 40px 1fr;
                    min-height: 0;
                    overflow: hidden;
                }

                .ep-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 12px;
                    background: var(--bg-surface);
                    border-bottom: 1px solid var(--border);
                }

                .ep-title {
                    font-family: var(--font-sans);
                    font-size: 13px;
                    font-weight: 500;
                    color: var(--text-primary);
                }

                .ep-close {
                    width: 28px;
                    height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: none;
                    border: none;
                    color: var(--text-muted);
                    font-size: 18px;
                    cursor: pointer;
                    border-radius: var(--radius);
                    transition: all var(--transition);
                }

                .ep-close:hover {
                    background: var(--bg-hover);
                    color: var(--text-primary);
                }

                .ep-content {
                    display: grid;
                    min-height: 0;
                    overflow: hidden;
                }

                .ep-empty {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--text-muted);
                    font-family: var(--font-sans);
                    font-size: 13px;
                }

                .ep-loading {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    color: var(--text-secondary);
                    font-family: var(--font-sans);
                }

                .ep-spinner {
                    width: 14px;
                    height: 14px;
                    border: 2px solid var(--border);
                    border-top-color: var(--accent);
                    border-radius: 50%;
                    animation: ep-spin 0.8s linear infinite;
                }

                @keyframes ep-spin {
                    to { transform: rotate(360deg); }
                }

                .ep-iframe {
                    width: 100%;
                    height: 100%;
                    border: none;
                }

                .ep-vars {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    padding: 12px;
                    overflow: auto;
                }

                .ep-var {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 10px 12px;
                    background: var(--bg-surface);
                    border: 1px solid var(--border);
                    border-radius: var(--radius);
                }

                .ep-var-info {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .ep-var-name {
                    font-family: var(--font-mono);
                    font-size: 13px;
                    color: var(--text-primary);
                }

                .ep-var-type {
                    font-family: var(--font-mono);
                    font-size: 11px;
                    color: var(--text-muted);
                }

                .ep-var-btn {
                    padding: 6px 12px;
                    font-family: var(--font-sans);
                    font-size: 12px;
                    font-weight: 500;
                    background: var(--bg-elevated);
                    color: var(--text-secondary);
                    border: 1px solid var(--border);
                    border-radius: var(--radius);
                    cursor: pointer;
                    transition: all var(--transition);
                }

                .ep-var-btn:hover {
                    background: var(--accent);
                    color: var(--bg-base);
                    border-color: var(--accent);
                }
            `;
            document.head.appendChild(style);
        }
    }

    setupListeners() {
        this.querySelector('#close-explorer').addEventListener('click', () => {
            this.close();
        });
    }

    open(sessionID) {
        this._sessionID = sessionID;
        this.classList.add('visible');
        this.showExplorer();
    }

    close() {
        this.classList.remove('visible');
        this._sessionID = null;
    }

    showLoading() {
        this.querySelector('#explorer-content').innerHTML = `
            <div class="ep-loading">
                <div class="ep-spinner"></div>
                <span>Loading explorer...</span>
            </div>
        `;
    }

    showExplorer() {
        // Load structexplorer in iframe
        this.querySelector('#explorer-content').innerHTML = `
            <iframe
                src="/explore/${this._sessionID}/"
                class="ep-iframe"
                frameborder="0">
            </iframe>
        `;
    }

    async loadVariables() {
        this.showLoading();
        try {
            const res = await fetch(`/api/explore/${this._sessionID}/vars`);
            if (!res.ok) {
                throw new Error('Failed to load variables');
            }
            const data = await res.json();
            this.renderVariableList(data.variables);
        } catch (e) {
            this.querySelector('#explorer-content').innerHTML = `
                <div class="ep-empty">Failed to load variables: ${e.message}</div>
            `;
        }
    }

    renderVariableList(variables) {
        if (!variables || variables.length === 0) {
            this.querySelector('#explorer-content').innerHTML = `
                <div class="ep-empty">No explorable variables found</div>
            `;
            return;
        }

        let html = '<div class="ep-vars">';
        for (const v of variables) {
            html += `
                <div class="ep-var">
                    <div class="ep-var-info">
                        <span class="ep-var-name">${v.name}</span>
                        <span class="ep-var-type">${v.type || 'unknown'}</span>
                    </div>
                    <button class="ep-var-btn" data-name="${v.name}">Explore</button>
                </div>
            `;
        }
        html += '</div>';

        this.querySelector('#explorer-content').innerHTML = html;

        // Attach click handlers
        this.querySelectorAll('.ep-var-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.showExplorer();
            });
        });
    }
}

customElements.define('explore-panel', ExplorePanel);
