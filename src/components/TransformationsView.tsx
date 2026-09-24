import React, { useState } from 'react';
import { Connection, Transformation, TransformationRule } from '../types';
import {
  Wand2,
  Plus,
  Trash2,
  Edit2,
  Play,
  Sparkles,
  Layers,
  Code,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

interface TransformationsViewProps {
  transformations: Transformation[];
  connections: Connection[];
  onSaveTransformation: (data: any) => Promise<void>;
  onDeleteTransformation: (id: string) => Promise<void>;
  onPreviewTransformation: (trans: any, rawInput: string) => Promise<any>;
}

export const TransformationsView: React.FC<TransformationsViewProps> = ({
  transformations,
  connections,
  onSaveTransformation,
  onDeleteTransformation,
  onPreviewTransformation,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTrans, setEditingTrans] = useState<Transformation | null>(null);
  const [activeTab, setActiveTab] = useState<'visual' | 'template' | 'ai'>('visual');

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [connectionId, setConnectionId] = useState('');
  const [rules, setRules] = useState<TransformationRule[]>([]);
  const [templateJson, setTemplateJson] = useState('{\n  "name": "{{name}}",\n  "company": "{{company}}"\n}');
  const [aiInstructions, setAiInstructions] = useState('');
  const [sampleInput, setSampleInput] = useState('{\n  "full_name": "Jane Doe",\n  "company_name": "Acme Inc"\n}');
  const [previewOutput, setPreviewOutput] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const openCreateModal = () => {
    setEditingTrans(null);
    setName('');
    setDescription('');
    setConnectionId(connections[0]?.id || '');
    setRules([
      { id: '1', type: 'rename_field', source_field: 'full_name', target_field: 'name' },
      { id: '2', type: 'constant_value', target_field: 'source', value: 'just-in-time-connector' },
    ]);
    setTemplateJson('{\n  "name": "{{name}}",\n  "source": "just-in-time-connector"\n}');
    setAiInstructions('Extract name, company, email, and client request.');
    setSampleInput('{\n  "full_name": "Alex Mercer",\n  "company_name": "Cyber Inc"\n}');
    setPreviewOutput(null);
    setActiveTab('visual');
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (trans: Transformation) => {
    setEditingTrans(trans);
    setName(trans.name);
    setDescription(trans.description);
    setConnectionId(trans.connection_id || '');
    setRules(trans.rules || []);
    setTemplateJson(trans.template_json || '{\n  "name": "{{name}}"\n}');
    setAiInstructions(trans.ai_system_instructions || '');
    setSampleInput(trans.sample_input || '');
    setPreviewOutput(trans.sample_output || null);
    setActiveTab(trans.mode === 'template' ? 'template' : trans.mode === 'ai_prompt' ? 'ai' : 'visual');
    setError(null);
    setModalOpen(true);
  };

  const addRule = () => {
    const newRule: TransformationRule = {
      id: String(Date.now()),
      type: 'rename_field',
      source_field: '',
      target_field: '',
    };
    setRules([...rules, newRule]);
  };

  const updateRule = (id: string, updates: Partial<TransformationRule>) => {
    setRules(rules.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  const removeRule = (id: string) => {
    setRules(rules.filter((r) => r.id !== id));
  };

  const handleRunPreview = async () => {
    setPreviewing(true);
    setError(null);
    try {
      const mode = activeTab === 'template' ? 'template' : activeTab === 'ai' ? 'ai_prompt' : 'visual';
      const dummy = {
        mode,
        rules,
        template_json: templateJson,
        ai_system_instructions: aiInstructions,
      };
      const res = await onPreviewTransformation(dummy, sampleInput);
      setPreviewOutput(JSON.stringify(res.output, null, 2));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setPreviewing(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Transformation name is required.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const mode = activeTab === 'template' ? 'template' : activeTab === 'ai' ? 'ai_prompt' : 'visual';
      await onSaveTransformation({
        id: editingTrans?.id,
        name: name.trim(),
        description: description.trim(),
        connection_id: connectionId || undefined,
        mode,
        rules,
        template_json: templateJson,
        ai_system_instructions: aiInstructions,
        sample_input: sampleInput,
        sample_output: previewOutput || undefined,
      });
      setModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-indigo-400" />
            Payload Transformations
          </h1>
          <p className="text-xs text-slate-400">
            Convert natural language instructions or mismatched JSON payloads into the exact schema your API expects.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-cyan-500/20 hover:from-cyan-400 hover:to-indigo-500 transition flex items-center gap-1.5 self-start"
        >
          <Plus className="h-4 w-4" />
          Create Transformation
        </button>
      </div>

      {/* Grid of transformations */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {transformations.map((trans) => {
          const conn = connections.find((c) => c.id === trans.connection_id);
          return (
            <div
              key={trans.id}
              className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-5 hover:border-slate-700 transition space-y-4"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-950/60 border border-indigo-800/40 text-indigo-400">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white leading-tight">{trans.name}</h3>
                      <span className="text-[10px] text-slate-400">v{trans.version}</span>
                    </div>
                  </div>

                  <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300 uppercase">
                    {trans.mode}
                  </span>
                </div>

                <p className="mt-2 text-xs text-slate-400 line-clamp-2">
                  {trans.description || 'No description provided.'}
                </p>

                {conn && (
                  <div className="mt-3 inline-flex items-center gap-1 text-[11px] text-cyan-400 bg-cyan-950/30 px-2 py-1 rounded border border-cyan-800/40">
                    <span className="text-slate-400">Target:</span> {conn.name}
                  </div>
                )}

                {trans.mode === 'visual' && trans.rules?.length > 0 && (
                  <div className="mt-3 rounded-lg bg-slate-950/80 p-2.5 border border-slate-800 text-[11px] text-slate-300 space-y-1">
                    <div className="text-[10px] uppercase font-semibold text-slate-500">Rules ({trans.rules.length})</div>
                    {trans.rules.slice(0, 3).map((r, i) => (
                      <div key={i} className="flex items-center gap-1 text-[11px] font-mono text-slate-400 truncate">
                        <span className="text-indigo-400">{r.type}:</span> {r.source_field || ''} → {r.target_field || r.value || ''}
                      </div>
                    ))}
                    {trans.rules.length > 3 && (
                      <div className="text-[10px] text-slate-500 font-medium">+{trans.rules.length - 3} more rules</div>
                    )}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-800 pt-3 flex items-center justify-between">
                <button
                  onClick={() => openEditModal(trans)}
                  className="flex items-center gap-1 rounded bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-xs font-medium text-slate-200 transition"
                >
                  <Edit2 className="h-3 w-3" />
                  Edit & Preview
                </button>

                <button
                  onClick={() => onDeleteTransformation(trans.id)}
                  className="rounded p-1 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition"
                  title="Delete Transformation"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Editor Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-cyan-400" />
                {editingTrans ? 'Edit Transformation' : 'Create New Transformation'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            {error && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-3 text-rose-300 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Transformation Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Lead Extractor to HubSpot"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Associated Connection (Optional)</label>
                  <select
                    value={connectionId}
                    onChange={(e) => setConnectionId(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="">None (Standalone)</option>
                    {connections.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.http_method})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explains what this transformation formats"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              {/* Mode Tabs */}
              <div className="flex border-b border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('visual')}
                  className={`px-4 py-2 font-medium border-b-2 transition flex items-center gap-1.5 ${
                    activeTab === 'visual'
                      ? 'border-cyan-400 text-cyan-400'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" />
                  Visual Rule Builder
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('template')}
                  className={`px-4 py-2 font-medium border-b-2 transition flex items-center gap-1.5 ${
                    activeTab === 'template'
                      ? 'border-cyan-400 text-cyan-400'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <Code className="h-3.5 w-3.5" />
                  JSON Template Mode
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('ai')}
                  className={`px-4 py-2 font-medium border-b-2 transition flex items-center gap-1.5 ${
                    activeTab === 'ai'
                      ? 'border-cyan-400 text-cyan-400'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  AI Natural-Language Guide
                </button>
              </div>

              {/* Tab 1: Visual Rule Builder */}
              {activeTab === 'visual' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-xs">Transform fields deterministically without code</span>
                    <button
                      type="button"
                      onClick={addRule}
                      className="rounded bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-xs text-slate-200 transition flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      Add Rule
                    </button>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto p-1">
                    {rules.map((rule) => (
                      <div
                        key={rule.id}
                        className="grid grid-cols-12 gap-2 items-center rounded-lg border border-slate-800 bg-slate-950 p-2.5"
                      >
                        <div className="col-span-3">
                          <select
                            value={rule.type}
                            onChange={(e) => updateRule(rule.id, { type: e.target.value })}
                            className="w-full rounded border border-slate-800 bg-slate-900 px-2 py-1 text-white text-[11px]"
                          >
                            <option value="rename_field">Rename Field</option>
                            <option value="remove_field">Remove Field</option>
                            <option value="constant_value">Constant Value</option>
                            <option value="trim_text">Trim Text</option>
                            <option value="lowercase">Lowercase</option>
                            <option value="uppercase">Uppercase</option>
                            <option value="to_number">Convert to Number</option>
                            <option value="to_boolean">Convert to Boolean</option>
                            <option value="set_default">Set Default Value</option>
                          </select>
                        </div>

                        <div className="col-span-4">
                          <input
                            type="text"
                            placeholder="Source field (e.g. full_name)"
                            value={rule.source_field || ''}
                            onChange={(e) => updateRule(rule.id, { source_field: e.target.value })}
                            className="w-full rounded border border-slate-800 bg-slate-900 px-2 py-1 text-white text-[11px] font-mono"
                          />
                        </div>

                        <div className="col-span-4">
                          <input
                            type="text"
                            placeholder={
                              rule.type === 'constant_value' || rule.type === 'set_default'
                                ? 'Target field = Value'
                                : 'Target field (e.g. name)'
                            }
                            value={(rule.target_field || rule.value || '') as string}
                            onChange={(e) =>
                              updateRule(rule.id, {
                                target_field: e.target.value,
                                value: e.target.value,
                              })
                            }
                            className="w-full rounded border border-slate-800 bg-slate-900 px-2 py-1 text-white text-[11px] font-mono"
                          />
                        </div>

                        <div className="col-span-1 text-right">
                          <button
                            type="button"
                            onClick={() => removeRule(rule.id)}
                            className="text-slate-500 hover:text-rose-400 p-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {rules.length === 0 && (
                      <p className="text-center py-4 text-slate-500">No rules added yet. Click &ldquo;Add Rule&rdquo; above.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 2: Template Mode */}
              {activeTab === 'template' && (
                <div className="space-y-2">
                  <label className="block text-slate-300 font-semibold">
                    JSON Template (use &ldquo;{'{{fieldName}}'}&rdquo; for string interpolation)
                  </label>
                  <textarea
                    rows={6}
                    value={templateJson}
                    onChange={(e) => setTemplateJson(e.target.value)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-cyan-300 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              )}

              {/* Tab 3: AI Natural-Language Guide */}
              {activeTab === 'ai' && (
                <div className="space-y-2">
                  <label className="block text-slate-300 font-semibold">
                    AI Schema Guidance (Gemini 3.8 Flash Extraction Prompt)
                  </label>
                  <textarea
                    rows={4}
                    value={aiInstructions}
                    onChange={(e) => setAiInstructions(e.target.value)}
                    placeholder="e.g. Extract name, company, email, phone, and request. Map priority to 'HIGH' if client indicates urgency."
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 p-3 text-white focus:border-cyan-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-500">
                    When free-form text or ChatGPT voice summaries are received, Gemini analyzes the input using these
                    guidelines.
                  </p>
                </div>
              )}

              {/* Live Preview Sandbox */}
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Play className="h-3.5 w-3.5 text-emerald-400" />
                    Live Transformation Preview
                  </span>
                  <button
                    type="button"
                    onClick={handleRunPreview}
                    disabled={previewing}
                    className="rounded bg-indigo-600 hover:bg-indigo-500 px-3 py-1 font-semibold text-white transition flex items-center gap-1 disabled:opacity-50"
                  >
                    {previewing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    Run Preview
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                      Sample Input (JSON or Plain Text)
                    </span>
                    <textarea
                      rows={5}
                      value={sampleInput}
                      onChange={(e) => setSampleInput(e.target.value)}
                      className="w-full rounded border border-slate-800 bg-slate-900 p-2 font-mono text-[11px] text-slate-200 focus:outline-none"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-semibold text-emerald-400 block mb-1">
                      Transformed Output
                    </span>
                    <pre className="w-full h-[106px] overflow-y-auto rounded border border-slate-800 bg-slate-900 p-2 font-mono text-[11px] text-emerald-300">
                      {previewOutput || '// Click "Run Preview" to test output'}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="border-t border-slate-800 pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-cyan-500 hover:bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 transition disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingTrans ? 'Save Changes' : 'Create Transformation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
