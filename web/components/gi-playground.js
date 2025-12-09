import { CodeEditor } from './code-editor.js';
import { OutputPanel } from './output-panel.js';

const DEFAULT_CODE = `package main

import "fmt"

func main() {
    fmt.Println("Hello, gi playground!")

    for i := 1; i <= 5; i++ {
        fmt.Printf("Count: %d\\n", i)
    }
}
`;

class GiPlayground extends HTMLElement {
    constructor() {
        super();
        this._shareId = null;
    }

    connectedCallback() {
        this.render();
        this.setupListeners();
        this.loadFromURL();
    }

    render() {
        this.innerHTML = `
            <header class="pg-header">
                <div class="pg-brand">
                    <a href="https://github.com/emicklei/gi" target="_blank" class="pg-logo">gi</a>
                    <span class="pg-sep">/</span>
                    <a href="https://github.com/flaticols/gi-play" target="_blank" class="pg-title">playground</a>
                </div>
                <div class="pg-actions">
                    <span class="pg-version" id="version"></span>
                    <button class="pg-btn" id="share">
                        <span class="pg-btn-text">Share</span>
                    </button>
                    <button class="pg-btn pg-btn-run" id="run">
                        <span class="pg-btn-icon">▶</span>
                        <span class="pg-btn-text">Run</span>
                        <kbd>⌘↵</kbd>
                    </button>
                </div>
            </header>

            <main class="pg-main">
                <code-editor id="editor"></code-editor>
                <div class="pg-gutter"></div>
                <output-panel id="output"></output-panel>
            </main>

            <dialog id="share-dialog">
                <div class="dialog-header">
                    <span class="dialog-title">Share snippet</span>
                    <button class="dialog-close" id="dialog-close">×</button>
                </div>
                <div class="dialog-body">
                    <div class="dialog-section">
                        <label class="dialog-label">Link</label>
                        <div class="dialog-input-wrap">
                            <input type="text" readonly id="share-url" class="dialog-input">
                            <button class="dialog-copy" data-target="share-url">Copy</button>
                        </div>
                    </div>
                    <div class="dialog-section">
                        <label class="dialog-label">Embed</label>
                        <div class="dialog-input-wrap">
                            <input type="text" readonly id="embed-code" class="dialog-input">
                            <button class="dialog-copy" data-target="embed-code">Copy</button>
                        </div>
                        <div class="dialog-preview">
                            <iframe id="embed-preview" frameborder="0"></iframe>
                        </div>
                    </div>
                </div>
            </dialog>
        `;

        this.injectStyles();
    }

    injectStyles() {
        if (document.getElementById('gi-playground-styles')) return;

        const style = document.createElement('style');
        style.id = 'gi-playground-styles';
        style.textContent = `
            gi-playground {
                display: grid;
                grid-template-rows: 48px 1fr;
                height: 100vh;
                overflow: hidden;
            }

            /* Header */
            .pg-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0 16px;
                background: var(--bg-surface);
                border-bottom: 1px solid var(--border);
            }

            .pg-brand {
                display: flex;
                align-items: center;
                gap: 8px;
                font-family: var(--font-mono);
            }

            .pg-logo {
                font-weight: 600;
                font-size: 16px;
                color: var(--accent);
                text-decoration: none;
            }

            .pg-logo:hover {
                text-decoration: underline;
            }

            .pg-sep {
                color: var(--text-muted);
            }

            .pg-title {
                color: var(--text-secondary);
                font-size: 14px;
                text-decoration: none;
            }

            .pg-title:hover {
                text-decoration: underline;
            }

            /* Actions */
            .pg-actions {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .pg-version {
                font-family: var(--font-mono);
                font-size: 11px;
                color: var(--text-muted);
            }

            .pg-btn {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 6px 12px;
                font-family: var(--font-sans);
                font-size: 13px;
                font-weight: 500;
                background: var(--bg-elevated);
                color: var(--text-secondary);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                cursor: pointer;
                transition: all var(--transition);
            }

            .pg-btn:hover {
                background: var(--bg-hover);
                color: var(--text-primary);
                border-color: var(--border-bright);
            }

            .pg-btn-run {
                background: var(--bg-elevated);
                color: var(--text-primary);
                border-color: var(--border-bright);
            }

            .pg-btn-run .pg-btn-icon {
                color: var(--accent);
                font-size: 10px;
            }

            .pg-btn-run:hover {
                background: var(--bg-hover);
            }

            .pg-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .pg-btn kbd {
                font-family: var(--font-mono);
                font-size: 10px;
                padding: 2px 4px;
                background: var(--bg-base);
                border-radius: 2px;
                color: var(--text-muted);
            }

            /* Main layout */
            .pg-main {
                display: grid;
                grid-template-columns: 1fr 1px 1fr;
                min-height: 0;
                overflow: hidden;
            }

            .pg-gutter {
                background: var(--border);
            }

            /* Dialog */
            .dialog-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 12px 16px;
                border-bottom: 1px solid var(--border);
            }

            .dialog-title {
                font-weight: 600;
                font-size: 14px;
            }

            .dialog-close {
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: none;
                border: none;
                color: var(--text-muted);
                font-size: 18px;
                cursor: pointer;
                border-radius: var(--radius);
            }

            .dialog-close:hover {
                background: var(--bg-hover);
                color: var(--text-primary);
            }

            .dialog-body {
                padding: 16px;
                display: flex;
                flex-direction: column;
                gap: 16px;
            }

            .dialog-section {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }

            .dialog-label {
                font-size: 12px;
                font-weight: 500;
                color: var(--text-muted);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .dialog-input-wrap {
                display: flex;
                gap: 8px;
            }

            .dialog-preview {
                margin-top: 8px;
                border: 1px solid var(--border);
                border-radius: var(--radius);
                overflow: hidden;
                background: var(--bg-base);
            }

            .dialog-preview iframe {
                display: block;
                width: 100%;
                height: 200px;
                border: none;
            }

            .dialog-input {
                flex: 1;
                padding: 8px 10px;
                font-family: var(--font-mono);
                font-size: 12px;
                background: var(--bg-base);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                color: var(--text-primary);
            }

            .dialog-input:focus {
                outline: none;
                border-color: var(--accent);
            }

            .dialog-copy {
                padding: 8px 16px;
                font-family: var(--font-sans);
                font-size: 13px;
                font-weight: 500;
                background: var(--accent);
                color: var(--bg-base);
                border: none;
                border-radius: var(--radius);
                cursor: pointer;
                transition: background var(--transition);
            }

            .dialog-copy:hover {
                background: var(--accent-dim);
            }

            .dialog-copy.copied {
                background: var(--success);
            }

            /* Responsive */
            @media (max-width: 768px) {
                .pg-main {
                    grid-template-columns: 1fr;
                    grid-template-rows: 1fr 1px 1fr;
                }

                .pg-gutter {
                    width: 100%;
                }

                .pg-btn kbd {
                    display: none;
                }
            }
        `;
        document.head.appendChild(style);
    }

