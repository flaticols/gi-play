export class ExplorePanel extends HTMLElement {
    constructor() {
        super();
        this._sessionID = null;
        this._data = null;
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
                    overflow: auto;
                    padding: 12px;
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

                /* Tree view styles */
                .ep-tree {
                    font-family: var(--font-mono);
                    font-size: 13px;
                    line-height: 1.6;
                }

                .ep-node {
                    margin-bottom: 4px;
                }

                .ep-node-header {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 8px;
                    background: var(--bg-surface);
                    border: 1px solid var(--border);
                    border-radius: var(--radius);
                    cursor: pointer;
                    transition: all var(--transition);
                }

                .ep-node-header:hover {
                    background: var(--bg-hover);
                    border-color: var(--border-bright);
                }

                .ep-node-toggle {
                    width: 16px;
                    color: var(--text-muted);
                    font-size: 10px;
                    flex-shrink: 0;
                }

                .ep-node-label {
                    color: var(--accent);
                    font-weight: 500;
                }

                .ep-node-type {
                    color: var(--text-muted);
                    font-size: 11px;
                }

                .ep-node-children {
                    margin-left: 20px;
                    padding-left: 12px;
                    border-left: 1px solid var(--border);
                    margin-top: 4px;
                }

                .ep-field {
                    display: flex;
                    align-items: baseline;
                    gap: 8px;
                    padding: 4px 8px;
                    font-size: 12px;
                }

                .ep-field-name {
                    color: var(--text-secondary);
                    min-width: 100px;
                }

                .ep-field-type {
                    color: var(--text-muted);
                    font-size: 11px;
                }

                .ep-field-value {
                    color: var(--text-primary);
                    word-break: break-all;
                }

                .ep-field-value.string {
                    color: #a5d6a7;
                }

                .ep-field-value.number {
                    color: #90caf9;
                }

                .ep-field-value.bool {
                    color: #ffab91;
                }

                .ep-expandable {
                    color: var(--accent);
                    cursor: pointer;
                    text-decoration: underline;
                    text-decoration-style: dotted;
                }

                .ep-expandable:hover {
                    text-decoration-style: solid;
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
        this.loadData();
    }

    close() {
        this.classList.remove('visible');
        this._sessionID = null;
        this._data = null;
    }

    showLoading() {
        this.querySelector('#explorer-content').innerHTML = `
            <div class="ep-loading">
                <div class="ep-spinner"></div>
                <span>Loading...</span>
            </div>
        `;
    }

    async loadData() {
        this.showLoading();
        try {
            const res = await fetch(`/explore/${this._sessionID}/`, {
                headers: { 'Accept': 'application/json' }
            });
            if (!res.ok) {
                throw new Error('Failed to load data');
            }
            this._data = await res.json();
            this.renderTree();
        } catch (e) {
            this.querySelector('#explorer-content').innerHTML = `
                <div class="ep-empty">Failed to load: ${e.message}</div>
            `;
        }
    }

    renderTree() {
        const content = this.querySelector('#explorer-content');

        if (!this._data?.rows?.length) {
            content.innerHTML = '<div class="ep-empty">No variables to explore</div>';
            return;
        }

        let html = '<div class="ep-tree">';

        for (const row of this._data.rows) {
            for (const cell of row.cells) {
                html += this.renderNode(cell);
            }
        }

        html += '</div>';
        content.innerHTML = html;

        // Attach toggle handlers
        content.querySelectorAll('.ep-node-header').forEach(header => {
            header.addEventListener('click', () => {
                const node = header.closest('.ep-node');
                const children = node.querySelector('.ep-node-children');
                const toggle = header.querySelector('.ep-node-toggle');
                if (children) {
                    const isHidden = children.style.display === 'none';
                    children.style.display = isHidden ? 'block' : 'none';
                    toggle.textContent = isHidden ? '▼' : '▶';
                }
            });
        });

        // Attach drill-down handlers for expandable fields
        content.querySelectorAll('.ep-expandable').forEach(el => {
            el.addEventListener('click', async (e) => {
                e.stopPropagation();
                const key = el.dataset.key;
                const row = parseInt(el.dataset.row);
                const col = parseInt(el.dataset.col);
                await this.drillDown(row, col, key);
            });
        });
    }

    renderNode(cell) {
        const hasFields = cell.fields && cell.fields.length > 0;

        let html = `
            <div class="ep-node">
                <div class="ep-node-header">
                    <span class="ep-node-toggle">${hasFields ? '▼' : ''}</span>
                    <span class="ep-node-label">${this.escapeHtml(cell.label)}</span>
                    <span class="ep-node-type">${this.escapeHtml(cell.type)}</span>
                </div>
        `;

        if (hasFields) {
            html += '<div class="ep-node-children">';
            for (const field of cell.fields) {
                html += this.renderField(field, cell.row, cell.column);
            }
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    renderField(field, row, col) {
        const isExpandable = this.isExpandableType(field.type);
        const valueClass = this.getValueClass(field.type, field.value);

        let valueHtml;
        if (isExpandable) {
            valueHtml = `<span class="ep-expandable" data-key="${this.escapeHtml(field.key)}" data-row="${row}" data-col="${col}">${this.escapeHtml(field.value)}</span>`;
        } else {
            valueHtml = `<span class="ep-field-value ${valueClass}">${this.escapeHtml(field.value)}</span>`;
        }

        return `
            <div class="ep-field">
                <span class="ep-field-name">${this.escapeHtml(field.label)}</span>
                <span class="ep-field-type">${this.escapeHtml(field.type)}</span>
                ${valueHtml}
            </div>
        `;
    }

    isExpandableType(type) {
        if (!type) return false;
        // Types that can be drilled into
        return type.includes('struct') ||
               type.includes('Struct') ||
               type.includes('map[') ||
               type.includes('[]') ||
               type.startsWith('*');
    }

    getValueClass(type, value) {
        if (!type) return '';
        if (type === 'string' || value?.startsWith('"')) return 'string';
        if (type === 'int' || type === 'int64' || type === 'float64' || /^\d+$/.test(value)) return 'number';
        if (type === 'bool' || value === 'true' || value === 'false') return 'bool';
        return '';
    }

    async drillDown(row, col, key) {
        try {
            // Send POST to structexplorer to navigate
            const res = await fetch(`/explore/${this._sessionID}/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    row: row,
                    column: col,
                    selections: [key],
                    action: 'down'
                })
            });

            if (res.ok) {
                // Reload data to show new state
                await this.loadData();
            }
        } catch (e) {
            console.error('Drill-down failed:', e);
        }
    }

    escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }
}

customElements.define('explore-panel', ExplorePanel);
