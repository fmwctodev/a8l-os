import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { DataSourceSelector } from '../../components/reporting/DataSourceSelector';
import { FieldPicker } from '../../components/reporting/FieldPicker';
import { FilterBuilder } from '../../components/reporting/FilterBuilder';
import { TimeRangePicker } from '../../components/reporting/TimeRangePicker';
import { ChartTypeSelector } from '../../components/reporting/ChartTypeSelector';
import { ReportTable } from '../../components/reporting/ReportTable';
import { ReportChart } from '../../components/reporting/ReportChart';
import {
  getDimensionsForDataSource,
  getMetricsForDataSource,
  visibilityOptions,
} from '../../config/reportingFields';
import { getReportById, createReport, updateReport } from '../../services/reports';
import { getReportPreview } from '../../services/reportEngine';
import type {
  ReportDataSource,
  ReportVisualizationType,
  ReportVisibility,
  ReportConfig,
  ReportDimension,
  ReportMetric,
  ReportFilter,
  ReportTimeRange,
  ReportSorting,
  ReportQueryResult,
  ReportDateGrouping,
} from '../../types';

const defaultTimeRange: ReportTimeRange = { type: 'preset', preset: 'last_30_days' };

export function ReportBuilder() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const isEditing = Boolean(id);

  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [name, setName] = useState('Untitled Report');
  const [description, setDescription] = useState('');
  const [dataSource, setDataSource] = useState<ReportDataSource | null>(null);
  const [visualizationType, setVisualizationType] = useState<ReportVisualizationType>('table');
  const [visibility, setVisibility] = useState<ReportVisibility>('private');

  const [selectedDimensions, setSelectedDimensions] = useState<ReportDimension[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<ReportMetric[]>([]);
  const [filters, setFilters] = useState<ReportFilter[]>([]);
  const [timeRange, setTimeRange] = useState<ReportTimeRange>(defaultTimeRange);
  const [sorting, setSorting] = useState<ReportSorting[]>([]);

  const [previewData, setPreviewData] = useState<ReportQueryResult | null>(null);

  const availableDimensions = dataSource ? getDimensionsForDataSource(dataSource) : [];
  const availableMetrics = dataSource ? getMetricsForDataSource(dataSource) : [];

  useEffect(() => {
    if (isEditing && id) {
      loadReport();
    }
  }, [id, isEditing]);

  const loadReport = async () => {
    try {
      setIsLoading(true);
      const report = await getReportById(id!);
      if (report) {
        setName(report.name);
        setDescription(report.description || '');
        setDataSource(report.data_source);
        setVisualizationType(report.visualization_type);
        setVisibility(report.visibility);
        setSelectedDimensions(report.config.dimensions);
        setSelectedMetrics(report.config.metrics);
        setFilters(report.config.filters);
        setTimeRange(report.config.timeRange);
        setSorting(report.config.sorting);
      }
    } catch (err) {
      console.error('Failed to load report:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const runPreview = useCallback(async () => {
    if (!dataSource || !user?.organization_id) return;
    if (selectedDimensions.length === 0 && selectedMetrics.length === 0) {
      setPreviewData(null);
      return;
    }

    try {
      setIsPreviewLoading(true);
      setPreviewError(null);

      const config: ReportConfig = {
        dimensions: selectedDimensions,
        metrics: selectedMetrics,
        filters,
        timeRange,
        sorting,
      };

      const result = await getReportPreview(user.organization_id, dataSource, config);
      setPreviewData(result);
    } catch (err) {
      console.error('Preview failed:', err);
      setPreviewError(err instanceof Error ? err.message : 'Preview failed');
      setPreviewData(null);
    } finally {
      setIsPreviewLoading(false);
    }
  }, [dataSource, selectedDimensions, selectedMetrics, filters, timeRange, sorting, user?.organization_id]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (dataSource && (selectedDimensions.length > 0 || selectedMetrics.length > 0)) {
        runPreview();
      }
    }, 500);
    return () => clearTimeout(debounce);
  }, [dataSource, selectedDimensions, selectedMetrics, filters, timeRange]);

  const handleDataSourceChange = (source: ReportDataSource) => {
    setDataSource(source);
    setSelectedDimensions([]);
    setSelectedMetrics([]);
    setFilters([]);
    setPreviewData(null);
  };

  const toggleDimension = (dim: ReportDimension | ReportMetric) => {
    const dimension = dim as ReportDimension;
    const exists = selectedDimensions.find((d) => d.id === dimension.id);
    if (exists) {
      setSelectedDimensions(selectedDimensions.filter((d) => d.id !== dimension.id));
    } else {
      setSelectedDimensions([...selectedDimensions, dimension]);
    }
  };

  const toggleMetric = (met: ReportDimension | ReportMetric) => {
    const metric = met as ReportMetric;
    const exists = selectedMetrics.find((m) => m.id === metric.id);
    if (exists) {
      setSelectedMetrics(selectedMetrics.filter((m) => m.id !== metric.id));
    } else {
      setSelectedMetrics([...selectedMetrics, metric]);
    }
  };

  const updateDimensionDateGrouping = (fieldId: string, grouping: ReportDateGrouping) => {
    setSelectedDimensions(
      selectedDimensions.map((d) =>
        d.id === fieldId ? { ...d, dateGrouping: grouping } : d
      )
    );
  };

  const addFilter = () => {
    const newFilter: ReportFilter = {
      id: `filter_${Date.now()}`,
      field: '',
      operator: 'equals',
      value: '',
      dataType: 'string',
    };
    setFilters([...filters, newFilter]);
  };

  const updateFilter = (index: number, filter: ReportFilter) => {
    const newFilters = [...filters];
    newFilters[index] = filter;
    setFilters(newFilters);
  };

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!dataSource || !user) return;

    try {
      setIsSaving(true);

      const config: ReportConfig = {
        dimensions: selectedDimensions,
        metrics: selectedMetrics,
        filters: filters.filter((f) => f.field),
        timeRange,
        sorting,
      };

      if (isEditing && id) {
        await updateReport(id, {
          name,
          description: description || undefined,
          data_source: dataSource,
          config,
          visualization_type: visualizationType,
          visibility,
        });
        navigate(`/reporting/${id}`);
      } else {
        const report = await createReport(user.organization_id, user.id, {
          name,
          description: description || undefined,
          data_source: dataSource,
          config,
          visualization_type: visualizationType,
          visibility,
        });
        navigate(`/reporting/${report.id}`);
      }
    } catch (err) {
      console.error('Failed to save report:', err);
      alert('Failed to save report');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/reporting')}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-xl font-bold text-slate-900 bg-transparent border-none focus:outline-none focus:ring-0 p-0"
              placeholder="Report Name"
            />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="block text-sm text-slate-500 bg-transparent border-none focus:outline-none focus:ring-0 p-0 w-96"
              placeholder="Add description..."
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ChartTypeSelector
            value={visualizationType}
            onChange={setVisualizationType}
          />

          <div className="w-px h-8 bg-slate-200" />

          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as ReportVisibility)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-2"
          >
            {visibilityOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            onClick={handleSave}
            disabled={isSaving || !dataSource || selectedMetrics.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 border-r border-slate-200 bg-slate-50 overflow-y-auto p-4 space-y-6">
          <DataSourceSelector
            value={dataSource}
            onChange={handleDataSourceChange}
          />

          {dataSource && (
            <>
              <FieldPicker
                title="Dimensions"
                type="dimension"
                availableFields={availableDimensions}
                selectedFields={selectedDimensions}
                onToggle={toggleDimension}
                onUpdateDateGrouping={updateDimensionDateGrouping}
              />

              <FieldPicker
                title="Metrics"
                type="metric"
                availableFields={availableMetrics}
                selectedFields={selectedMetrics}
                onToggle={toggleMetric}
              />

              <TimeRangePicker value={timeRange} onChange={setTimeRange} />

              <FilterBuilder
                filters={filters}
                availableFields={availableDimensions}
                onAdd={addFilter}
                onUpdate={updateFilter}
                onRemove={removeFilter}
              />
            </>
          )}
        </div>

        <div className="flex-1 p-6 overflow-y-auto bg-white">
          {!dataSource ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <RefreshCw className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-700 mb-2">Select a Data Source</h3>
                <p className="text-slate-500">Choose a data source from the left panel to begin</p>
              </div>
            </div>
          ) : selectedDimensions.length === 0 && selectedMetrics.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <RefreshCw className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-700 mb-2">Configure Your Report</h3>
                <p className="text-slate-500">Select dimensions and metrics to see a preview</p>
              </div>
            </div>
          ) : isPreviewLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="w-8 h-8 text-sky-500 animate-spin mx-auto mb-4" />
                <p className="text-slate-500">Running query...</p>
              </div>
            </div>
          ) : previewError ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-lg font-medium text-slate-700 mb-2">Query Error</h3>
                <p className="text-slate-500 mb-4">{previewError}</p>
                <button
                  onClick={runPreview}
                  className="text-sky-600 hover:text-sky-700"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : previewData ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-500">
                  {previewData.totalRows.toLocaleString()} rows in {previewData.executionTime}ms
                </div>
                <button
                  onClick={runPreview}
                  className="flex items-center gap-1.5 text-sm text-sky-600 hover:text-sky-700"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              </div>

              {visualizationType === 'table' ? (
                <ReportTable
                  data={previewData}
                  sorting={sorting}
                  onSortChange={setSorting}
                />
              ) : (
                <ReportChart
                  data={previewData}
                  visualizationType={visualizationType}
                />
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
