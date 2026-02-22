import { useEffect, useState, useCallback } from "react";
import { useDataStore } from "../stores/dataStore";
import { Clock, Timer, CheckCircle, XCircle, ChevronDown, ChevronRight } from "lucide-react";
import { api } from "../api/client";

interface JobRun {
  id?: string;
  startedAt?: string;
  finishedAt?: string;
  status?: string;
  durationMs?: number;
  error?: string;
}

function JobRunHistory({ jobId }: { jobId: string }) {
  const [runs, setRuns] = useState<JobRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ runs: JobRun[] }>(`/api/jobs/runs/${jobId}`)
      .then((data) => setRuns(data.runs || []))
      .catch(() => setRuns([]))
      .finally(() => setLoading(false));
  }, [jobId]);

  if (loading) return <tr><td colSpan={6} className="p-3 text-xs text-gray-500">Loading run history...</td></tr>;
  if (runs.length === 0) return <tr><td colSpan={6} className="p-3 text-xs text-gray-500">No run history available</td></tr>;

  return (
    <tr>
      <td colSpan={6} className="px-3 pb-3">
        <div className="bg-surface-0 rounded-lg border border-surface-3 overflow-hidden">
          <div className="overflow-x-auto"><table className="w-full text-xs min-w-[500px]">
            <thead>
              <tr className="border-b border-surface-3 text-gray-600">
                <th className="text-left p-2 font-medium">Started</th>
                <th className="text-left p-2 font-medium">Duration</th>
                <th className="text-left p-2 font-medium">Status</th>
                <th className="text-left p-2 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run, i) => (
                <tr key={run.id || i} className="border-b border-surface-3/30">
                  <td className="p-2 text-gray-400">
                    {run.startedAt ? new Date(run.startedAt).toLocaleString() : "—"}
                  </td>
                  <td className="p-2 text-gray-400">
                    {run.durationMs != null ? `${(run.durationMs / 1000).toFixed(1)}s` : "—"}
                  </td>
                  <td className="p-2">
                    {run.status === "success" || run.status === "completed" ? (
                      <span className="text-status-idle">✓ Success</span>
                    ) : run.status === "failed" || run.status === "error" ? (
                      <span className="text-priority-urgent">✗ Failed</span>
                    ) : (
                      <span className="text-gray-500">{run.status || "unknown"}</span>
                    )}
                  </td>
                  <td className="p-2 text-gray-500 truncate max-w-[300px]">
                    {run.error || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      </td>
    </tr>
  );
}

export function JobsPage() {
  const cronJobs = useDataStore((s) => s.cronJobs);
  const heartbeatChecks = useDataStore((s) => s.heartbeatChecks);
  const fetchJobs = useDataStore((s) => s.fetchJobs);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const toggleJob = useCallback((id: string) => {
    setExpandedJob((prev) => (prev === id ? null : id));
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl mx-auto">
      <h1 className="text-xl font-semibold">Periodic Jobs</h1>

      {/* Cron Jobs */}
      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Cron Jobs ({cronJobs.length})
        </h3>
        <div className="bg-surface-1 rounded-lg border border-surface-3 overflow-hidden">
          {cronJobs.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">No cron jobs configured</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-3 text-gray-500 text-xs">
                  <th className="text-left p-3 font-medium w-6"></th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Schedule</th>
                  <th className="text-left p-3 font-medium">Payload</th>
                  <th className="text-left p-3 font-medium">Last Run</th>
                </tr>
              </thead>
              <tbody>
                {cronJobs.map((job) => (
                  <>
                    <tr
                      key={job.id}
                      className={`border-b border-surface-3/50 hover:bg-surface-2 transition-colors cursor-pointer ${expandedJob === job.id ? "bg-surface-2" : ""}`}
                      onClick={() => toggleJob(job.id)}
                    >
                      <td className="pl-3 pr-0">
                        {expandedJob === job.id ? (
                          <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                        )}
                      </td>
                      <td className="p-3">
                        {job.enabled ? (
                          <span className="flex items-center gap-1 text-status-idle text-xs">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Active
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-gray-600 text-xs">
                            <XCircle className="w-3.5 h-3.5" />
                            Disabled
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-gray-200">{job.name}</td>
                      <td className="p-3">
                        <code className="text-xs bg-surface-2 px-1.5 py-0.5 rounded text-accent">{job.schedule}</code>
                      </td>
                      <td className="p-3 text-gray-400 text-xs capitalize">{job.payload}</td>
                      <td className="p-3 text-gray-500 text-xs">
                        {job.lastRun ? new Date(job.lastRun).toLocaleString() : "—"}
                      </td>
                    </tr>
                    {expandedJob === job.id && <JobRunHistory key={`runs-${job.id}`} jobId={job.id} />}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Heartbeat */}
      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
          <Timer className="w-4 h-4" />
          Heartbeat
        </h3>
        <div className="bg-surface-1 rounded-lg border border-surface-3 p-4 space-y-4">
          {/* Status bar */}
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-status-idle animate-pulse" />
              <span className="text-gray-300">Every 1 minute</span>
            </div>
            <div className="text-gray-500">
              {heartbeatChecks.length} checks configured
            </div>
          </div>

          {/* Checks list */}
          {heartbeatChecks.length > 0 && (
            <div className="space-y-1.5">
              {heartbeatChecks.map((check, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                  <span className="text-gray-300">{check}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
