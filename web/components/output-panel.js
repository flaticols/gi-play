export class OutputPanel extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.render();
    }

    render() {
        this.innerHTML = `
            <div class="op-container" id="content">
                <div class="op-empty">
                    <div class="op-empty-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="4 17 10 11 4 5"/>
                            <line x1="12" y1="19" x2="20" y2="19"/>
                        </svg>
                    </div>
                    <span>Run your code to see output</span>
                </div>
            </div>
        `;

        if (!document.getElementById('output-panel-styles')) {
            const style = document.createElement('style');
            style.id = 'output-panel-styles';
            style.textContent = `
                output-panel {
                    display: grid;
                    min-height: 0;
                    min-width: 0;
                    overflow: hidden;
                }

                .op-container {
                    display: flex;
                    flex-direction: column;
                    overflow: auto;
                    padding: 12px;
                    font-family: var(--font-mono);
                    font-size: 13px;
                    line-height: 1.6;
                    background: var(--bg-base);
                    min-height: 0;
                }

                .op-empty {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    flex: 1;
                    color: var(--text-muted);
                    font-family: var(--font-sans);
                    font-size: 13px;
                }

                .op-empty-icon {
                    opacity: 0.3;
                }

                .op-loading {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    color: var(--text-secondary);
                    font-family: var(--font-sans);
                }

                .op-spinner {
                    width: 14px;
                    height: 14px;
                    border: 2px solid var(--border);
                    border-top-color: var(--accent);
                    border-radius: 50%;
                    animation: op-spin 0.8s linear infinite;
                }

                @keyframes op-spin {
                    to { transform: rotate(360deg); }
                }

                .op-result {
                }

                .op-output {
                    white-space: pre-wrap;
                    word-break: break-word;
                    color: var(--text-primary);
                    padding: 12px;
                    background: var(--bg-surface);
                    border-radius: var(--radius);
                    border: 1px solid var(--border);
                }

                .op-error {
                    white-space: pre-wrap;
                    word-break: break-word;
                    color: var(--error);
                    padding: 12px;
                    background: rgba(239, 68, 68, 0.1);
                    border-radius: var(--radius);
                    border: 1px solid rgba(239, 68, 68, 0.2);
                    margin-top: 8px;
                }

                .op-success {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: var(--success);
                    padding: 12px;
                    background: rgba(34, 197, 94, 0.1);
                    border-radius: var(--radius);
                    border: 1px solid rgba(34, 197, 94, 0.2);
                }

                .op-success-icon {
                    flex-shrink: 0;
                }

                .op-meta {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-top: 12px;
                    padding-top: 12px;
                    border-top: 1px solid var(--border);
                    color: var(--text-muted);
                    font-size: 12px;
                    font-family: var(--font-sans);
                }

                .op-explore {
                    margin-top: 12px;
                }

                .op-explore-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 14px;
                    font-family: var(--font-sans);
                    font-size: 13px;
                    font-weight: 500;
                    background: var(--bg-elevated);
                    color: var(--text-primary);
                    border: 1px solid var(--border-bright);
                    border-radius: var(--radius);
                    cursor: pointer;
                    transition: all var(--transition);
                }

                .op-explore-btn:hover {
                    background: var(--accent);
                    color: var(--bg-base);
                    border-color: var(--accent);
                }

                .op-explore-icon {
                    font-size: 14px;
                }

                .op-explore-hint {
                    margin-top: 12px;
                    padding: 8px 12px;
                    font-family: var(--font-sans);
                    font-size: 12px;
                    color: var(--text-muted);
                    background: var(--bg-surface);
                    border-radius: var(--radius);
                    border: 1px dashed var(--border);
                }

                .op-explore-hint code {
                    font-family: var(--font-mono);
                    background: var(--bg-base);
                    padding: 2px 4px;
                    border-radius: 2px;
                }

                .op-message {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 12px;
                    background: var(--bg-surface);
                    border-radius: var(--radius);
                    border: 1px solid var(--border);
                    color: var(--text-primary);
                    font-family: var(--font-sans);
                    font-size: 13px;
                }

                .op-message-icon {
                    color: var(--accent);
                    flex-shrink: 0;
                }
            `;
            document.head.appendChild(style);
        }

        this.content = this.querySelector('#content');
    }

    clear() {
        this.content.innerHTML = '';
    }

    showLoading() {
        this.content.innerHTML = `
            <div class="op-loading">
                <div class="op-spinner"></div>
                <span>Running...</span>
            </div>
        `;
    }

    showResult(result) {
        let html = '<div class="op-result">';

        if (result.output) {
            html += `<div class="op-output">${this.escapeHtml(result.output)}</div>`;
        }

        if (result.error) {
            html += `<div class="op-error">${this.escapeHtml(result.error)}</div>`;
        }

        if (!result.output && !result.error) {
            html += `
                <div class="op-success">
                    <svg class="op-success-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span>Program completed successfully</span>
                </div>
            `;
        }

        // Add explore button if session available
        if (result.session_id && result.variables?.length > 0) {
            html += `
                <div class="op-explore">
                    <button class="op-explore-btn" data-session="${result.session_id}">
                        <span class="op-explore-icon">&#128269;</span>
                        <span>Explore Variables (${result.variables.length})</span>
                    </button>
                </div>
            `;
        } else if (!result.error) {
            html += `
                <div class="op-explore-hint">
                    Tip: Use <code>var x = ...</code> at package level to enable variable exploration
                </div>
            `;
        }

        html += `
            <div class="op-meta">
                <span>Executed in ${result.duration_ms}ms</span>
            </div>
        </div>`;

        this.content.innerHTML = html;

        // Attach explore handler
        const exploreBtn = this.content.querySelector('.op-explore-btn');
        if (exploreBtn) {
            exploreBtn.addEventListener('click', () => {
                this.dispatchEvent(new CustomEvent('open-explorer', {
                    bubbles: true,
                    detail: { sessionID: exploreBtn.dataset.session }
                }));
            });
        }
    }

    showMessage(msg) {
        this.content.innerHTML = `
            <div class="op-message">
                <svg class="op-message-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>${this.escapeHtml(msg)}</span>
            </div>
        `;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

customElements.define('output-panel', OutputPanel);
