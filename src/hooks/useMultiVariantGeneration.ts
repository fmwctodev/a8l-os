import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { MediaGenerationJob, MediaAsset, CreateJobParams } from '../services/mediaGeneration';
import { createGenerationJob, getJobStatus, isJobActive } from '../services/mediaGeneration';
import { usePlatformMediaDefaults } from './usePlatformMediaDefaults';

interface VariantStatus {
  platform: string;
  contentFormat: string;
  jobId: string | null;
  status: 'pending' | 'generating' | 'success' | 'fail';
  assets: MediaAsset[];
  error?: string;
}

interface MultiVariantState {
  parentJobId: string | null;
  basePrompt: string;
  variants: VariantStatus[];
  overallStatus: 'idle' | 'processing' | 'completed' | 'partial_fail' | 'failed';
}

export function useMultiVariantGeneration(
  organizationId: string | undefined,
  userId: string | undefined,
  platforms: string[]
) {
  const { getPresetsForPlatforms, loading: defaultsLoading } =
    usePlatformMediaDefaults(platforms);
  const [state, setState] = useState<MultiVariantState>({
    parentJobId: null,
    basePrompt: '',
    variants: [],
    overallStatus: 'idle',
  });
  const pollingRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  useEffect(() => {
    return () => {
      Object.values(pollingRef.current).forEach(clearInterval);
    };
  }, []);

  const startMultiVariant = useCallback(
    async (
      basePrompt: string,
      contentFormat = 'feed_post',
      brandKitId?: string,
      sourceUploadId?: string
    ) => {
      if (!organizationId || !userId || platforms.length === 0) return;

      const presets = getPresetsForPlatforms(contentFormat);
      if (presets.length === 0) return;

      const { data: parentJob, error: parentError } = await supabase
        .from('multi_variant_jobs')
        .insert({
          organization_id: organizationId,
          created_by: userId,
          base_prompt: basePrompt,
          platforms: platforms,
          status: 'processing',
          total_variants: presets.length,
          completed_variants: 0,
          brand_kit_id: brandKitId || null,
          source_upload_id: sourceUploadId || null,
        })
        .select()
        .single();

      if (parentError || !parentJob) {
        console.error('Failed to create multi-variant parent job:', parentError);
        return;
      }

      const variants: VariantStatus[] = presets.map((preset) => ({
        platform: preset.platform,
        contentFormat: preset.contentFormat,
        jobId: null,
        status: 'pending' as const,
        assets: [],
      }));

      setState({
        parentJobId: parentJob.id,
        basePrompt,
        variants,
        overallStatus: 'processing',
      });

      for (let i = 0; i < presets.length; i++) {
        const preset = presets[i];
        if (!preset.model) {
          variants[i].status = 'fail';
          variants[i].error = 'No recommended model for this platform';
          continue;
        }

        const adaptedPrompt = preset.promptSuffix
          ? `${basePrompt} ${preset.promptSuffix}`
          : basePrompt;

        try {
          const params: CreateJobParams = {
            model_id: preset.model.id,
            prompt: adaptedPrompt,
            aspect_ratio: preset.aspectRatio || undefined,
            resolution: preset.resolution || undefined,
            duration: preset.duration || undefined,
            brand_kit_id: brandKitId,
          };

          const job = await createGenerationJob(params);
          variants[i].jobId = job.id;
          variants[i].status = 'generating';

          await supabase.from('multi_variant_children').insert({
            parent_job_id: parentJob.id,
            platform: preset.platform,
            content_format: preset.contentFormat,
            generation_job_id: job.id,
            adapted_prompt: adaptedPrompt,
            aspect_ratio: preset.aspectRatio,
            resolution: preset.resolution,
            duration: preset.duration,
            status: 'generating',
          });

          pollingRef.current[job.id] = setInterval(
            () => pollVariantJob(job.id, i, parentJob.id),
            5000
          );
        } catch (err) {
          variants[i].status = 'fail';
          variants[i].error =
            err instanceof Error ? err.message : 'Failed to start generation';
        }
      }

      setState((prev) => ({ ...prev, variants: [...variants] }));
    },
    [organizationId, userId, platforms, getPresetsForPlatforms]
  );

  async function pollVariantJob(
    jobId: string,
    variantIndex: number,
    parentJobId: string
  ) {
    try {
      const result = await getJobStatus(jobId);
      if (!isJobActive(result.job.status)) {
        clearInterval(pollingRef.current[jobId]);
        delete pollingRef.current[jobId];

        setState((prev) => {
          const newVariants = [...prev.variants];
          newVariants[variantIndex] = {
            ...newVariants[variantIndex],
            status: result.job.status === 'success' ? 'success' : 'fail',
            assets: result.assets,
            error: result.job.error_message || undefined,
          };

          const completedCount = newVariants.filter(
            (v) => v.status === 'success' || v.status === 'fail'
          ).length;
          const successCount = newVariants.filter(
            (v) => v.status === 'success'
          ).length;
          const allDone = completedCount === newVariants.length;

          let overallStatus = prev.overallStatus;
          if (allDone) {
            overallStatus =
              successCount === newVariants.length
                ? 'completed'
                : successCount > 0
                  ? 'partial_fail'
                  : 'failed';

            supabase
              .from('multi_variant_jobs')
              .update({
                status: overallStatus,
                completed_variants: completedCount,
                completed_at: new Date().toISOString(),
              })
              .eq('id', parentJobId)
              .then(() => {});
          } else {
            supabase
              .from('multi_variant_jobs')
              .update({ completed_variants: completedCount })
              .eq('id', parentJobId)
              .then(() => {});
          }

          return {
            ...prev,
            variants: newVariants,
            overallStatus: allDone ? overallStatus : 'processing',
          };
        });

        await supabase
          .from('multi_variant_children')
          .update({
            status: result.job.status === 'success' ? 'success' : 'fail',
          })
          .eq('generation_job_id', jobId);
      }
    } catch (err) {
      console.error('Multi-variant poll error:', err);
    }
  }

  const reset = useCallback(() => {
    Object.values(pollingRef.current).forEach(clearInterval);
    pollingRef.current = {};
    setState({
      parentJobId: null,
      basePrompt: '',
      variants: [],
      overallStatus: 'idle',
    });
  }, []);

  return {
    state,
    startMultiVariant,
    reset,
    isProcessing: state.overallStatus === 'processing',
    defaultsLoading,
  };
}
