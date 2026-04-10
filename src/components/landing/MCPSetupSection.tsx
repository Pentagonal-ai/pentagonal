'use client';

import { useState, useCallback } from 'react';

const MCP_CONFIG_STDIO = `{
  "mcpServers": {
    "pentagonal": {
      "command": "npx",
      "args": ["-y", "pentagonal-mcp"],
      "env": {
        "PENTAGONAL_KEY": "<YOUR_API_KEY>"
      }
    }
  }
}`;

const MCP_CONFIG_HTTP = `{
  "mcpServers": {
    "pentagonal": {
      "type": "http",
      "url": "https://www.pentagonal.ai/api/mcp",
      "headers": {
        "x-pentagonal-api-key": "<YOUR_API_KEY>"
      }
    }
  }
}`;

const SUPPORTED_PLATFORMS = [
  {
    id: 'claude',
    name: 'Claude Desktop',
    icon: '◈',
    file: '~/Library/Application Support/Claude/claude_desktop_config.json',
    fileWin: '%APPDATA%\\Claude\\claude_desktop_config.json',
    config: MCP_CONFIG_STDIO,
    transport: 'stdio',
    color: '#d97757',
  },
  {
    id: 'claudecode',
    name: 'Claude Code',
    icon: '⌘',
    file: '~/.claude/settings.json',
    fileWin: '%USERPROFILE%\\.claude\\settings.json',
    config: MCP_CONFIG_HTTP,
    transport: 'http',
    color: '#d97757',
  },
  {
    id: 'cursor',
    name: 'Cursor',
    icon: '▶',
    file: '~/.cursor/mcp.json',
    fileWin: '%USERPROFILE%\\.cursor\\mcp.json',
    config: MCP_CONFIG_HTTP,
    transport: 'http',
    color: '#22d3ee',
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    icon: '◆',
    file: '~/.codeium/windsurf/mcp_config.json',
    fileWin: '%USERPROFILE%\\.codeium\\windsurf\\mcp_config.json',
    config: MCP_CONFIG_HTTP,
    transport: 'http',
    color: '#4ade80',
  },
  {
    id: 'gemini',
    name: 'Gemini CLI',
    icon: '✦',
    file: '~/.gemini/settings.json',
    fileWin: '%USERPROFILE%\\.gemini\\settings.json',
    config: MCP_CONFIG_STDIO,
    transport: 'stdio',
    color: '#818cf8',
  },
];

const TOOLS = [
  { name: 'pentagonal_lookup', desc: 'Token intelligence — price, holders, LP lock, honeypot, source code', icon: '🔍' },
  { name: 'pentagonal_generate', desc: 'Generate production smart contracts from natural language', icon: '✦' },
  { name: 'pentagonal_audit', desc: '8-agent security pen test with severity scoring', icon: '🛡' },
  { name: 'pentagonal_fix', desc: 'Remediate vulnerabilities with patched code', icon: '🔧' },
  { name: 'pentagonal_compile', desc: 'Compile to ABI + bytecode, deployment-ready', icon: '⚡' },
  { name: 'pentagonal_rules', desc: 'Access self-learning security knowledge base', icon: '📚' },
  { name: 'pentagonal_chains', desc: 'Query all supported chains and deployment targets', icon: '🔗' },
];

type ModalView = 'mcp' | 'skill';

