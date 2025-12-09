// Monaco loader - loads Monaco from local /min/vs
let monacoLoadPromise = null;

async function loadMonaco() {
    if (monacoLoadPromise) return monacoLoadPromise;

    monacoLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '/min/vs/loader.js';
        script.onload = () => {
            window.require.config({
                paths: { vs: '/min/vs' }
            });
            window.require(['vs/editor/editor.main'], () => {
                resolve(window.monaco);
            });
        };
        script.onerror = reject;
        document.head.appendChild(script);
    });

    return monacoLoadPromise;
}

export class CodeEditor extends HTMLElement {
    constructor() {
        super();
        this._value = '';
        this._editor = null;
        this._monaco = null;
    }

    connectedCallback() {
        this.render();
        this.initMonaco();
    }

    disconnectedCallback() {
        if (this._editor) {
            this._editor.dispose();
            this._editor = null;
        }
    }

    get value() {
        if (this._editor) {
            return this._editor.getValue();
        }
        return this._value;
    }

    set value(v) {
        this._value = v;
        if (this._editor) {
            this._editor.setValue(v);
        }
    }

    render() {
        this.innerHTML = `
            <div class="ce-wrap">
                <div class="ce-loading" id="loading">Loading...</div>
                <div class="ce-editor" id="editor"></div>
            </div>
        `;

        if (!document.getElementById('code-editor-styles')) {
            const style = document.createElement('style');
            style.id = 'code-editor-styles';
            style.textContent = `
                code-editor {
                    display: grid;
                    min-height: 0;
                    min-width: 0;
                    overflow: hidden;
                }

                .ce-wrap {
                    display: grid;
                    position: relative;
                    background: var(--bg-base);
                    min-height: 0;
                    min-width: 0;
                    overflow: hidden;
                }

                .ce-loading {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-family: var(--font-mono);
                    font-size: 12px;
                    color: var(--text-muted);
                    background: var(--bg-base);
                    z-index: 1;
                }

                .ce-loading.hidden {
                    display: none;
                }

                .ce-editor {
                    width: 100%;
                    height: 100%;
                }
            `;
            document.head.appendChild(style);
        }
    }

    async initMonaco() {
        try {
            this._monaco = await loadMonaco();

            const editorContainer = this.querySelector('#editor');
            const loading = this.querySelector('#loading');

            // Dark theme - engineering, retro-modern
            this._monaco.editor.defineTheme('gi-dark', {
                base: 'vs-dark',
                inherit: true,
                rules: [
                    { token: 'comment', foreground: '555555', fontStyle: 'italic' },
                    { token: 'keyword', foreground: 'f59e0b' },
                    { token: 'string', foreground: '22c55e' },
                    { token: 'number', foreground: 'f59e0b' },
                    { token: 'type', foreground: '888888' },
                    { token: 'function', foreground: 'e8e8e8' },
                    { token: 'variable', foreground: 'e8e8e8' },
                ],
                colors: {
                    'editor.background': '#0a0a0a',
                    'editor.foreground': '#e8e8e8',
                    'editor.lineHighlightBackground': '#111111',
                    'editor.selectionBackground': '#f59e0b33',
                    'editor.inactiveSelectionBackground': '#f59e0b1a',
                    'editorLineNumber.foreground': '#333333',
                    'editorLineNumber.activeForeground': '#555555',
                    'editorCursor.foreground': '#f59e0b',
                    'editorWhitespace.foreground': '#1a1a1a',
                    'editorIndentGuide.background': '#1a1a1a',
                    'editorIndentGuide.activeBackground': '#262626',
                }
            });

            // Light theme
            this._monaco.editor.defineTheme('gi-light', {
                base: 'vs',
                inherit: true,
                rules: [
                    { token: 'comment', foreground: '888888', fontStyle: 'italic' },
                    { token: 'keyword', foreground: 'd97706' },
                    { token: 'string', foreground: '16a34a' },
                    { token: 'number', foreground: 'd97706' },
                    { token: 'type', foreground: '555555' },
                    { token: 'function', foreground: '1a1a1a' },
                    { token: 'variable', foreground: '1a1a1a' },
                ],
                colors: {
                    'editor.background': '#ffffff',
                    'editor.foreground': '#1a1a1a',
                    'editor.lineHighlightBackground': '#f5f5f5',
                    'editor.selectionBackground': '#f59e0b44',
                    'editor.inactiveSelectionBackground': '#f59e0b22',
                    'editorLineNumber.foreground': '#cccccc',
                    'editorLineNumber.activeForeground': '#888888',
                    'editorCursor.foreground': '#d97706',
                    'editorWhitespace.foreground': '#e5e5e5',
                    'editorIndentGuide.background': '#e5e5e5',
                    'editorIndentGuide.activeBackground': '#cccccc',
                }
            });

            // Detect system preference
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const theme = isDark ? 'gi-dark' : 'gi-light';

            this._editor = this._monaco.editor.create(editorContainer, {
                value: this._value,
                language: 'go',
                theme: theme,
                automaticLayout: true,
                minimap: { enabled: false },
                fontSize: 13,
                fontFamily: "'Recursive', 'SF Mono', monospace",
                fontLigatures: "'MONO' 1, 'CASL' 0",
                lineNumbers: 'on',
                lineHeight: 20,
                scrollBeyondLastLine: false,
                renderWhitespace: 'none',
                tabSize: 4,
                insertSpaces: false,
                wordWrap: 'off',
                folding: false,
                bracketPairColorization: { enabled: false },
                padding: { top: 12, bottom: 12 },
                smoothScrolling: false,
                cursorBlinking: 'solid',
                cursorStyle: 'block',
                renderLineHighlight: 'line',
                scrollbar: {
                    vertical: 'auto',
                    horizontal: 'auto',
                    verticalScrollbarSize: 8,
                    horizontalScrollbarSize: 8,
                },
            });

            this._editor.addCommand(
                this._monaco.KeyMod.CtrlCmd | this._monaco.KeyCode.Enter,
                () => {
                    this.dispatchEvent(new CustomEvent('run-code', { bubbles: true }));
                }
            );

            // Listen for system theme changes
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                this._monaco.editor.setTheme(e.matches ? 'gi-dark' : 'gi-light');
            });

            loading.classList.add('hidden');

        } catch (err) {
            console.error('Failed to load Monaco:', err);
            this.querySelector('#loading').textContent = 'Failed to load editor';
        }
    }

    focus() {
        if (this._editor) {
            this._editor.focus();
        }
    }
}

customElements.define('code-editor', CodeEditor);
