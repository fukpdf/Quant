import { useState } from "react";
import {
  useListIncidents,
  useGetIncident,
  useInvestigateIncident,
  useResolveIncident,
  useAddIncidentUpdate,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function IncidentsPage() {
  const queryClient = useQueryClient();
  const { data: incidentsRes, isLoading } = useListIncidents();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [updateText, setUpdateText] = useState("");

  const { data: incidentDetail, isLoading: isLoadingDetail } = useGetIncident(
    selectedId || "",
    { query: { enabled: !!selectedId } as any }
  );

  const invInc = useInvestigateIncident();
  const resInc = useResolveIncident();
  const addUpdate = useAddIncidentUpdate();

  const handleInvestigate = () => {
    if (selectedId)
      invInc.mutate({ id: selectedId }, { onSuccess: () => queryClient.invalidateQueries() });
  };
  const handleResolve = () => {
    if (selectedId)
      resInc.mutate(
        { id: selectedId, data: { resolution: "Resolved from dashboard" } },
        { onSuccess: () => queryClient.invalidateQueries() }
      );
  };
  const submitUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedId && updateText) {
      addUpdate.mutate(
        { id: selectedId, data: { message: updateText } },
        {
          onSuccess: () => {
            setUpdateText("");
            queryClient.invalidateQueries();
          },
        }
      );
    }
  };

  const detail = incidentDetail?.data;

  return (
    <div className="p-6">
      <PageHeader title="Incident Tracking" subtitle="Active incidents and resolution workflow" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-medium mb-3">All Incidents</h3>
          <DataTable
            data={incidentsRes?.data || []}
            isLoading={isLoading}
            onRowClick={(inc) => setSelectedId(inc.id ?? null)}
            columns={[
              { header: "Title", accessorKey: "title", className: "font-medium" },
              {
                header: "Sev",
                cell: (i) => <Badge variant={i.severity as any}>{i.severity}</Badge>,
              },
              {
                header: "Status",
                cell: (i) => <Badge variant="outline">{i.status}</Badge>,
              },
              {
                header: "Opened",
                cell: (i) =>
                  i.createdAt
                    ? format(new Date(i.createdAt), "MM/dd HH:mm")
                    : "—",
              },
            ]}
          />
        </div>

        <div>
          <h3 className="text-lg font-medium mb-3">Incident Details</h3>
          {!selectedId ? (
            <div className="p-8 text-center text-muted-foreground border border-border rounded-md bg-card">
              Select an incident
            </div>
          ) : isLoadingDetail ? (
            <div className="p-8 text-center text-muted-foreground border border-border rounded-md bg-card">
              Loading...
            </div>
          ) : detail ? (
            <div className="border border-border rounded-md bg-card p-4">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="font-bold text-lg">{detail.title}</h4>
                  <p className="text-sm text-muted-foreground">{detail.description}</p>
                </div>
                <div className="flex gap-2">
                  {detail.status === "open" && (
                    <button
                      onClick={handleInvestigate}
                      className="bg-secondary px-3 py-1 text-sm rounded hover:bg-secondary/80"
                    >
                      Investigate
                    </button>
                  )}
                  {detail.status !== "resolved" && (
                    <button
                      onClick={handleResolve}
                      className="bg-primary text-primary-foreground px-3 py-1 text-sm rounded hover:bg-primary/80"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </div>

              {detail.affectedServices && detail.affectedServices.length > 0 && (
                <div className="mb-4 flex gap-2 flex-wrap">
                  {detail.affectedServices.map((svc) => (
                    <Badge key={svc} variant="secondary">{svc}</Badge>
                  ))}
                </div>
              )}

              <div className="mb-4">
                <h5 className="font-medium text-sm mb-2">Timeline</h5>
                <div className="space-y-3 pl-2 border-l-2 border-muted">
                  {(detail.timeline ?? []).map((item: any) => (
                    <div key={item.id} className="relative pl-4">
                      <div className="absolute w-2 h-2 rounded-full bg-primary -left-[5px] top-1.5" />
                      <p className="text-xs text-muted-foreground mb-0.5">
                        {item.createdAt
                          ? format(new Date(item.createdAt), "MMM dd, HH:mm:ss")
                          : "—"}
                      </p>
                      <p className="text-sm">{item.message}</p>
                    </div>
                  ))}
                </div>
              </div>

              {detail.status !== "resolved" && (
                <form
                  onSubmit={submitUpdate}
                  className="flex gap-2 mt-4 pt-4 border-t border-border"
                >
                  <input
                    type="text"
                    value={updateText}
                    onChange={(e) => setUpdateText(e.target.value)}
                    placeholder="Add an update..."
                    className="flex-1 bg-input border border-border rounded px-3 py-1 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={!updateText}
                    className="bg-primary text-primary-foreground px-3 py-1 text-sm rounded disabled:opacity-50"
                  >
                    Post
                  </button>
                </form>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
