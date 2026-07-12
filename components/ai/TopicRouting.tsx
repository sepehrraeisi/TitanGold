import React, { useState, useEffect, useMemo } from 'react';
import type { TopicRoutingRule, TopicRoutingLog } from '../../types.ts';
import * as api from '../../services/api.ts';
import { useLanguage } from '../../context/LanguageContext.tsx';
import { useAppContext } from '../../context/AppContext.tsx';
import { canWriteTopicRouting } from '../../utils/agentPermissions.ts';

const TopicRouting: React.FC = () => {
    const { t } = useLanguage();
    const { user } = useAppContext();
    const canWrite = canWriteTopicRouting(user?.role);
    const [agentOptions, setAgentOptions] = useState<Array<{ key: string; label: string }>>([]);
    const [rules, setRules] = useState<TopicRoutingRule[]>([]);
    const [logs, setLogs] = useState<TopicRoutingLog[]>([]);
    const [totalLogs, setTotalLogs] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'rules' | 'logs'>('rules');

    // Modal states
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedRule, setSelectedRule] = useState<TopicRoutingRule | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        keywords: [] as string[],
        agent_key: '',
        priority: 50,
        is_active: true
    });
    const [keywordInput, setKeywordInput] = useState('');

    // Logs pagination
    const [logsPage, setLogsPage] = useState(0);
    const [logsLimit] = useState(20);

    useEffect(() => {
        loadRules();
        api.fetchAIAgents()
            .then((agents) => {
                setAgentOptions(
                    agents
                        .filter((a) => a.agent_key)
                        .map((a) => ({ key: a.agent_key!, label: a.name || a.agent_key! }))
                        .sort((a, b) => a.label.localeCompare(b.label)),
                );
            })
            .catch(() => setAgentOptions([]));
    }, []);

    useEffect(() => {
        if (activeTab === 'logs') {
            loadLogs();
        }
    }, [activeTab, logsPage]);

    const loadRules = async () => {
        try {
            setIsLoading(true);
            const response = await api.fetchTopicRoutingRules();
            setRules(response.rules || []);
        } catch (error) {
            console.error('Failed to load rules:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadLogs = async () => {
        try {
            const response = await api.fetchTopicRoutingLogs(logsLimit, logsPage * logsLimit);
            setLogs(response.logs || []);
            setTotalLogs(response.total || 0);
        } catch (error) {
            console.error('Failed to load logs:', error);
        }
    };

    const handleCreate = () => {
        setFormData({
            name: '',
            keywords: [],
            agent_key: '',
            priority: 50,
            is_active: true
        });
        setKeywordInput('');
        setShowCreateModal(true);
    };

    const handleEdit = (rule: TopicRoutingRule) => {
        setSelectedRule(rule);
        setFormData({
            name: rule.name,
            keywords: rule.keywords,
            agent_key: rule.agent_key,
            priority: rule.priority,
            is_active: rule.is_active
        });
        setKeywordInput('');
        setShowEditModal(true);
    };

    const handleDelete = (rule: TopicRoutingRule) => {
        setSelectedRule(rule);
        setShowDeleteModal(true);
    };

    const handleSubmitCreate = async () => {
        try {
            await api.createTopicRoutingRule(formData);
            setShowCreateModal(false);
            await loadRules();
        } catch (error) {
            console.error('Failed to create rule:', error);
            alert('Failed to create rule');
        }
    };

    const handleSubmitEdit = async () => {
        if (!selectedRule) return;
        try {
            await api.updateTopicRoutingRule(selectedRule.id, formData);
            setShowEditModal(false);
            await loadRules();
        } catch (error) {
            console.error('Failed to update rule:', error);
            alert('Failed to update rule');
        }
    };

    const handleSubmitDelete = async () => {
        if (!selectedRule) return;
        try {
            await api.deleteTopicRoutingRule(selectedRule.id);
            setShowDeleteModal(false);
            await loadRules();
        } catch (error) {
            console.error('Failed to delete rule:', error);
            alert('Failed to delete rule');
        }
    };

    const handleAddKeyword = () => {
        if (keywordInput.trim() && !formData.keywords.includes(keywordInput.trim())) {
            setFormData(prev => ({
                ...prev,
                keywords: [...prev.keywords, keywordInput.trim()]
            }));
            setKeywordInput('');
        }
    };

    const handleRemoveKeyword = (keyword: string) => {
        setFormData(prev => ({
            ...prev,
            keywords: prev.keywords.filter(k => k !== keyword)
        }));
    };

    const handleToggleActive = async (rule: TopicRoutingRule) => {
        try {
            await api.updateTopicRoutingRule(rule.id, {
                is_active: !rule.is_active
            });
            await loadRules();
        } catch (error) {
            console.error('Failed to toggle rule:', error);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="text-foreground">Loading...</div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Topic Routing</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Automatically route data to AI agents based on keywords
                    </p>
                </div>
                {canWrite ? (
                    <button
                        onClick={handleCreate}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium"
                    >
                        + {t('create_rule') || 'Create Rule'}
                    </button>
                ) : (
                    <span className="text-xs text-muted-foreground px-3 py-2 rounded-lg border border-border bg-muted/30" role="status">
                        {t('topic_routing_read_only') || 'Read-only — admin required to modify routing rules'}
                    </span>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-border">
                <button
                    onClick={() => setActiveTab('rules')}
                    className={`px-4 py-2 font-medium transition-colors ${activeTab === 'rules'
                            ? 'text-primary border-b-2 border-primary'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                >
                    Routing Rules ({rules.length})
                </button>
                <button
                    onClick={() => setActiveTab('logs')}
                    className={`px-4 py-2 font-medium transition-colors ${activeTab === 'logs'
                            ? 'text-primary border-b-2 border-primary'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                >
                    Routing Logs ({totalLogs})
                </button>
            </div>

            {/* Rules Tab */}
            {activeTab === 'rules' && (
                <div className="space-y-4">
                    {rules.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            No routing rules configured. Create one to get started.
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {rules.map(rule => (
                                <div
                                    key={rule.id}
                                    className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className="text-lg font-semibold text-foreground">
                                                    {rule.name}
                                                </h3>
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${rule.is_active
                                                        ? 'bg-green-500/20 text-green-400'
                                                        : 'bg-gray-500/20 text-gray-400'
                                                    }`}>
                                                    {rule.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-400">
                                                    Priority: {rule.priority}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-2 mb-2">
                                                {rule.keywords.map((keyword, idx) => (
                                                    <span
                                                        key={idx}
                                                        className="px-2 py-1 bg-primary/20 text-primary rounded text-sm font-mono"
                                                    >
                                                        {keyword}
                                                    </span>
                                                ))}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                Routes to: <span className="text-foreground font-medium">
                                                    {agentOptions.find(a => a.key === rule.agent_key)?.label || rule.agent_key}
                                                </span>
                                            </div>
                                        </div>
                                        {canWrite && (
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleToggleActive(rule)}
                                                className="p-2 hover:bg-muted rounded"
                                                title={rule.is_active ? 'Deactivate' : 'Activate'}
                                            >
                                                {rule.is_active ? '⏸' : '▶'}
                                            </button>
                                            <button
                                                onClick={() => handleEdit(rule)}
                                                className="p-2 hover:bg-muted rounded"
                                                title="Edit"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                onClick={() => handleDelete(rule)}
                                                className="p-2 hover:bg-destructive/20 text-destructive rounded"
                                                title="Delete"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Logs Tab */}
            {activeTab === 'logs' && (
                <div className="space-y-4">
                    {logs.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            No routing decisions logged yet.
                        </div>
                    ) : (
                        <>
                            <div className="bg-card border border-border rounded-lg overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-muted">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Time</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Rule</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Matched Keywords</th>
                                            <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Agent</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {logs.map(log => (
                                            <tr key={log.id} className="hover:bg-muted/50">
                                                <td className="px-4 py-3 text-sm text-muted-foreground">
                                                    {new Date(log.created_at).toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-foreground">
                                                    {log.rule_name || 'N/A'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-wrap gap-1">
                                                        {log.matched_keywords.map((kw, idx) => (
                                                            <span key={idx} className="px-2 py-0.5 bg-primary/20 text-primary rounded text-xs">
                                                                {kw}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-foreground">
                                                    {agentOptions.find(a => a.key === log.agent_key)?.label || log.agent_key}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-muted-foreground">
                                    Showing {logsPage * logsLimit + 1}-{Math.min((logsPage + 1) * logsLimit, totalLogs)} of {totalLogs}
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setLogsPage(Math.max(0, logsPage - 1))}
                                        disabled={logsPage === 0}
                                        className="px-3 py-1 bg-muted text-foreground rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Previous
                                    </button>
                                    <button
                                        onClick={() => setLogsPage(logsPage + 1)}
                                        disabled={(logsPage + 1) * logsLimit >= totalLogs}
                                        className="px-3 py-1 bg-muted text-foreground rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Create/Edit Modal */}
            {(showCreateModal || showEditModal) && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-card border border-border rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold text-foreground mb-4">
                            {showCreateModal ? 'Create Routing Rule' : 'Edit Routing Rule'}
                        </h3>

                        <div className="space-y-4">
                            {/* Name */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Rule Name
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 bg-background border border-border rounded text-foreground"
                                    placeholder="e.g., Bitcoin Market Intelligence"
                                />
                            </div>

                            {/* Keywords */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Keywords
                                </label>
                                <div className="flex gap-2 mb-2">
                                    <input
                                        type="text"
                                        value={keywordInput}
                                        onChange={(e) => setKeywordInput(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleAddKeyword()}
                                        className="flex-1 px-3 py-2 bg-background border border-border rounded text-foreground"
                                        placeholder="Enter keyword and press Enter"
                                    />
                                    <button
                                        onClick={handleAddKeyword}
                                        className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                                    >
                                        Add
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {formData.keywords.map((keyword, idx) => (
                                        <span
                                            key={idx}
                                            className="px-2 py-1 bg-primary/20 text-primary rounded text-sm flex items-center gap-1"
                                        >
                                            {keyword}
                                            <button
                                                onClick={() => handleRemoveKeyword(keyword)}
                                                className="ml-1 hover:text-destructive"
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Agent */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Target Agent
                                </label>
                                <select
                                    value={formData.agent_key}
                                    onChange={(e) => setFormData({ ...formData, agent_key: e.target.value })}
                                    className="w-full px-3 py-2 bg-background border border-border rounded text-foreground"
                                >
                                    <option value="">Select an agent...</option>
                                    {agentOptions.map(agent => (
                                        <option key={agent.key} value={agent.key}>
                                            {agent.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Priority */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Priority: {formData.priority}
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="150"
                                    value={formData.priority}
                                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                                    className="w-full"
                                />
                                <div className="text-xs text-muted-foreground">
                                    Higher priority rules are checked first
                                </div>
                            </div>

                            {/* Active */}
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={formData.is_active}
                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                    className="w-4 h-4"
                                />
                                <label className="text-sm font-medium text-foreground">
                                    Rule is active
                                </label>
                            </div>
                        </div>

                        <div className="flex gap-2 mt-6">
                            <button
                                onClick={showCreateModal ? handleSubmitCreate : handleSubmitEdit}
                                disabled={!formData.name || formData.keywords.length === 0 || !formData.agent_key}
                                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {showCreateModal ? 'Create' : 'Save'}
                            </button>
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setShowEditModal(false);
                                }}
                                className="px-4 py-2 bg-muted text-foreground rounded hover:bg-muted/80"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && selectedRule && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4">
                        <h3 className="text-xl font-bold text-foreground mb-4">Delete Routing Rule</h3>
                        <p className="text-foreground mb-6">
                            Are you sure you want to delete the rule "{selectedRule.name}"?
                            This action cannot be undone.
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={handleSubmitDelete}
                                className="px-4 py-2 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90"
                            >
                                Delete
                            </button>
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className="px-4 py-2 bg-muted text-foreground rounded hover:bg-muted/80"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TopicRouting;
