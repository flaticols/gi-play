import { CodeEditor } from './code-editor.js';
import { OutputPanel } from './output-panel.js';

class GiEmbed extends HTMLElement {
    constructor() {
        super();
        this._snippetId = null;
    }

    connectedCallback() {
        this.render();
        this.setupListeners();
        this.loadSnippet();
    }

    render() {
        this.innerHTML = `
            <div class="embed-container">
                <div class="embed-header">
                    <span class="embed-logo">gi</span>
                    <button class="embed-run" id="run">
                        <span class="embed-run-icon">▶</span>
                        Run
                    </button>
                </div>
                <div class="embed-editor">
                    <code-editor id="editor"></code-editor>
                </div>
                <div class="embed-output" id="output-wrap">
                    <output-panel id="output"></output-panel>
                </div>
            </div>
        `;

        this.injectStyles();
    }

    injectStyles() {
        if (document.getElementById('gi-embed-styles')) return;

        const style = document.createElement('style');
        style.id = 'gi-embed-styles';
        style.textContent = `
            gi-embed {
                display: flex;
                flex: 1;
                min-height: 0;
                min-width: 0;
            }

            .embed-container {
                display: flex;
                flex-direction: column;
                flex: 1;
                overflow: hidden;
                background: var(--bg-base);
            }

            .embed-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0 12px;
                height: 36px;
                background: var(--bg-surface);
                border-bottom: 1px solid var(--border);
            }

            .embed-logo {
                font-family: var(--font-mono);
                font-weight: 600;
                font-size: 14px;
                color: var(--accent);
            }

            .embed-run {
                display: flex;
                align-items: center;
                gap: 5px;
                padding: 4px 10px;
                font-family: var(--font-sans);
                font-size: 12px;
                font-weight: 500;
                background: var(--bg-elevated);
                color: var(--text-primary);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                cursor: pointer;
                transition: all var(--transition);
            }

            .embed-run:hover {
                background: var(--bg-hover);
                border-color: var(--border-bright);
            }

            .embed-run:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .embed-run-icon {
                color: var(--accent);
                font-size: 9px;
            }

            .embed-editor {
                flex: 1;
                display: flex;
                min-height: 80px;
            }

            .embed-output {
                border-top: 1px solid var(--border);
                background: var(--bg-surface);
                max-height: 120px;
                overflow: auto;
            }

            .embed-output.hidden {
                display: none;
            }

            .embed-output output-panel {
                display: block;
            }

            .embed-output .op-container {
                padding: 8px 12px;
                min-height: auto;
            }

            .embed-output .op-empty {
                display: none;
            }
        `;
        document.head.appendChild(style);
    }

    setupListeners() {
        this.editor = this.querySelector('#editor');
        this.output = this.querySelector('#output');
        this.outputWrap = this.querySelector('#output-wrap');
        this.runBtn = this.querySelector('#run');

        this.runBtn.addEventListener('click', () => this.run());
        this.editor.addEventListener('run-code', () => this.run());

        // Hide output initially
        this.outputWrap.classList.add('hidden');
    }

    async loadSnippet() {
        // Support both /embed/{id} path and ?s={id} query param
        const pathMatch = window.location.pathname.match(/^\/embed\/([a-z0-9]+)$/i);
        const params = new URLSearchParams(window.location.search);
        const id = pathMatch ? pathMatch[1] : params.get('s');

        if (id) {
            this._snippetId = id;
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

        this.editor.value = `package main

import "fmt"

func main() {
    fmt.Println("Hello, gi!")
}
`;
    }

    async run() {
        const code = this.editor.value;
        if (!code.trim()) return;

        this.runBtn.disabled = true;
        this.outputWrap.classList.remove('hidden');
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
}

customElements.define('gi-embed', GiEmbed);
