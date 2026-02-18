import { useEffect } from "react";
import { useDataStore } from "../stores/dataStore";
import { Clock, Timer, CheckCircle, XCircle } from "lucide-react";

export function JobsPage() {
  const cronJobs = useDataStore((s) => s.cronJobs);
  const heartbeatChecks = useDataStore((s) => s.heartbeatChecks);
  const fetchJobs = useDataStore((s) => s.fetchJobs);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
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
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Schedule</th>
                  <th className="text-left p-3 font-medium">Payload</th>
                  <th className="text-left p-3 font-medium">Target</th>
                  <th className="text-left p-3 font-medium">Last Run</th>
                </tr>
              </thead>
              <tbody>
                {cronJobs.map((job) => (
                  <tr key={job.id} className="border-b border-surface-3/50 hover:bg-surface-2 transition-colors">
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
                    <td className="p-3 text-gray-400 text-xs">{job.sessionTarget}</td>
                    <td className="p-3 text-gray-500 text-xs">
                      {job.lastRun ? new Date(job.lastRun).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Heartbeat Checks */}
      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
          <Timer className="w-4 h-4" />
          Heartbeat Checks ({heartbeatChecks.length})
        </h3>
        <div className="bg-surface-1 rounded-lg border border-surface-3 p-4">
          {heartbeatChecks.length === 0 ? (
            <p className="text-sm text-gray-500">No heartbeat checks configured</p>
          ) : (
            <div className="space-y-2">
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