    setupListeners() {
        this.editor = this.querySelector('#editor');
        this.output = this.querySelector('#output');
        this.runBtn = this.querySelector('#run');
        this.shareBtn = this.querySelector('#share');
        this.dialog = this.querySelector('#share-dialog');
        this.shareUrlInput = this.querySelector('#share-url');
        this.embedCodeInput = this.querySelector('#embed-code');
        this.embedPreview = this.querySelector('#embed-preview');
        this.dialogClose = this.querySelector('#dialog-close');

        this.runBtn.addEventListener('click', () => this.run());
        this.shareBtn.addEventListener('click', () => this.share());
        this.editor.addEventListener('run-code', () => this.run());

        this.dialogClose.addEventListener('click', () => this.dialog.close());
        this.dialog.addEventListener('click', (e) => {
            if (e.target === this.dialog) this.dialog.close();
        });

        // Handle copy buttons
        this.dialog.querySelectorAll('.dialog-copy').forEach(btn => {
            btn.addEventListener('click', () => this.copyInput(btn));
        });

        // Load version
        this.loadVersion();
    }

    async loadVersion() {
        try {
            const res = await fetch('/api/version');
            if (res.ok) {
                const data = await res.json();
                this.querySelector('#version').textContent = data.gi_version;
            }
        } catch (e) {
            console.error('Failed to load version:', e);
        }
    }

    async loadFromURL() {
        // Support both /s/{id} path and ?s={id} query param
        const pathMatch = window.location.pathname.match(/^\/s\/([a-z0-9]+)$/i);
        const params = new URLSearchParams(window.location.search);
        const id = pathMatch ? pathMatch[1] : params.get('s');

        if (id) {
            this._shareId = id;
            try {
                const res = await fetch(`/api/s/${id}`);
                if (res.ok) {
                    const data = await res.json();
                    this.editor.value = data.code;
                    return;
                }
            } catch (e) {
                console.error('Failed to load snippet:', e);
            }
        }

        this.editor.value = DEFAULT_CODE;
    }

    async run() {
        const code = this.editor.value;
        if (!code.trim()) return;

        this.runBtn.disabled = true;
        this.output.clear();
        this.output.showLoading();

        try {
            const res = await fetch('/api/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
            });

            const result = await res.json();
            this.output.showResult(result);
        } catch (e) {
            this.output.showResult({
                error: `Network error: ${e.message}`,
                output: '',
                duration_ms: 0,
            });
        } finally {
            this.runBtn.disabled = false;
        }
    }

    async share() {
        const code = this.editor.value;
        if (!code.trim()) return;

        try {
            const res = await fetch('/api/share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
            });

            const data = await res.json();
            this._shareId = data.id;

            const url = `${window.location.origin}/s/${data.id}`;
            const embedUrl = `${window.location.origin}/embed/${data.id}`;
            const iframe = `<iframe src="${embedUrl}" width="100%" height="300" frameborder="0"></iframe>`;

            // Update URL persistently
            history.replaceState({}, '', `/s/${data.id}`);

            // Show dialog
            this.shareUrlInput.value = url;
            this.embedCodeInput.value = iframe;
            this.embedPreview.src = embedUrl;

            // Reset copy buttons
            this.dialog.querySelectorAll('.dialog-copy').forEach(btn => {
                btn.textContent = 'Copy';
                btn.classList.remove('copied');
            });

            this.dialog.showModal();
            this.shareUrlInput.select();
        } catch (e) {
            this.output.showMessage(`Failed to share: ${e.message}`);
        }
    }

    async copyInput(btn) {
        const targetId = btn.dataset.target;
        const input = this.querySelector(`#${targetId}`);

        try {
            await navigator.clipboard.writeText(input.value);
            btn.textContent = 'Copied!';
            btn.classList.add('copied');
            setTimeout(() => {
                btn.textContent = 'Copy';
                btn.classList.remove('copied');
            }, 2000);
        } catch {
            input.select();
        }
    }
}

customElements.define('gi-playground', GiPlayground);