export function MCPSetupSection() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalView, setModalView] = useState<ModalView>('mcp');
  const [selectedPlatform, setSelectedPlatform] = useState('claude');
  const [copied, setCopied] = useState(false);

  const platform = SUPPORTED_PLATFORMS.find(p => p.id === selectedPlatform) || SUPPORTED_PLATFORMS[0];

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(platform.config);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [platform.config]);

  const openModal = (view: ModalView) => {
    setModalView(view);
    setModalOpen(true);
  };

  return (
    <>
      <section className="marketing-section" id="mcp-setup">
        <div className="marketing-section-label">AI Integration</div>
        <h2 className="marketing-section-title">Add Pentagonal to your AI</h2>
        <p className="marketing-section-desc">
          Connect Pentagonal directly to your AI assistant via MCP or as a Claude Skill. Generate, audit, fix, and compile smart contracts without leaving your workflow.
        </p>

        {/* Tool showcase */}
        <div className="mcp-tools-grid">
          {TOOLS.map(tool => (
            <div key={tool.name} className="mcp-tool-card">
              <span className="mcp-tool-icon">{tool.icon}</span>
              <div>
                <div className="mcp-tool-name">{tool.name}</div>
                <div className="mcp-tool-desc">{tool.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Dual CTA buttons */}
        <div className="mcp-cta-row">
          <button className="mcp-cta-btn" onClick={() => openModal('mcp')}>
            <span className="mcp-cta-icon">⬡</span>
            Add MCP Server
            <span className="mcp-cta-arrow">→</span>
          </button>
          <button className="mcp-cta-btn mcp-cta-skill" onClick={() => openModal('skill')}>
            <span className="mcp-cta-icon">📜</span>
            Install Claude Skill
            <span className="mcp-cta-arrow">→</span>
          </button>
        </div>

        <p className="mcp-cta-sub">
          Works with Claude Desktop, Claude Code, Cursor, Windsurf, Gemini CLI, and any MCP-compatible client
        </p>
      </section>

      {/* ─── Modal ─── */}
      {modalOpen && (
        <div className="mcp-modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="mcp-modal" onClick={e => e.stopPropagation()}>
            <button className="mcp-modal-close" onClick={() => setModalOpen(false)}>×</button>

            {/* Tab switcher */}
            <div className="mcp-modal-tabs">
              <button
                className={`mcp-modal-tab ${modalView === 'mcp' ? 'active' : ''}`}
                onClick={() => setModalView('mcp')}
              >
                <span>⬡</span> MCP Server
              </button>
              <button
                className={`mcp-modal-tab ${modalView === 'skill' ? 'active' : ''}`}
                onClick={() => setModalView('skill')}
              >
                <span>📜</span> Claude Skill
              </button>
            </div>

            {/* ─── MCP Server View ─── */}
            {modalView === 'mcp' && (
              <>
                <div className="mcp-modal-header">
                  <span className="mcp-modal-icon">⬡</span>
                  <h3>Connect Pentagonal MCP</h3>
                  <p>Add the Pentagonal MCP server to your AI assistant in 3 steps</p>
                </div>

                {/* Platform picker */}
                <div className="mcp-platform-picker">
                  {SUPPORTED_PLATFORMS.map(p => (
                    <button
                      key={p.id}
                      className={`mcp-platform-btn ${selectedPlatform === p.id ? 'active' : ''}`}
                      onClick={() => setSelectedPlatform(p.id)}
                      style={{ '--platform-color': p.color } as React.CSSProperties}
                    >
                      <span className="mcp-platform-icon">{p.icon}</span>
                      {p.name}
                    </button>
                  ))}
                </div>

                {/* Steps */}
                <div className="mcp-steps">
                  <div className="mcp-step">
                    <div className="mcp-step-num">1</div>
                    <div className="mcp-step-content">
                      <div className="mcp-step-title">Get your API key</div>
                      <p className="mcp-step-desc">
                        Sign in at <a href="https://www.pentagonal.ai" style={{ color: '#d97757' }}>pentagonal.ai</a>, click your avatar → <strong>🔑 API Keys</strong>, and generate a key.
                      </p>
                    </div>
                  </div>

                  <div className="mcp-step">
                    <div className="mcp-step-num">2</div>
                    <div className="mcp-step-content">
                      <div className="mcp-step-title">Add to your {platform.name} config</div>
                      <div className="mcp-step-file">
                        <span className="mcp-step-file-label">Config file:</span>
                        <code>{platform.file}</code>
                      </div>
                      <div className="mcp-config-block">
                        <div className="mcp-config-header">
                          <span>JSON</span>
                          <button className="mcp-copy-btn" onClick={handleCopy}>
                            {copied ? '✓ Copied' : 'Copy'}
                          </button>
                        </div>
                        <pre className="mcp-config-code"><code>{platform.config}</code></pre>
                      </div>
                      <p className="mcp-step-note">
                        Replace <code>&lt;YOUR_API_KEY&gt;</code> with the key from step 1. No other dependencies needed.
                      </p>
                    </div>
                  </div>

                  <div className="mcp-step">
                    <div className="mcp-step-num">3</div>
                    <div className="mcp-step-content">
                      <div className="mcp-step-title">Restart {platform.name}</div>
                      <p className="mcp-step-desc">
                        Restart your AI assistant. Pentagonal&apos;s 7 tools will be available immediately. Try: <em>&ldquo;Generate a staking contract for Ethereum&rdquo;</em>
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ─── Claude Skill View ─── */}
            {modalView === 'skill' && (
              <>
                <div className="mcp-modal-header">
                  <span className="mcp-modal-icon">📜</span>
                  <h3>Install Pentagonal Skill</h3>
                  <p>Add the Pentagonal workflow skill to Claude.ai or Claude Code</p>
                </div>

                <div className="skill-install-options">
                  {/* Option 1: Claude.ai Web */}
                  <div className="skill-install-card">
                    <div className="skill-install-card-header">
                      <span className="skill-install-badge">Claude.ai</span>
                      <span className="skill-install-badge-sub">Web Interface</span>
                    </div>
                    <div className="mcp-steps">
                      <div className="mcp-step">
                        <div className="mcp-step-num">1</div>
                        <div className="mcp-step-content">
                          <div className="mcp-step-title">Download the skill package</div>
                          <a
                            href="https://github.com/Pentagonal-ai/pentagonal/releases/latest/download/pentagonal-clawd-skill.zip"
                            className="skill-download-btn"
                            download
                          >
                            <span>⬇</span>
                            Download pentagonal-clawd-skill.zip
                          </a>
                        </div>
                      </div>
                      <div className="mcp-step">
                        <div className="mcp-step-num">2</div>
                        <div className="mcp-step-content">
                          <div className="mcp-step-title">Upload to Claude.ai</div>
                          <p className="mcp-step-desc">
                            Go to <strong>Settings → Customize → Skills → +</strong> and select <em>&ldquo;Upload a skill&rdquo;</em>. Choose the downloaded ZIP file.
                          </p>
                        </div>
                      </div>
                      <div className="mcp-step">
                        <div className="mcp-step-num">3</div>
                        <div className="mcp-step-content">
                          <div className="mcp-step-title">Enable and use</div>
                          <p className="mcp-step-desc">
                            Toggle the skill <strong>ON</strong> in your Skills list. Claude will automatically use it when you ask about smart contracts. Try: <em>&ldquo;Build me a staking contract&rdquo;</em>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Option 2: Claude Code CLI */}
                  <div className="skill-install-card">
                    <div className="skill-install-card-header">
                      <span className="skill-install-badge" style={{ background: 'rgba(129,140,248,0.2)', color: '#818cf8' }}>Claude Code</span>
                      <span className="skill-install-badge-sub">CLI / Terminal</span>
                    </div>
                    <div className="mcp-steps">
                      <div className="mcp-step">
                        <div className="mcp-step-num">1</div>
                        <div className="mcp-step-content">
                          <div className="mcp-step-title">Clone and copy the skill folder</div>
                          <div className="mcp-step-code">
                            <code>git clone https://github.com/Pentagonal-ai/pentagonal</code>
                            <br />
                            <code>cp -r pentagonal/pentagonal-mcp/skill/. ~/.claude/skills/pentagonal/</code>
                          </div>
                        </div>
                      </div>
                      <div className="mcp-step">
                        <div className="mcp-step-num">2</div>
                        <div className="mcp-step-content">
                          <div className="mcp-step-title">Use with the /pentagonal command</div>
                          <p className="mcp-step-desc">
                            Type <code>/pentagonal</code> in Claude Code to invoke the skill, or Claude will auto-trigger it for smart contract tasks.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* What's included */}
                <div className="skill-contents">
                  <div className="skill-contents-title">What&apos;s in the skill package</div>
                  <div className="skill-contents-tree">
                    <div className="skill-tree-item">
                      <span className="skill-tree-icon">📁</span>
                      <span className="skill-tree-name">pentagonal/</span>
                    </div>
                    <div className="skill-tree-item skill-tree-child">
                      <span className="skill-tree-icon">📄</span>
                      <span className="skill-tree-name">SKILL.md</span>
                      <span className="skill-tree-desc">— Core workflow instructions + tool reference</span>
                    </div>
                    <div className="skill-tree-item skill-tree-child">
                      <span className="skill-tree-icon">📁</span>
                      <span className="skill-tree-name">references/</span>
                    </div>
                    <div className="skill-tree-item skill-tree-grandchild">
                      <span className="skill-tree-icon">📄</span>
                      <span className="skill-tree-name">deployment.md</span>
                      <span className="skill-tree-desc">— EVM & Solana deployment commands</span>
                    </div>
                    <div className="skill-tree-item skill-tree-grandchild">
                      <span className="skill-tree-icon">📄</span>
                      <span className="skill-tree-name">examples.md</span>
                      <span className="skill-tree-desc">— Example conversation flows</span>
                    </div>
                    <div className="skill-tree-item skill-tree-grandchild">
                      <span className="skill-tree-icon">📄</span>
                      <span className="skill-tree-name">security-rules.md</span>
                      <span className="skill-tree-desc">— 32 learned security rules</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
